"""Agricultural Household Survey 2024, Eastern Province maize and bean growers.

The public-use files (RWA-NISR-RAHS-2024) have no question on crop sales, the
timing of sales, storage or post-harvest losses for seasonal crops. Only fruit,
milk, eggs and honey have sold quantities. So AHS cannot calibrate the loss
rates in config/assumptions.yaml. It does describe who faces the sell-or-store
decision: how many households grow maize and beans, how much they harvest, why
a season went badly, whether they belong to a cooperative and what it does for
them, and whether they borrow. Every share is weighted with the survey weight.

The microdata stays in data/raw/nisr/ahs2024/ and is not committed. The
weighted summary is written to data/processed/ahs_summary.json.
"""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from pipeline.paths import PROCESSED, RAW

CATALOG = "https://microdata.statistics.gov.rw/index.php/catalog/123"
FOLDER = RAW / "nisr" / "ahs2024"
NOTE = RAW / "nisr" / "AHS_2024_MISSING.txt"
OUTPUT = PROCESSED / "ahs_summary.json"
CROP_SLOTS = range(1, 8)
FILES = {
    "crops": "Section3_4",
    "extension": "Section6",
    "credit": "Credits",
    "saving": "Saving",
    "household": "Section0",
}


def _members(folder: Path):
    """Every readable table in the folder, including inside zip files."""
    for path in sorted(folder.rglob("*")):
        if path.suffix.lower() in {".dta", ".csv", ".sav"}:
            yield path.name, lambda path=path: path.read_bytes()
        elif path.suffix.lower() == ".zip":
            with zipfile.ZipFile(path) as archive:
                for name in archive.namelist():
                    if Path(name).suffix.lower() in {".dta", ".csv", ".sav"}:
                        yield Path(name).name, lambda path=path, name=name: zipfile.ZipFile(path).read(name)


# The crop file has 331 columns and one label set that pandas cannot convert, so
# only the columns the summary uses are read.
CROP_COLUMNS = ["hhid", "province", "district", "Season", "weight"] + [
    name for slot in CROP_SLOTS for name in (f"s3_q4_{slot}", f"s3_q20_{slot}", f"s2q23_{slot}", f"s3_q21_{slot}_1")
]


def _read(name: str, data: bytes) -> pd.DataFrame:
    suffix = Path(name).suffix.lower()
    if suffix == ".dta":
        columns = None
        if FILES["crops"].lower() in name.lower():
            available = set(pd.io.stata.StataReader(io.BytesIO(data)).variable_labels())
            columns = [column for column in CROP_COLUMNS if column in available]
        return pd.read_stata(io.BytesIO(data), convert_categoricals=True, columns=columns)
    if suffix == ".csv":
        return pd.read_csv(io.BytesIO(data))
    import pyreadstat  # only needed when NISR ships SPSS files alone

    with open(PROCESSED / "_ahs_tmp.sav", "wb") as handle:
        handle.write(data)
    frame, _ = pyreadstat.read_sav(str(PROCESSED / "_ahs_tmp.sav"), apply_value_formats=True)
    (PROCESSED / "_ahs_tmp.sav").unlink()
    return frame


def load_tables(folder: Path = FOLDER) -> dict[str, pd.DataFrame]:
    found: dict[str, tuple[str, bytes]] = {}
    for name, read in _members(folder):
        for key, needle in FILES.items():
            if needle.lower() in name.lower().replace(" ", "_") or needle.lower() in name.lower():
                # Prefer Stata over CSV over SPSS when NISR ships several formats.
                rank = {".dta": 0, ".csv": 1, ".sav": 2}[Path(name).suffix.lower()]
                if key not in found or rank < {".dta": 0, ".csv": 1, ".sav": 2}[Path(found[key][0]).suffix.lower()]:
                    found[key] = (name, read())
    return {key: _read(name, data) for key, (name, data) in found.items()}


