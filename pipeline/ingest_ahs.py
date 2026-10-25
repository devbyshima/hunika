"""Agricultural Household Survey 2024.

The public-use file sits behind a NISR microdata login. This step does not
try to log in. When the team downloads RWA-NISR-RAHS-2024 into
data/raw/nisr/ahs2024/, the summary can be added here.
"""

from __future__ import annotations

from pipeline.paths import RAW

CATALOG = "https://microdata.statistics.gov.rw/index.php/catalog"
NOTE = RAW / "nisr" / "AHS_2024_MISSING.txt"


def main() -> int:
    folder = RAW / "nisr" / "ahs2024"
    NOTE.parent.mkdir(parents=True, exist_ok=True)
    if not folder.exists() or not any(folder.iterdir()) if folder.exists() else True:
        NOTE.write_text(
            "Agricultural Household Survey 2024 is not in this folder.\n"
            "The build needs it for Eastern Province sales timing, storage and losses.\n"
            f"Register and download RWA-NISR-RAHS-2024 from {CATALOG}\n"
            "Place the public-use files in data/raw/nisr/ahs2024/.\n"
            "Do not commit microdata if the NISR terms forbid redistribution.\n"
        )
        print("AHS 2024 is not available. The team needs to download it. See data/raw/nisr/AHS_2024_MISSING.txt")
        return 0
    print(f"AHS files found in {folder}. A summary is not written yet.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
