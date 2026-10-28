import { useEffect, useRef, useState } from "react"
import { decide, storageValue, type DecideInput } from "../lib/decide"
import { money, monthLabel, quantityLabel } from "../lib/format"
import { readCosts, withPrice, type CostOverrides } from "../lib/outlook"
import type { Assumption, Bundle, CropForecast } from "../types"
import type { Compare, View } from "../App"
import { Dot } from "../components/Icons"
import { BeansPic, MaizePic, SackPic, SealedSackPic, WarehousePic } from "../components/Illustrations"
import { PastDots, RiskMeter, Spark, ValueBars } from "../components/Charts"

type T = (key: string, vars?: Record<string, string | number>) => string

const DISTRICTS = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]
const CROPS = [
  ["maize", MaizePic],
  ["beans", BeansPic],
] as const
const OPTIONS = [
  ["home_bags", "decide.home", SackPic],
  ["hermetic_bags", "decide.hermetic", SealedSackPic],
  ["warehouse", "decide.warehouse", WarehousePic],
] as const

function defaultFor(items: Assumption[], storageId: string, field: string) {
  return items.find((item) => item.option === storageId && item.field === field)?.value ?? null
}

function inputFor(items: Assumption[], forecast: CropForecast, quantityKg: number, needsCash: boolean, storageId: string, costs: CostOverrides): DecideInput {
  const options = OPTIONS.filter(([id]) => id === storageId).map(([id]) => {
    const read = (field: string) => defaultFor(items, id, field)
    return {
      id,
      loss_monthly: costs.loss_monthly ?? read("loss_monthly"),
      fee: read("fee"),
      cost_per_kg: costs.cost_per_kg ?? read("cost_per_kg"),
      interest_annual: costs.interest_annual ?? read("interest_annual"),
      borrow_share: read("borrow_share"),
    }
  })
  const gate = (field: string) => items.find((item) => item.field === field && item.option == null)?.value ?? 0
  const forecasts: DecideInput["forecasts"] = {}
  for (const [horizon, value] of Object.entries(forecast.horizons ?? {})) {
    forecasts[horizon] = { p10: value.p10, p50: value.p50, p90: value.p90 }
  }
  return {
    quantity_kg: quantityKg,
    price_now: forecast.price_now ?? 0,
    needs_cash_now: needsCash,
    g_min: Number(gate("g_min")),
    d_max: Number(gate("d_max")),
    options,
    forecasts,
  }
}

/** What storing would bring at its best horizon, after costs when the option is priced. */
function compareFor(input: DecideInput, forecast: CropForecast): Compare {
  const option = input.options[0]
  const priced = option && option.loss_monthly != null && option.fee != null && option.cost_per_kg != null && option.borrow_share != null && !(option.borrow_share > 0 && option.interest_annual == null)
  let best: Compare | null = null
  for (const [key, item] of Object.entries(forecast.horizons ?? {})) {
    const horizon = Number(key)
    const value = (price: number) =>
      priced
        ? storageValue(input.quantity_kg, price, horizon, option.loss_monthly as number, option.fee as number, option.cost_per_kg as number, option.interest_annual ?? 0, option.borrow_share as number, input.price_now)
        : input.quantity_kg * price
    const likely = value(item.p50)
    const low = value(item.p10)
    const high = value(item.p90)
    if (likely == null || low == null || high == null) continue
    if (!best || likely > best.likely) best = { horizon, likely, low, high, raw: !priced }
  }
  return best ?? { horizon: 0, likely: input.quantity_kg * input.price_now, low: input.quantity_kg * input.price_now, high: input.quantity_kg * input.price_now, raw: true }
}

/** One optional input: a title that says what to type, and the unit inside the box. */
function Option({
  title,
  unit,
  value,
  placeholder,
  onChange,
}: {
  title: string
  unit: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="field mt-1.5 flex !min-h-11 items-center gap-2">
        <input className="num w-full min-w-0 bg-transparent outline-none placeholder:text-ghost" inputMode="decimal" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        <span className="shrink-0 text-sm text-faint">{unit}</span>
      </span>
    </label>
  )
}

