from datetime import datetime

import pandas as pd
import pytest

from pipeline.ingest_cpi import extract_food, publication_date
from pipeline.ingest_prices import kg_price, load_prices
from pipeline.ingest_sas import extract_table


def test_kg_price_converts_bags_and_rejects_unknown_units():
    assert kg_price(5000, "100 KG") == 50
    assert kg_price(250, "KG") == 250
    assert kg_price(100, "basket") is None


def test_price_loader_keeps_grain_and_drops_the_aggregate_duplicate(tmp_path):
    path = tmp_path / "prices.csv"
    rows = [
        "date,admin1,admin2,market,market_id,latitude,longitude,category,commodity,commodity_id,unit,priceflag,pricetype,currency,price,usdprice",
        "2020-01-15,Eastern Province,Kayonza,Kabarondo,1,0,0,cereals,Maize,51,KG,actual,Retail,RWF,100,1",
        "2020-01-15,Eastern Province,Kayonza,Kabarondo,1,0,0,cereals,Maize,51,KG,aggregate,Retail,RWF,999,1",
        "2020-02-15,Eastern Province,Kayonza,Kabarondo,1,0,0,cereals,Maize flour,52,KG,actual,Retail,RWF,80,1",
        "2020-02-15,Eastern Province,Kayonza,Kabarondo,1,0,0,pulses,Beans (dry),50,100 KG,actual,Retail,RWF,5000,1",
        "2020-03-15,Eastern Province,Kayonza,Kabarondo,1,0,0,pulses,Beans,50,KG,actual,Retail,RWF,50,1",
    ]
    path.write_text("\n".join(rows))
    prices, report = load_prices(path)
    maize = prices[prices.crop.eq("maize")]
    assert list(maize.price_rwf_per_kg) == [100]
    beans = prices[prices.crop.eq("beans")]
    assert list(beans.price_rwf_per_kg) == [50]
    assert report["dropped"]["beans_not_labeled_dry"] == 1


def test_unknown_maize_name_stops_the_load(tmp_path):
    path = tmp_path / "prices.csv"
    path.write_text(
        "date,admin1,admin2,market,market_id,latitude,longitude,category,commodity,commodity_id,unit,priceflag,pricetype,currency,price,usdprice\n"
        "2020-01-15,Eastern Province,Kayonza,Kabarondo,1,0,0,cereals,Maize (yellow),51,KG,actual,Retail,RWF,100,1\n"
    )
    with pytest.raises(SystemExit):
        load_prices(path)


def test_cpi_food_row_and_publication_lag():
    dates = [datetime(2014, month, 10) for month in range(1, 13)]
    frame = pd.DataFrame(
        [
            ["Province", "U_R", "COICOP", "label", *dates],
            [0, 2, "01", "Food and non-alcoholic beverages", *range(100, 112)],
        ]
    )
    series = extract_food(frame)
    assert series["2014-01"] == 100
    assert series["2014-12"] == 111
    assert publication_date("2026-09") == "2026-10-10"


def test_sas_district_table_reads_maize_and_beans():
    frame = pd.DataFrame(
        [
            [None, "Table 24"],
            [None, "District", "Cereals", "Maize", "Bean", "Bush bean"],
            [None, "Kayonza", 30, 12.5, 40, 15],
            [None, "Total", 30, 12.5, 40, 15],
        ]
    )
    rows = extract_table(frame, "A", 2025)
    assert rows == [
        {
            "sas_year": 2025,
            "season": "A",
            "district": "Kayonza",
            "eastern": True,
            "maize_tonnes": 12.5,
            "beans_tonnes": 40.0,
            "published_on": "2025-12-31",
            "source_table": "SAS 2025 annual tables, season A",
            "source_url": "https://statistics.gov.rw/sites/default/files/documents/2025-12/SAS%202025_Annual%20Tables.xlsx",
        }
    ]
