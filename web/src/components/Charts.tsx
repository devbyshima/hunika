// Small SVG and CSS charts that stand in for sentences.

import { useId } from "react"
import { money } from "../lib/format"

// Bars are slim, lighter at the top, and rounded only at the end that
// carries the value; the end on the baseline stays square.
const GRADIENTS = {
  grass: ["#6fc25c", "#45a535"],
  loss: ["#d2493d", "#b42318"],
  ghost: ["#d8d8d3", "#c9c9c3"],
} as const

function BarGradients({ id }: { id: string }) {
  return (
    <defs>
      {Object.entries(GRADIENTS).map(([name, [top, bottom]]) => (
        <linearGradient key={name} id={`${id}-${name}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={top} />
          <stop offset="100%" stopColor={bottom} />
        </linearGradient>
      ))}
    </defs>
  )
}

/** A bar path rounded at its top (up) or its bottom (down). */
function barPath(x: number, y: number, w: number, h: number, r: number, up: boolean) {
  const radius = Math.min(r, w / 2, h)
  if (up) {
    return `M${x},${y + h}V${y + radius}A${radius},${radius} 0 0 1 ${x + radius},${y}H${x + w - radius}A${radius},${radius} 0 0 1 ${x + w},${y + radius}V${y + h}Z`
  }
  return `M${x},${y}V${y + h - radius}A${radius},${radius} 0 0 0 ${x + radius},${y + h}H${x + w - radius}A${radius},${radius} 0 0 0 ${x + w},${y + h - radius}V${y}Z`
}

function compact(value: number) {
  const size = Math.abs(value)
  const text = size >= 1000 ? `${Math.round(size / 1000)}k` : String(Math.round(size))
  return value < 0 ? `−${text}` : text
}

function niceStep(max: number) {
  const steps = [1000, 2000, 5000, 10000, 20000, 25000, 50000, 100000, 200000, 250000, 500000]
  return steps.find((step) => step * 3 >= max) ?? Math.ceil(max / 3)
}

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
        <div className="relative mt-1.5 h-3.5">
          <div className={`absolute inset-y-0 left-0 rounded-r-[5px] ${better === "sell" ? "bar-ink" : "bar-ghost"}`} style={{ width: pct(now) }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className={better === "store" ? "font-semibold text-grass-800" : "text-muted"}>{storeLabel}</span>
          <span className="num font-semibold">{money(likely)}</span>
        </div>
        <div className="relative mt-1.5 h-3.5">
          <div className="absolute inset-y-0 rounded-r-[5px] bg-grass-100" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
          <div className={`absolute inset-y-0 left-0 rounded-r-[5px] ${better === "store" ? "bar-grass" : "bar-grass-soft"}`} style={{ width: pct(likely) }} />
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
        <span key={index} className={`size-2.5 rounded-[3px] ${index < filled ? "bar-grass" : "border border-line bg-white"}`} />
      ))}
    </div>
  )
}

/** Three rising bars for the chance of losing money. */
export function RiskMeter({ level }: { level: 0 | 1 | 2 }) {
  const color = level === 0 ? "bar-grass" : level === 1 ? "bar-warn" : "bar-loss"
  return (
    <span className="inline-flex h-6 items-end gap-1" aria-hidden>
      {[0, 1, 2].map((index) => (
        <span key={index} className={`w-2.5 rounded-t-[3px] ${index <= level ? color : "bg-line"}`} style={{ height: 10 + index * 7 }} />
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
        <span key={index} className={`cell-in size-3.5 rounded-[3px] ${index < good ? "bar-grass" : "bar-loss"}`} style={{ animationDelay: `${index * 25}ms` }} />
      ))}
    </div>
  )
}

/** Every past season as a bar, up for a gain and down for a loss, on light gridlines with values on the right. */
export function SeasonStrip({ values, first, last }: { values: number[]; first: string; last: string }) {
  const id = useId().replace(/:/g, "")
  const width = 300
  const height = 112
  const plotRight = width - 30
  const plotTop = 6
  const plotBottom = height - 18
  const most = Math.max(1, ...values.map((value) => Math.abs(value)))
  const step = niceStep(most)
  const topValue = Math.max(step, Math.ceil(Math.max(0, ...values) / step) * step)
  const bottomValue = Math.min(0, Math.floor(Math.min(0, ...values) / step) * step)
  const span = topValue - bottomValue || 1
  const y = (value: number) => plotTop + ((topValue - value) / span) * (plotBottom - plotTop)
  const slot = plotRight / values.length
  const barW = slot * 0.7
  const ticks: number[] = []
  for (let value = bottomValue; value <= topValue; value += step) ticks.push(value)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
      <BarGradients id={id} />
      {ticks.map((value) => (
        <g key={value}>
          <line x1={0} x2={plotRight} y1={y(value)} y2={y(value)} stroke="rgba(23,23,23,0.14)" strokeWidth={value === 0 ? 1 : 0.67} />
          <text x={width} y={y(value) + 3.5} fontSize={10} fill="#737373" textAnchor="end">
            {compact(value)}
          </text>
        </g>
      ))}
      {values.map((value, index) => {
        const x = index * slot + (slot - barW) / 2
        if (value === 0) return <rect key={index} x={x} y={y(0) - 1} width={barW} height={2} rx={1} fill={`url(#${id}-ghost)`} />
        const up = value > 0
        const top = up ? y(value) : y(0)
        const size = Math.max(2, Math.abs(y(value) - y(0)))
        return <path key={index} d={barPath(x, top, barW, size, 2, up)} fill={`url(#${id}-${up ? "grass" : "loss"})`} />
      })}
      <text x={0} y={height - 3} fontSize={10} fill="#737373">
        {first}
      </text>
      <text x={plotRight} y={height - 3} fontSize={10} fill="#737373" textAnchor="end">
        {last}
      </text>
    </svg>
  )
}

/** A centred bar for a change against normal, green to the right, grey to the left. */
export function ChangeBar({ value, limit = 0.6 }: { value: number; limit?: number }) {
  const share = Math.min(1, Math.abs(value) / limit) * 50
  return (
    <div className="relative h-2.5 w-full" aria-hidden>
      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
      <span className={`absolute inset-y-0 ${value >= 0 ? "left-1/2 rounded-r-[4px] bar-grass" : "right-1/2 rounded-l-[4px] bar-ghost"}`} style={{ width: `${Math.max(share, 1.5)}%` }} />
    </div>
  )
}