function Pill({ tone, children }: { tone: "good" | "warn" | "neutral"; children: React.ReactNode }) {
  const look = tone === "warn" ? "bg-warn-100 text-warn" : tone === "good" ? "bg-grass-50 text-grass-800" : "bg-paper text-muted"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${look}`}>
      <Dot tone={tone} />
      {children}
    </span>
  )
}

export default function Decide({ bundle, t, onView, onShare }: { bundle: Bundle; t: T; onView: (view: View) => void; onShare: () => void }) {
  const [crop, setCrop] = useState<"maize" | "beans">("maize")
  const [district, setDistrict] = useState("Kayonza")
  const [amount, setAmount] = useState("5")
  const [unit, setUnit] = useState<"t" | "kg">("t")
  const [storage, setStorage] = useState("home_bags")
  const [cash, setCash] = useState(false)
  const [typed, setTyped] = useState("")
  const [loss, setLoss] = useState("")
  const [cost, setCost] = useState("")
  const [interest, setInterest] = useState("")
  const [view, setView] = useState<View | null>(null)
  const [round, setRound] = useState(0)
  const result = useRef<HTMLElement>(null)

  const dataForecast = bundle.forecasts.districts[district]?.[crop]
  const typedPrice = Number(typed.replace(/,/g, ""))
  const ownPrice = typed.trim() !== "" && Number.isFinite(typedPrice) && typedPrice > 0

  useEffect(() => {
    if (!round || !result.current) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    result.current.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" })
  }, [round])

  function submit() {
    const quantity = Number(amount)
    if (!dataForecast || !Number.isFinite(quantity) || quantity <= 0) return
    const forecast = ownPrice && dataForecast.status === "ok" ? { ...withPrice(dataForecast, typedPrice), own_price: true } : dataForecast
    const quantityKg = unit === "t" ? quantity * 1000 : quantity
    const costs = readCosts(loss, cost, interest)
    const input = inputFor(bundle.assumptions.items, forecast, quantityKg, cash, storage, costs)
    const verdict = decide(input)
    const compare: Compare =
      verdict.verdict === "store"
        ? { horizon: verdict.horizon_months, likely: verdict.likely_value, low: verdict.low_value, high: verdict.high_value, raw: false }
        : compareFor(input, forecast)
    const next = { district, crop, quantityKg, forecast, verdict, horizon: compare.horizon, compare, ownCosts: Object.keys(costs).length > 0, cashOnly: cash && storage !== "warehouse" }
    setView(next)
    onView(next)
    setRound((value) => value + 1)
  }

  function pickStorage(id: string) {
    setStorage(id)
    setLoss("")
    setCost("")
    setInterest("")
  }

  const lossDefault = defaultFor(bundle.assumptions.items, storage, "loss_monthly")
  const costDefault = defaultFor(bundle.assumptions.items, storage, "cost_per_kg")
  const interestDefault = defaultFor(bundle.assumptions.items, storage, "interest_annual")
  const forecast = view?.forecast
  const compare = view?.compare
  const horizon = forecast?.horizons?.[String(compare?.horizon)]
  const verdict = view?.verdict.verdict
  const gate = (field: string) => Number(bundle.assumptions.items.find((item) => item.field === field && item.option == null)?.value ?? 0)
  const tooRisky = !!view && !!compare && compare.likely - view.verdict.v0 >= gate("g_min") * view.verdict.v0 && compare.low - view.verdict.v0 < -gate("d_max") * view.verdict.v0
  const risk: 0 | 1 | 2 = !view || !compare ? 0 : compare.likely < view.verdict.v0 ? 2 : compare.low < view.verdict.v0 ? 1 : 0

  return (
    <div className="flex flex-1 flex-col px-4 pt-7 pb-3">
      <h1 className="display px-1 text-[30px] leading-[1.05]">{t("decide.heroA")}</h1>
      <p className="mt-2 px-1 text-[15px] leading-snug text-muted">{t("decide.intro")}</p>

      <section className="panel mt-5 flex flex-1 flex-col p-3">
        <p className="label mb-1.5 px-1">{t("decide.cropLabel")}</p>
        <div className="grid max-h-[150px] min-h-[92px] flex-[3] grid-cols-2 gap-2">
          {CROPS.map(([id, Pic]) => (
            <button key={id} type="button" aria-pressed={crop === id} className="tile h-full" onClick={() => setCrop(id)}>
              <Pic className="size-8" />
              <span>{t(`decide.${id}`)}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-x-2 gap-y-1.5">
          <p className="label px-1">{t("decide.district")}</p>
          <p className="label px-1">{t("decide.quantity")}</p>
          <select aria-label={t("decide.district")} className="field" value={district} onChange={(event) => setDistrict(event.target.value)}>
            {DISTRICTS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <div className="field flex items-center gap-1 !px-1.5">
            <input aria-label={t("decide.quantity")} className="num w-full min-w-0 bg-transparent px-1.5 outline-none" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <button type="button" className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white" onClick={() => setUnit(unit === "t" ? "kg" : "t")}>
              {t(unit === "t" ? "decide.tonnes" : "decide.kg")}
            </button>
          </div>
        </div>

        <p className="label mt-3 mb-1.5 px-1">{t("decide.storage")}</p>
        <div className="grid max-h-[124px] min-h-[84px] flex-[2] grid-cols-3 gap-2">
          {OPTIONS.map(([id, key, Pic]) => (
            <button key={id} type="button" aria-pressed={storage === id} className="tile h-full !min-h-[84px] !text-[13px]" onClick={() => pickStorage(id)}>
              <Pic className="size-7" />
              <span className="leading-tight">{t(key)}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-3">
        <details className="rounded-[14px] border border-line bg-white/80 px-3.5">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">{t("decide.more")}</summary>
          <div className="grid gap-3.5 pt-1 pb-4">
            <Option
              title={t("decide.todayPrice")}
              unit="RWF/kg"
              value={typed}
              placeholder={dataForecast?.price_now != null ? money(dataForecast.price_now) : ""}
              onChange={setTyped}
            />
            <Option
              title={t("decide.costLoss")}
              unit="%"
              value={loss}
              placeholder={lossDefault != null ? String(+(lossDefault * 100).toFixed(2)) : ""}
              onChange={setLoss}
            />
            <Option
              title={t("decide.costBags")}
              unit="RWF/kg"
              value={cost}
              placeholder={costDefault != null ? String(costDefault) : ""}
              onChange={setCost}
            />
            {storage === "warehouse" ? (
              <Option
                title={t("decide.costInterest")}
                unit={t("decide.perYear")}
                value={interest}
                placeholder={interestDefault != null ? String(+(interestDefault * 100).toFixed(2)) : ""}
                onChange={setInterest}
              />
            ) : null}
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">{t("decide.cash")}</span>
              <input type="checkbox" className="peer sr-only" checked={cash} onChange={(event) => setCash(event.target.checked)} />
              <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-[#d4d4d4] transition-colors peer-checked:bg-grass-700 peer-focus-visible:outline-2 peer-focus-visible:outline-grass-500 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
            </label>
          </div>
        </details>

        <button type="button" className="key-dark mt-3 min-h-14 w-full text-[17px]" onClick={submit}>
          {t("decide.show")}
        </button>
        </div>
      </section>

      {view && forecast?.status !== "ok" ? <p className="card rise-in mt-5 p-5 text-lg">{t("decide.notEnough")}</p> : null}

      {view && compare && forecast?.status === "ok" && forecast.price_now != null ? (
        <section key={round} ref={result} className="card rise-in mt-5 scroll-mt-4 p-5 shadow-[0_8px_8px_-4px_rgba(0,0,0,0.06),0_4px_6px_-4px_rgba(0,0,0,0.1)]">
          <p className="eyebrow">
            {t(`decide.${view.crop}`)} · {view.district} · {quantityLabel(view.quantityKg)}
          </p>
          <h2 className={`display mt-2 text-[40px] leading-[1.02] ${verdict === "store" ? "text-grass-700" : verdict === "sell_now" ? "text-ink" : "text-ghost"}`}>
            {verdict === "store" ? t("decide.store", { months: view.verdict.horizon_months }) : verdict === "sell_now" ? t("decide.sellNow") : t("decide.noVerdict")}
          </h2>
          {verdict === "store" ? (
            <p className="num mt-3 inline-flex rounded-full bg-grass-100 px-3 py-1 text-sm font-semibold text-grass-800">{t("decide.gain", { amount: money(view.verdict.likely_gain) })}</p>
          ) : null}
          <p className="mt-3 text-[15px] leading-snug text-muted">
            {verdict === "store"
              ? t("decide.why.store", { months: compare.horizon })
              : verdict === "sell_now"
                ? t(view.cashOnly ? "decide.why.cash" : tooRisky ? "decide.why.risk" : "decide.why.small")
                : t("decide.unpriced")}
          </p>

          <div className="mt-5">
            <ValueBars
              sellLabel={t("decide.rowSell")}
              storeLabel={t(compare.raw ? "decide.rowStoreRaw" : "decide.rowStore", { months: compare.horizon })}
              now={view.verdict.v0}
              likely={compare.likely}
              low={compare.low}
              high={compare.high}
              better={verdict === "store" ? "store" : "sell"}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-[12px] bg-paper/70 p-3">
              <RiskMeter level={risk} />
              <p className="mt-2 text-[13px] font-semibold">{t(`decide.risk.${risk}`)}</p>
              <p className="text-[11px] text-faint">{t("decide.riskLabel")}</p>
            </div>
            {horizon ? (
              <div className="rounded-[12px] bg-paper/70 p-3">
                <PastDots up={horizon.n_up} n={horizon.n} />
                <p className="num mt-2 text-[13px] font-semibold">
                  {horizon.n_up} / {horizon.n}
                </p>
                <p className="text-[11px] text-faint">{t("decide.pastUp", { months: compare.horizon })}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex items-baseline justify-between gap-3">
            <p className="eyebrow">{t("decide.outlook")}</p>
            <p className="flex items-center gap-2 text-[11px] text-faint">
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-0.5 w-3 rounded bg-grass-700" />
                {t("decide.legendLikely")}
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="inline-block h-2 w-3 rounded-sm bg-grass-100" />
                {t("decide.legendRange")}
              </span>
            </p>
          </div>
          <div className="mt-1">
            <Spark
              mark={compare.horizon}
              points={[
                { label: t("decide.now"), p10: forecast.price_now, p50: forecast.price_now, p90: forecast.price_now },
                ...Object.entries(forecast.horizons ?? {}).map(([key, item]) => ({ label: t("decide.plusMonths", { months: key }), p10: item.p10, p50: item.p50, p90: item.p90 })),
              ]}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {forecast.own_price ? <Pill tone="good">{t("decide.ownPrice")}</Pill> : null}
            {view.ownCosts ? <Pill tone="good">{t("decide.ownCosts")}</Pill> : null}
            {!forecast.own_price && forecast.stale ? <Pill tone="warn">{t("decide.stale", { days: forecast.stale_days ?? "" })}</Pill> : null}
            {!forecast.own_price && forecast.price_pooled ? <Pill tone="neutral">{t("decide.provincePrice")}</Pill> : null}
          </div>

          <details className="mt-4 border-t border-hair">
            <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">{t("decide.markets")}</summary>
            <ul className="num grid gap-1 pb-2 text-[13px]">
              {(forecast.nearest_markets ?? []).map((market) => (
                <li key={market.name} className="flex justify-between gap-3">
                  <span>{market.name}</span>
                  <span className="text-muted">
                    {money(market.price)} RWF/kg · {monthLabel(market.month)}
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <button type="button" className="key-light mt-3 min-h-12 w-full" onClick={onShare}>
            {t("decide.shareThis")}
          </button>
          <p className="mt-3 text-center text-xs text-faint">
            {t("decide.dataDate", { date: forecast.price_date || "" })} · {t("decide.notice")}
          </p>
        </section>
      ) : null}
    </div>
  )
}
