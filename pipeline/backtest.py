"""Forecast backtest with no look-ahead.

Net RWF per tonne needs the storage rates in assumptions.yaml. Those rates are
still blank, so this module scores the price band and a price-only comparison.
The price-only figures ignore losses, fees and interest. They are not the
headline gain.
"""

from __future__ import annotations

import pandas as pd
import yaml

from pipeline.model import _nominal, _pool_ratios, _quantile_or_none, _series_map, inflation_at, retail
from pipeline.months import add_months, blend
from pipeline.paths import CONFIG, EASTERN_DISTRICTS, PROCESSED

MIN_YEARS = 4


def _month_value(frame: pd.DataFrame, month: str, column: str) -> float | None:
    part = frame[frame["month"].eq(month)]
    if part.empty or column not in part.columns or part[column].isna().all():
        return None
    return float(part[column].median())


def _band(local_markets, province_markets, calendar_month, horizon, before):
    local_ratios, local_years = _pool_ratios(local_markets, calendar_month, horizon, before)
    province_ratios, _ = _pool_ratios(province_markets, calendar_month, horizon, before)
    blended, _weight = blend(_quantile_or_none(local_ratios), _quantile_or_none(province_ratios), len(local_years))
    if blended is None or len(local_years) < MIN_YEARS and _quantile_or_none(province_ratios) is None:
        return None
    return blended


def run_backtest(panel: pd.DataFrame, cpi: pd.DataFrame, seasons: dict) -> dict:
    rows = []
    for crop in ("maize", "beans"):
        east = retail(panel, crop)
        by_market = _series_map(east)
        for district in EASTERN_DISTRICTS:
            local = east[east["admin2"].eq(district)]
            local_markets = {name: by_market[name] for name in local["market"].unique() if name in by_market}
            crop_seasons = (seasons.get("crops") or {}).get(crop) or {}
            for season, spec in crop_seasons.items():
                if not spec:
                    continue
                decision_month = int(spec["decision_month"])
                shift = int(spec["year_shift"])
                years = range(int(spec["year_min"]), int(spec["year_max"]) + 1)
                for year in years:
                    decision_year = year + shift
                    decision_ym = f"{decision_year:04d}-{decision_month:02d}"
                    as_of = f"{decision_ym}-15"
                    cpi_info = inflation_at(cpi, as_of)
                    if cpi_info is None:
                        continue
                    local_now = _month_value(local, decision_ym, "price_rwf_per_kg")
                    province_now = _month_value(east, decision_ym, "price_rwf_per_kg")
                    if local_now is None and province_now is None:
                        continue
                    price_pooled = local_now is None
                    price_now = province_now if price_pooled else local_now
                    scored_frame = east if price_pooled else local
                    real_now = _month_value(scored_frame, decision_ym, "price_real")
                    forecasts = {}
                    for horizon in (1, 2, 3, 4):
                        blended = _band(local_markets, by_market, decision_month, horizon, decision_ym)
                        if blended is None or real_now is None:
                            continue
                        nominal = [
                            _nominal(price_now, ratio, cpi_info["trailing_12m_inflation"], horizon)
                            for ratio in blended
                        ]
                        real_band = [real_now * ratio for ratio in blended]
                        future = add_months(decision_ym, horizon)
                        actual = _month_value(scored_frame, future, "price_rwf_per_kg")
                        actual_real = _month_value(scored_frame, future, "price_real")
                        if actual is None or actual_real is None:
                            continue
                        forecasts[horizon] = {
                            "p10": nominal[0],
                            "p50": nominal[1],
                            "p90": nominal[2],
                            "real_p10": real_band[0],
                            "real_p50": real_band[1],
                            "real_p90": real_band[2],
                            "actual": actual,
                            "actual_real": actual_real,
                            "inside_nominal": nominal[0] <= actual <= nominal[2],
                            "inside": real_band[0] <= actual_real <= real_band[2],
                        }
                    if not forecasts:
                        continue
                    best = max(forecasts, key=lambda horizon: forecasts[horizon]["real_p50"])
                    chosen = forecasts[best]
                    # Cash gain is nominal. It includes inflation, so it is not the net result.
                    gross_follow = (chosen["actual"] - price_now) * 1000 if chosen["p50"] > price_now else 0.0
                    real_follow = (chosen["actual_real"] - real_now) * 1000 if chosen["real_p50"] > real_now else 0.0
                    gross_hold4 = None
                    if 4 in forecasts:
                        gross_hold4 = (forecasts[4]["actual"] - price_now) * 1000
                    for horizon, item in forecasts.items():
                        rows.append(
                            {
                                "crop": crop,
                                "district": district,
                                "season": season,
                                "year": year,
                                "horizon": horizon,
                                "price_pooled": price_pooled,
                                "price_now": price_now,
                                "p10": item["p10"],
                                "p50": item["p50"],
                                "p90": item["p90"],
                                "actual": item["actual"],
                                "inside": item["inside"],
                                "inside_nominal": item["inside_nominal"],
                                "pinball_10": _pinball(item["actual_real"], item["real_p10"], 0.1),
                                "pinball_50": _pinball(item["actual_real"], item["real_p50"], 0.5),
                                "pinball_90": _pinball(item["actual_real"], item["real_p90"], 0.9),
                                "chosen_horizon": best,
                                "gross_follow_rwf_per_tonne": gross_follow if horizon == best else None,
                                "real_follow_rwf_per_tonne": real_follow if horizon == best else None,
                                "gross_hold4_rwf_per_tonne": gross_hold4 if horizon == best else None,
                            }
                        )
    detail = pd.DataFrame(rows)
    return {"detail": detail, "summary": _summarise(detail)}


