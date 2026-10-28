import type { CropForecast } from "../types"

/** Re-price the outlook from a price the user typed. Ratios are in today's money, as the pipeline writes them. */
export function withPrice(forecast: CropForecast, price: number): CropForecast {
  const horizons: NonNullable<CropForecast["horizons"]> = {}
  for (const [key, item] of Object.entries(forecast.horizons ?? {})) {
    horizons[key] = {
      ...item,
      p10: price * item.ratio_p10,
      p50: price * item.ratio_p50,
      p90: price * item.ratio_p90,
    }
  }
  return { ...forecast, price_now: price, horizons }
}

export type CostOverrides = { loss_monthly?: number; cost_per_kg?: number; interest_annual?: number }

/** Read the optional cost fields. Percent fields are typed as percent. */
export function readCosts(loss: string, cost: string, interest: string): CostOverrides {
  const number = (text: string) => {
    const value = Number(text.replace(/,/g, "").replace("%", "").trim())
    return text.trim() !== "" && Number.isFinite(value) && value >= 0 ? value : undefined
  }
  const out: CostOverrides = {}
  const lossValue = number(loss)
  const costValue = number(cost)
  const interestValue = number(interest)
  if (lossValue !== undefined) out.loss_monthly = lossValue / 100
  if (costValue !== undefined) out.cost_per_kg = costValue
  if (interestValue !== undefined) out.interest_annual = interestValue / 100
  return out
}
