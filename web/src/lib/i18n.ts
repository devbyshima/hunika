import en from "../i18n/en.json"
import rw from "../i18n/rw.json"

export type Lang = "rw" | "en"

const tables: Record<Lang, Record<string, string>> = { en, rw: rw as unknown as Record<string, string> }

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>) {
  let text = tables[lang][key] ?? tables.en[key] ?? key
  if (!vars) return text
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}
