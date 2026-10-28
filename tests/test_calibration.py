import pytest

from pipeline.model import fit_width, widen
from pipeline.seasons import rolling_months


def _series(bottoms):
    """Season A windows (Dec-Mar) where the lowest month is the one given per year."""
    series = {}
    for year, low in bottoms.items():
        for month in (12, 1, 2, 3):
            key = f"{year - 1 if month == 12 else year:04d}-{month:02d}"
            series[key] = 50.0 if month == low else 100.0
    return series


def test_rolling_months_use_only_earlier_bottoms():
    series = _series({2010: 3, 2011: 3, 2012: 2, 2013: 3, 2014: 2, 2015: 2, 2016: 2})
    months = rolling_months(series, "A", min_years=4)
    # 2014 sees 2010-2013: three Marches and one February.
    assert months[2014] == 3
    # 2016 sees 2010-2015: three of each, and a tie goes to the later month.
    assert months[2016] == 3
    assert 2013 not in months


def test_widen_keeps_the_median_and_stretches_in_log_space():
    low, mid, high = widen((0.8, 1.0, 1.25), 2.0)
    assert mid == 1.0
    assert low == pytest.approx(0.64)
    assert high == pytest.approx(1.5625)


def test_fit_width_reaches_the_target_coverage():
    records = [(0.9, 1.0, 1.1, actual) for actual in [1.0] * 60 + [1.21] * 20 + [0.81] * 20]
    width = fit_width(records)
    widened = [widen(row[:3], width) for row in records]
    inside = sum(low <= row[3] <= high for (low, _, high), row in zip(widened, records))
    assert inside / len(records) >= 0.8
    assert fit_width(records[:10]) is None
