"""Find the harvest month when Eastern Province prices bottom out.

The windows are the months when Season A and Season B crops reach the market,
taken from the build guide's FAO note: maize was still falling through March,
beans through July. The decision month is the most common price bottom inside
that window. A tie goes to the later month in the window. The team confirms
the result before it is treated as final.
"""

from __future__ import annotations

import pandas as pd
import yaml

from pipeline.model import retail
from pipeline.paths import CONFIG

WINDOWS = {
    "A": (12, 1, 2, 3),
    "B": (4, 5, 6, 7),
}


def _window_months(season: str, year: int) -> list[str]:
    months = []
    for month in WINDOWS[season]:
        use_year = year - 1 if season == "A" and month == 12 else year
        months.append(f"{use_year:04d}-{month:02d}")
    return months


def bottoms(series: dict[str, float], season: str) -> dict | None:
    counts: dict[int, int] = {}
    years = []
    if not series:
        return None
    first = int(min(series)[:4])
    last = int(max(series)[:4])
    for year in range(first, last + 1):
        months = _window_months(season, year)
        if any(month not in series for month in months):
            continue
        order = {month: position for position, month in enumerate(WINDOWS[season])}
        winner = min(months, key=lambda month: (series[month], -order[int(month[5:7])]))
        calendar = int(winner[5:7])
        counts[calendar] = counts.get(calendar, 0) + 1
        years.append(year)
    if not counts:
        return None
    best = max(counts.values())
    tied = [month for month, count in counts.items() if count == best]
    order = list(WINDOWS[season])
    decision = max(tied, key=lambda month: order.index(month))
    return {
        "decision_month": decision,
        "year_shift": -1 if decision == 12 else 0,
        "window_months": list(WINDOWS[season]),
        "years_compared": len(years),
        "year_min": min(years),
        "year_max": max(years),
        "bottom_counts": {str(month): count for month, count in sorted(counts.items())},
        "confirmed": False,
    }


def season_bottoms(series: dict[str, float], season: str) -> dict[int, int]:
    """The bottom calendar month of every complete window, by season year."""
    found = {}
    if not series:
        return found
    order = {month: position for position, month in enumerate(WINDOWS[season])}
    for year in range(int(min(series)[:4]), int(max(series)[:4]) + 1):
        months = _window_months(season, year)
        if any(month not in series for month in months):
            continue
        winner = min(months, key=lambda month: (series[month], -order[int(month[5:7])]))
        found[year] = int(winner[5:7])
    return found


def rolling_months(series: dict[str, float], season: str, min_years: int = 4) -> dict[int, int]:
    """Decision month for each season year, from the bottoms of earlier years only.

    A season's window closes before the next year's window opens, so every
    bottom used for year Y was known before any decision in year Y.
    """
    bottoms_by_year = season_bottoms(series, season)
    order = list(WINDOWS[season])
    months = {}
    first = min(bottoms_by_year) if bottoms_by_year else None
    if first is None:
        return months
    for year in range(first + 1, int(max(series)[:4]) + 1):
        earlier = [month for past, month in bottoms_by_year.items() if past < year]
        if len(earlier) < min_years:
            continue
        counts = {month: earlier.count(month) for month in set(earlier)}
        best = max(counts.values())
        months[year] = max((month for month, count in counts.items() if count == best), key=order.index)
    return months


def province_series(panel: pd.DataFrame, crop: str) -> dict[str, float]:
    frame = retail(panel, crop)
    if frame.empty:
        return {}
    grouped = frame.groupby("month")["price_real"].median()
    return {str(month): float(price) for month, price in grouped.items()}


def propose(panel: pd.DataFrame) -> dict:
    crops = {}
    for crop in ("maize", "beans"):
        series = province_series(panel, crop)
        crops[crop] = {season: bottoms(series, season) for season in ("A", "B")}
    return {
        "confirmed": False,
        "method": (
            "Eastern Province median real retail price, camps excluded, short fills excluded. "
            "Season A window is Dec-Mar. Season B window is Apr-Jul. "
            "The decision month is the most common bottom. Ties use the later month in the window."
        ),
        "crops": crops,
    }


def write_proposal(proposal: dict) -> None:
    path = CONFIG / "seasons.yaml"
    if path.exists():
        current = yaml.safe_load(path.read_text()) or {}
        if current.get("confirmed") is True:
            print("seasons.yaml is confirmed. Leaving it in place.")
            return
    path.write_text(yaml.safe_dump(proposal, sort_keys=False))
    print("Wrote config/seasons.yaml (confirmed: false).")