def _pinball(actual: float, predicted: float, quantile: float) -> float:
    gap = actual - predicted
    below = 1.0 if actual < predicted else 0.0
    return (quantile - below) * gap


def _summarise(detail: pd.DataFrame) -> dict:
    blocked = (
        "Net gain per tonne is not calculated. Monthly loss rates, bag costs and "
        "the interest rate are still blank in config/assumptions.yaml."
    )
    if detail.empty:
        return {
            "net_gain_rwf_per_tonne": None,
            "net_blocked_reason": blocked,
            "coverage": [],
            "pinball": [],
            "price_only_before_storage_costs": None,
        }
    coverage = []
    for keys, part in detail.groupby(["crop", "district", "horizon"]):
        crop, district, horizon = keys
        coverage.append(
            {
                "crop": crop,
                "district": district,
                "horizon": int(horizon),
                "n": int(len(part)),
                "inside": int(part["inside"].sum()),
                "share": float(part["inside"].mean()),
            }
        )
    pinball = []
    for keys, part in detail.groupby(["crop", "horizon"]):
        crop, horizon = keys
        pinball.append(
            {
                "crop": crop,
                "horizon": int(horizon),
                "n": int(len(part)),
                "p10": float(part["pinball_10"].mean()),
                "p50": float(part["pinball_50"].mean()),
                "p90": float(part["pinball_90"].mean()),
            }
        )
    decisions = detail[detail["gross_follow_rwf_per_tonne"].notna()].copy()
    losing = decisions[decisions["real_follow_rwf_per_tonne"] < 0]
    price_only = {
        "label": "Price change only, before storage losses, fees and interest. Not the Hunika net gain. The nominal mean includes inflation.",
        "n_decisions": int(len(decisions)),
        "mean_nominal_follow_rwf_per_tonne": float(decisions["gross_follow_rwf_per_tonne"].mean()) if len(decisions) else None,
        "mean_real_follow_rwf_per_tonne": float(decisions["real_follow_rwf_per_tonne"].mean()) if len(decisions) else None,
        "mean_always_store_4_nominal_rwf_per_tonne": float(decisions["gross_hold4_rwf_per_tonne"].dropna().mean()) if decisions["gross_hold4_rwf_per_tonne"].notna().any() else None,
        "mean_always_sell_rwf_per_tonne": 0,
        "share_real_follow_not_below_sell": float((decisions["real_follow_rwf_per_tonne"] >= 0).mean()) if len(decisions) else None,
        "worst_real_follow_rwf_per_tonne": float(decisions["real_follow_rwf_per_tonne"].min()) if len(decisions) else None,
        "losing_count": int(len(losing)),
        "nominal_band_share": float(detail["inside_nominal"].mean()) if "inside_nominal" in detail else None,
        "losing_seasons": [
            {
                "crop": row.crop,
                "district": row.district,
                "season": row.season,
                "year": int(row.year),
                "real_follow_rwf_per_tonne": round(float(row.real_follow_rwf_per_tonne), 1),
            }
            for row in losing.sort_values("real_follow_rwf_per_tonne").head(12).itertuples(index=False)
        ],
    }
    return {
        "net_gain_rwf_per_tonne": None,
        "net_blocked_reason": blocked,
        "coverage": coverage,
        "pinball": pinball,
        "price_only_before_storage_costs": price_only,
    }


def load_seasons() -> dict:
    return yaml.safe_load((CONFIG / "seasons.yaml").read_text()) or {}


def main(panel=None, cpi=None):
    if panel is None:
        panel = pd.read_csv(PROCESSED / "panel_monthly.csv")
    if cpi is None:
        cpi = pd.read_csv(PROCESSED / "cpi_food.csv")
    result = run_backtest(panel, cpi, load_seasons())
    PROCESSED.mkdir(parents=True, exist_ok=True)
    if not result["detail"].empty:
        result["detail"].to_csv(PROCESSED / "backtest_rows.csv", index=False)
    print(f"backtest rows {len(result['detail'])}")
    return result
