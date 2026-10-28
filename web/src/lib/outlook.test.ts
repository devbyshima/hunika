import { expect, it } from "vitest"
import { readCosts, withPrice } from "./outlook"
import type { CropForecast } from "../types"

const forecast: CropForecast = {
  status: "ok",
  price_now: 500,
  horizons: { "2": { ratio_p10: 0.9, ratio_p50: 1.1, ratio_p90: 1.3, p10: 450, p50: 550, p90: 650, n: 10, n_up: 7, years: 8 } },
}

it("re-prices the outlook in today's money from a typed price", () => {
  const priced = withPrice(forecast, 600)
  expect(priced.price_now).toBe(600)
  expect(priced.horizons?.["2"].p50).toBeCloseTo(660)
  expect(priced.horizons?.["2"].p10).toBeCloseTo(540)
})

it("reads typed costs and ignores blanks", () => {
  expect(readCosts("2.5", "", "")).toEqual({ loss_monthly: 0.025 })
  expect(readCosts("", "1,200", "16%")).toEqual({ cost_per_kg: 1200, interest_annual: 0.16 })
  expect(readCosts("abc", "-3", "")).toEqual({})
})
