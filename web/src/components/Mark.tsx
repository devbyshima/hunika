// Hunika's pixel mark: a sprout of square pixels, two leaves over a stem and
// a line of soil. `busy` makes the pixels shimmer upward while data loads.

const ROWS = [
  ".LL.LL.",
  "LLG.GLL",
  ".LGSGL.",
  "...S...",
  "...S...",
  "DDDDDDD",
]
const FILL: Record<string, [string, number]> = {
  L: ["#45a535", 1],
  G: ["#276b1f", 1],
  S: ["#1f5418", 1],
  D: ["#171717", 0.85],
}

const CELLS = ROWS.flatMap((row, y) =>
  row.split("").flatMap((code, x) => (FILL[code] ? [{ x, y, code }] : [])),
)

export function Mark({ size = 28, busy = false, className = "" }: { size?: number; busy?: boolean; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 34 34" className={`shrink-0 ${busy ? "pixel-shimmer" : ""} ${className}`}>
      {CELLS.map(({ x, y, code }) => (
        <rect
          key={`${x}-${y}`}
          x={x * 5}
          y={y * 5 + 2}
          width={4}
          height={4}
          rx={0.6}
          fill={FILL[code][0]}
          fillOpacity={FILL[code][1]}
          style={busy ? { animationDelay: `${(ROWS.length - y) * 0.12}s` } : undefined}
        />
      ))}
    </svg>
  )
}
