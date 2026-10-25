/** Sell-or-store rule. Keep this file in step with pipeline/decide.py. */

export const HORIZONS = [1, 2, 3, 4] as const

export type StorageOption = {
  id: string
  loss_monthly: number | null
  fee: number | null
  cost_per_kg: number | null
  interest_annual: number | null
  borrow_share: number | null
}

export type ForecastPrice = { p10: number; p50: number; p90: number }

export type DecideInput = {
  quantity_kg: number
  price_now: number
  needs_cash_now: boolean
  g_min: number
  d_max: number
  options: StorageOption[]
  forecasts: Record<string, ForecastPrice>
}

export type DecideResult = {
  verdict: "store" | "sell_now" | "unpriced"
  option: string | null
  horizon_months: number
  v0: number
  likely_value: number
  low_value: number
  high_value: number
  likely_gain: number
  low_gain: number
  high_gain: number
  loss_band: "under_10" | "between_10_and_50" | "over_50" | null
}

export function storageValue(
  quantityKg: number,
  priceHat: number,
  horizon: number,
  lossMonthly: number,
  fee: number,
  costPerKg: number,
  interestAnnual: number,
  borrowShare: number,
  priceNow: number,
): number | null {
  const retained = 1 - lossMonthly * horizon
  if (retained <= 0) return null
  const interest = interestAnnual * borrowShare * quantityKg * priceNow * (horizon / 12)
  return quantityKg * priceHat * retained * (1 - fee) - quantityKg * costPerKg - interest
}

function priced(option: StorageOption): boolean {
  if (option.loss_monthly == null || option.fee == null || option.cost_per_kg == null || option.borrow_share == null) {
    return false
  }
  return !(option.borrow_share > 0 && option.interest_annual == null)
}

function band(lowGain: number, likelyGain: number): DecideResult["loss_band"] {
  if (likelyGain < 0) return "over_50"
  if (lowGain < 0) return "between_10_and_50"
  return "under_10"
}

function sell(verdict: "sell_now" | "unpriced", v0: number): DecideResult {
  return {
    verdict,
    option: null,
    horizon_months: 0,
    v0,
    likely_value: v0,
    low_value: v0,
    high_value: v0,
    likely_gain: 0,
    low_gain: 0,
    high_gain: 0,
    loss_band: null,
  }
}

export function decide(payload: DecideInput): DecideResult {
  const quantity = payload.quantity_kg
  const priceNow = payload.price_now
  const v0 = quantity * priceNow
  const available = payload.options.filter(priced)
  if (available.length === 0) return sell("unpriced", v0)
  const eligible = payload.needs_cash_now ? available.filter((option) => option.id === "warehouse") : available
  if (eligible.length === 0) return sell("sell_now", v0)

  let best: DecideResult | null = null
  for (const option of eligible) {
    const interest = option.interest_annual ?? 0
    for (const horizon of HORIZONS) {
      const forecast = payload.forecasts[String(horizon)]
      if (!forecast) continue
      const values: Record<string, number> = {}
      let skipped = false
      for (const key of ["p10", "p50", "p90"] as const) {
        const value = storageValue(
          quantity,
          forecast[key],
          horizon,
          option.loss_monthly as number,
          option.fee as number,
          option.cost_per_kg as number,
          interest,
          option.borrow_share as number,
          priceNow,
        )
        if (value == null) {
          skipped = true
          break
        }
        values[key] = value
      }
      if (skipped) continue
      const gain = values.p50 - v0
      if (!best || gain > best.likely_gain) {
        best = {
          verdict: "store",
          option: option.id,
          horizon_months: horizon,
          v0,
          likely_value: values.p50,
          low_value: values.p10,
          high_value: values.p90,
          likely_gain: gain,
          low_gain: values.p10 - v0,
          high_gain: values.p90 - v0,
          loss_band: band(values.p10 - v0, gain),
        }
      }
    }
  }
  if (!best) return sell("sell_now", v0)
  const passes = best.likely_gain >= payload.g_min * v0 && best.low_gain >= -payload.d_max * v0
  if (!passes) return sell("sell_now", v0)
  return best
}