# Question 3.21 is stored as letters in questionnaire order: A is code 1 (drought).
# Letters A to O and Z only appear with a lower harvest, Q to T only with a higher one.
REASONS = {
    "A": "Drought",
    "B": "Heavy rainfall or hailstones",
    "C": "Insufficient rainfall",
    "D": "Insufficient or no fertiliser",
    "E": "Late sowing",
    "F": "Flood",
    "G": "Landslide",
    "H": "Crop destroyed by animals",
    "I": "Diseases and pests",
    "J": "Unfertile soil",
    "K": "Inappropriate seeds",
    "L": "Biennial effect",
    "M": "Lack of improved seeds",
    "N": "Strong winds",
    "O": "Perennial crop not yet mature",
    "Z": "Other reason",
}
LOWER = {"Was decreased", "Was highly decreased"}
COMPARED = LOWER | {"Was increased", "Was highly increased", "No change"}
# Question 6.12, several digits per answer.
COOP_SERVICES = {
    "1": "Farming advice",
    "2": "Markets our products",
    "3": "Access to farm inputs",
    "4": "Storage facilities",
    "5": "Access to loans",
    "6": "Share in the profit",
    "7": "None",
    "8": "Other",
}


def _text(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip()


def _eastern(frame: pd.DataFrame) -> pd.Series:
    return _text(frame["province"]).str.contains("East", case=False, na=False)


def _crop_of(label: str) -> str | None:
    text = label.lower()
    if "maize" in text:
        return "maize"
    if "bean" in text and "soy" not in text:
        return "beans"
    return None


def _share(mask: pd.Series, weights: pd.Series) -> float | None:
    total = float(weights.sum())
    return None if total <= 0 else round(float(weights[mask].sum()) / total, 4)


def _weighted_quantile(values: pd.Series, weights: pd.Series, q: float) -> float:
    order = np.argsort(values.to_numpy(dtype=float))
    v = values.to_numpy(dtype=float)[order]
    w = weights.to_numpy(dtype=float)[order]
    cum = np.cumsum(w) / w.sum()
    return float(v[np.searchsorted(cum, q)])


def _ranked(frame: pd.DataFrame, column: str, weight: str = "weight", limit: int = 6) -> list[dict]:
    total = frame[weight].sum()
    if total <= 0:
        return []
    shares = frame.groupby(column)[weight].sum().sort_values(ascending=False) / total
    return [{"answer": str(answer), "share": round(float(share), 4)} for answer, share in shares.head(limit).items()]


def crop_rows(crops: pd.DataFrame) -> pd.DataFrame:
    """One row per plot and crop slot, Eastern Province, maize or beans."""
    rows = []
    east = crops[_eastern(crops)]
    for slot in CROP_SLOTS:
        name = f"s3_q4_{slot}"
        if name not in east.columns:
            continue
        part = pd.DataFrame(
            {
                "hhid": east["hhid"],
                "season": _text(east["Season"]),
                "weight": east["weight"].astype(float),
                "crop": _text(east[name]).map(_crop_of),
                "harvest_kg": pd.to_numeric(east.get(f"s3_q20_{slot}"), errors="coerce"),
                "compare": _text(east[f"s2q23_{slot}"]) if f"s2q23_{slot}" in east else "",
                "reason": _text(east[f"s3_q21_{slot}_1"]).str[:1] if f"s3_q21_{slot}_1" in east else "",
            }
        )
        rows.append(part[part["crop"].notna() & part["season"].isin(["Season A", "Season B"])])
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def summarise(tables: dict[str, pd.DataFrame]) -> dict:
    crops = crop_rows(tables["crops"])
    household = tables["household"].drop_duplicates("hhid").set_index("hhid")
    weights = household["weight"].astype(float)
    east_households = household[_eastern(household.reset_index()).to_numpy()].index
    growers = pd.Index(crops["hhid"].unique())
    summary: dict = {
        "source": "NISR Agricultural Household Survey 2024, RWA-NISR-RAHS-2024-V0.1, public-use files",
        "catalog": CATALOG,
        "questionnaire": f"{CATALOG}/download/1106",
        "scope": "Eastern Province households that grew maize or beans in Season A or B 2024. Shares and counts use the survey weight.",
        "not_in_survey": "The public-use files have no question on maize or bean sales, timing of sales, storage or post-harvest losses. The questionnaire's market-place and storage code lists are not used by any question.",
        "sample_households": int(len(growers)),
        "weighted_households": round(float(weights.reindex(growers).sum())),
        "eastern_households_sampled": int(len(east_households)),
        "share_of_eastern_households": _share(weights.reindex(east_households).index.isin(growers), weights.reindex(east_households)),
        "crops": {},
    }
    for (crop, season), part in crops.groupby(["crop", "season"]):
        per_household = part.groupby("hhid").agg(harvest_kg=("harvest_kg", "sum"), weight=("weight", "first"))
        harvested = per_household[per_household["harvest_kg"] > 0]
        compared = part[part["compare"].isin(COMPARED)]
        lower = part[part["compare"].isin(LOWER) & part["reason"].isin(REASONS)].assign(reason=lambda f: f["reason"].map(REASONS))
        summary["crops"].setdefault(crop, {})[season] = {
            "households_sampled": int(len(per_household)),
            "households_weighted": round(float(per_household["weight"].sum())),
            "median_harvest_kg": round(_weighted_quantile(harvested["harvest_kg"], harvested["weight"], 0.5), 1),
            "p90_harvest_kg": round(_weighted_quantile(harvested["harvest_kg"], harvested["weight"], 0.9), 1),
            "plots_compared": int(len(compared)),
            "share_lower_than_last_season": _share(compared["compare"].isin(LOWER), compared["weight"]),
            "main_reason_when_lower": _ranked(lower, "reason"),
        }

    grower_weights = weights.reindex(growers)
    ext = tables["extension"]
    ext = ext[ext["hhid"].isin(growers)]
    first = ext.drop_duplicates("hhid").set_index("hhid")
    member = _text(first["s6q10"]).eq("Yes")
    w = weights.reindex(first.index)
    summary["cooperative_member"] = _share(member, w)
    members = first[member]
    member_weights = weights.reindex(members.index)
    summary["cooperative_members_sampled"] = int(len(members))
    summary["cooperative_services"] = [
        {"code": code, "answer": label, "share": _share(_text(members["s6q12"]).str.contains(code, regex=False), member_weights)}
        for code, label in COOP_SERVICES.items()
    ]
    post = ext[_text(ext["s6q1"]).str.startswith("Post-harvest")]
    received = post[~_text(post["s6q3"]).isin(["", "nan", "99"])]
    summary["post_harvest_advice_this_season"] = _share(grower_weights.index.isin(received["hhid"]), grower_weights)
    summary["crop_insurance"] = _share(_text(first["s6q8"]).eq("Yes"), w)

    credit = tables["credit"]
    credit = credit[credit["hhid"].isin(growers)]
    asked = credit.drop_duplicates("hhid").set_index("hhid")
    summary["loan_requested"] = _share(_text(asked["loan"]).eq("Yes"), weights.reindex(asked.index))
    loans = credit[credit["s10q6"].notna()].assign(weight=lambda f: f["hhid"].map(weights))
    summary["loans_sampled"] = int(len(loans))
    summary["loan_source"] = _ranked(loans, "s10q6")
    summary["loan_purpose"] = _ranked(loans, "s10aq7")

    saving = tables["saving"]
    saving = saving[saving["hhid"].isin(growers)].drop_duplicates("hhid").set_index("hhid")
    summary["account"] = _share(_text(saving["account"]).eq("Yes"), weights.reindex(saving.index))
    return summary


def main() -> dict | None:
    NOTE.parent.mkdir(parents=True, exist_ok=True)
    if not FOLDER.exists() or not any(path.is_file() and path.name != ".DS_Store" for path in FOLDER.rglob("*")):
        NOTE.write_text(
            "Agricultural Household Survey 2024 is not in this folder.\n"
            f"Register and download RWA-NISR-RAHS-2024 from {CATALOG}\n"
            "Place the public-use files in data/raw/nisr/ahs2024/.\n"
            "Do not commit microdata if the NISR terms forbid redistribution.\n"
        )
        if OUTPUT.exists():
            print("AHS 2024 microdata missing. Using the committed summary.")
            return json.loads(OUTPUT.read_text())
        print("AHS 2024 is not available. See data/raw/nisr/AHS_2024_MISSING.txt")
        return None
    tables = load_tables()
    missing = [key for key in FILES if key not in tables]
    if missing:
        raise SystemExit(f"AHS files not found for {missing}. Files seen: {[name for name, _ in _members(FOLDER)]}")
    summary = summarise(tables)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(summary, indent=2))
    if NOTE.exists():
        NOTE.unlink()
    print(f"AHS 2024 summary written: {', '.join(summary['crops'])}")
    return summary


if __name__ == "__main__":
    main()
