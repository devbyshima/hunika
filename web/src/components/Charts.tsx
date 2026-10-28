// Small SVG and CSS charts that stand in for sentences.

import { money } from "../lib/format"

/** Sell now against storing: two bars, the store bar with its likely range as a pale band. */
export function ValueBars({
  sellLabel,
  storeLabel,
  now,
  likely,
  low,
  high,
  better,
}: {
  sellLabel: string
  storeLabel: string
  now: number
  likely: number
  low: number
  high: number
  better: "sell" | "store"
}) {
  const top = Math.max(now, high, likely) * 1.04
  const pct = (value: number) => `${Math.max(0, (value / top) * 100)}%`
  return (
    <div className="grid gap-3">
      <div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className={better === "sell" ? "font-semibold text-ink" : "text-muted"}>{sellLabel}</span>
          <span className="num font-semibold">{money(now)}</span>
        </div>
        <div className="relative mt-1.5 h-3 overflow-hidden rounded-full bg-paper">
          <div className={`absolute inset-y-0 left-0 rounded-full ${better === "sell" ? "bg-ink" : "bg-ghost"}`} style={{ width: pct(now) }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className={better === "store" ? "font-semibold text-grass-800" : "text-muted"}>{storeLabel}</span>
          <span className="num font-semibold">{money(likely)}</span>
        </div>
        <div className="relative mt-1.5 h-3 overflow-hidden rounded-full bg-paper">
          <div className="absolute inset-y-0 rounded-full bg-grass-200" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
          <div className={`absolute inset-y-0 left-0 rounded-full ${better === "store" ? "bg-grass-700" : "bg-grass-400"}`} style={{ width: pct(likely) }} />
        </div>
        <div className="num mt-1 text-right text-[11px] text-faint">
          {money(low)} – {money(high)}
        </div>
      </div>
    </div>
  )
}

type Point = { label: string; p10: number; p50: number; p90: number }

/** Price path from today: a pale band for the likely range and a line for the likely price. */
export function Spark({ points, mark, height = 96 }: { points: Point[]; mark?: number; height?: number }) {
  const width = 300
  const padX = 14
  const padTop = 16
  const padBottom = 20
  const values = points.flatMap((point) => [point.p10, point.p90])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (index: number) => padX + (index * (width - 2 * padX)) / Math.max(1, points.length - 1)
  const y = (value: number) => padTop + (1 - (value - min) / span) * (height - padTop - padBottom)
  const band = [
    ...points.map((point, index) => `${x(index)},${y(point.p90)}`),
    ...points.map((point, index) => `${x(points.length - 1 - index)},${y(points[points.length - 1 - index].p10)}`),
  ].join(" ")
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.p50)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
      <polygon points={band} fill="#e2f2d8" />
      <path d={line} fill="none" stroke="#276b1f" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => {
        const chosen = index === mark
        const first = index === 0
        return (
          <g key={point.label}>
            <circle cx={x(index)} cy={y(point.p50)} r={chosen ? 5 : 3} fill={chosen ? "#276b1f" : "#fff"} stroke="#276b1f" strokeWidth={2} />
            {chosen || first ? (
              <text x={x(index)} y={y(point.p50) - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill={chosen ? "#1f5418" : "#525252"}>
                {money(point.p50)}
              </text>
            ) : null}
            <text x={x(index)} y={height - 4} textAnchor="middle" fontSize={10} fill={chosen ? "#1f5418" : "#737373"} fontWeight={chosen ? 700 : 400}>
              {point.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** One dot per past window: filled where the price was higher by then. */
export function PastDots({ up, n }: { up: number; n: number }) {
  const shown = Math.min(n, 30)
  const filled = Math.round((up / Math.max(1, n)) * shown)
  return (
    <div className="flex flex-wrap gap-1" aria-hidden>
      {Array.from({ length: shown }, (_, index) => (
        <span key={index} className={`size-2.5 rounded-[3px] ${index < filled ? "bg-grass-500" : "border border-line bg-white"}`} />
      ))}
    </div>
  )
}

/** Three rising bars for the chance of losing money. */
export function RiskMeter({ level }: { level: 0 | 1 | 2 }) {
  const color = level === 0 ? "bg-grass-500" : level === 1 ? "bg-warn" : "bg-loss"
  return (
    <span className="inline-flex h-6 items-end gap-1" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span key={index} className={`w-2.5 rounded-[3px] ${index <= level ? color : "bg-line"}`} style={{ height: 10 + index * 7 }} />
      ))}
    </span>
  )
}

/** Twenty squares: the share of decisions that were at least as good as selling. */
export function Waffle({ share }: { share: number }) {
  const good = Math.round(share * 20)
  return (
    <div className="grid w-fit grid-cols-10 gap-1" aria-hidden>
      {Array.from({ length: 20 }, (_, index) => (
        <span key={index} className={`size-3.5 rounded-[3px] ${index < good ? "bg-grass-500" : "bg-loss"}`} />
      ))}
    </div>
  )
}

/** Every past season as a thin bar: up for a gain, down for a loss. */
export function SeasonStrip({ values, first, last }: { values: number[]; first: string; last: string }) {
  const width = 300
  const height = 84
  const mid = height / 2 - 6
  const top = Math.max(1, ...values.map((value) => Math.abs(value)))
  const step = width / values.length
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
      <line x1={0} x2={width} y1={mid} y2={mid} stroke="rgba(23,23,23,0.2)" />
      {values.map((value, index) => {
        const size = (Math.abs(value) / top) * (mid - 4)
        const barX = index * step + step * 0.18
        const barW = step * 0.64
        if (value === 0) return <rect key={index} x={barX} y={mid - 1} width={barW} height={2} fill="#c9c9c3" />
        return <rect key={index} x={barX} y={value > 0 ? mid - size : mid} width={barW} height={Math.max(1.5, size)} rx={1} fill={value > 0 ? "#45a535" : "#b42318"} />
      })}
      <text x={0} y={height - 2} fontSize={10} fill="#737373">{first}</text>
      <text x={width} y={height - 2} fontSize={10} fill="#737373" textAnchor="end">{last}</text>
    </svg>
  )
}

/** A centred bar for a change against normal, green to the right, grey to the left. */
export function ChangeBar({ value, limit = 0.6 }: { value: number; limit?: number }) {
  const share = Math.min(1, Math.abs(value) / limit) * 50
  return (
    <div className="relative h-2 w-full rounded-full bg-paper" aria-hidden>
      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
      <span className={`absolute inset-y-0 rounded-full ${value >= 0 ? "left-1/2 bg-grass-500" : "right-1/2 bg-ghost"}`} style={{ width: `${share}%` }} />
    </div>
  )
}
