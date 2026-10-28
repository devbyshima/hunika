"""Backtest with no look-ahead.

For every Eastern district, crop, season and year, the forecast uses only
prices, CPI and rainfall known before the 15th of the decision month. The
decision month itself is the most common price bottom of earlier years. The
likely range is widened by how often past ranges missed, using only forecasts
whose outcome was already known. The decision then runs through
pipeline.decide with the parameters in config/assumptions.yaml and a 1-tonne
lot, in today's money, and the real price at the chosen horizon scores it.
Money is in September 2026 francs: each cash flow is deflated by the rural
food CPI of the month it happens in.
"""

from __future__ import annotations

import pandas as pd
import yaml

from pipeline.decide import decide
from pipeline.ingest_rain import season_rain
from pipeline.model import (
    _pool_ratios,
    _quantile_or_none,
    _series_map,
    fit_width,
    inflation_at,
    retail,
    v2_quantiles,
    v2_samples,
    widen,
)
from pipeline.months import add_months, blend
from pipeline.paths import CONFIG, EASTERN_DISTRICTS, PROCESSED
from pipeline.seasons import province_series, rolling_months

MIN_YEARS = 4
LOT_KG = 1000
OPTIONS = ("home_bags", "hermetic_bags", "warehouse")
MODELS = ("v1", "v2")
HEADLINE = {"model": "v1", "option": "hermetic_bags"}
# real: the forecast price is in today's money, as the backtest scores it.
# calibrate: widen the range by its past misses. months: rolling or fixed.
DEFAULT_SETTINGS = {"real": True, "calibrate": True, "months": "rolling"}


def _month_value(frame: pd.DataFrame, month: str, column: str) -> float | None:
    part = frame[frame["month"].eq(month)]
    if part.empty or column not in part.columns or part[column].isna().all():
        return None
    return float(part[column].median())


def _v1_band(local_markets, province_markets, calendar_month, horizon, before):
    local_ratios, local_years = _pool_ratios(local_markets, calendar_month, horizon, before)
    province_ratios, _ = _pool_ratios(province_markets, calendar_month, horizon, before)
    blended, _weight = blend(_quantile_or_none(local_ratios), _quantile_or_none(province_ratios), len(local_years))
    if blended is None or len(local_years) < MIN_YEARS and _quantile_or_none(province_ratios) is None:
        return None
    return blended


def storage_options(assumptions: dict) -> tuple[dict, dict]:
    items = assumptions.get("items") or []
    options = {}
    for option in OPTIONS:
        fields = {item["field"]: item["value"] for item in items if item.get("option") == option}
        options[option] = {
            "id": option,
            "loss_monthly": fields.get("loss_monthly"),
            "fee": fields.get("fee"),
            "cost_per_kg": fields.get("cost_per_kg"),
            "interest_annual": fields.get("interest_annual"),
            "borrow_share": fields.get("borrow_share"),
        }
    gates = {item["field"]: item["value"] for item in items if item.get("option") is None}
    return options, gates


def _priced(option: dict) -> bool:
    if any(option[key] is None for key in ("loss_monthly", "fee", "cost_per_kg", "borrow_share")):
        return False
    return not (option["borrow_share"] > 0 and option["interest_annual"] is None)


def _realised(option: dict, horizon: int, price_now: float, real_now: float, actual: float, actual_real: float) -> float | None:
    """Real gain over selling now, RWF per lot. Bags are bought now, the loan is repaid at sale."""
    retained = 1 - option["loss_monthly"] * horizon
    if retained <= 0:
        return None
    interest = (option["interest_annual"] or 0.0) * option["borrow_share"] * LOT_KG * price_now * horizon / 12
    deflator_sale = actual_real / actual
    sale = LOT_KG * actual_real * retained * (1 - option["fee"])
    return sale - interest * deflator_sale - LOT_KG * option["cost_per_kg"] - LOT_KG * real_now


def _decision_months(panel, seasons, crop, settings) -> dict[str, dict[int, int]]:
    if settings["months"] == "fixed":
        found = {}
        for season, spec in ((seasons.get("crops") or {}).get(crop) or {}).items():
            if spec:
                found[season] = {year: int(spec["decision_month"]) for year in range(int(spec["year_min"]), int(spec["year_max"]) + 1)}
        return found
    series = province_series(panel, crop)
    return {season: rolling_months(series, season) for season in ("A", "B")}


