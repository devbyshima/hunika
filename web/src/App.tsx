import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import Decide from "./screens/Decide"
import Share from "./screens/Share"
import { Mark } from "./components/Mark"
import { AboutIcon, DecideIcon, PlanIcon, ProofIcon } from "./components/Icons"
import { translate, type Lang } from "./lib/i18n"
import type { Bundle } from "./types"
import type { DecideResult } from "./lib/decide"
import type { CropForecast } from "./types"

const Plan = lazy(() => import("./screens/Plan"))
const Proof = lazy(() => import("./screens/Proof"))
const About = lazy(() => import("./screens/About"))

export type Screen = "decide" | "share" | "plan" | "proof" | "about"

export type Compare = { horizon: number; likely: number; low: number; high: number; raw: boolean }

export type View = {
  district: string
  crop: "maize" | "beans"
  quantityKg: number
  forecast: CropForecast
  verdict: DecideResult
  horizon: number
  ownCosts?: boolean
  cashOnly?: boolean
  compare: Compare
}

const NAV: [Screen, (props: { className?: string }) => React.ReactNode][] = [
  ["decide", DecideIcon],
  ["plan", PlanIcon],
  ["proof", ProofIcon],
  ["about", AboutIcon],
]

function savedLang(): Lang {
  try {
    return (localStorage.getItem("hunika-lang") as Lang) || "rw"
  } catch {
    return "rw"
  }
}

function Loading() {
  return (
    <div className="flex justify-center pt-24">
      <Mark size={48} busy />
    </div>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>(savedLang)
  const [screen, setScreen] = useState<Screen>("decide")
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [error, setError] = useState("")
  const [view, setView] = useState<View | null>(null)
  const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang])

  useEffect(() => {
    try {
      localStorage.setItem("hunika-lang", lang)
    } catch {
      // Private windows can refuse storage; the language still switches.
    }
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

  function go(next: Screen) {
    setScreen(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="phone canvas mx-auto flex min-h-dvh max-w-[480px] flex-col pb-32 shadow-[0_0_0_1px_rgba(23,23,23,0.06),0_30px_80px_-40px_rgba(23,23,23,0.35)]">
      <header className="no-print relative z-10 flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <Mark size={30} />
          <span className="display text-[26px] leading-none text-ink">{t("app.name")}</span>
        </div>
        <div className="panel flex !rounded-full p-1" role="group" aria-label="Language">
          {(["rw", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              aria-pressed={lang === code}
              className={`min-h-11 min-w-12 rounded-full px-3 text-sm font-semibold transition-colors ${lang === code ? "bg-ink text-white" : "text-muted"}`}
              onClick={() => setLang(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {!bundle ? (
          error ? <p className="px-5 pt-16 text-lg">{error}</p> : <Loading />
        ) : (
          <>
            <div hidden={screen !== "decide"}>
              <Decide bundle={bundle} t={t} onView={setView} onShare={() => go("share")} />
            </div>
            {screen === "share" ? <Share t={t} view={view} onDecide={() => go("decide")} /> : null}
            <Suspense fallback={<Loading />}>
              {screen === "plan" ? <Plan bundle={bundle} t={t} /> : null}
              {screen === "proof" ? <Proof bundle={bundle} t={t} /> : null}
              {screen === "about" ? <About bundle={bundle} t={t} /> : null}
            </Suspense>
          </>
        )}
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] px-2 pb-[max(10px,env(safe-area-inset-bottom))] min-[400px]:px-3">
        <div className="panel flex p-1 min-[400px]:p-1.5">
          {NAV.map(([item, Icon]) => {
            const active = screen === item
            return (
              <button
                key={item}
                type="button"
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] px-0 text-[10px] leading-tight font-semibold tracking-[-0.02em] transition-colors min-[400px]:text-[11px] ${active ? "bg-grass-100 text-grass-800" : "text-faint"}`}
                onClick={() => go(item)}
              >
                <Icon />
                <span className="whitespace-nowrap">{t(`nav.${item}`)}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
