import type { CropForecast } from "../types"

/** Re-price the outlook from a price the user typed. Ratios and inflation are the pipeline's. */
export function withPrice(forecast: CropForecast, price: number, inflation: number): CropForecast {
  const horizons: NonNullable<CropForecast["horizons"]> = {}
  for (const [key, item] of Object.entries(forecast.horizons ?? {})) {
    const growth = (1 + inflation) ** (Number(key) / 12)
    horizons[key] = {
      ...item,
      p10: price * item.ratio_p10 * growth,
      p50: price * item.ratio_p50 * growth,
      p90: price * item.ratio_p90 * growth,
    }
  }
  return { ...forecast, price_now: price, horizons }
}