def collect_points(panel, cpi, seasons, rain, settings) -> list[dict]:
    """Every decision point with its raw ratio bands and outcomes."""
    points = []
    for crop in ("maize", "beans"):
        east = retail(panel, crop)
        by_market = _series_map(east)
        market_district = dict(zip(east["market"], east["admin2"]))
        for season, months in _decision_months(panel, seasons, crop, settings).items():
            rain_cache: dict[int, dict] = {}
            for district in EASTERN_DISTRICTS:
                local = east[east["admin2"].eq(district)]
                local_markets = {name: by_market[name] for name in local["market"].unique() if name in by_market}
                for year, month in months.items():
                    decision_year = year - 1 if season == "A" and month == 12 else year
                    if rain is not None and month not in rain_cache:
                        rain_cache[month] = {name: season_rain(rain, name, season, month) for name in EASTERN_DISTRICTS}
                    point = _decision_point(
                        crop, season, district, decision_year, month,
                        east, local, local_markets, by_market, market_district, rain_cache.get(month, {}), cpi,
                    )
                    if point is not None:
                        points.append(point)
    return points


def _decision_point(crop, season, district, decision_year, decision_month, east, local, local_markets, by_market, market_district, rain_by_district, cpi):
    decision_ym = f"{decision_year:04d}-{decision_month:02d}"
    cpi_info = inflation_at(cpi, f"{decision_ym}-15")
    if cpi_info is None:
        return None
    local_now = _month_value(local, decision_ym, "price_rwf_per_kg")
    province_now = _month_value(east, decision_ym, "price_rwf_per_kg")
    if local_now is None and province_now is None:
        return None
    price_pooled = local_now is None
    price_now = province_now if price_pooled else local_now
    scored = east if price_pooled else local
    real_now = _month_value(scored, decision_ym, "price_real")
    if real_now is None:
        return None
    anomaly_now = (rain_by_district.get(district) or {}).get(decision_year)
    ratios = {"v1": {}, "v2": {}}
    outcomes = {}
    for horizon in (1, 2, 3, 4):
        future = add_months(decision_ym, horizon)
        actual = _month_value(scored, future, "price_rwf_per_kg")
        actual_real = _month_value(scored, future, "price_real")
        if actual is None or actual_real is None:
            continue
        outcomes[horizon] = (actual, actual_real)
        found = _v1_band(local_markets, by_market, decision_month, horizon, decision_ym)
        if found is not None:
            ratios["v1"][horizon] = found
        if rain_by_district:
            samples = v2_samples(by_market, market_district, rain_by_district, decision_month, horizon, decision_ym)
            found = v2_quantiles(samples, anomaly_now)
            if found is not None:
                ratios["v2"][horizon] = found
    if not outcomes or not any(ratios.values()):
        return None
    return {
        "crop": crop,
        "season": season,
        "district": district,
        "year": decision_year,
        "decision_ym": decision_ym,
        "price_pooled": price_pooled,
        "price_now": price_now,
        "real_now": real_now,
        "inflation": cpi_info["trailing_12m_inflation"],
        "rain_anomaly": anomaly_now,
        "ratios": ratios,
        "outcomes": outcomes,
    }


def _records(points) -> list[dict]:
    """One raw forecast per point, model and horizon, for calibration."""
    out = []
    for point in points:
        for model, bands in point["ratios"].items():
            for horizon, ratio in bands.items():
                actual, actual_real = point["outcomes"][horizon]
                out.append(
                    {
                        "model": model,
                        "crop": point["crop"],
                        "known_from": add_months(point["decision_ym"], horizon + 1),
                        "ratio": ratio,
                        "actual_ratio": actual_real / point["real_now"],
                    }
                )
    return out


def widths_for(points, records, settings) -> dict:
    """Range stretch for each point and model, from outcomes known before its decision month."""
    widths = {}
    for index, point in enumerate(points):
        for model in MODELS:
            width = None
            if settings["calibrate"]:
                past = [
                    (*row["ratio"], row["actual_ratio"])
                    for row in records
                    if row["model"] == model and row["crop"] == point["crop"] and row["known_from"] <= point["decision_ym"]
                ]
                width = fit_width(past)
            widths[(index, model)] = width
    return widths


