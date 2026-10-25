"""Load WFP Rwanda prices and keep maize grain and dry beans, in RWF per kg."""

from __future__ import annotations

import json

import pandas as pd

from pipeline.paths import INTERIM, RAW

# Source commodity name -> Hunika crop. Wholesale "Beans" has no "(dry)" in the
# file; retail dry beans are named "Beans (dry)". They stay in separate price types.
SOURCE_CROP = {
    "Maize": "maize",
    "Beans (dry)": "beans",
    "Beans": "beans",
}

# Present in the file and deliberately unused. A new maize or bean name should
# fail the commodity test instead of disappearing.
IGNORED_COMMODITIES = {
    "Maize flour",
    "Maize flour (imported)",
    "Beans (fresh)",
    "Beans (green, fresh)",
    "Soybeans",
}

UNIT_TO_KG = {
    "KG": 1.0,
    "G": 0.001,
    "100 KG": 100.0,
    "90 KG": 90.0,
    "MT": 1000.0,
    "TONNE": 1000.0,
}


def kg_price(price: float, unit: str) -> float | None:
    factor = UNIT_TO_KG.get(str(unit).strip().upper())
    if factor is None or factor == 0:
        return None
    return float(price) / factor


def load_prices(path=None) -> tuple[pd.DataFrame, dict]:
    path = path or RAW / "wfp_food_prices_rwa.csv"
    frame = pd.read_csv(path)
    report: dict = {"rows_in": int(len(frame)), "dropped": {}}

    maize_or_bean = frame["commodity"].astype(str).str.contains("maize|bean", case=False, na=False)
    unknown = sorted(set(frame.loc[maize_or_bean, "commodity"]) - set(SOURCE_CROP) - IGNORED_COMMODITIES)
    if unknown:
        raise SystemExit(f"Unclassified maize or bean commodity: {unknown}")

    kept = frame[frame["commodity"].isin(SOURCE_CROP)].copy()
    report["dropped"]["other_commodities"] = int(len(frame) - len(kept))

    # The wholesale series named "Beans" is not labeled dry. Keep it only as wholesale.
    loose = kept["commodity"].eq("Beans") & kept["pricetype"].ne("Wholesale")
    report["dropped"]["beans_not_labeled_dry"] = int(loose.sum())
    kept = kept.loc[~loose]

    kept = kept[kept["currency"].eq("RWF")]
    report["dropped"]["not_rwf"] = int(report["rows_in"] - report["dropped"]["other_commodities"] - report["dropped"]["beans_not_labeled_dry"] - len(kept) - (len(frame) - len(frame)))
    # Recompute the currency drop against the post-filter frame size more directly below.

    prices = []
    bad_unit = 0
    for price, unit in zip(kept["price"], kept["unit"], strict=True):
        converted = kg_price(price, unit)
        if converted is None or pd.isna(price):
            bad_unit += 1
            prices.append(None)
        else:
            prices.append(converted)
    kept["price_rwf_per_kg"] = prices
    report["dropped"]["bad_unit"] = bad_unit
    kept = kept[kept["price_rwf_per_kg"].notna() & (kept["price_rwf_per_kg"] > 0)]

    # Prefer observed rows. Use an aggregate only when the month has no actual quote.
    kept["priceflag"] = kept["priceflag"].fillna("").astype(str)
    actual = kept["priceflag"].eq("actual")
    group_cols = ["market_id", "commodity", "pricetype", "date"]
    has_actual = actual.groupby([kept[col] for col in group_cols]).transform("any")
    use_aggregate = ~has_actual & kept["priceflag"].isin(["aggregate", "actual,aggregate"])
    chosen = kept.loc[actual | use_aggregate].copy()
    report["dropped"]["flag_or_duplicate_aggregate"] = int(len(kept) - len(chosen))
    report["rows_out"] = int(len(chosen))
    report["by_crop"] = chosen["commodity"].value_counts().to_dict()
    report["price_types"] = chosen["pricetype"].value_counts().to_dict()
    report["date_min"] = str(chosen["date"].min())
    report["date_max"] = str(chosen["date"].max())

    chosen["crop"] = chosen["commodity"].map(SOURCE_CROP)
    chosen["month"] = chosen["date"].astype(str).str.slice(0, 7)
    chosen["is_camp"] = chosen["market"].astype(str).str.contains("(Camp)", regex=False)
    columns = [
        "date",
        "month",
        "admin1",
        "admin2",
        "market",
        "market_id",
        "latitude",
        "longitude",
        "commodity",
        "crop",
        "unit",
        "priceflag",
        "pricetype",
        "price_rwf_per_kg",
        "is_camp",
    ]
    return chosen[columns].reset_index(drop=True), report


def main():
    INTERIM.mkdir(parents=True, exist_ok=True)
    prices, report = load_prices()
    prices.to_csv(INTERIM / "prices_kg.csv", index=False)
    (INTERIM / "price_ingest_report.json").write_text(json.dumps(report, indent=2))
    print(f"prices {report['rows_in']} -> {report['rows_out']}  {report['date_min']} to {report['date_max']}")
    return prices, report


if __name__ == "__main__":
    main()
