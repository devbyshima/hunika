import { money, quantityLabel } from "../lib/format"
import type { View } from "../App"

function verdictLine(view: View, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (view.verdict.verdict === "store") return t("decide.store", { months: view.verdict.horizon_months })
  if (view.verdict.verdict === "sell_now") return t("decide.sellNow")
  return t("decide.noVerdict")
}

export default function Share({
  t,
  view,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string
  view: View | null
}) {
  if (!view || view.forecast.status !== "ok") {
    return <p className="px-5 pt-8 text-lg leading-snug">{t("share.empty")}</p>
  }

  const line = verdictLine(view, t)
  const message = t("share.message", {
    crop: t(`decide.${view.crop}`),
    district: view.district,
    line,
    date: view.forecast.price_date || "",
  })
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`

  async function shareCard() {
    const node = document.getElementById("share-card")
    if (!node) return
    try {
      const { toBlob } = await import("html-to-image")
      const blob = await toBlob(node, { pixelRatio: 3, backgroundColor: "#f4efe6", cacheBust: true })
      if (!blob) throw new Error("card")
      const file = new File([blob], "hunika.png", { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message, title: "Hunika" })
        return
      }
      if (navigator.share) {
        await navigator.share({ text: message, title: "Hunika" })
        return
      }
      window.open(whatsapp, "_blank", "noopener,noreferrer")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      window.open(whatsapp, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="px-4 pt-5">
      <h1 className="text-lg font-semibold">{t("share.title")}</h1>
      <article id="share-card" className="mt-4 aspect-square rounded-3xl bg-white p-5">
        <p className="ledger text-3xl text-[#14532d]">{t("app.name")}</p>
        <p className="mt-2 text-sm">
          {t(`decide.${view.crop}`)} · {view.district} · {quantityLabel(view.quantityKg)}
        </p>
        <h2 className={`ledger mt-6 text-4xl leading-tight ${view.verdict.verdict === "store" ? "text-[#14532d]" : "text-[#9a3412]"}`}>{line}</h2>
        <p className="mt-4 text-lg leading-snug">{t("decide.sellNowWorth", { quantity: quantityLabel(view.quantityKg), amount: money(view.verdict.v0) })}</p>
        {view.verdict.verdict === "unpriced" ? <p className="mt-3 text-sm leading-snug">{t("decide.unpriced")}</p> : null}
        {view.verdict.verdict === "store" ? (
          <p className="mt-3 text-lg leading-snug">
            {t("decide.likelyLine", {
              amount: money(view.verdict.likely_value),
              low: money(view.verdict.low_value),
              high: money(view.verdict.high_value),
            })}
          </p>
        ) : null}
        <p className="mt-6 text-sm leading-snug text-[#5c564c]">{t("decide.notice")}</p>
      </article>
      <button type="button" className="no-print mt-4 min-h-14 w-full rounded-2xl bg-[#14532d] text-lg font-semibold text-white" onClick={shareCard}>
        {t("share.button")}
      </button>
      <a className="no-print mt-2 flex min-h-12 items-center justify-center rounded-2xl bg-[#8a6a12] font-semibold text-white" href={whatsapp} target="_blank" rel="noreferrer">
        {t("share.whatsapp")}
      </a>
      <button type="button" className="no-print mt-2 min-h-12 w-full rounded-2xl bg-white font-semibold" onClick={() => window.print()}>
        {t("share.print")}
      </button>
    </div>
  )
}
