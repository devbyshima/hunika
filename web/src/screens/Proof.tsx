import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { money } from "../lib/format"
import type { Bundle, NetStats } from "../types"

type T = (key: string, vars?: Record<string, string | number>) => string

const OPTION_KEYS: Record<string, string> = {
  home_bags: "decide.home",
  hermetic_bags: "decide.hermetic",
  warehouse: "decide.warehouse",
}

function signed(value: number) {
  return `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-xs leading-snug text-[#5c564c]">{label}</p>
      <p className={`ledger mt-1 text-xl ${tone === "bad" ? "text-[#9a3412]" : tone === "good" ? "text-[#14532d]" : ""}`}>{value}</p>
    </div>
  )
}

function Row({ name, stats, t }: { name: string; stats: NetStats; t: T }) {
  return (
    <tr className="border-t border-[#e0d6c4]">
      <td className="py-2 pr-2">{name}</td>
      <td className={`py-2 pr-2 text-right ${stats.mean_gain_rwf_per_tonne < 0 ? "text-[#9a3412]" : ""}`}>{signed(stats.mean_gain_rwf_per_tonne)}</td>
      <td className="py-2 pr-2 text-right">{pct(stats.share_not_worse_than_selling)}</td>
      <td className="py-2 text-right">{t("proof.storedOf", { stored: stats.store_count, n: stats.n_decisions })}</td>
    </tr>
  )
}

export default function Proof({ bundle, t }: { bundle: Bundle; t: T }) {
  const backtest = bundle.backtest
  const head = backtest.headline
  const v1 = backtest.models.find((row) => row.model === "v1")
  const v2 = backtest.models.find((row) => row.model === "v2")
  const seasons = backtest.seasons.map((row) => ({
    name: `${row.year} ${row.crop === "maize" ? t("decide.maize") : t("decide.beans")} ${row.season}`,
    value: Math.round(row.gain_rwf_per_tonne),
  }))
  const byOption = backtest.net.filter((row) => row.model === "v1")
  const byCrop = backtest.net_by_crop.filter((row) => row.model === head?.model && row.option === head?.option)
  const byDistrict = backtest.net_by_district.filter((row) => row.model === head?.model && row.option === head?.option)
  const gainV1 = backtest.net.find((row) => row.model === "v1" && row.option === head?.option)
  const gainV2 = backtest.net.find((row) => row.model === "v2" && row.option === head?.option)

  return (
    <div className="px-4 pt-5 pb-4">
      <h1 className="text-lg font-semibold">{t("proof.title")}</h1>
      {head ? (
        <>
          <p className={`ledger mt-3 text-5xl leading-none ${head.mean_gain_rwf_per_tonne >= 0 ? "text-[#14532d]" : "text-[#9a3412]"}`}>
            {signed(head.mean_gain_rwf_per_tonne)}
          </p>
          <p className="mt-2 text-lg leading-snug">{t("proof.headline", { option: t(OPTION_KEYS[head.option]) })}</p>
          <p className="mt-2 text-sm leading-snug text-[#5c564c]">{t("proof.headlineNote", { n: head.n_decisions, francs: backtest.francs })}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label={t("proof.notWorse")} value={pct(head.share_not_worse_than_selling)} />
            <Stat label={t("proof.stored")} value={t("proof.storedOf", { stored: head.store_count, n: head.n_decisions })} />
            <Stat label={t("proof.range")} value={`${signed(head.p10_gain_rwf_per_tonne)} / ${signed(head.p90_gain_rwf_per_tonne)}`} />
            <Stat
              label={t("proof.worst", { crop: t(`decide.${head.worst.crop}`), district: head.worst.district, season: head.worst.season, year: head.worst.year })}
              value={signed(head.worst.gain_rwf_per_tonne)}
              tone="bad"
            />
          </div>
          {head.mean_always_store_4_rwf_per_tonne != null ? (
            <p className="mt-3 text-sm leading-snug">
              {t("proof.alwaysStore", {
                amount: signed(head.mean_always_store_4_rwf_per_tonne),
                share: pct(head.share_always_store_4_losing ?? 0),
              })}
            </p>
          ) : null}

          <h2 className="mt-6 text-sm font-semibold">{t("proof.bySeason")}</h2>
          <div className="mt-2 w-full" style={{ height: Math.max(220, seasons.length * 16) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasons} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 9 }} interval={0} />
                <ReferenceLine x={0} stroke="#1c1915" />
                <Tooltip formatter={(value) => `${signed(Number(value))} RWF/t`} />
                <Bar dataKey="value">
                  {seasons.map((row) => (
                    <Cell key={row.name} fill={row.value < 0 ? "#9a3412" : row.value === 0 ? "#c4a574" : "#14532d"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs leading-snug text-[#5c564c]">{t("proof.bySeasonNote")}</p>

          <h2 className="mt-6 text-sm font-semibold">{t("proof.byOption")}</h2>
          <table className="mt-1 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#5c564c]">
                <th className="py-1 font-normal" />
                <th className="py-1 text-right font-normal">{t("proof.colGain")}</th>
                <th className="py-1 text-right font-normal">{t("proof.colNotWorse")}</th>
                <th className="py-1 text-right font-normal">{t("proof.colStored")}</th>
              </tr>
            </thead>
            <tbody>
              {byOption.map((row) => (
                <Row key={row.option} name={t(OPTION_KEYS[row.option])} stats={row} t={t} />
              ))}
              {byCrop.map((row) => (
                <Row key={row.crop} name={t(`decide.${row.crop}`)} stats={row} t={t} />
              ))}
              {byDistrict.map((row) => (
                <Row key={row.district} name={row.district} stats={row} t={t} />
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs leading-snug text-[#5c564c]">{t("proof.tableNote", { option: t(OPTION_KEYS[head.option]) })}</p>

          <h2 className="mt-6 text-sm font-semibold">{t("proof.losing")}</h2>
          <ul className="mt-1 text-sm leading-6">
            {backtest.losing_seasons.map((row) => (
              <li key={`${row.crop}-${row.district}-${row.season}-${row.year}`}>
                {t(`decide.${row.crop}`)} · {row.district} {row.season} {row.year} · {t("decide.plusMonths", { months: row.horizon })}: {signed(row.gain_rwf_per_tonne)}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm leading-snug">{t("proof.losingMore", { count: head.losing_count })}</p>
        </>
      ) : (
        <>
          <p className="ledger mt-3 text-4xl leading-tight text-[#9a3412]">{t("proof.netMissing")}</p>
          <p className="mt-3 text-sm leading-snug">{t("proof.netWhy")}</p>
        </>
      )}

      <h2 className="mt-6 text-sm font-semibold">{t("proof.models")}</h2>
      {v1 ? <p className="mt-1 text-sm leading-snug">{t("proof.coverage", { share: pct(v1.coverage_all), n: v1.rows_all.toLocaleString("en-US") })}</p> : null}
      {v1 && v2 && v1.pinball_mean != null && v2.pinball_mean != null && v2.coverage_compared != null && v1.coverage_compared != null ? (
        <p className="mt-2 text-sm leading-snug">
          {t("proof.v2", {
            n: v2.rows_compared.toLocaleString("en-US"),
            v1: v1.pinball_mean.toFixed(1),
            v2: v2.pinball_mean.toFixed(1),
            c1: pct(v1.coverage_compared),
            c2: pct(v2.coverage_compared),
          })}
        </p>
      ) : null}
      {gainV1?.mean_gain_compared_rwf_per_tonne != null && gainV2?.mean_gain_compared_rwf_per_tonne != null ? (
        <p className="mt-2 text-sm leading-snug">
          {t("proof.v2Gain", {
            n: gainV2.n_compared,
            v1: signed(gainV1.mean_gain_compared_rwf_per_tonne),
            v2: signed(gainV2.mean_gain_compared_rwf_per_tonne),
          })}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-snug text-[#5c564c]">{t("proof.coverageNote")}</p>
    </div>
  )
}
