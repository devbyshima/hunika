"""Extract district maize and bean production from the NISR SAS table workbooks.

Seasons A and B, 2018 to 2026, every district. Season C is out of scope.
Each edition keeps the date it can be treated as published. The supply anomaly
for a season is the log of production over the mean of the three previous
seasons of the same letter, so the first anomaly is 2021.
"""

from __future__ import annotations

import math
import warnings
from dataclasses import dataclass

import pandas as pd

from pipeline.paths import EASTERN_DISTRICTS, PROCESSED, RAW

FOLDER = RAW / "nisr" / "sas"
BASE = "https://statistics.gov.rw/sites/default/files/documents"


@dataclass(frozen=True)
class Edition:
    file: str
    sheet: str
    season: str
    year: int
    layout: str  # "rows": districts down the side. "columns": districts across the top.
    published_on: str
    date_basis: str
    url: str


# Dates stated on an NISR publication page are used as they are. Older editions
# carry only a 2024 or 2025 re-upload date, so they are treated as published on
# 31 March of the next year. That is later than the workbook's own save date.
STATED = "NISR publication page"
LATE = "not stated; treated as 31 March of the next year"
EDITIONS = (
    Edition("SAS_2018_Annual_Tables.xlsx", "Appendix 6 ", "A", 2018, "columns", "2019-03-31", LATE, f"{BASE}/2025-06/2018%20Annual%20Tables_Final%20%281%29.xlsx"),
    Edition("SAS_2018_Annual_Tables.xlsx", "Appendix 7", "B", 2018, "columns", "2019-03-31", LATE, f"{BASE}/2025-06/2018%20Annual%20Tables_Final%20%281%29.xlsx"),
    Edition("SAS_2019_Annual_Tables.xlsx", "Table 18", "A", 2019, "rows", "2020-03-31", LATE, f"{BASE}/2024-10/SAS%202019%20_Annual%20report%20_Tables.xlsx"),
    Edition("SAS_2019_Annual_Tables.xlsx", "Table 19", "B", 2019, "rows", "2020-03-31", LATE, f"{BASE}/2024-10/SAS%202019%20_Annual%20report%20_Tables.xlsx"),
    Edition("SAS_2020_Final_Tables.xlsx", "Table 20", "A", 2020, "rows", "2021-03-31", LATE, f"{BASE}/2024-10/USAS%202020%20_Final_Tables.xlsx"),
    Edition("SAS_2020_Final_Tables.xlsx", "Table 21", "B", 2020, "rows", "2021-03-31", LATE, f"{BASE}/2024-10/USAS%202020%20_Final_Tables.xlsx"),
    Edition("SAS_2021_Tables.xlsx", "Table 24", "A", 2021, "rows", "2022-03-31", LATE, f"{BASE}/2024-10/SAS%202021_Tables.xlsx"),
    Edition("SAS_2021_Tables.xlsx", "Table 25", "B", 2021, "rows", "2022-03-31", LATE, f"{BASE}/2024-10/SAS%202021_Tables.xlsx"),
    Edition("SAS_2022_Tables.xlsx", "Table 23", "A", 2022, "rows", "2022-12-09", STATED, f"{BASE}/2026-09/SAS%202022_Tables_0.xlsx"),
    Edition("SAS_2022_Tables.xlsx", "Table 24", "B", 2022, "rows", "2022-12-09", STATED, f"{BASE}/2026-09/SAS%202022_Tables_0.xlsx"),
    Edition("SAS_2023_Annual_Tables.xlsx", "Table 22", "A", 2023, "rows", "2023-12-30", STATED, f"{BASE}/2024-10/SAS%202023_Annual%20Tables%20%283%29.xlsx"),
    Edition("SAS_2023_Annual_Tables.xlsx", "Table 23", "B", 2023, "rows", "2023-12-30", STATED, f"{BASE}/2024-10/SAS%202023_Annual%20Tables%20%283%29.xlsx"),
    Edition("SAS_2024_Annual_Tables.xlsx", "Table 21", "A", 2024, "rows", "2024-12-31", STATED, f"{BASE}/2025-02/SAS%202024_Annual%20Tables.xlsx"),
    Edition("SAS_2024_Annual_Tables.xlsx", "Table 22", "B", 2024, "rows", "2024-12-31", STATED, f"{BASE}/2025-02/SAS%202024_Annual%20Tables.xlsx"),
    Edition("SAS_2025_Annual_Tables.xlsx", "Table 24", "A", 2025, "rows", "2025-12-31", STATED, f"{BASE}/2025-12/SAS%202025_Annual%20Tables.xlsx"),
    Edition("SAS_2025_Annual_Tables.xlsx", "Table 25", "B", 2025, "rows", "2025-12-31", STATED, f"{BASE}/2025-12/SAS%202025_Annual%20Tables.xlsx"),
    Edition("SAS_2026A_Tables.xlsx", "Table 15", "A", 2026, "rows", "2026-04-28", STATED, f"{BASE}/2026-04/Tables_2026%20Season%20A.xlsx"),
    Edition("SAS_2026B_Tables.xlsx", "Table 13", "B", 2026, "rows", "2026-09-22", STATED, f"{BASE}/2026-09/Tables_2026%20Season%20B.xlsx"),
)

