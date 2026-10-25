from pipeline.fill import fill_short_gaps
from pipeline.months import add_months, blend, collect_ratios
from pipeline.seasons import bottoms


def test_short_gaps_fill_one_or_two_months_only():
    filled = fill_short_gaps([100, None, 120])
    assert filled[1] == (110, True)
    longer = fill_short_gaps([100, None, None, None, 140])
    assert longer[1][0] is None
    assert longer[2][1] is False
    two = fill_short_gaps([100, None, None, 130])
    assert two[1][0] == 110
    assert two[2][0] == 120
    assert two[1][1] is True


def test_add_months_crosses_the_year():
    assert add_months("2026-11", 3) == "2027-02"
    assert add_months("2026-08", 4) == "2026-12"


def test_ratios_exclude_a_window_that_ends_after_the_decision():
    series = {"2024-08": 100.0, "2024-10": 80.0, "2025-08": 100.0, "2025-10": 150.0}
    ratios, years = collect_ratios(series, 8, 2, "2025-09")
    assert ratios == [0.8]
    assert years == {"2024"}


def test_blend_uses_province_until_five_years():
    market = (1.0, 1.1, 1.2)
    province = (0.5, 0.6, 0.7)
    only_province, weight = blend(None, province, 0)
    assert only_province == province
    assert weight == 0
    mixed, weight = blend(market, province, 2)
    assert weight == 0.4
    assert mixed[1] == 0.4 * 1.1 + 0.6 * 0.6
    own, weight = blend(market, province, 5)
    assert own == market
    assert weight == 1


def test_season_bottom_is_the_usual_low_month():
    series = {}
    for year in range(2012, 2018):
        series[f"{year - 1}-12"] = 100
        series[f"{year}-01"] = 90
        series[f"{year}-02"] = 80
        series[f"{year}-03"] = 70
        series[f"{year}-04"] = 80
        series[f"{year}-05"] = 70
        series[f"{year}-06"] = 60
        series[f"{year}-07"] = 90
    season_a = bottoms(series, "A")
    season_b = bottoms(series, "B")
    assert season_a["decision_month"] == 3
    assert season_b["decision_month"] == 6
    assert season_a["confirmed"] is False
