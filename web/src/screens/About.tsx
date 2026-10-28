import { Dot } from "../components/Icons"
import { AnswerPic, ChevronDownPic, CostsPic, PricesPic } from "../components/Illustrations"
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

const STEPS = [
  ["about.step1", "about.step1Note", PricesPic],
  ["about.step2", "about.step2Note", CostsPic],
  ["about.step3", "about.step3Note", AnswerPic],
] as const

export default function About({ bundle, t }: { bundle: Bundle; t: T }) {
  const ahs = bundle.supply.ahs
  const sources = [t("about.wfp"), t("about.cpi"), t("about.sas"), t("about.rain"), ahs ? t("about.ahsUsed", { storage: pct(ahs.cooperative_storage) }) : t("about.ahs")]

  return (
    <div className="px-4 pt-7 pb-3">
      <h1 className="display px-1 text-[30px] leading-[1.05]">{t("about.title")}</h1>

      <ol className="mt-5 grid gap-2">
        {STEPS.map(([title, note, Pic], index) => (
          <li key={title} className="card flex items-center gap-4 p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-grass-50 text-grass-700">
              <Pic className="size-6" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">
                <span className="mr-1.5 text-faint">{index + 1}</span>
                {t(title)}
              </span>
              <span className="font-body block text-[13px] text-muted">{t(note)}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="eyebrow mt-8 px-1">{t("about.sources")}</p>
      <ol className="font-body card mt-2 grid gap-2 p-4 text-sm">
        {sources.map((text, index) => (
          <li key={index} className="flex gap-2.5">
            <span className="fn mt-0.5 w-3 shrink-0 text-right">{index + 1}</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>

      <details className="card mt-3 px-4">
        <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">
          {t("about.assumptions")}
          <ChevronDownPic className="chevron ml-auto size-4 shrink-0 text-faint" />
        </summary>
        <ul className="pb-2">
          {bundle.assumptions.items.map((item) => (
            <li key={item.id} className="border-t border-hair">
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1.5 text-[13px]">
                  <span className="flex items-center gap-2">
                    <Dot tone={item.value == null ? "neutral" : item.status === "sourced" ? "good" : "warn"} />
                    {item.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`num font-semibold ${item.value == null ? "text-ghost" : "text-grass-700"}`}>{valueText(item, t)}</span>
                    <ChevronDownPic className="chevron size-3.5 text-faint" />
                  </span>
                </summary>
                <p className="font-body pb-3 pl-4 text-xs leading-snug text-muted">
                  {item.source}
                  {item.url ? (
                    <>
                      {" "}
                      <a className="font-medium text-grass-700 underline decoration-grass-200 underline-offset-2" href={item.url} target="_blank" rel="noreferrer">
                        {t("about.source")}
                      </a>
                    </>
                  ) : null}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </details>

    </div>
  )
}
