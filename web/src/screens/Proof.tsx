import { SeasonStrip, Waffle } from "../components/Charts"
import { ChevronDownPic, SealedSackPic } from "../components/Illustrations"
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

function Row({ name, stats }: { name: string; stats: NetStats }) {
  return (
    <tr className="border-t border-hair">
      <td className="py-2 pr-2">{name}</td>
      <td className={`num py-2 pr-2 text-right font-semibold ${stats.mean_gain_rwf_per_tonne < 0 ? "text-loss" : "text-grass-700"}`}>{signed(stats.mean_gain_rwf_per_tonne)}</td>
      <td className="num py-2 text-right text-muted">{pct(stats.share_not_worse_than_selling)}</td>
    </tr>
  )
}

function Group({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={3} className="eyebrow pt-4 pb-1">
        {title}
      </td>
    </tr>
  )
}

export default function Proof({ bundle, t }: { bundle: Bundle; t: T }) {
  const backtest = bundle.backtest
  const head = backtest.headline
  if (!head) {
    return (
      <div className="px-4 pt-7">
        <h1 className="display px-1 text-[30px] leading-[1.05]">{t("proof.title")}</h1>
        <p className="font-body mt-4 px-1 text-muted">{t("proof.netMissing")}</p>
      </div>
    )
  }

  const v1 = backtest.models.find((row) => row.model === "v1")
  const byOption = backtest.net.filter((row) => row.model === "v1")
  const home = byOption.find((row) => row.option === "home_bags")
  const byCrop = backtest.net_by_crop.filter((row) => row.model === head.model && row.option === head.option)
  const beans = byCrop.find((row) => row.crop === "beans")
  const byDistrict = backtest.net_by_district.filter((row) => row.model === head.model && row.option === head.option)
  const gainV1 = backtest.net.find((row) => row.model === "v1" && row.option === head.option)
  const gainV2 = backtest.net.find((row) => row.model === "v2" && row.option === head.option)
  const checks = (backtest.sensitivity ?? []).filter((row) => row.option === head.option)
  const seasons = backtest.seasons
  const years = (backtest.years ?? "").split("-")
  const saved = home?.mean_store_4_when_sell_rwf_per_tonne

  return (
    <div className="px-4 pt-7 pb-3">
      <h1 className="display px-1 text-[30px] leading-[1.05]">{t("proof.title")}</h1>
      <p className="font-body mt-1.5 px-1 text-sm text-muted">{t("proof.lead", { n: head.n_decisions, years: backtest.years ?? "" })}</p>

      <section className="panel mt-5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-grass-800">
          <SealedSackPic className="size-5" />
          {t(OPTION_KEYS[head.option])}
        </div>
        <p className="display num mt-3 text-[52px] leading-none text-grass-700">{signed(head.mean_gain_rwf_per_tonne)}</p>
        <p className="font-body mt-2 text-sm text-muted">{t("proof.headline")}</p>
      </section>

      <section className="card mt-3 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="display num text-[34px] leading-none">{pct(head.share_not_worse_than_selling)}</p>
            <p className="font-body mt-1.5 text-sm text-muted">{t("proof.notWorse")}</p>
          </div>
          <Waffle share={head.share_not_worse_than_selling} />
        </div>
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {head.mean_gain_when_stored_rwf_per_tonne != null ? (
          <div className="card p-4">
            <p className="display num text-[24px] leading-none text-grass-700">{signed(head.mean_gain_when_stored_rwf_per_tonne)}</p>
            <p className="font-body mt-2 text-xs leading-snug text-muted">{t("proof.whenStore")}</p>
          </div>
        ) : null}
        {saved != null ? (
          <div className="rounded-[16px] bg-grass-800 p-4 text-white">
            <p className="display num text-[24px] leading-none">{money(Math.abs(saved))}</p>
            <p className="font-body mt-2 text-xs leading-snug text-white/80">{t("proof.avoid")}</p>
          </div>
        ) : null}
      </div>

      {seasons.length ? (
        <section className="card mt-3 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">{t("proof.bySeason")}</p>
            <p className="flex items-center gap-2 text-[11px] text-faint">
              <span className="inline-flex items-center gap-1">
                <i className="inline-block size-2 rounded-[2px] bar-grass" />
                {t("proof.up")}
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="inline-block size-2 rounded-[2px] bar-loss" />
                {t("proof.down")}
              </span>
            </p>
          </div>
          <div className="mt-3">
            <SeasonStrip values={seasons.map((row) => row.gain_rwf_per_tonne)} first={years[0] ?? ""} last={years[1] ?? ""} />
          </div>
        </section>
      ) : null}

      <details className="card mt-3 px-4">
        <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">
          {t("proof.details")}
          <ChevronDownPic className="chevron ml-auto size-4 shrink-0 text-faint" />
        </summary>
        <div className="pb-4 text-sm">
          {beans ? (
            <p className="font-body mt-1 rounded-[12px] bg-grass-50 p-3 text-grass-800">
              <span className="num font-semibold">{signed(beans.mean_gain_rwf_per_tonne * 100)} RWF</span> · {t("proof.coop")}
            </p>
          ) : null}
          <table className="mt-2 w-full">
            <thead>
              <tr className="text-left text-[11px] text-faint">
                <th className="py-1 font-normal" />
                <th className="py-1 text-right font-normal">RWF/t</th>
                <th className="py-1 text-right font-normal">{t("proof.colNotWorse")}</th>
              </tr>
            </thead>
            <tbody>
              <Group title={t("proof.groupStorage")} />
              {byOption.map((row) => (
                <Row key={row.option} name={t(OPTION_KEYS[row.option])} stats={row} />
              ))}
              <Group title={t("proof.groupCrop")} />
              {byCrop.map((row) => (
                <Row key={row.crop} name={t(`decide.${row.crop}`)} stats={row} />
              ))}
              <Group title={t("proof.groupDistrict")} />
              {byDistrict.map((row) => (
                <Row key={row.district} name={row.district} stats={row} />
              ))}
            </tbody>
          </table>

          <p className="eyebrow mt-5">{t("proof.losing")}</p>
          <ul className="num mt-1">
            {backtest.losing_seasons.slice(0, 3).map((row) => (
              <li key={`${row.crop}-${row.district}-${row.season}-${row.year}`} className="flex justify-between gap-3 border-b border-hair py-1.5 last:border-0">
                <span>
                  {t(`decide.${row.crop}`)} · {row.district} {row.season} {row.year}
                </span>
                <span className="font-semibold text-loss">{signed(row.gain_rwf_per_tonne)}</span>
              </li>
            ))}
          </ul>

          <p className="eyebrow mt-5">{t("proof.models")}</p>
          {v1 ? <p className="font-body mt-1">{t("proof.coverage", { share: pct(v1.coverage_all) })}</p> : null}
          {gainV1?.mean_gain_compared_rwf_per_tonne != null && gainV2?.mean_gain_compared_rwf_per_tonne != null ? (
            <p className="font-body mt-1 text-muted">{t("proof.v2Short", { v1: signed(gainV1.mean_gain_compared_rwf_per_tonne), v2: signed(gainV2.mean_gain_compared_rwf_per_tonne) })}</p>
          ) : null}

          {checks.length ? (
            <>
              <p className="eyebrow mt-5">{t("proof.checks")}</p>
              <table className="mt-1 w-full">
                <tbody>
                  {checks.map((row) => (
                    <tr key={row.case} className="border-t border-hair first:border-0">
                      <td className="py-1.5 pr-2">{t(`proof.case.${row.case}`)}</td>
                      <td className={`num py-1.5 text-right font-semibold ${row.mean_gain_rwf_per_tonne < 0 ? "text-loss" : "text-grass-700"}`}>{signed(row.mean_gain_rwf_per_tonne)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
          <p className="font-body mt-4 text-xs text-faint">{t("proof.money")}</p>
        </div>
      </details>
    </div>
  )
}
