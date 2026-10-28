import { useState } from "react"
import { decide, type DecideInput } from "../lib/decide"
import { money, monthLabel, quantityLabel } from "../lib/format"
import { readCosts, withPrice, type CostOverrides } from "../lib/outlook"
import type { Assumption, Bundle, CropForecast } from "../types"
import type { View } from "../App"

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
}: {
  bundle: Bundle
  t: (key: string, vars?: Record<string, string | number>) => string
  onView: (view: View) => void
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

  const dataForecast = bundle.forecasts.districts[district]?.[crop]
  const typedPrice = Number(typed.replace(/,/g, ""))
  const ownPrice = typed.trim() !== "" && Number.isFinite(typedPrice) && typedPrice > 0

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
  }

  const forecast = view?.forecast
  const horizon = forecast?.horizons?.[String(view?.horizon)]
  const total = (price: number) => (view ? price * view.quantityKg : 0)

  return (
    <div className="px-4 pt-5">
      <div className="grid grid-cols-2 gap-2">
        {(["maize", "beans"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={`min-h-12 rounded-xl font-semibold ${crop === item ? "bg-[#14532d] text-white" : "bg-white text-[#1c1915]"}`}
            onClick={() => setCrop(item)}
          >
            {t(`decide.${item}`)}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-semibold">
        {t("decide.district")}
        <select className="mt-1 min-h-12 w-full rounded-xl border border-[#e0d6c4] bg-white px-3" value={district} onChange={(event) => setDistrict(event.target.value)}>
          {DISTRICTS.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <label className="text-sm font-semibold">
          {t("decide.quantity")}
          <input className="mt-1 min-h-12 w-full rounded-xl border border-[#e0d6c4] bg-white px-3" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <div className="flex items-end gap-1 pb-0.5">
          {(["t", "kg"] as const).map((item) => (
            <button key={item} type="button" className={`min-h-12 rounded-xl px-3 ${unit === item ? "bg-[#14532d] text-white" : "bg-white"}`} onClick={() => setUnit(item)}>
              {t(item === "t" ? "decide.tonnes" : "decide.kg")}
            </button>
          ))}
        </div>
      </div>
      <label className="mt-4 block text-sm font-semibold">
        {t("decide.todayPrice")}
        <input
          className="mt-1 min-h-12 w-full rounded-xl border border-[#e0d6c4] bg-white px-3"
          inputMode="decimal"
          value={typed}
          placeholder={dataForecast?.price_now != null ? t("decide.todayPricePlaceholder", { price: money(dataForecast.price_now), month: monthLabel(dataForecast.price_month || "") }) : ""}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
      <p className="mt-4 text-sm font-semibold">{t("decide.storage")}</p>
      <div className="mt-1 grid gap-2">
        {OPTIONS.map(([id, key]) => (
          <button key={id} type="button" className={`min-h-12 rounded-xl px-3 text-left ${storage === id ? "bg-[#14532d] text-white" : "bg-white"}`} onClick={() => {
              setStorage(id)
              setLoss("")
              setCost("")
              setInterest("")
            }}>
            {t(key)}
          </button>
        ))}
      </div>
      <details className="mt-3 rounded-xl bg-white px-3 py-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{t("decide.yourCosts")}</summary>
        <p className="text-xs leading-snug text-[#5c564c]">{t("decide.yourCostsNote")}</p>
        <label className="mt-2 block text-sm">
          {t("decide.costLoss")}
          <input className="mt-1 min-h-11 w-full rounded-lg border border-[#e0d6c4] px-3" inputMode="decimal" value={loss} onChange={(event) => setLoss(event.target.value)} placeholder={percentPlaceholder(defaultFor(bundle.assumptions.items, storage, "loss_monthly"), t)} />
        </label>
        <label className="mt-2 block text-sm">
          {t("decide.costBags")}
          <input className="mt-1 min-h-11 w-full rounded-lg border border-[#e0d6c4] px-3" inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder={numberPlaceholder(defaultFor(bundle.assumptions.items, storage, "cost_per_kg"), t)} />
        </label>
        {storage === "warehouse" ? (
          <label className="mt-2 block text-sm">
            {t("decide.costInterest")}
            <input className="mt-1 min-h-11 w-full rounded-lg border border-[#e0d6c4] px-3" inputMode="decimal" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder={percentPlaceholder(defaultFor(bundle.assumptions.items, storage, "interest_annual"), t)} />
          </label>
        ) : null}
      </details>
      <label className="mt-4 flex min-h-12 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="h-5 w-5" checked={cash} onChange={(event) => setCash(event.target.checked)} />
        {t("decide.cash")}
      </label>
      <button type="button" className="mt-4 min-h-14 w-full rounded-2xl bg-[#8a6a12] text-lg font-semibold text-white" onClick={submit}>
        {t("decide.show")}
      </button>

      {view && forecast?.status !== "ok" ? <p className="mt-6 text-lg">{t("decide.notEnough")}</p> : null}

      {view && forecast?.status === "ok" && horizon && forecast.price_now != null ? (
        <section className="mt-6 rounded-3xl bg-white p-4">
          <h2 className={`ledger text-4xl leading-tight ${view.verdict.verdict === "store" ? "text-[#14532d]" : "text-[#9a3412]"}`}>
            {view.verdict.verdict === "store"
              ? t("decide.store", { months: view.verdict.horizon_months })
              : view.verdict.verdict === "sell_now"
                ? t("decide.sellNow")
                : t("decide.noVerdict")}
          </h2>
          <p className="mt-3 text-lg leading-snug">{t("decide.sellNowWorth", { quantity: quantityLabel(view.quantityKg), amount: money(view.verdict.v0) })}</p>
          {view.verdict.verdict === "unpriced" ? <p className="mt-2 text-sm leading-snug text-[#5c564c]">{t("decide.unpriced")}</p> : null}
          <p className="mt-3 text-lg leading-snug">
            {view.verdict.verdict === "store"
              ? t("decide.likelyLine", { amount: money(view.verdict.likely_value), low: money(view.verdict.low_value), high: money(view.verdict.high_value) })
              : t("decide.beforeLosses", {
                  amount: money(total(horizon.p50)),
                  low: money(total(horizon.p10)),
                  high: money(total(horizon.p90)),
                })}
          </p>
          {view.verdict.verdict === "store" ? <p className="mt-2">{t("decide.gain", { amount: money(view.verdict.likely_gain) })}</p> : null}
          {view.verdict.loss_band ? <p className="mt-2 text-sm">{t(`decide.loss.${view.verdict.loss_band === "between_10_and_50" ? "mid" : view.verdict.loss_band === "over_50" ? "over50" : "under10"}`)}</p> : null}
          <p className="mt-3 text-sm leading-snug">{t("decide.reason", { up: horizon.n_up, n: horizon.n, months: view.horizon })}</p>
          {forecast.own_price ? <p className="mt-3 text-sm">{t("decide.ownPrice", { price: money(forecast.price_now) })}</p> : null}
          {view.ownCosts ? <p className="mt-2 text-sm">{t("decide.ownCosts")}</p> : null}
          {!forecast.own_price && forecast.stale ? <p className="mt-3 rounded-xl bg-[#f8e7c8] px-3 py-2 text-sm">{t("decide.stale", { days: forecast.stale_days ?? "" })}</p> : null}
          {!forecast.own_price && forecast.price_pooled ? <p className="mt-2 text-sm">{t("decide.provincePrice", { month: monthLabel(forecast.price_month || "") })}</p> : null}
          {forecast.pattern_last_year && forecast.pattern_last_year < "2022" ? <p className="mt-2 text-sm">{t("decide.oldPattern", { year: forecast.pattern_last_year })}</p> : null}
          <p className="mt-4 text-sm font-semibold">{t("decide.outlook")}</p>
          <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
            {Object.entries(forecast.horizons ?? {}).map(([key, item]) => (
              <div key={key} className="rounded-xl bg-[#f4efe6] px-1 py-2">
                <div className="font-semibold">{t("decide.plusMonths", { months: key })}</div>
                <div className="mt-1">{money(item.p50)}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold">{t("decide.markets")}</p>
          <ul className="mt-1 text-sm leading-6">
            {(forecast.nearest_markets ?? []).map((market) => (
              <li key={market.name}>
                {market.name}: {money(market.price)} RWF/kg ({monthLabel(market.month)})
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">{t("decide.dataDate", { date: forecast.price_date || "" })}</p>
          <p className="mt-3 text-sm leading-snug text-[#5c564c]">{t("decide.notice")}</p>
        </section>
      ) : null}
    </div>
  )
}
