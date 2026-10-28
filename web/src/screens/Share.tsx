import { Mark } from "../components/Mark"
import { BackPic } from "../components/Illustrations"
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
  onDecide,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string
  view: View | null
  onDecide: () => void
}) {
  if (!view || view.forecast.status !== "ok") {
    return (
      <div className="px-4 pt-8">
        <h1 className="display px-1 text-[30px] leading-[1.05]">{t("share.title")}</h1>
        <div className="card mt-6 p-5">
          <p className="text-[17px] leading-snug">{t("share.empty")}</p>
          <button type="button" className="key-dark mt-4 min-h-12 w-full" onClick={onDecide}>
            {t("nav.decide")}
          </button>
        </div>
      </div>
    )
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
      const side = node.offsetWidth
      const blob = await toBlob(node, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 1080 / side,
        canvasWidth: side,
        canvasHeight: side,
      })
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

  const store = view.verdict.verdict === "store"

  return (
    <div className="px-4 pt-6 pb-3">
      <button type="button" className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-3 text-sm font-semibold text-muted" onClick={onDecide}>
        <BackPic className="size-5" />
        {t("nav.decide")}
      </button>
      <h1 className="display mt-1 px-1 text-[30px] leading-[1.05]">{t("share.title")}</h1>
      <article
        id="share-card"
        className="relative mt-6 flex aspect-square flex-col overflow-hidden rounded-[22px] border border-line bg-white p-6"
        style={{
          backgroundImage:
            "radial-gradient(120% 55% at 50% 0%, rgba(69,165,53,0.20), rgba(69,165,53,0) 62%), radial-gradient(rgba(23,23,23,0.08) 1px, transparent 1.2px)",
          backgroundSize: "auto, 14px 14px",
        }}
      >
        <div className="flex items-center gap-2">
          <Mark size={26} />
          <span className="display text-[22px] leading-none">{t("app.name")}</span>
        </div>
        <p className="eyebrow mt-6">
          {t(`decide.${view.crop}`)} · {view.district} · {quantityLabel(view.quantityKg)}
        </p>
        <h2 className={`display mt-3 text-[42px] leading-[0.98] tracking-[-0.02em] ${store ? "text-grass-700" : "text-ink"}`}>{line}</h2>
        <dl className="num mt-5 grid gap-1.5 text-[15px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t("decide.rowSell")}</dt>
            <dd className="font-semibold">{money(view.verdict.v0)} RWF</dd>
          </div>
          {store ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t("decide.rowStore")}</dt>
              <dd className="font-semibold">{money(view.verdict.likely_value)} RWF</dd>
            </div>
          ) : null}
        </dl>
        {view.verdict.verdict === "unpriced" ? <p className="mt-2 text-sm leading-snug text-muted">{t("decide.unpriced")}</p> : null}
        <p className="mt-auto pt-4 text-xs leading-snug text-faint">{t("decide.notice")}</p>
      </article>
      <div className="no-print mt-4 grid gap-2">
        <button type="button" className="key-grass min-h-14 w-full text-[17px]" onClick={shareCard}>
          {t("share.button")}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <a className="key-light min-h-12" href={whatsapp} target="_blank" rel="noreferrer">
            {t("share.whatsapp")}
          </a>
          <button type="button" className="key-light min-h-12" onClick={() => window.print()}>
            {t("share.print")}
          </button>
        </div>
      </div>
    </div>
  )
}
