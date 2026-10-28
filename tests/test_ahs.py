import pandas as pd
import pytest

from pipeline.ingest_ahs import REASONS, crop_rows, summarise


def _tables():
    crops = pd.DataFrame(
        {
            "hhid": [1, 1, 2, 3],
            "province": ["East", "East", "East", "South"],
            "district": ["Kayonza", "Kayonza", "Kirehe", "Huye"],
            "Season": ["Season A", "Season A", "Season A", "Season A"],
            "weight": [100.0, 100.0, 300.0, 50.0],
            "s3_q4_1": ["Maize", "Bush bean", "Maize", "Maize"],
            "s3_q20_1": [200.0, 50.0, 400.0, 999.0],
            "s2q23_1": ["Was decreased", "Was increased", "No change", "Was decreased"],
            "s3_q21_1_1": ["CD", "Q", "", "A"],
            "s3_q4_2": ["Sweet potato", None, "Climbing bean", None],
            "s3_q20_2": [10.0, None, 30.0, None],
            "s2q23_2": [None, None, "Was highly decreased", None],
            "s3_q21_2_1": [None, None, "B", None],
        }
    )
    household = pd.DataFrame({"hhid": [1, 2, 3], "province": ["East", "East", "South"], "weight": [100.0, 300.0, 50.0]})
    extension = pd.DataFrame(
        {
            "hhid": [1, 1, 2],
            "s6q1": ["Post-harvest handling and storage ", "None", "None"],
            "s6q3": ["01", "", ""],
            "s6q10": ["Yes", "Yes", "No"],
            "s6q12": ["124", "124", ""],
            "s6q8": ["No", "No", "No"],
        }
    )
    credit = pd.DataFrame({"hhid": [1, 2], "loan": ["Yes", "No"], "s10q6": ["Tontine/Solidarity fund", None], "s10aq7": ["Food purchase", None]})
    saving = pd.DataFrame({"hhid": [1, 2], "account": ["No", "Yes"]})
    return {"crops": crops, "household": household, "extension": extension, "credit": credit, "saving": saving}


def test_crop_rows_keep_eastern_maize_and_beans_and_decode_the_first_reason():
    rows = crop_rows(_tables()["crops"])
    assert sorted(rows["crop"]) == ["beans", "beans", "maize", "maize"]
    assert set(rows["hhid"]) == {1, 2}
    assert rows.loc[rows["compare"].eq("Was decreased"), "reason"].tolist() == ["C"]
    assert REASONS["C"] == "Insufficient rainfall"


def test_summary_weights_households_and_cooperative_services():
    summary = summarise(_tables())
    maize = summary["crops"]["maize"]["Season A"]
    assert maize["households_weighted"] == 400
    assert maize["median_harvest_kg"] == 400.0
    assert maize["share_lower_than_last_season"] == pytest.approx(0.25)
    assert summary["cooperative_member"] == pytest.approx(0.25)
    storage = next(item for item in summary["cooperative_services"] if item["code"] == "4")
    assert storage["share"] == 1.0
    assert summary["post_harvest_advice_this_season"] == pytest.approx(0.25)
    assert summary["account"] == pytest.approx(0.75)
