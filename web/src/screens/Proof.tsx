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
    <div className="card p-4">
      <p className={`display num text-[28px] leading-none ${tone === "bad" ? "text-loss" : tone === "good" ? "text-grass-700" : ""}`}>{value}</p>
      <p className="mt-2 text-xs leading-snug text-muted">{label}</p>
    </div>
  )
}

function Row({ name, stats, t }: { name: string; stats: NetStats; t: T }) {
  return (
    <tr className="border-t border-hair">
      <td className="py-2.5 pr-2">{name}</td>
      <td className={`num py-2.5 pr-2 text-right font-semibold ${stats.mean_gain_rwf_per_tonne < 0 ? "text-loss" : "text-grass-700"}`}>{signed(stats.mean_gain_rwf_per_tonne)}</td>
      <td className="num py-2.5 pr-2 text-right">{pct(stats.share_not_worse_than_selling)}</td>
      <td className="num py-2.5 text-right text-muted">{t("proof.storedOf", { stored: stats.store_count, n: stats.n_decisions })}</td>
    </tr>
  )
}

function Group({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={4} className="eyebrow pt-5 pb-1.5">
        {title}
      </td>
    </tr>
  )
}

export default function Proof({ bundle, t }: { bundle: Bundle; t: T }) {
  const backtest = bundle.backtest
  const head = backtest.headline
  const v1 = backtest.models.find((row) => row.model === "v1")
  const v2 = backtest.models.find((row) => row.model === "v2")
  const seasons = backtest.seasons.map((row) => ({
    name: `${row.year} ${t(`decide.${row.crop}`)} ${row.season}`,
    value: Math.round(row.gain_rwf_per_tonne),
  }))
  const byOption = backtest.net.filter((row) => row.model === "v1")
  const home = byOption.find((row) => row.option === "home_bags")
  const byCrop = backtest.net_by_crop.filter((row) => row.model === head?.model && row.option === head?.option)
  const beans = byCrop.find((row) => row.crop === "beans")
  const byDistrict = backtest.net_by_district.filter((row) => row.model === head?.model && row.option === head?.option)
  const gainV1 = backtest.net.find((row) => row.model === "v1" && row.option === head?.option)
  const gainV2 = backtest.net.find((row) => row.model === "v2" && row.option === head?.option)
  const checks = (backtest.sensitivity ?? []).filter((row) => row.option === head?.option)
  const optionName = head ? t(OPTION_KEYS[head.option]).toLowerCase() : ""

  if (!head) {
    return (
      <div className="px-4 pt-8 pb-4">
        <h1 className="display px-1 text-[34px] leading-[1.02] tracking-[-0.02em]">{t("proof.title")}</h1>
        <p className="display mt-4 text-3xl leading-tight text-ghost">{t("proof.netMissing")}</p>
        <p className="mt-3 text-sm leading-snug">{t("proof.netWhy")}</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-8 pb-4">
      <h1 className="display px-1 text-[34px] leading-[1.02] tracking-[-0.02em]">{t("proof.title")}</h1>
      <p className="mt-3 px-1 text-[13px] leading-snug text-muted">{t("proof.lead", { n: head.n_decisions, years: backtest.years ?? "" })}</p>

      <section className="panel mt-6 p-5">
      <p className={`display num text-[60px] leading-none tracking-[-0.02em] ${head.mean_gain_rwf_per_tonne >= 0 ? "text-grass-700" : "text-loss"}`}>
        {signed(head.mean_gain_rwf_per_tonne)}
      </p>
      <p className="mt-3 text-[17px] leading-snug">{t("proof.headline", { option: optionName })}</p>

      </section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label={t("proof.notWorse")} value={pct(head.share_not_worse_than_selling)} tone="good" />
        {head.mean_gain_when_stored_rwf_per_tonne != null ? (
          <Stat label={t("proof.whenStore", { stored: head.store_count })} value={signed(head.mean_gain_when_stored_rwf_per_tonne)} tone="good" />
        ) : null}
      </div>

      {home?.mean_store_4_when_sell_rwf_per_tonne != null ? (
        <section className="mt-3 rounded-[16px] bg-grass-800 p-5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-grass-200">{t("proof.avoidTitle")}</p>
          <p className="display num mt-2 text-[36px] leading-none">{signed(home.mean_store_4_when_sell_rwf_per_tonne)}</p>
          <p className="mt-2 text-sm leading-snug text-white/85">
            {t("proof.avoid", {
              n: home.n_decisions - home.store_count,
              share: pct(home.share_store_4_losing_when_sell ?? 0),
            })}
          </p>
        </section>
      ) : null}

      {beans ? (
        <section className="card mt-3 p-5">
          <p className="eyebrow">{t("proof.coopTitle")}</p>
          <p className="display num mt-2 text-[36px] leading-none text-grass-700">{signed(beans.mean_gain_rwf_per_tonne * 100)} RWF</p>
          <p className="mt-2 text-sm leading-snug text-muted">{t("proof.coop", { option: optionName, pct: pct(beans.share_not_worse_than_selling) })}</p>
        </section>
      ) : null}

      {head.mean_always_store_4_rwf_per_tonne != null ? (
        <p className="mt-4 px-1 text-sm leading-snug text-muted">
          {t("proof.alwaysStore", {
            option: optionName,
            amount: signed(head.mean_always_store_4_rwf_per_tonne),
            share: pct(head.share_always_store_4_losing ?? 0),
            ours: pct(1 - head.share_not_worse_than_selling),
          })}
        </p>
      ) : null}

      <h2 className="eyebrow mt-8 px-1">{t("proof.bySeason")}</h2>
      <div className="card mt-2 p-3">
      <div className="mt-2 w-full" style={{ height: Math.max(220, seasons.length * 16) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={seasons} layout="vertical" margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "#737373" }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 9, fill: "#525252" }} axisLine={false} tickLine={false} interval={0} />
            <ReferenceLine x={0} stroke="#171717" />
            <Tooltip formatter={(value) => `${signed(Number(value))} RWF/t`} />
            <Bar dataKey="value">
              {seasons.map((row) => (
                <Cell key={row.name} fill={row.value < 0 ? "#b42318" : row.value === 0 ? "#c9c9c3" : "#45a535"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      </div>
      <p className="mt-2 px-1 text-xs leading-snug text-faint">{t("proof.bySeasonNote")}</p>

      <h2 className="eyebrow mt-8 px-1">{t("proof.byOption")}</h2>
      <div className="card mt-2 px-4 pb-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="py-1 font-normal" />
            <th className="py-1 text-right font-normal">{t("proof.colGain")}</th>
            <th className="py-1 text-right font-normal">{t("proof.colNotWorse")}</th>
            <th className="py-1 text-right font-normal">{t("proof.colStored")}</th>
          </tr>
        </thead>
        <tbody>
          <Group title={t("proof.groupStorage")} />
          {byOption.map((row) => (
            <Row key={row.option} name={t(OPTION_KEYS[row.option])} stats={row} t={t} />
          ))}
          <Group title={t("proof.groupCrop", { option: optionName })} />
          {byCrop.map((row) => (
            <Row key={row.crop} name={t(`decide.${row.crop}`)} stats={row} t={t} />
          ))}
          <Group title={t("proof.groupDistrict", { option: optionName })} />
          {byDistrict.map((row) => (
            <Row key={row.district} name={row.district} stats={row} t={t} />
          ))}
        </tbody>
      </table>
      </div>

      <h2 className="eyebrow mt-8 px-1">{t("proof.losing")}</h2>
      <ul className="card mt-2 px-4 py-2 text-sm leading-7">
        {backtest.losing_seasons.slice(0, 5).map((row) => (
          <li key={`${row.crop}-${row.district}-${row.season}-${row.year}`} className="num flex justify-between gap-3 border-b border-hair last:border-0">
            <span>
              {t(`decide.${row.crop}`)} · {row.district} {row.season} {row.year} <span className="text-faint">· {t("decide.plusMonths", { months: row.horizon })}</span>
            </span>
            <span className="font-semibold text-loss">{signed(row.gain_rwf_per_tonne)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 px-1 text-xs leading-snug text-faint">{t("proof.losingMore", { count: head.losing_count })}</p>

      <h2 className="eyebrow mt-8 px-1">{t("proof.models")}</h2>
      <div className="card mt-2 grid gap-2 p-4">
      {v1 ? <p className="text-sm leading-snug">{t("proof.coverage", { share: pct(v1.coverage_all) })}</p> : null}
      {gainV1?.mean_gain_compared_rwf_per_tonne != null && gainV2?.mean_gain_compared_rwf_per_tonne != null ? (
        <p className="text-sm leading-snug text-muted">
          {t("proof.v2Short", { v1: signed(gainV1.mean_gain_compared_rwf_per_tonne), v2: signed(gainV2.mean_gain_compared_rwf_per_tonne) })}
        </p>
      ) : null}
      </div>
      {checks.length ? (
        <details className="card mt-3 px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">{t("proof.checks")}</summary>
          <table className="mb-3 w-full text-sm">
            <tbody>
              {checks.map((row) => (
                <tr key={row.case} className="border-t border-hair align-top">
                  <td className="py-2 pr-2 leading-snug">{t(`proof.case.${row.case}`)}</td>
                  <td className={`num py-2 pr-2 text-right font-semibold ${row.mean_gain_rwf_per_tonne < 0 ? "text-loss" : "text-grass-700"}`}>{signed(row.mean_gain_rwf_per_tonne)}</td>
                  <td className="num py-2 text-right text-muted">{pct(row.share_not_worse_than_selling)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
      <p className="mt-3 px-1 text-xs leading-snug text-faint">{t("proof.money")}</p>
    </div>
  )
}
