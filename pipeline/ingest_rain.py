"""CHIRPS dekadal rainfall for the seven Eastern districts, from the WFP file on HDX.

The rainfall anomaly for a season is the log of rain so far over the mean of
the same calendar window in every earlier year. The window stops before the
first day of the decision month, and the mean uses only earlier years, so the
anomaly never sees a later season or the climatology of a later period.
"""

from __future__ import annotations

import math

import pandas as pd

from pipeline.paths import PROCESSED, RAW

SOURCE = RAW / "rwa-rainfall-subnat-full.csv"
SOURCE_URL = "https://data.humdata.org/dataset/rwa-rainfall-subnational"
OUTPUT = PROCESSED / "rain_dekadal_east.csv"

# NISR district codes, as used in the WFP PCODE column.
PCODES = {
    "RW51": "Rwamagana",
    "RW52": "Nyagatare",
    "RW53": "Gatsibo",
    "RW54": "Kayonza",
    "RW55": "Kirehe",
    "RW56": "Ngoma",
    "RW57": "Bugesera",
}

# Season A is planted in September and harvested in January and February.
# Season B is planted in February and harvested in June and July.
WINDOWS = {"A": ((-1, 9), (0, 1)), "B": ((0, 2), (0, 5))}
FIRST_YEAR = 1981


def load_rain(path=None) -> pd.DataFrame:
    path = path or SOURCE
    if not path.exists():
        if OUTPUT.exists():
            print("Rainfall file missing. Using the committed extract.")
            return pd.read_csv(OUTPUT)
        raise SystemExit("Missing rwa-rainfall-subnat-full.csv. Run scripts/fetch_public_data.sh.")
    frame = pd.read_csv(path, usecols=["date", "adm_level", "PCODE", "rfh", "version"])
    frame = frame[frame["adm_level"].eq(2) & frame["PCODE"].isin(PCODES)].copy()
    frame["district"] = frame["PCODE"].map(PCODES)
    frame = frame[["district", "date", "rfh", "version"]].sort_values(["district", "date"])
    PROCESSED.mkdir(parents=True, exist_ok=True)
    frame.to_csv(OUTPUT, index=False)
    return frame


def _window(season: str, season_year: int) -> tuple[str, str]:
    (start_shift, start_month), (end_shift, end_month) = WINDOWS[season]
    start = f"{season_year + start_shift:04d}-{start_month:02d}-01"
    end_year, end_next = season_year + end_shift, end_month + 1
    if end_next == 13:
        end_year, end_next = end_year + 1, 1
    return start, f"{end_year:04d}-{end_next:02d}-01"


def season_rain(rain: pd.DataFrame, district: str, season: str, cutoff_month: int | None = None) -> dict[int, float]:
    """Rainfall anomaly for every season year of one district.

    With `cutoff_month`, the window stops before the first day of that month in
    the season year, which is the decision month. The mean of the same window
    uses every earlier year from 1981, so it needs no later data.
    """
    series = rain[rain["district"].eq(district)]
    dates = series["date"].astype(str).to_numpy()
    values = series["rfh"].to_numpy(dtype=float)
    sums: dict[int, float] = {}
    last_year = int(dates.max()[:4]) + 1
    for year in range(FIRST_YEAR + 1, last_year + 1):
        start, end = _window(season, year)
        stop = min(end, f"{year:04d}-{cutoff_month:02d}-01") if cutoff_month else end
        if stop <= start or stop > dates.max():
            continue
        mask = (dates >= start) & (dates < stop)
        if not mask.any() or math.isnan(values[mask].sum()):
            continue
        sums[year] = float(values[mask].sum())
    anomalies = {}
    for year, total in sums.items():
        past = [value for earlier, value in sums.items() if earlier < year]
        if len(past) < 10 or total <= 0:
            continue
        mean = sum(past) / len(past)
        if mean > 0:
            anomalies[year] = math.log(total / mean)
    return anomalies


def main():
    rain = load_rain()
    print(f"rainfall rows {len(rain)} districts {rain['district'].nunique()} last dekad {rain['date'].max()}")
    return rain


if __name__ == "__main__":
    main()
