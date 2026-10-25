"""Read the NISR CPI workbook and rebase the rural food index.

The September 2026 release was published on 10 October 2026. The workbook
stamps each column with the 10th of the index month, which is not the release
date. A month's index is treated as available on the 10th of the next month.
"""

from __future__ import annotations

from datetime import datetime

import pandas as pd

from pipeline.months import add_months
from pipeline.paths import PROCESSED, RAW

FOOD_LABEL = "Food and non-alcoholic beverages"
CPI_FILE = RAW / "nisr" / "CPI_time_series_September_2026.xls"
SHEETS = {"urban": "Urban", "rural": "Rural", "national": "All Rwanda"}


def _as_month(value) -> str | None:
    if isinstance(value, datetime):
        return f"{value.year:04d}-{value.month:02d}"
    if isinstance(value, pd.Timestamp):
        return f"{value.year:04d}-{value.month:02d}"
    return None


def extract_food(frame: pd.DataFrame) -> pd.Series:
    date_row = None
    best = 0
    for index, row in frame.iterrows():
        count = sum(_as_month(cell) is not None for cell in row.tolist())
        if count > best:
            best = count
            date_row = index
    if date_row is None or best < 12:
        raise ValueError("CPI sheet has no date header")

    label_row = None
    for index, row in frame.iterrows():
        if any(str(cell).strip() == FOOD_LABEL for cell in row.tolist()):
            label_row = index
            break
    if label_row is None:
        raise ValueError("CPI sheet has no food row")

    months = []
    values = []
    for column in frame.columns:
        month = _as_month(frame.at[date_row, column])
        if month is None:
            continue
        value = frame.at[label_row, column]
        if pd.isna(value):
            continue
        months.append(month)
        values.append(float(value))
    series = pd.Series(values, index=months, name="index")
    return series.groupby(level=0).mean()


def publication_date(index_month: str) -> str:
    published = add_months(index_month, 1)
    return f"{published}-10"


def load_cpi(path=None) -> pd.DataFrame:
    path = path or CPI_FILE
    rows = []
    for name, sheet in SHEETS.items():
        frame = pd.read_excel(path, sheet_name=sheet, header=None)
        series = extract_food(frame)
        for month, value in series.items():
            rows.append(
                {
                    "series": name,
                    "month": month,
                    "index": value,
                    "base": "February 2014 = 100",
                    "published_on": publication_date(month),
                }
            )
    out = pd.DataFrame(rows).sort_values(["series", "month"]).reset_index(drop=True)
    return out


def rebase_latest(cpi: pd.DataFrame, series: str = "rural") -> pd.DataFrame:
    part = cpi[cpi["series"].eq(series)].sort_values("month").copy()
    latest = float(part["index"].iloc[-1])
    part["rebased"] = part["index"] / latest * 100
    part["real_factor"] = latest / part["index"]
    return part


def deflate(panel: pd.DataFrame, cpi: pd.DataFrame) -> pd.DataFrame:
    """Real price uses the rural food index, rebased to 100 at its latest month."""
    rural = rebase_latest(cpi, "rural")
    factor = rural.set_index("month")["real_factor"]
    out = panel.copy()
    out["cpi_factor"] = out["month"].map(factor)
    out["price_real"] = out["price_rwf_per_kg"] * out["cpi_factor"]
    out.loc[out["filled"], "price_real"] = out.loc[out["filled"], "price_real"]
    return out


def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    if not CPI_FILE.exists():
        cached = PROCESSED / "cpi_food.csv"
        if cached.exists():
            print(f"CPI workbook missing. Using {cached.name}. Download URL is in docs/DATA.md.")
            return pd.read_csv(cached)
        raise SystemExit(
            "Missing data/raw/nisr/CPI_time_series_September_2026.xls. "
            "The download link is in docs/DATA.md."
        )
    cpi = load_cpi()
    cpi.to_csv(PROCESSED / "cpi_food.csv", index=False)
    rural = cpi[cpi.series.eq("rural")]
    print(f"CPI rural food {rural.month.min()} to {rural.month.max()} ({len(rural)} months)")
    return cpi


if __name__ == "__main__":
    main()