DISTRICTS = frozenset(
    "Nyarugenge Gasabo Kicukiro Nyanza Gisagara Nyaruguru Huye Nyamagabe Ruhango Muhanga Kamonyi "
    "Karongi Rutsiro Rubavu Nyabihu Ngororero Rusizi Nyamasheke Rulindo Gakenke Musanze Burera Gicumbi "
    "Rwamagana Nyagatare Gatsibo Kayonza Kirehe Ngoma Bugesera".split()
)


def _clean(cell) -> str:
    return " ".join(str(cell).split()) if pd.notna(cell) else ""


def _number(cell) -> float | None:
    if pd.isna(cell):
        return None
    if isinstance(cell, str):
        text = cell.strip()
        if text in {"-", ""}:
            return 0.0
        try:
            return float(text.replace(",", ""))
        except ValueError:
            return None
    return float(cell)


def _bean_columns(headers: list[str]) -> list[int]:
    """Total beans. 2021 Season A has no total, so bush plus climbing is used."""
    for name in ("Beans", "Bean"):
        if name in headers:
            return [headers.index(name)]
    if "Bush bean" in headers and "Climbing bean" in headers:
        return [headers.index("Bush bean"), headers.index("Climbing bean")]
    raise ValueError("No bean column")


def _row(edition: Edition, district: str, maize: float, beans: float) -> dict:
    return {
        "sas_year": edition.year,
        "season": edition.season,
        "district": district,
        "eastern": district in EASTERN_DISTRICTS,
        "maize_tonnes": maize,
        "beans_tonnes": beans,
        "published_on": edition.published_on,
        "date_basis": edition.date_basis,
        "source_table": f"SAS {edition.year} {edition.sheet.strip()}, season {edition.season}",
        "source_url": edition.url,
    }


def extract_rows_layout(frame: pd.DataFrame, edition: Edition) -> list[dict]:
    header_index = None
    for index in range(min(len(frame), 12)):
        cells = [_clean(cell) for cell in frame.iloc[index].tolist()]
        if "Maize" in cells:
            header_index = index
            headers = cells
            break
    if header_index is None:
        raise ValueError(f"No maize header in {edition.file} {edition.sheet}")
    maize_col = headers.index("Maize")
    bean_cols = _bean_columns(headers)
    rows = []
    for _, row in frame.iloc[header_index + 1 :].iterrows():
        name = next((_clean(cell) for cell in row.tolist()[:3] if isinstance(cell, str) and _clean(cell)), "")
        if name not in DISTRICTS:
            continue
        maize = _number(row.iloc[maize_col])
        beans = [_number(row.iloc[col]) for col in bean_cols]
        if maize is None or any(value is None for value in beans):
            continue
        rows.append(_row(edition, name, maize, sum(beans)))
    return rows


