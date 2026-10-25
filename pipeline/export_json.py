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


def _sas_public(sas: pd.DataFrame) -> dict:
    districts = {}
    eastern = sas[sas["eastern"] & sas["season"].isin(["A", "B"])]
    for row in eastern.itertuples(index=False):
        entry = districts.setdefault(row.district, {})
        entry[row.season] = {
            "maize_tonnes": round(float(row.maize_tonnes), 1),
            "beans_tonnes": round(float(row.beans_tonnes), 1),
        }
    return {
        "published_on": "2025-12-31",
        "source_url": "https://statistics.gov.rw/sites/default/files/documents/2025-12/SAS%202025_Annual%20Tables.xlsx",
        "anomaly": None,
        "anomaly_reason": "The supply anomaly needs the three previous seasons of the same letter. Only SAS 2025 is loaded.",
        "districts": districts,
    }


def write_all(panel, cpi, sas, backtest_summary) -> None:
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    assumptions = yaml.safe_load((CONFIG / "assumptions.yaml").read_text())
    forecasts = build_forecasts(panel, cpi)
    geojson = _districts_geojson()
    nearest = nearest_markets(panel, _centroids(geojson))
    supply = _sas_public(sas) if not sas.empty else {
        "published_on": None,
        "anomaly": None,
        "anomaly_reason": "SAS extract is missing.",
        "districts": {},
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
