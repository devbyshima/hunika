"""Kinyarwanda review sheet.

    python scripts/rw_review.py export   writes docs/review/kinyarwanda_review.csv
    python scripts/rw_review.py apply    reads it back into web/src/i18n/rw.json

The reviewer fills `kinyarwanda_final` (leave empty to keep the draft) and
writes `yes` in `approved`. Only approved rows leave the `_review` list. A row
is refused if its placeholders, such as {amount}, differ from the English.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EN = ROOT / "web" / "src" / "i18n" / "en.json"
RW = ROOT / "web" / "src" / "i18n" / "rw.json"
SHEET = ROOT / "docs" / "review" / "kinyarwanda_review.csv"
FIELDS = ["key", "english", "kinyarwanda_draft", "kinyarwanda_final", "approved", "note"]


def placeholders(text: str) -> set[str]:
    return set(re.findall(r"\{(\w+)\}", text))


def export() -> None:
    en = json.loads(EN.read_text())
    rw = json.loads(RW.read_text())
    review = set(rw.get("_review", []))
    SHEET.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig so Excel opens the accents and apostrophes correctly.
    with SHEET.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for key, english in en.items():
            if key not in review:
                continue
            writer.writerow({"key": key, "english": english, "kinyarwanda_draft": rw.get(key, ""), "kinyarwanda_final": "", "approved": "", "note": ""})
    print(f"Wrote {SHEET.relative_to(ROOT)} with {len(review)} strings to review.")


def apply() -> None:
    en = json.loads(EN.read_text())
    rw = json.loads(RW.read_text())
    review = list(rw.get("_review", []))
    approved = refused = 0
    with SHEET.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            key = row["key"].strip()
            if row.get("approved", "").strip().lower() not in {"yes", "y", "ok", "yego"} or key not in en:
                continue
            text = (row.get("kinyarwanda_final") or "").strip() or row["kinyarwanda_draft"].strip()
            if placeholders(text) != placeholders(en[key]):
                print(f"Refused {key}: placeholders {sorted(placeholders(text))} do not match {sorted(placeholders(en[key]))}")
                refused += 1
                continue
            rw[key] = text
            if key in review:
                review.remove(key)
            approved += 1
    rw["_review"] = review
    ordered = {"_review": review, **{key: rw[key] for key in en}}
    RW.write_text(json.dumps(ordered, indent=2, ensure_ascii=False) + "\n")
    print(f"Approved {approved}, refused {refused}, still to review {len(review)}.")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "export":
        export()
    elif command == "apply":
        apply()
    else:
        raise SystemExit("Use: python scripts/rw_review.py export|apply")
