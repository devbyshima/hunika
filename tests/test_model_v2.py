import math

import pandas as pd
import pytest

from pipeline.backtest import _realised
from pipeline.ingest_rain import season_rain
from pipeline.model import v2_quantiles


def _rain(values_by_year):
    rows = []
    for year, value in values_by_year.items():
        for month in (9, 10, 11, 12):
            for day in ("01", "11", "21"):
                rows.append({"district": "Kayonza", "date": f"{year - 1}-{month:02d}-{day}", "rfh": value})
        for day in ("01", "11", "21"):
            rows.append({"district": "Kayonza", "date": f"{year}-01-{day}", "rfh": value})
            rows.append({"district": "Kayonza", "date": f"{year}-02-{day}", "rfh": value})
    return pd.DataFrame(rows)


def test_rain_anomaly_uses_only_earlier_years():
    years = {year: 10.0 for year in range(1990, 2010)}
    years[2010] = 20.0
    years[2011] = 10.0
    anomalies = season_rain(_rain(years), "Kayonza", "A")
    assert anomalies[2010] == pytest.approx(math.log(2.0))
    # 2011 sees the wet 2010 in its mean, 2009 does not.
    assert anomalies[2009] == pytest.approx(0.0)
    assert anomalies[2011] < 0


def test_rain_window_stops_before_the_decision_month():
    years = {year: 10.0 for year in range(1990, 2011)}
    rain = _rain(years)
    rain.loc[rain["date"].str.startswith("2010-01"), "rfh"] = 1000.0
    january = season_rain(rain, "Kayonza", "A", cutoff_month=1)
    full = season_rain(rain, "Kayonza", "A")
    assert january[2010] == pytest.approx(0.0)
    assert full[2010] > 0


def test_v2_slope_moves_the_centre_and_residuals_set_the_range():
    samples = [(x / 10, 0.5 * x / 10 + noise, str(2000 + i)) for i, (x, noise) in enumerate(
        [(-2, 0.01), (-1, -0.01), (0, 0.02), (1, -0.02), (2, 0.0), (-2, -0.01), (-1, 0.01), (0, -0.02), (1, 0.02), (2, 0.0), (0, 0.0), (1, 0.0)]
    )]
    low, mid, high = v2_quantiles(samples, 0.2)
    assert low < mid < high
    assert math.log(mid) == pytest.approx(0.1, abs=0.02)
    assert v2_quantiles(samples[:5], 0.2) is None
    assert v2_quantiles(samples, None) is None


def test_realised_gain_counts_loss_bags_and_interest():
    option = {"loss_monthly": 0.01, "fee": 0.0, "cost_per_kg": 10.0, "interest_annual": 0.12, "borrow_share": 0.5}
    # Price 400 now and 500 in two months, no inflation.
    gain = _realised(option, 2, 400.0, 400.0, 500.0, 500.0)
    sale = 1000 * 500 * 0.98
    interest = 0.12 * 0.5 * 1000 * 400 * 2 / 12
    assert gain == pytest.approx(sale - interest - 10_000 - 400_000)