def run_backtest(panel, cpi, seasons, rain=None, assumptions=None, settings=None) -> dict:
    settings = {**DEFAULT_SETTINGS, **(settings or {})}
    options, gates = storage_options(assumptions or load_assumptions())
    points = collect_points(panel, cpi, seasons, rain, settings)
    records = _records(points)
    widths = widths_for(points, records, settings)
    rows = []
    decisions = []
    for index, point in enumerate(points):
        bands = {}
        for model, model_ratios in point["ratios"].items():
            width = widths[(index, model)]
            bands[model] = {}
            for horizon, raw in model_ratios.items():
                ratio = widen(raw, width) if width else raw
                actual, actual_real = point["outcomes"][horizon]
                growth = 1.0 if settings["real"] else (1 + point["inflation"]) ** (horizon / 12)
                prices = [point["price_now"] * value * growth for value in ratio]
                real_band = [point["real_now"] * value for value in ratio]
                bands[model][horizon] = {"p10": prices[0], "p50": prices[1], "p90": prices[2]}
                rows.append(
                    {
                        "model": model,
                        "crop": point["crop"],
                        "district": point["district"],
                        "season": point["season"],
                        "year": point["year"],
                        "horizon": horizon,
                        "price_pooled": point["price_pooled"],
                        "price_now": point["price_now"],
                        "p10": prices[0],
                        "p50": prices[1],
                        "p90": prices[2],
                        "actual": actual,
                        "actual_real": actual_real,
                        "width": width,
                        "inside": real_band[0] <= actual_real <= real_band[2],
                        "inside_raw": point["real_now"] * raw[0] <= actual_real <= point["real_now"] * raw[2],
                        "pinball_10": _pinball(actual_real, real_band[0], 0.1),
                        "pinball_50": _pinball(actual_real, real_band[1], 0.5),
                        "pinball_90": _pinball(actual_real, real_band[2], 0.9),
                        "rain_anomaly": point["rain_anomaly"],
                    }
                )
        decisions.extend(_decisions(point, bands, options, gates))
    detail = pd.DataFrame(rows)
    choices = pd.DataFrame(decisions)
    return {"detail": detail, "decisions": choices, "summary": _summarise(detail, choices, options)}


def _decisions(point: dict, bands: dict, options: dict, gates: dict) -> list[dict]:
    found = []
    deflator_now = point["real_now"] / point["price_now"]
    for option_id, option in options.items():
        if not _priced(option):
            continue
        # Costs in assumptions.yaml are September 2026 francs. The decision is made in that year's francs.
        then = dict(option, cost_per_kg=option["cost_per_kg"] / deflator_now)
        hold = None
        if 4 in point["outcomes"]:
            hold = _realised(option, 4, point["price_now"], point["real_now"], *point["outcomes"][4])
        for model, band in bands.items():
            if not band:
                continue
            result = decide(
                {
                    "quantity_kg": LOT_KG,
                    "price_now": point["price_now"],
                    "needs_cash_now": False,
                    "g_min": gates.get("g_min", 0.08),
                    "d_max": gates.get("d_max", 0.05),
                    "options": [then],
                    "forecasts": band,
                }
            )
            gain = 0.0
            if result["verdict"] == "store":
                horizon = result["horizon_months"]
                gain = _realised(option, horizon, point["price_now"], point["real_now"], *point["outcomes"][horizon])
            found.append(
                {
                    "model": model,
                    "option": option_id,
                    "crop": point["crop"],
                    "district": point["district"],
                    "season": point["season"],
                    "year": point["year"],
                    "price_pooled": point["price_pooled"],
                    "verdict": result["verdict"],
                    "horizon": result["horizon_months"],
                    "likely_gain_forecast": result["likely_gain"],
                    "gain_rwf_per_tonne": gain,
                    "always_store_4_rwf_per_tonne": hold,
                    "full_band": len(band) == 4,
                }
            )
    return found


def _pinball(actual: float, predicted: float, quantile: float) -> float:
    gap = actual - predicted
    below = 1.0 if actual < predicted else 0.0
    return (quantile - below) * gap


def _mean(series: pd.Series) -> float | None:
    series = series.dropna()
    return float(series.mean()) if len(series) else None


