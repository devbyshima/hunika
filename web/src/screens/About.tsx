import type { Bundle } from "../types"

export default function About({
  bundle,
  t,
}: {
  bundle: Bundle
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  return (
    <div className="px-4 pt-5 pb-6">
      <h1 className="ledger text-3xl text-[#14532d]">{t("about.title")}</h1>
      <p className="mt-3 text-sm leading-snug">{t("about.lead")}</p>
      <h2 className="mt-6 text-sm font-semibold">{t("about.sources")}</h2>
      <ul className="mt-2 space-y-2 text-sm leading-snug">
        <li>{t("about.wfp")}</li>
        <li>{t("about.cpi")}</li>
        <li>{t("about.sas")}</li>
        <li>{t("about.rain")}</li>
        <li>{t("about.ahs")}</li>
      </ul>
      <h2 className="mt-6 text-sm font-semibold">{t("about.assumptions")}</h2>
      <ul className="mt-2 space-y-3">
        {bundle.assumptions.items.map((item) => (
          <li key={item.id} className="rounded-2xl bg-white p-3">
            <p className="font-semibold">{item.label}</p>
            <p className={`mt-1 text-sm ${item.value == null ? "text-[#9a3412]" : ""}`}>
              {item.value == null ? t("about.blank") : item.value} · {item.status}
            </p>
            <p className="mt-1 text-sm leading-snug text-[#5c564c]">{item.source}</p>
            {item.url ? (
              <a className="mt-1 block break-all text-sm text-[#14532d] underline" href={item.url}>
                {item.url}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-sm font-semibold">{t("about.teamTitle")}</h2>
      <p className="mt-1 text-sm leading-snug">{t("about.team")}</p>
      <p className="mt-2 text-sm leading-snug">{t("about.ai")}</p>
      <p className="mt-6 text-sm leading-snug text-[#5c564c]">{t("about.notice")}</p>
    </div>
  )
}
