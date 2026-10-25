import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import Decide from "./screens/Decide"
import Share from "./screens/Share"
import { translate, type Lang } from "./lib/i18n"
import type { Bundle } from "./types"
import type { DecideResult } from "./lib/decide"
import type { CropForecast } from "./types"

const Plan = lazy(() => import("./screens/Plan"))
const Proof = lazy(() => import("./screens/Proof"))
const About = lazy(() => import("./screens/About"))

export type Screen = "decide" | "share" | "plan" | "proof" | "about"

export type View = {
  district: string
  crop: "maize" | "beans"
  quantityKg: number
  forecast: CropForecast
  verdict: DecideResult
  horizon: number
}

const nav: Screen[] = ["decide", "share", "plan", "proof", "about"]

export default function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("hunika-lang") as Lang) || "rw")
  const [screen, setScreen] = useState<Screen>("decide")
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [error, setError] = useState("")
  const [view, setView] = useState<View | null>(null)
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])

  useEffect(() => {
    localStorage.setItem("hunika-lang", lang)
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    Promise.all(
      ["forecasts", "assumptions", "backtest", "supply"].map(async (name) => {
        const response = await fetch(`${base}data/${name}.json`)
        if (!response.ok) throw new Error(name)
        return [name, await response.json()] as const
      }),
    )
      .then((entries) => setBundle(Object.fromEntries(entries) as Bundle))
      .catch(() => setError("The data files did not load."))
  }, [])

  const screenNode = !bundle ? (
    <p className="px-5 pt-16 text-lg">{error || "…"}</p>
  ) : screen === "decide" ? (
    <Decide bundle={bundle} t={t} onView={setView} />
  ) : screen === "share" ? (
    <Share t={t} view={view} />
  ) : (
    <Suspense fallback={<p className="px-5 pt-16">…</p>}>
      {screen === "plan" ? <Plan bundle={bundle} t={t} /> : null}
      {screen === "proof" ? <Proof bundle={bundle} t={t} /> : null}
      {screen === "about" ? <About bundle={bundle} t={t} /> : null}
    </Suspense>
  )

  return (
    <div className="phone relative mx-auto flex min-h-dvh max-w-[480px] flex-col bg-[#f4efe6] pb-20 shadow-xl">
      <header className="no-print flex items-center justify-between px-4 pt-4">
        <div>
          <p className="ledger text-2xl leading-none text-[#14532d]">{t("app.name")}</p>
          <p className="mt-1 max-w-[16rem] text-sm leading-snug text-[#5c564c]">{t("app.tagline")}</p>
        </div>
        <div className="flex rounded-full bg-[#e7e0d2] p-1">
          {(["rw", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={`min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold ${lang === code ? "bg-[#14532d] text-white" : "text-[#3f3a33]"}`}
              onClick={() => setLang(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1">{screenNode}</main>
      <nav className="no-print fixed inset-x-0 bottom-0 mx-auto flex max-w-[480px] border-t border-[#e0d6c4] bg-[#fffdf8]">
        {nav.map((item) => (
          <button
            key={item}
            type="button"
            className={`min-h-16 flex-1 text-xs font-semibold ${screen === item ? "text-[#14532d]" : "text-[#6b6458]"}`}
            onClick={() => setScreen(item)}
          >
            {t(`nav.${item}`)}
          </button>
        ))}
      </nav>
    </div>
  )
}
