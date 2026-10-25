#!/usr/bin/env bash
# Download the public files the pipeline can rebuild from.
# CPI and SAS land in data/raw/nisr/ and stay gitignored.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw/nisr

curl -L --fail -o data/raw/wfp_food_prices_rwa.csv \
  "https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/8c22eeb5-cc2e-46bc-8a0d-08b7486b2486/download/wfp_food_prices_rwa.csv"

curl -L --fail -o data/raw/wfp_markets_rwa.csv \
  "https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/31d038ef-416e-4c66-906f-54de20794918/download/wfp_markets_rwa.csv"

curl -L --fail -o data/raw/geoBoundaries-RWA-ADM2_simplified.geojson \
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/RWA/ADM2/geoBoundaries-RWA-ADM2_simplified.geojson"

curl -L --fail -o data/raw/nisr/CPI_time_series_September_2026.xls \
  "https://statistics.gov.rw/sites/default/files/documents/2026-10/CPI_time_series_September_2026.xls"

curl -L --fail -o data/raw/nisr/SAS_2025_Annual_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2025-12/SAS%202025_Annual%20Tables.xlsx"

echo "Downloaded. AHS 2024 still needs an NISR microdata login."
