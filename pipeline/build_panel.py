"""Monthly median panel. Gaps of one or two months are filled and flagged."""

from __future__ import annotations

import pandas as pd

from pipeline.fill import fill_short_gaps
from pipeline.months import month_span
from pipeline.paths import INTERIM, PROCESSED


def monthly_median(prices: pd.DataFrame) -> pd.DataFrame:
    group = [
        "market_id",
        "market",
        "admin1",
        "admin2",
        "latitude",
        "longitude",
        "is_camp",
        "crop",
        "pricetype",
        "month",
    ]
    grouped = (
        prices.groupby(group, dropna=False)
        .agg(
            price_rwf_per_kg=("price_rwf_per_kg", "median"),
            n_obs=("price_rwf_per_kg", "size"),
            price_date=("date", "max"),
        )
        .reset_index()
    )
    return grouped


def fill_panel(monthly: pd.DataFrame) -> pd.DataFrame:
    keys = ["market_id", "crop", "pricetype"]
    rows = []
    for key, part in monthly.groupby(keys, dropna=False):
        part = part.sort_values("month")
        start, end = part["month"].iloc[0], part["month"].iloc[-1]
        indexed = part.set_index("month")
        meta = part.iloc[0]
        months = month_span(start, end)
        observed = [None if month not in indexed.index else float(indexed.loc[month, "price_rwf_per_kg"]) for month in months]
        counts = [0 if month not in indexed.index else int(indexed.loc[month, "n_obs"]) for month in months]
        dates = [None if month not in indexed.index else str(indexed.loc[month, "price_date"])[:10] for month in months]
        for month, (price, was_filled), n_obs, price_date in zip(months, fill_short_gaps(observed), counts, dates, strict=True):
            if price is None:
                continue
            rows.append(
                {
                    "market_id": meta["market_id"],
                    "market": meta["market"],
                    "admin1": meta["admin1"],
                    "admin2": meta["admin2"],
                    "latitude": meta["latitude"],
                    "longitude": meta["longitude"],
                    "is_camp": bool(meta["is_camp"]),
                    "crop": meta["crop"],
                    "pricetype": meta["pricetype"],
                    "month": month,
                    "price_date": None if was_filled else price_date,
                    "price_rwf_per_kg": price,
                    "n_obs": 0 if was_filled else n_obs,
                    "filled": was_filled,
                }
            )
    return pd.DataFrame(rows)


def main(prices: pd.DataFrame | None = None) -> pd.DataFrame:
    if prices is None:
        prices = pd.read_csv(INTERIM / "prices_kg.csv")
    panel = fill_panel(monthly_median(prices))
    INTERIM.mkdir(parents=True, exist_ok=True)
    panel.to_csv(INTERIM / "panel_monthly.csv", index=False)
    print(f"panel rows {len(panel)} filled {int(panel['filled'].sum())}")
    return panel


if __name__ == "__main__":
    main()