def _net_stats(part: pd.DataFrame) -> dict:
    gains = part["gain_rwf_per_tonne"]
    stored = part[part["verdict"].eq("store")]
    sold = part[~part["verdict"].eq("store")]
    worst = part.loc[gains.idxmin()]
    hold = part["always_store_4_rwf_per_tonne"].dropna()
    hold_when_sold = sold["always_store_4_rwf_per_tonne"].dropna()
    return {
        "n_decisions": int(len(part)),
        "store_count": int(len(stored)),
        "mean_gain_rwf_per_tonne": float(gains.mean()),
        "p10_gain_rwf_per_tonne": float(gains.quantile(0.1)),
        "p90_gain_rwf_per_tonne": float(gains.quantile(0.9)),
        "min_gain_rwf_per_tonne": float(gains.min()),
        "max_gain_rwf_per_tonne": float(gains.max()),
        "share_not_worse_than_selling": float((gains >= 0).mean()),
        "losing_count": int((gains < 0).sum()),
        "mean_gain_when_stored_rwf_per_tonne": _mean(stored["gain_rwf_per_tonne"]),
        "share_stored_losing": float((stored["gain_rwf_per_tonne"] < 0).mean()) if len(stored) else None,
        "mean_store_4_when_sell_rwf_per_tonne": _mean(hold_when_sold),
        "share_store_4_losing_when_sell": float((hold_when_sold < 0).mean()) if len(hold_when_sold) else None,
        "mean_always_store_4_rwf_per_tonne": float(hold.mean()) if len(hold) else None,
        "share_always_store_4_losing": float((hold < 0).mean()) if len(hold) else None,
        "worst": {
            "crop": worst["crop"],
            "district": worst["district"],
            "season": worst["season"],
            "year": int(worst["year"]),
            "gain_rwf_per_tonne": round(float(worst["gain_rwf_per_tonne"]), 1),
        },
    }


def _summarise(detail: pd.DataFrame, choices: pd.DataFrame, options: dict) -> dict:
    summary = {
        "lot_kg": LOT_KG,
        "francs": "September 2026 RWF, deflated by the NISR rural food CPI",
        "headline": None,
        "unpriced_options": [option_id for option_id, option in options.items() if not _priced(option)],
        "years": None,
        "net": [],
        "net_by_crop": [],
        "net_by_district": [],
        "seasons": [],
        "losing_seasons": [],
        "coverage": [],
        "models": [],
    }
    if detail.empty:
        return summary
    summary["years"] = f"{int(detail['year'].min())}-{int(detail['year'].max())}"

    v1 = detail[detail["model"].eq("v1")]
    for keys, part in v1.groupby(["crop", "district", "horizon"]):
        crop, district, horizon = keys
        summary["coverage"].append(
            {
                "crop": crop,
                "district": district,
                "horizon": int(horizon),
                "n": int(len(part)),
                "inside": int(part["inside"].sum()),
                "share": float(part["inside"].mean()),
            }
        )

    # Models are compared only where both produced a forecast for the same row.
    keys = ["crop", "district", "season", "year", "horizon"]
    common = detail.pivot_table(index=keys, columns="model", values="pinball_50", aggfunc="size").dropna().reset_index()[keys]
    for model, part in detail.groupby("model"):
        paired = part.merge(common, on=keys)
        summary["models"].append(
            {
                "model": model,
                "rows_all": int(len(part)),
                "coverage_all": float(part["inside"].mean()),
                "coverage_raw_all": float(part["inside_raw"].mean()),
                "below_p10_all": float((part["actual_real"] < part["p10"] * part["actual_real"] / part["actual"]).mean()),
                "rows_compared": int(len(paired)),
                "pinball_10": float(paired["pinball_10"].mean()) if len(paired) else None,
                "pinball_50": float(paired["pinball_50"].mean()) if len(paired) else None,
                "pinball_90": float(paired["pinball_90"].mean()) if len(paired) else None,
                "pinball_mean": float(paired[["pinball_10", "pinball_50", "pinball_90"]].mean(axis=1).mean()) if len(paired) else None,
                "coverage_compared": float(paired["inside"].mean()) if len(paired) else None,
            }
        )

    if choices.empty:
        return summary
    point_keys = ["crop", "district", "season", "year", "option"]
    both = choices.pivot_table(index=point_keys, columns="model", values="gain_rwf_per_tonne", aggfunc="size").dropna().reset_index()[point_keys]
    for (model, option), part in choices.groupby(["model", "option"]):
        entry = {"model": model, "option": option, **_net_stats(part)}
        paired = part.merge(both, on=point_keys)
        entry["n_compared"] = int(len(paired))
        entry["mean_gain_compared_rwf_per_tonne"] = float(paired["gain_rwf_per_tonne"].mean()) if len(paired) else None
        summary["net"].append(entry)
        for crop, crop_part in part.groupby("crop"):
            summary["net_by_crop"].append({"model": model, "option": option, "crop": crop, **_net_stats(crop_part)})
        for district, district_part in part.groupby("district"):
            summary["net_by_district"].append({"model": model, "option": option, "district": district, **_net_stats(district_part)})

    head = choices[choices["model"].eq(HEADLINE["model"]) & choices["option"].eq(HEADLINE["option"])]
    if not head.empty:
        summary["headline"] = {**HEADLINE, **_net_stats(head)}
        by_season = head.groupby(["crop", "season", "year"], as_index=False)["gain_rwf_per_tonne"].mean()
        summary["seasons"] = [
            {"crop": row.crop, "season": row.season, "year": int(row.year), "gain_rwf_per_tonne": round(float(row.gain_rwf_per_tonne), 1)}
            for row in by_season.sort_values(["year", "crop", "season"]).itertuples(index=False)
        ]
        losing = head[head["gain_rwf_per_tonne"] < 0].sort_values("gain_rwf_per_tonne")
        summary["losing_seasons"] = [
            {
                "crop": row.crop,
                "district": row.district,
                "season": row.season,
                "year": int(row.year),
                "horizon": int(row.horizon),
                "gain_rwf_per_tonne": round(float(row.gain_rwf_per_tonne), 1),
            }
            for row in losing.head(12).itertuples(index=False)
        ]
    return summary


