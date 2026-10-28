import { useEffect, useRef, useState } from "react"
import { decide, type DecideInput } from "../lib/decide"
import { money, monthLabel, quantityLabel } from "../lib/format"
import { readCosts, withPrice, type CostOverrides } from "../lib/outlook"
import type { Assumption, Bundle, CropForecast } from "../types"
import type { View } from "../App"
import { Dot } from "../components/Icons"

const DISTRICTS = ["Bugesera", "Gatsibo", "Kayonza", "Kirehe", "Ngoma", "Nyagatare", "Rwamagana"]
const OPTIONS = [
  ["home_bags", "decide.home"],
  ["hermetic_bags", "decide.hermetic"],
  ["warehouse", "decide.warehouse"],
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

function percentPlaceholder(value: number | null, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (value == null) return t("decide.costUnknown")
  return t("decide.costDefault", { value: `${(value * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%` })
}

function numberPlaceholder(value: number | null, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (value == null) return t("decide.costUnknown")
  return t("decide.costDefault", { value: `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} RWF` })
}

function bestHorizon(forecast: CropForecast) {
  const entries = Object.entries(forecast.horizons ?? {})
  if (!entries.length) return 0
  return Number(entries.reduce((best, item) => (item[1].p50 > best[1].p50 ? item : best))[0])
}

export default function Decide({
  bundle,
  t,
  onView,
  onShare,
}: {
  bundle: Bundle
  t: (key: string, vars?: Record<string, string | number>) => string
  onView: (view: View) => void
  onShare: () => void
}) {
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
    const verdict = decide(inputFor(bundle.assumptions.items, forecast, quantityKg, cash, storage, costs))
    const next = { district, crop, quantityKg, forecast, verdict, horizon: bestHorizon(forecast), ownCosts: Object.keys(costs).length > 0 }
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

  const forecast = view?.forecast
  const horizon = forecast?.horizons?.[String(view?.horizon)]
  const total = (price: number) => (view ? price * view.quantityKg : 0)
  const verdict = view?.verdict.verdict
  const band = view?.verdict.loss_band

  return (
    <div className="px-4 pt-8">
      <h1 className="display px-1 text-[34px] leading-[1.02] tracking-[-0.02em] text-ink">
        {t("decide.heroA")}
        <span className="mt-1.5 block text-[24px] leading-[1.08] text-ghost">{t("decide.heroB")}</span>
      </h1>
      <p className="mt-3 px-1 text-[13px] leading-snug text-muted">{t("app.tagline")}</p>

      <section className="panel mt-6 p-3">
        <div className="grid grid-cols-2 gap-2">
          {(["maize", "beans"] as const).map((item) => (
            <button key={item} type="button" aria-pressed={crop === item} className="chip w-full" onClick={() => setCrop(item)}>
              {t(`decide.${item}`)}
            </button>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="label">{t("decide.district")}</span>
          <select className="field mt-1" value={district} onChange={(event) => setDistrict(event.target.value)}>
            {DISTRICTS.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2">
          <label className="block">
            <span className="label">{t("decide.quantity")}</span>
            <input className="field num mt-1" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <div className="flex gap-1 rounded-full border border-line bg-white p-1">
            {(["t", "kg"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={unit === item}
                className={`min-h-10 rounded-full px-3 text-sm font-semibold ${unit === item ? "bg-ink text-white" : "text-muted"}`}
                onClick={() => setUnit(item)}
              >
                {t(item === "t" ? "decide.tonnes" : "decide.kg")}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-3 block">
          <span className="label">{t("decide.todayPrice")}</span>
          <input
            className="field num mt-1"
            inputMode="decimal"
            value={typed}
            placeholder={dataForecast?.price_now != null ? t("decide.todayPricePlaceholder", { price: money(dataForecast.price_now), month: monthLabel(dataForecast.price_month || "") }) : ""}
            onChange={(event) => setTyped(event.target.value)}
          />
        </label>

        <p className="label mt-4">{t("decide.storage")}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {OPTIONS.map(([id, key]) => (
            <button key={id} type="button" aria-pressed={storage === id} className="chip" onClick={() => pickStorage(id)}>
              {t(key)}
            </button>
          ))}
        </div>

        <details className="mt-3 rounded-[14px] border border-line bg-white/80 px-3.5">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-ink">{t("decide.yourCosts")}</summary>
          <p className="text-xs leading-snug text-muted">{t("decide.yourCostsNote")}</p>
          <div className="grid gap-2 pt-2 pb-3.5">
            <label className="block text-sm text-muted">
              {t("decide.costLoss")}
              <input className="field num mt-1 !min-h-11" inputMode="decimal" value={loss} onChange={(event) => setLoss(event.target.value)} placeholder={percentPlaceholder(defaultFor(bundle.assumptions.items, storage, "loss_monthly"), t)} />
            </label>
            <label className="block text-sm text-muted">
              {t("decide.costBags")}
              <input className="field num mt-1 !min-h-11" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder={numberPlaceholder(defaultFor(bundle.assumptions.items, storage, "cost_per_kg"), t)} />
            </label>
            {storage === "warehouse" ? (
              <label className="block text-sm text-muted">
                {t("decide.costInterest")}
                <input className="field num mt-1 !min-h-11" inputMode="decimal" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder={percentPlaceholder(defaultFor(bundle.assumptions.items, storage, "interest_annual"), t)} />
              </label>
            ) : null}
          </div>
        </details>

        <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-line bg-white/80 px-3.5 text-sm font-semibold">
          {t("decide.cash")}
          <input type="checkbox" className="peer sr-only" checked={cash} onChange={(event) => setCash(event.target.checked)} />
          <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-[#d4d4d4] transition-colors peer-checked:bg-grass-700 peer-focus-visible:outline-2 peer-focus-visible:outline-grass-500 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
        </label>

        <button type="button" className="key-dark mt-4 min-h-14 w-full text-[17px]" onClick={submit}>
          {t("decide.show")}
        </button>
      </section>

      {view && forecast?.status !== "ok" ? <p className="card rise-in mt-5 p-5 text-lg">{t("decide.notEnough")}</p> : null}

      {view && forecast?.status === "ok" && horizon && forecast.price_now != null ? (
        <section key={round} ref={result} className="card rise-in mt-5 scroll-mt-4 p-5 shadow-[0_8px_8px_-4px_rgba(0,0,0,0.06),0_4px_6px_-4px_rgba(0,0,0,0.1)]">
          <p className="eyebrow">
            {t(`decide.${view.crop}`)} · {view.district} · {quantityLabel(view.quantityKg)}
          </p>
          <h2 className={`display mt-3 text-[44px] leading-[0.98] tracking-[-0.02em] ${verdict === "store" ? "text-grass-700" : verdict === "sell_now" ? "text-ink" : "text-ghost"}`}>
            {verdict === "store" ? t("decide.store", { months: view.verdict.horizon_months }) : verdict === "sell_now" ? t("decide.sellNow") : t("decide.noVerdict")}
          </h2>

          <div className="mt-4 grid gap-1.5 text-[17px] leading-snug">
            <p>{t("decide.sellNowWorth", { quantity: quantityLabel(view.quantityKg), amount: money(view.verdict.v0) })}</p>
            <p>
              {verdict === "store"
                ? t("decide.likelyLine", { amount: money(view.verdict.likely_value), low: money(view.verdict.low_value), high: money(view.verdict.high_value) })
                : t("decide.beforeLosses", { amount: money(total(horizon.p50)), low: money(total(horizon.p10)), high: money(total(horizon.p90)) })}
            </p>
          </div>
          {verdict === "unpriced" ? <p className="mt-2 text-sm leading-snug text-muted">{t("decide.unpriced")}</p> : null}

          {verdict === "store" ? (
            <p className="num mt-4 inline-flex items-center gap-2 rounded-full bg-grass-100 px-3 py-1.5 text-sm font-semibold text-grass-800">
              {t("decide.gain", { amount: money(view.verdict.likely_gain) })}
            </p>
          ) : null}
          {band ? (
            <p className="mt-3 flex items-center gap-2 text-sm">
              <Dot tone={band === "under_10" ? "good" : band === "over_50" ? "bad" : "warn"} />
              {t(`decide.loss.${band === "between_10_and_50" ? "mid" : band === "over_50" ? "over50" : "under10"}`)}
            </p>
          ) : null}
          <p className="mt-3 text-sm leading-snug text-muted">{t("decide.reason", { up: horizon.n_up, n: horizon.n, months: view.horizon })}</p>

          <ul className="mt-4 grid gap-1.5 text-[13px] leading-snug">
            {forecast.own_price ? (
              <li className="flex items-start gap-2"><span className="mt-1.5"><Dot tone="good" /></span>{t("decide.ownPrice", { price: money(forecast.price_now) })}</li>
            ) : null}
            {view.ownCosts ? (
              <li className="flex items-start gap-2"><span className="mt-1.5"><Dot tone="good" /></span>{t("decide.ownCosts")}</li>
            ) : null}
            {!forecast.own_price && forecast.stale ? (
              <li className="flex items-start gap-2 rounded-[10px] bg-warn-100 px-2.5 py-2 text-warn"><span className="mt-1"><Dot tone="warn" /></span>{t("decide.stale", { days: forecast.stale_days ?? "" })}</li>
            ) : null}
            {!forecast.own_price && forecast.price_pooled ? (
              <li className="flex items-start gap-2 text-muted"><span className="mt-1.5"><Dot tone="neutral" /></span>{t("decide.provincePrice", { month: monthLabel(forecast.price_month || "") })}</li>
            ) : null}
            {forecast.pattern_last_year && forecast.pattern_last_year < "2022" ? (
              <li className="flex items-start gap-2 text-muted"><span className="mt-1.5"><Dot tone="neutral" /></span>{t("decide.oldPattern", { year: forecast.pattern_last_year })}</li>
            ) : null}
          </ul>

          <p className="eyebrow mt-5">{t("decide.outlook")}</p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {Object.entries(forecast.horizons ?? {}).map(([key, item]) => {
              const up = item.p50 >= (forecast.price_now ?? 0)
              return (
                <div key={key} className={`rounded-[12px] border px-1 py-2.5 text-center ${String(view.verdict.horizon_months) === key && verdict === "store" ? "border-grass-700 bg-grass-50" : "border-hair bg-paper/60"}`}>
                  <div className="font-pixel text-[9px] text-faint">{t("decide.plusMonths", { months: key })}</div>
                  <div className={`num mt-1.5 text-[15px] font-semibold ${up ? "text-grass-700" : "text-ink"}`}>{money(item.p50)}</div>
                </div>
              )
            })}
          </div>

          <p className="eyebrow mt-5">{t("decide.markets")}</p>
          <ol className="mt-1.5 grid gap-1 text-sm">
            {(forecast.nearest_markets ?? []).map((market, index) => (
              <li key={market.name} className="flex items-baseline justify-between gap-3 border-b border-hair pb-1 last:border-0">
                <span>
                  <span className="fn mr-1">{index + 1}</span>
                  {market.name}
                </span>
                <span className="num text-muted">
                  {money(market.price)} RWF/kg · {monthLabel(market.month)}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-faint">{t("decide.dataDate", { date: forecast.price_date || "" })}</p>

          <button type="button" className="key-light mt-5 min-h-12 w-full" onClick={onShare}>
            {t("decide.shareThis")}
          </button>
          <p className="mt-3 text-xs leading-snug text-faint">{t("decide.notice")}</p>
        </section>
      ) : null}
    </div>
  )
}
