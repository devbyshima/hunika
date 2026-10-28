import { Dot } from "../components/Icons"
import type { Assumption, Bundle } from "../types"

type T = (key: string, vars?: Record<string, string | number>) => string

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function valueText(item: Assumption, t: T) {
  if (item.value == null) return t("about.blank")
  const percent = `${(item.value * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
  switch (item.unit) {
    case "fraction_per_month":
      return `${percent} ${t("about.perMonth")}`
    case "fraction_per_year":
      return `${percent} ${t("about.perYear")}`
    case "share_of_value":
    case "share_of_sell_now_value":
      return percent
    case "rwf_per_kg":
      return `${item.value.toLocaleString("en-US", { maximumFractionDigits: 1 })} RWF/kg`
    case "days":
      return `${item.value} ${t("about.days")}`
    case "years":
      return `${item.value} ${t("about.years")}`
    default:
      return String(item.value)
  }
}

export default function About({ bundle, t }: { bundle: Bundle; t: T }) {
  const ahs = bundle.supply.ahs
  const sources = [
    t("about.wfp"),
    t("about.cpi"),
    t("about.sas"),
    t("about.rain"),
    ahs
      ? t("about.ahsUsed", {
          households: Math.round(ahs.weighted_households / 1000).toLocaleString("en-US"),
          n: ahs.sample_households,
          maize: ahs.median_harvest_kg.maize?.A ?? "",
          beans: ahs.median_harvest_kg.beans?.A ?? "",
          coop: pct(ahs.cooperative_member),
          storage: pct(ahs.cooperative_storage),
          markets: pct(ahs.cooperative_markets),
          loan: pct(ahs.loan_requested),
        })
      : t("about.ahs"),
  ]

  return (
    <div className="px-4 pt-8 pb-6">
      <h1 className="display px-1 text-[34px] leading-[1.02] tracking-[-0.02em]">{t("about.title")}</h1>
      <p className="mt-3 px-1 text-[15px] leading-relaxed text-muted">{t("about.lead")}</p>

      <h2 className="eyebrow mt-8 px-1">{t("about.sources")}</h2>
      <ol className="card mt-2 grid gap-3 p-4 text-sm leading-relaxed">
        {sources.map((text, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="fn mt-0.5 w-4 shrink-0 text-right">{index + 1}</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>

      <h2 className="eyebrow mt-8 px-1">{t("about.assumptions")}</h2>
      <ul className="card mt-2 px-4">
        {bundle.assumptions.items.map((item) => (
          <li key={item.id} className="border-b border-hair py-3.5 last:border-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">{item.label}</p>
              <p className={`num shrink-0 text-sm font-semibold ${item.value == null ? "text-ghost" : "text-grass-700"}`}>{valueText(item, t)}</p>
            </div>
            <p className="mt-1.5 flex items-start gap-2 text-[13px] leading-snug text-muted">
              <span className="mt-1.5">
                <Dot tone={item.value == null ? "neutral" : item.status === "sourced" ? "good" : "warn"} />
              </span>
              <span>
                {item.source}
                {item.url ? (
                  <>
                    {" "}
                    <a className="font-medium text-grass-700 underline decoration-grass-200 underline-offset-2" href={item.url} target="_blank" rel="noreferrer">
                      {t("about.source")}
                    </a>
                  </>
                ) : null}
              </span>
            </p>
          </li>
        ))}
      </ul>

      <h2 className="eyebrow mt-8 px-1">{t("about.teamTitle")}</h2>
      <div className="card mt-2 grid gap-2 p-4 text-sm leading-relaxed">
        <p>{t("about.team")}</p>
        <p className="text-muted">{t("about.ai")}</p>
      </div>
      <p className="mt-4 px-1 text-xs leading-snug text-faint">{t("about.notice")}</p>
    </div>
  )
}