def live_widths(panel, cpi, seasons, rain=None) -> dict[str, float | None]:
    """Range stretch for today's outlook, from every v1 forecast whose outcome is known."""
    points = collect_points(panel, cpi, seasons, None, DEFAULT_SETTINGS)
    records = _records(points)
    out = {}
    for crop in ("maize", "beans"):
        past = [(*row["ratio"], row["actual_ratio"]) for row in records if row["model"] == "v1" and row["crop"] == crop]
        out[crop] = fit_width(past)
    return out


SENSITIVITY = (
    ("base", "Values in config/assumptions.yaml", {}, {}),
    ("nominal_decision", "Decide on nominal prices, carrying food inflation forward", {}, {"real": False}),
    ("uncalibrated", "Ranges not widened by past misses", {}, {"calibrate": False}),
    ("fixed_months", "Decision months picked from all years (look-ahead), from 2010", {}, {"months": "fixed"}),
    ("home_loss_fast", "Home bags lose 41.2% in 8 months (Ng'ang'a et al. 2016)", {"loss_home_bags": 0.412 / 8}, {}),
    ("hermetic_reused", "Hermetic bag reused for 3 seasons", {"cost_hermetic_bags": 35.5 / 3}, {}),
    ("no_gates", "Store whenever the likely gain is above zero", {"g_min": 0.0, "d_max": 10.0}, {}),
)


def sensitivity(panel, cpi, seasons, rain, assumptions) -> list[dict]:
    """Headline v1 result under other choices. Only the backtest changes."""
    rows = []
    for key, label, overrides, settings in SENSITIVITY:
        changed = {**assumptions, "items": [dict(item) for item in assumptions.get("items") or []]}
        for item in changed["items"]:
            if item["id"] in overrides:
                item["value"] = overrides[item["id"]]
        result = run_backtest(panel, cpi, seasons, None, changed, settings)
        v1 = next((row for row in result["summary"]["models"] if row["model"] == "v1"), {})
        for entry in result["summary"]["net"]:
            if entry["model"] != "v1":
                continue
            rows.append(
                {
                    "case": key,
                    "label": label,
                    "option": entry["option"],
                    "n_decisions": entry["n_decisions"],
                    "store_count": entry["store_count"],
                    "mean_gain_rwf_per_tonne": entry["mean_gain_rwf_per_tonne"],
                    "share_not_worse_than_selling": entry["share_not_worse_than_selling"],
                    "mean_gain_when_stored_rwf_per_tonne": entry["mean_gain_when_stored_rwf_per_tonne"],
                    "mean_store_4_when_sell_rwf_per_tonne": entry["mean_store_4_when_sell_rwf_per_tonne"],
                    "range_coverage": v1.get("coverage_all"),
                }
            )
    return rows


def load_seasons() -> dict:
    return yaml.safe_load((CONFIG / "seasons.yaml").read_text()) or {}


def load_assumptions() -> dict:
    return yaml.safe_load((CONFIG / "assumptions.yaml").read_text()) or {}


def main(panel=None, cpi=None, rain=None):
    if panel is None:
        panel = pd.read_csv(PROCESSED / "panel_monthly.csv")
    if cpi is None:
        cpi = pd.read_csv(PROCESSED / "cpi_food.csv")
    if rain is None:
        rain = pd.read_csv(PROCESSED / "rain_dekadal_east.csv")
    result = run_backtest(panel, cpi, load_seasons(), rain)
    write(result)
    return result


def write(result: dict) -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    if not result["detail"].empty:
        result["detail"].to_csv(PROCESSED / "backtest_rows.csv", index=False)
    if not result["decisions"].empty:
        result["decisions"].to_csv(PROCESSED / "backtest_decisions.csv", index=False)
    print(f"backtest rows {len(result['detail'])} decisions {len(result['decisions'])}")


if __name__ == "__main__":
    main()