def extract_columns_layout(frame: pd.DataFrame, edition: Edition) -> list[dict]:
    header_index = None
    for index in range(min(len(frame), 12)):
        if _clean(frame.iat[index, 0]).lower().startswith("crop/district"):
            header_index = index
            break
    if header_index is None:
        raise ValueError(f"No district header in {edition.file} {edition.sheet}")
    labels = [_clean(cell) for cell in frame.iloc[:, 0].tolist()]
    maize_row = labels.index("Maize")
    bean_row = labels.index("Beans")
    rows = []
    for col in range(1, frame.shape[1]):
        name = _clean(frame.iat[header_index, col])
        if name not in DISTRICTS:
            continue
        maize = _number(frame.iat[maize_row, col])
        beans = _number(frame.iat[bean_row, col])
        if maize is None or beans is None:
            continue
        rows.append(_row(edition, name, maize, beans))
    return rows


def extract_table(frame: pd.DataFrame, edition: Edition) -> list[dict]:
    if edition.layout == "columns":
        return extract_columns_layout(frame, edition)
    return extract_rows_layout(frame, edition)


def load_sas(folder=None) -> pd.DataFrame:
    folder = folder or FOLDER
    rows = []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for edition in EDITIONS:
            frame = pd.read_excel(folder / edition.file, sheet_name=edition.sheet, header=None)
            found = extract_table(frame, edition)
            districts = {row["district"] for row in found}
            missing = set(EASTERN_DISTRICTS) - districts
            if missing:
                raise SystemExit(f"{edition.file} {edition.sheet} is missing {sorted(missing)}")
            if len(found) != 30:
                raise SystemExit(f"{edition.file} {edition.sheet} has {len(found)} districts, expected 30")
            rows.extend(found)
    return pd.DataFrame(rows)


def supply_anomaly(sas: pd.DataFrame) -> pd.DataFrame:
    """log(production / mean of the three previous same-letter seasons), by district and nationally."""
    national = (
        sas.groupby(["sas_year", "season"], as_index=False)
        .agg(maize_tonnes=("maize_tonnes", "sum"), beans_tonnes=("beans_tonnes", "sum"), published_on=("published_on", "max"))
        .assign(district="Rwanda")
    )
    frame = pd.concat([sas[["sas_year", "season", "district", "maize_tonnes", "beans_tonnes", "published_on"]], national])
    rows = []
    for (district, season), part in frame.groupby(["district", "season"]):
        part = part.set_index("sas_year").sort_index()
        for year in part.index:
            previous = [year - 1, year - 2, year - 3]
            if not all(item in part.index for item in previous):
                continue
            for crop in ("maize", "beans"):
                base = part.loc[previous, f"{crop}_tonnes"].mean()
                value = part.at[year, f"{crop}_tonnes"]
                if base <= 0 or value <= 0:
                    continue
                rows.append(
                    {
                        "district": district,
                        "season": season,
                        "sas_year": int(year),
                        "crop": crop,
                        "tonnes": float(value),
                        "base_tonnes": float(base),
                        "anomaly": math.log(value / base),
                        "published_on": part.at[year, "published_on"],
                    }
                )
    return pd.DataFrame(rows)


def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    cached = PROCESSED / "sas_district_production.csv"
    if not all((FOLDER / edition.file).exists() for edition in EDITIONS):
        if cached.exists():
            print("SAS workbooks missing. Using the committed extract. Links are in docs/DATA.md.")
            table = pd.read_csv(cached)
        else:
            raise SystemExit("Missing SAS workbooks. Run scripts/fetch_public_data.sh.")
    else:
        table = load_sas()
        table.to_csv(cached, index=False)
    anomaly = supply_anomaly(table)
    anomaly.to_csv(PROCESSED / "sas_supply_anomaly.csv", index=False)
    print(f"SAS rows {len(table)} editions {table[['sas_year', 'season']].drop_duplicates().shape[0]} anomaly rows {len(anomaly)}")
    return table


if __name__ == "__main__":
    main()
