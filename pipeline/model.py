"""Price-ratio forecasts.

Model v1 takes percentiles of past seasonal ratios. Model v2 adds the supply
signal: the log ratio is regressed on the district rainfall anomaly of the
season, pooled across Eastern Province, and the range comes from the residuals.
"""

from __future__ import annotations

import math
from datetime import date, datetime

import pandas as pd

from pipeline.months import add_months, blend, collect_ratios, quantiles
from pipeline.paths import EASTERN_DISTRICTS

MIN_RATIOS = 4
V2_MIN_SAMPLES = 12
V2_MIN_YEARS = 5


def _bool(series: pd.Series) -> pd.Series:
    if series.dtype == bool:
        return series
    return series.astype(str).str.lower().isin(["1", "true", "yes"])


def retail(panel: pd.DataFrame, crop: str) -> pd.DataFrame:
    frame = panel.copy()
    frame["is_camp"] = _bool(frame["is_camp"])
    frame["filled"] = _bool(frame["filled"])
    mask = (
        frame["crop"].eq(crop)
        & frame["pricetype"].eq("Retail")
        & ~frame["is_camp"]
        & ~frame["filled"]
        & frame["price_real"].notna()
        & frame["admin1"].eq("Eastern Province")
    )
    return frame.loc[mask].copy()


def _series_map(frame: pd.DataFrame) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    for market, part in frame.groupby("market"):
        out[str(market)] = {str(month): float(price) for month, price in zip(part["month"], part["price_real"], strict=True)}
    return out


def _pool_ratios(by_market: dict[str, dict[str, float]], calendar_month: int, horizon: int, before: str):
    ratios: list[float] = []
    years: set[str] = set()
    for series in by_market.values():
        found, found_years = collect_ratios(series, calendar_month, horizon, before)
        ratios.extend(found)
        years |= found_years
    return ratios, years


def _quantile_or_none(ratios: list[float]):
    if len(ratios) < MIN_RATIOS:
        return None
    return quantiles(ratios)


def v2_samples(by_market, market_district, rain_by_district, calendar_month, horizon, before):
    """Past (rain anomaly, log real ratio, year) for every Eastern market window before `before`."""
    samples = []
    for market, series in by_market.items():
        rain = rain_by_district.get(market_district.get(market))
        if not rain:
            continue
        needle = f"{calendar_month:02d}"
        for year_month, price in series.items():
            if year_month[5:7] != needle or year_month >= before:
                continue
            future = add_months(year_month, horizon)
            if future >= before or future not in series or not price or price <= 0:
                continue
            anomaly = rain.get(int(year_month[:4]))
            if anomaly is None:
                continue
            samples.append((anomaly, math.log(series[future] / price), year_month[:4]))
    return samples


def v2_quantiles(samples, anomaly_now):
    """Real-ratio p10, p50, p90 from a one-variable least-squares fit and its residuals."""
    if anomaly_now is None or len(samples) < V2_MIN_SAMPLES or len({year for *_, year in samples}) < V2_MIN_YEARS:
        return None
    xs = [x for x, _, _ in samples]
    ys = [y for _, y, _ in samples]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    spread = sum((x - mean_x) ** 2 for x in xs)
    slope = 0.0 if spread == 0 else sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / spread
    intercept = mean_y - slope * mean_x
    residuals = [y - intercept - slope * x for x, y in zip(xs, ys)]
    centre = intercept + slope * anomaly_now
    low, mid, high = quantiles(residuals)
    return math.exp(centre + low), math.exp(centre + mid), math.exp(centre + high)


def inflation_at(cpi: pd.DataFrame, as_of: str) -> dict | None:
    rural = cpi[cpi["series"].eq("rural")].copy()
    rural = rural[rural["published_on"] <= as_of].sort_values("month")
    if rural.empty:
        return None
    latest = str(rural["month"].iloc[-1])
    earlier = add_months(latest, -12)
    current = rural.loc[rural["month"].eq(latest), "index"]
    previous = rural.loc[rural["month"].eq(earlier), "index"]
    if current.empty or previous.empty or float(previous.iloc[0]) == 0:
        return None
    return {
        "series": "rural food and non-alcoholic beverages",
        "index_month": latest,
        "published_on": str(rural["published_on"].iloc[-1]),
        "trailing_12m_inflation": float(current.iloc[0]) / float(previous.iloc[0]) - 1,
    }


def _latest_price(frame: pd.DataFrame) -> dict | None:
    if frame.empty:
        return None
    month = str(frame["month"].max())
    part = frame[frame["month"].eq(month)]
    if "price_date" in part.columns and part["price_date"].notna().any():
        price_date = str(part["price_date"].max())[:10]
    else:
        price_date = f"{month}-15"
    return {
        "month": month,
        "price_date": price_date,
        "price": float(part["price_rwf_per_kg"].median()),
        "n_markets": int(part["market"].nunique()),
    }


def _nominal(price_now: float, ratio: float, inflation: float, horizon: int) -> float:
    return price_now * ratio * (1 + inflation) ** (horizon / 12)


