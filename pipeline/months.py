"""Month arithmetic and percentile helpers shared by the model and backtest."""

from __future__ import annotations

import numpy as np


def add_months(year_month: str, horizon: int) -> str:
    year, month = int(year_month[:4]), int(year_month[5:7])
    index = year * 12 + (month - 1) + horizon
    year2, month0 = divmod(index, 12)
    return f"{year2:04d}-{month0 + 1:02d}"


def month_span(start: str, end: str) -> list[str]:
    months = []
    cursor = start
    while cursor <= end:
        months.append(cursor)
        cursor = add_months(cursor, 1)
    return months


def quantiles(values: list[float]) -> tuple[float, float, float]:
    array = np.asarray(values, dtype=float)
    low, mid, high = np.quantile(array, [0.1, 0.5, 0.9], method="linear")
    return float(low), float(mid), float(high)


def collect_ratios(series: dict[str, float], calendar_month: int, horizon: int, before: str) -> tuple[list[float], set[str]]:
    """Real-price ratios whose whole window ends before `before`.

    `before` is the decision month and is excluded. A pair that starts in an
    earlier year but lands after the decision month is left out, so a December
    ratio cannot use a price that was not yet known.
    """
    ratios: list[float] = []
    years: set[str] = set()
    needle = f"{calendar_month:02d}"
    for year_month, price in series.items():
        if year_month[5:7] != needle or year_month >= before:
            continue
        future = add_months(year_month, horizon)
        if future >= before or future not in series:
            continue
        if price is None or price <= 0 or series[future] is None:
            continue
        ratios.append(series[future] / price)
        years.add(year_month[:4])
    return ratios, years


def blend(market_q, province_q, n_years: int, min_years: int = 5):
    """Blend percentile triples. Weight is n/5 on the market, as in model v1."""
    if n_years >= min_years or province_q is None:
        return market_q, 1.0 if market_q is not None else 0.0
    weight = n_years / min_years
    if market_q is None or n_years == 0:
        return province_q, 0.0
    blended = tuple(weight * a + (1 - weight) * b for a, b in zip(market_q, province_q))
    return blended, weight
