import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import rw from "../i18n/rw.json"
import en from "../i18n/en.json"
import { decide, type DecideInput } from "./decide"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const cases = JSON.parse(readFileSync(resolve(root, "tests/fixtures/decide_cases.json"), "utf8")).cases as {
  name: string
  input: DecideInput
  expected: Record<string, string | number | null>
}[]

describe("shared decision fixtures", () => {
  for (const testCase of cases) {
    it(testCase.name, () => {
      const result = decide(testCase.input) as unknown as Record<string, string | number | null>
      for (const [key, expected] of Object.entries(testCase.expected)) {
        if (typeof expected === "number") expect(result[key]).toBeCloseTo(expected, 4)
        else expect(result[key]).toEqual(expected)
      }
    })
  }
})

it("keeps English and Kinyarwanda keys aligned", () => {
  const english = Object.keys(en).sort()
  const kinyarwanda = Object.keys(rw).filter((key) => key !== "_review").sort()
  expect(kinyarwanda).toEqual(english)
  const review = new Set(rw._review)
  for (const key of kinyarwanda) {
    if (key !== "app.name") expect(review.has(key)).toBe(true)
  }
  if (new Date().toISOString().slice(0, 10) > "2026-10-30") {
    expect(rw._review).toEqual([])
  }
})
