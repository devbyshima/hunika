"""Write config/markets.yaml from the WFP market list. Coordinates are not edited."""

from __future__ import annotations

import pandas as pd
import yaml

from pipeline.paths import CONFIG, RAW


def build_records(path=None) -> list[dict]:
    frame = pd.read_csv(path or RAW / "wfp_markets_rwa.csv")
    records = []
    for row in frame.itertuples(index=False):
        admin2 = row.admin2 if isinstance(row.admin2, str) else None
        if admin2 and "not available" in admin2.lower():
            admin2 = None
        records.append(
            {
                "id": int(row.market_id),
                "name": str(row.market),
                "admin1": None if not isinstance(row.admin1, str) else row.admin1,
                "admin2": admin2,
                "latitude": None if pd.isna(row.latitude) else float(row.latitude),
                "longitude": None if pd.isna(row.longitude) else float(row.longitude),
                "eastern": row.admin1 == "Eastern Province",
                "camp": "(Camp)" in str(row.market),
            }
        )
    return records


def main():
    records = build_records()
    document = {
        "source": "WFP Rwanda market list, HDX",
        "source_url": "https://data.humdata.org/dataset/wfp-food-prices-for-rwanda",
        "downloaded": "2026-10-25",
        "note": "Coordinates come from the WFP file. Camps are flagged and left out of cooperative advice.",
        "markets": records,
    }
    (CONFIG / "markets.yaml").write_text(yaml.safe_dump(document, sort_keys=False, allow_unicode=True))
    eastern = sum(1 for record in records if record["eastern"])
    print(f"markets {len(records)} eastern {eastern}")
    return document
