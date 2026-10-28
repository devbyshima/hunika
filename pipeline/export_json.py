"""Write the small JSON files the phone reads."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import yaml

from pipeline.model import build_forecasts, nearest_markets
from pipeline.paths import CONFIG, EASTERN_DISTRICTS, PROCESSED, RAW, WEB_DATA


def _round(value):
    if isinstance(value, float):
        return round(value, 4)
    if isinstance(value, dict):
        return {key: _round(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_round(item) for item in value]
    return value


def _districts_geojson() -> dict:
    source = json.loads((RAW / "geoBoundaries-RWA-ADM2_simplified.geojson").read_text())
    features = [
        feature
        for feature in source["features"]
        if feature["properties"].get("shapeName") in EASTERN_DISTRICTS
    ]
    return {"type": "FeatureCollection", "features": features}


def _centroids(geojson: dict) -> dict[str, tuple[float, float]]:
    found = {}
    for feature in geojson["features"]:
        points: list[tuple[float, float]] = []

        def walk(node):
            if isinstance(node[0], (int, float)):
                points.append((float(node[0]), float(node[1])))
                return
            for child in node:
                walk(child)

        walk(feature["geometry"]["coordinates"])
        lon = sum(point[0] for point in points) / len(points)
        lat = sum(point[1] for point in points) / len(points)
        found[feature["properties"]["shapeName"]] = (lat, lon)
    return found


def _supply_entry(rows: pd.DataFrame, anomaly: pd.DataFrame, district: str, season: str) -> dict | None:
    part = rows[rows["season"].eq(season)].sort_values("sas_year")
    if part.empty:
        return None
    latest = part.iloc[-1]
    year = int(latest["sas_year"])
    found = anomaly[anomaly["district"].eq(district) & anomaly["season"].eq(season) & anomaly["sas_year"].eq(year)]
    shift = {row.crop: row.anomaly for row in found.itertuples(index=False)}
    return {
        "year": year,
        "published_on": latest["published_on"],
        "maize_tonnes": round(float(latest["maize_tonnes"]), 1),
        "beans_tonnes": round(float(latest["beans_tonnes"]), 1),
        "maize_anomaly": None if "maize" not in shift else round(float(shift["maize"]), 4),
        "beans_anomaly": None if "beans" not in shift else round(float(shift["beans"]), 4),
        "history": [
            {"year": int(row.sas_year), "maize_tonnes": round(float(row.maize_tonnes), 1), "beans_tonnes": round(float(row.beans_tonnes), 1)}
            for row in part.itertuples(index=False)
        ],
    }


def _sas_public(sas: pd.DataFrame, anomaly: pd.DataFrame, rain_check: list[dict]) -> dict:
    districts = {}
    for district in EASTERN_DISTRICTS:
        rows = sas[sas["district"].eq(district) & sas["season"].isin(["A", "B"])]
        districts[district] = {season: _supply_entry(rows, anomaly, district, season) for season in ("A", "B")}
    national_rows = (
        sas.groupby(["sas_year", "season"], as_index=False)
        .agg(maize_tonnes=("maize_tonnes", "sum"), beans_tonnes=("beans_tonnes", "sum"), published_on=("published_on", "max"))
    )
    editions = (
        sas[["sas_year", "season", "published_on", "date_basis", "source_url"]]
        .drop_duplicates()
        .sort_values(["sas_year", "season"])
    )
    return {
        "source": "NISR Seasonal Agricultural Survey, district production tables",
        "anomaly_definition": "Log of production over the mean of the three previous seasons of the same letter.",
        "first_anomaly_year": int(anomaly["sas_year"].min()) if not anomaly.empty else None,
        "editions": [
            {"year": int(row.sas_year), "season": row.season, "published_on": row.published_on, "date_basis": row.date_basis, "url": row.source_url}
            for row in editions.itertuples(index=False)
        ],
        "districts": districts,
        "rwanda": {season: _supply_entry(national_rows, anomaly, "Rwanda", season) for season in ("A", "B")},
        "rain_check": rain_check,
    }


def rain_check(rain: pd.DataFrame, anomaly: pd.DataFrame) -> list[dict]:
    """How well the full-season rainfall anomaly tracks the SAS production anomaly."""
    from pipeline.ingest_rain import season_rain

    east = anomaly[anomaly["district"].isin(EASTERN_DISTRICTS)]
    tables = {(district, season): season_rain(rain, district, season) for district in EASTERN_DISTRICTS for season in ("A", "B")}
    out = []
    for (crop, season), part in east.groupby(["crop", "season"]):
        pairs = [
            (tables[(row.district, season)].get(int(row.sas_year)), row.anomaly)
            for row in part.itertuples(index=False)
        ]
        pairs = [(x, y) for x, y in pairs if x is not None]
        if len(pairs) < 5:
            continue
        xs, ys = zip(*pairs)
        frame = pd.DataFrame({"rain": xs, "supply": ys})
        out.append(
            {
                "crop": crop,
                "season": season,
                "n": len(pairs),
                "years": f"{int(part['sas_year'].min())}-{int(part['sas_year'].max())}",
                "correlation": round(float(frame["rain"].corr(frame["supply"])), 3),
            }
        )
    return out


def write_all(panel, cpi, sas, backtest_summary, rain=None) -> None:
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    assumptions = yaml.safe_load((CONFIG / "assumptions.yaml").read_text())
    forecasts = build_forecasts(panel, cpi)
    geojson = _districts_geojson()
    nearest = nearest_markets(panel, _centroids(geojson))
    anomaly = pd.read_csv(PROCESSED / "sas_supply_anomaly.csv") if (PROCESSED / "sas_supply_anomaly.csv").exists() else pd.DataFrame()
    if rain is None and (PROCESSED / "rain_dekadal_east.csv").exists():
        rain = pd.read_csv(PROCESSED / "rain_dekadal_east.csv")
    checks = rain_check(rain, anomaly) if rain is not None and not anomaly.empty else []
    supply = _sas_public(sas, anomaly, checks)
    ahs_path = PROCESSED / "ahs_summary.json"
    if ahs_path.exists():
        ahs = json.loads(ahs_path.read_text())
        supply["ahs"] = {
            "weighted_households": ahs["weighted_households"],
            "sample_households": ahs["sample_households"],
            "median_harvest_kg": {crop: {season[-1]: item["median_harvest_kg"] for season, item in seasons.items()} for crop, seasons in ahs["crops"].items()},
            "cooperative_member": ahs["cooperative_member"],
            "cooperative_storage": next(item["share"] for item in ahs["cooperative_services"] if item["code"] == "4"),
            "cooperative_markets": next(item["share"] for item in ahs["cooperative_services"] if item["code"] == "2"),
            "loan_requested": ahs["loan_requested"],
            "loan_for_food": next((item["share"] for item in ahs["loan_purpose"] if item["answer"] == "Food purchase"), None),
        }
    for district, crops in forecasts["districts"].items():
        for crop, payload in crops.items():
            if isinstance(payload, dict):
                payload["nearest_markets"] = nearest.get(district, {}).get(crop, [])
    payload = {
        "forecasts": _round(forecasts),
        "assumptions": assumptions,
        "backtest": _round(backtest_summary),
        "supply": supply,
        "meta": {
            "name": "Hunika",
            "model": "v1_seasonal_ratios",
            "rain_source": "CHIRPS dekadal rainfall by district, WFP on HDX",
            "sas_source": "NISR Seasonal Agricultural Survey 2018-2026, seasons A and B",
            "crops": ["maize", "beans"],
            "districts": list(EASTERN_DISTRICTS),
            "price_source": "WFP Rwanda food prices, retail, RWF per kg",
            "cpi_source": "NISR CPI, rural food and non-alcoholic beverages",
        },
    }
    for name, body in payload.items():
        path = WEB_DATA / f"{name}.json"
        path.write_text(json.dumps(body, indent=2))
    (WEB_DATA / "districts.geojson").write_text(json.dumps(geojson))
    print("exported", ", ".join(sorted(path.name for path in WEB_DATA.iterdir())))


def load_sas() -> pd.DataFrame:
    path = PROCESSED / "sas_district_production.csv"
    if not path.exists():
        return pd.DataFrame()
    frame = pd.read_csv(path)
    if "eastern" in frame.columns:
        frame["eastern"] = frame["eastern"].astype(str).str.lower().isin(["1", "true", "yes"])
    return frame
