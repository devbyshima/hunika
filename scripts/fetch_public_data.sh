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


# SAS district tables, 2018 to 2026. Land in data/raw/nisr/sas/ and stay gitignored.
mkdir -p data/raw/nisr/sas
curl -L --fail -o data/raw/nisr/sas/SAS_2018_Annual_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2025-06/2018%20Annual%20Tables_Final%20%281%29.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2019_Annual_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2024-10/SAS%202019%20_Annual%20report%20_Tables.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2020_Final_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2024-10/USAS%202020%20_Final_Tables.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2021_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2024-10/SAS%202021_Tables.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2022_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2026-09/SAS%202022_Tables_0.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2023_Annual_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2024-10/SAS%202023_Annual%20Tables%20%283%29.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2024_Annual_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2025-02/SAS%202024_Annual%20Tables.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2025_Annual_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2025-12/SAS%202025_Annual%20Tables.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2026A_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2026-04/Tables_2026%20Season%20A.xlsx"
curl -L --fail -o data/raw/nisr/sas/SAS_2026B_Tables.xlsx \
  "https://statistics.gov.rw/sites/default/files/documents/2026-09/Tables_2026%20Season%20B.xlsx"

# CHIRPS rainfall by district, WFP on HDX. The pipeline keeps the seven Eastern districts.
curl -L --fail -o data/raw/rwa-rainfall-subnat-full.csv \
  "https://data.humdata.org/dataset/80e9b2b6-a772-4390-89d8-5c50ad80c663/resource/a3eaa5a2-56ce-41a8-ad91-7ecbd65de8e8/download/rwa-rainfall-subnat-full.csv"

echo "Downloaded. AHS 2024 still needs an NISR microdata login."
