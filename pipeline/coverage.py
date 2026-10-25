"""Eastern Province price coverage, for the Sunday checkpoint."""

from __future__ import annotations

import pandas as pd

from pipeline.model import _bool
from pipeline.paths import EASTERN_DISTRICTS, PROCESSED


def coverage_table(panel: pd.DataFrame) -> pd.DataFrame:
    frame = panel.copy()
    frame["is_camp"] = _bool(frame["is_camp"])
    frame["filled"] = _bool(frame["filled"])
    east = frame[
        frame["admin1"].eq("Eastern Province")
        & frame["pricetype"].eq("Retail")
        & ~frame["is_camp"]
        & ~frame["filled"]
        & frame["admin2"].isin(EASTERN_DISTRICTS)
    ]
    rows = []
    for (district, crop), part in east.groupby(["admin2", "crop"]):
        years = part["month"].str.slice(0, 4)
        recent = part[part["month"] >= "2024-01"]
        rows.append(
            {
                "district": district,
                "crop": crop,
                "markets": int(part["market"].nunique()),
                "months": int(part["month"].nunique()),
                "years": int(years.nunique()),
                "first": str(part["month"].min()),
                "last": str(part["month"].max()),
                "markets_with_5_years": int((years.groupby(part["market"]).nunique() >= 5).sum()),
                "markets_priced_since_2024": int(recent["market"].nunique()),
            }
        )
    return pd.DataFrame(rows).sort_values(["crop", "district"]).reset_index(drop=True)


def to_markdown(table: pd.DataFrame) -> str:
    header = "| District | Crop | Markets | Years | First | Last | Markets with 5 years | Priced since 2024 |"
    rule = "| --- | --- | --- | --- | --- | --- | --- | --- |"
    lines = [header, rule]
    for row in table.itertuples(index=False):
        lines.append(
            f"| {row.district} | {row.crop} | {row.markets} | {row.years} | {row.first} | {row.last} | {row.markets_with_5_years} | {row.markets_priced_since_2024} |"
        )
    return "\n".join(lines)


def checkpoint(table: pd.DataFrame) -> str:
    current = table[table["markets_priced_since_2024"] > 0]
    stale = table[table["markets_priced_since_2024"].eq(0)]
    current_names = sorted(current["district"].unique()) if len(current) else []
    stale_names = sorted(set(stale["district"]) - set(current_names))
    return (
        "Checkpoint: pool current decisions to Eastern Province, and label them. "
        f"Districts with a non-camp retail price since 2024: {', '.join(current_names) or 'none'}. "
        f"Districts whose own prices stop earlier: {', '.join(stale_names) or 'none'}. "
        "Historical years exist in every district, so older seasonal patterns can be used, "
        "but a price from 2015 is not today's price."
    )


def main(panel: pd.DataFrame | None = None) -> str:
    if panel is None:
        panel = pd.read_csv(PROCESSED / "panel_monthly.csv")
    table = coverage_table(panel)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    table.to_csv(PROCESSED / "coverage.csv", index=False)
    text = checkpoint(table) + "\n\n" + to_markdown(table) + "\n"
    (PROCESSED / "coverage.md").write_text(text)
    print(text)
    return text
