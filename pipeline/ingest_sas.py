"""Extract district maize and bean production from the SAS 2025 annual tables.

One agricultural year is not enough for the supply anomaly, which needs the
mean of the three previous seasons of the same letter. This step stores the
published tonnes and the publication date, and does not invent earlier years.
"""

from __future__ import annotations

import pandas as pd

from pipeline.paths import EASTERN_DISTRICTS, PROCESSED, RAW

WORKBOOK = RAW / "nisr" / "SAS_2025_Annual_Tables.xlsx"
PUBLICATION_DATE = "2025-12-31"
SOURCE_URL = "https://statistics.gov.rw/sites/default/files/documents/2025-12/SAS%202025_Annual%20Tables.xlsx"

# Season C is out of scope. Tables 24 and 25 are Seasons A and B.
TABLES = {
    "Table 24": ("A", 2025),
    "Table 25": ("B", 2025),
}


def extract_table(frame: pd.DataFrame, season: str, year: int) -> list[dict]:
    header_index = None
    for index, row in frame.iterrows():
        cells = [str(cell).strip() for cell in row.tolist()]
        if "District" in cells and "Maize" in cells and "Bean" in cells:
            header_index = index
            headers = cells
            break
    if header_index is None:
        raise ValueError(f"No district maize and bean header for season {season}")

    district_col = headers.index("District")
    maize_col = headers.index("Maize")
    bean_col = headers.index("Bean")
    rows = []
    for _, row in frame.iloc[header_index + 1 :].iterrows():
        district = row.iloc[district_col]
        if pd.isna(district):
            continue
        name = str(district).strip()
        if not name or name.lower() in {"district", "rwanda", "total"}:
            continue
        maize = row.iloc[maize_col]
        beans = row.iloc[bean_col]
        if pd.isna(maize) or pd.isna(beans):
            continue
        rows.append(
            {
                "sas_year": year,
                "season": season,
                "district": name,
                "eastern": name in EASTERN_DISTRICTS,
                "maize_tonnes": float(maize),
                "beans_tonnes": float(beans),
                "published_on": PUBLICATION_DATE,
                "source_table": f"SAS 2025 annual tables, season {season}",
                "source_url": SOURCE_URL,
            }
        )
    return rows


def load_sas(path=None) -> pd.DataFrame:
    path = path or WORKBOOK
    rows = []
    for sheet, (season, year) in TABLES.items():
        frame = pd.read_excel(path, sheet_name=sheet, header=None)
        rows.extend(extract_table(frame, season, year))
    return pd.DataFrame(rows)


def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    cached = PROCESSED / "sas_district_production.csv"
    if not WORKBOOK.exists():
        if cached.exists():
            print("SAS workbook missing. Using the committed extract. Link is in docs/DATA.md.")
            return pd.read_csv(cached)
        raise SystemExit("Missing SAS 2025 annual tables. Download link is in docs/DATA.md.")
    table = load_sas()
    table.to_csv(cached, index=False)
    eastern = table[table.eastern & table.season.isin(["A", "B"])]
    print(f"SAS rows {len(table)} eastern A/B {len(eastern)} published {PUBLICATION_DATE}")
    return table


if __name__ == "__main__":
    main()
