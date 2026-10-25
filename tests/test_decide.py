import json
from pathlib import Path

import pytest

from pipeline.decide import decide

CASES = json.loads((Path(__file__).parents[1] / "tests" / "fixtures" / "decide_cases.json").read_text())["cases"]


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_shared_fixture(case):
    result = decide(case["input"])
    for key, expected in case["expected"].items():
        got = result[key]
        if isinstance(expected, float):
            assert got == pytest.approx(expected)
        else:
            assert got == expected