def build_forecasts(panel: pd.DataFrame, cpi: pd.DataFrame, as_of: str | None = None) -> dict:
    as_of = as_of or date.today().isoformat()
    cpi_info = inflation_at(cpi, as_of)
    if cpi_info is None:
        raise SystemExit("No rural food CPI was published on or before the decision date.")
    inflation = cpi_info["trailing_12m_inflation"]
    districts = {}

    for crop in ("maize", "beans"):
        east = retail(panel, crop)
        by_market = _series_map(east)
        province_latest = _latest_price(east)
        if province_latest is None:
            continue
        # Horizons run from the decision month, not from the month of the newest
        # price. The newest price stands in for today's price until the user
        # types the price at their own market.
        before = as_of[:7]
        calendar_month = int(before[5:7])

        for district in EASTERN_DISTRICTS:
            local = east[east["admin2"].eq(district)]
            local_latest = _latest_price(local)
            price_pooled = local_latest is None or local_latest["month"] != province_latest["month"]
            price = province_latest if price_pooled else local_latest
            local_markets = {name: by_market[name] for name in local["market"].unique() if name in by_market}

            horizons = {}
            weights = []
            years_used = []
            for horizon in (1, 2, 3, 4):
                local_ratios, local_years = _pool_ratios(local_markets, calendar_month, horizon, before)
                province_ratios, province_years = _pool_ratios(by_market, calendar_month, horizon, before)
                local_q = _quantile_or_none(local_ratios)
                province_q = _quantile_or_none(province_ratios)
                blended, weight = blend(local_q, province_q, len(local_years))
                if blended is None:
                    continue
                heavy = local_ratios if weight >= 0.5 else province_ratios
                heavy_years = local_years if weight >= 0.5 else province_years
                horizons[str(horizon)] = {
                    "ratio_p10": blended[0],
                    "ratio_p50": blended[1],
                    "ratio_p90": blended[2],
                    "p10": _nominal(price["price"], blended[0], inflation, horizon),
                    "p50": _nominal(price["price"], blended[1], inflation, horizon),
                    "p90": _nominal(price["price"], blended[2], inflation, horizon),
                    "n": len(heavy),
                    "n_up": int(sum(ratio > 1 for ratio in heavy)),
                    "years": len(heavy_years),
                }
                weights.append(weight)
                years_used.append(heavy_years)

            if not horizons:
                districts.setdefault(district, {})[crop] = {"status": "not_enough_data"}
                continue

            pattern_years = min(len(years) for years in years_used)
            last_year = max(max(years) for years in years_used if years)
            pattern_weight = min(weights)
            price_date = price["price_date"]
            stale_days = (datetime.fromisoformat(as_of) - datetime.fromisoformat(price_date)).days
            districts.setdefault(district, {})[crop] = {
                "status": "ok",
                "price_now": price["price"],
                "price_month": price["month"],
                "price_date": price_date,
                "stale_days": stale_days,
                "stale": stale_days > 60,
                "price_pooled": price_pooled,
                "n_markets": price["n_markets"],
                "district_last_month": None if local_latest is None else local_latest["month"],
                "pattern_pooled": pattern_weight < 1,
                "pattern_weight_market": pattern_weight,
                "pattern_years": pattern_years,
                "pattern_last_year": last_year,
                "horizons": horizons,
            }

    return {
        "generated_on": date.today().isoformat(),
        "decision_date": as_of,
        "decision_month": as_of[:7],
        "inflation": inflation,
        "model": "v1_seasonal_ratios",
        "cpi": cpi_info,
        "stale_days_limit": 60,
        "districts": districts,
    }


def nearest_markets(panel: pd.DataFrame, centroids: dict[str, tuple[float, float]], limit: int = 3) -> dict:
    """Three nearest non-camp markets with a price in the last 12 months, for each district and crop."""
    frame = panel.copy()
    frame["is_camp"] = _bool(frame["is_camp"])
    frame["filled"] = _bool(frame["filled"])
    base = frame[
        frame["pricetype"].eq("Retail")
        & ~frame["is_camp"]
        & ~frame["filled"]
        & frame["latitude"].notna()
        & frame["longitude"].notna()
    ]
    found = {}
    for district, (lat, lon) in centroids.items():
        found[district] = {}
        for crop in ("maize", "beans"):
            crop_rows = base[base["crop"].eq(crop)]
            latest = (
                crop_rows.sort_values("month")
                .groupby("market", as_index=False)
                .tail(1)
            )
            # A market whose last price is more than a year older than the newest
            # price is not a market a manager can sell in today.
            recent = add_months(str(crop_rows["month"].max()), -12)
            latest = latest[latest["month"] > recent]
            ranked = []
            for row in latest.itertuples(index=False):
                distance = _km(lat, lon, float(row.latitude), float(row.longitude))
                ranked.append(
                    {
                        "name": row.market,
                        "km": round(distance, 1),
                        "price": round(float(row.price_rwf_per_kg), 2),
                        "month": str(row.month),
                    }
                )
            ranked.sort(key=lambda item: item["km"])
            found[district][crop] = ranked[:limit]
    return found


def _km(lat1, lon1, lat2, lon2) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))
