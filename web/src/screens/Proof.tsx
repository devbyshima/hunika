import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { money } from "../lib/format"
import type { Bundle } from "../types"

export default function Proof({
  bundle,
  t,
}: {
  bundle: Bundle
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const coverage = bundle.backtest.coverage
  const inside = coverage.reduce((sum, row) => sum + row.inside, 0)
  const total = coverage.reduce((sum, row) => sum + row.n, 0)
  const share = total ? `${Math.round((inside / total) * 100)}% (${inside.toLocaleString("en-US")} of ${total.toLocaleString("en-US")})` : "0%"
  const price = bundle.backtest.price_only_before_storage_costs
  const byCrop = (["maize", "beans"] as const).map((crop) => {
    const rows = coverage.filter((row) => row.crop === crop)
    const cropInside = rows.reduce((sum, row) => sum + row.inside, 0)
    const cropTotal = rows.reduce((sum, row) => sum + row.n, 0)
    return { crop, inside: cropInside, total: cropTotal, share: cropTotal ? cropInside / cropTotal : 0 }
  })
  const worst = (price?.losing_seasons ?? []).map((row) => ({
    name: `${row.district} ${row.season} ${row.year}`,
    value: Math.round(row.real_follow_rwf_per_tonne),
    crop: row.crop,
  }))

  return (
    <div className="px-4 pt-5 pb-4">
      <h1 className="text-lg font-semibold">{t("proof.title")}</h1>
      <p className="ledger mt-3 text-4xl leading-tight text-[#9a3412]">{t("proof.netMissing")}</p>
      <p className="mt-3 text-sm leading-snug">{bundle.backtest.net_blocked_reason || t("proof.netWhy")}</p>
      <p className="mt-5 text-lg leading-snug">{t("proof.coverage", { share })}</p>
      <p className="mt-2 text-sm leading-snug text-[#5c564c]">{t("proof.coverageNote")}</p>
      <ul className="mt-3 text-sm leading-6">
        {byCrop.map((row) => (
          <li key={row.crop}>
            {t(`decide.${row.crop}`)}: {Math.round(row.share * 100)}% ({row.inside.toLocaleString("en-US")} / {row.total.toLocaleString("en-US")})
          </li>
        ))}
      </ul>
      {price?.mean_real_follow_rwf_per_tonne != null ? (
        <>
          <p className="mt-5 text-sm leading-snug">{t("proof.priceOnly", { amount: money(price.mean_real_follow_rwf_per_tonne) })}</p>
          <p className="mt-2 text-sm leading-snug text-[#5c564c]">{t("proof.priceOnlyNote")}</p>
        </>
      ) : null}
      <h2 className="mt-6 text-sm font-semibold">{t("proof.losing")}</h2>
      <div className="mt-2 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={worst} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => `${money(Number(value))} RWF/t`} />
            <Bar dataKey="value" fill="#9a3412" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 text-sm leading-6">
        {worst.map((row) => (
          <li key={`${row.crop}-${row.name}`}>
            {t(`decide.${row.crop}`)} · {row.name}: {money(row.value)}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-snug">{t("proof.losingMore", { count: price?.losing_count ?? 0 })}</p>
    </div>
  )
}
