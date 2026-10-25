# Data

Downloaded 25 October 2026 unless a row says otherwise. Every number in the app comes from these files or from `config/assumptions.yaml`.

| Source | What Hunika uses | Licence and notes | In git |
| --- | --- | --- | --- |
| [WFP Rwanda food prices on HDX](https://data.humdata.org/dataset/wfp-food-prices-for-rwanda) | Maize grain and dry beans, retail and wholesale, RWF | CC BY-IGO. File dates run from 2000-01-15 to 2026-08-15. Modified on HDX 19 October 2026. | `data/raw/wfp_food_prices_rwa.csv` |
| Same dataset, market list | Names, districts, coordinates | Coordinates are copied as published. Karangazi and Nyagatare share a point in the source file. | `data/raw/wfp_markets_rwa.csv` and `config/markets.yaml` |
| [NISR CPI time series, September 2026](https://statistics.gov.rw/sites/default/files/documents/2026-10/CPI_time_series_September_2026.xls) | Food and non-alcoholic beverages, rural, urban and national. Base February 2014 = 100. Rural food runs February 2009–September 2026, 212 months. | The September 2026 CPI release is CC BY 4.0. The workbook is local only. Column dates are the 10th of the index month, not the release date. | Extract: `data/processed/cpi_food.csv`. Workbook gitignored. |
| [SAS 2025 annual tables](https://statistics.gov.rw/sites/default/files/documents/2025-12/SAS%202025_Annual%20Tables.xlsx) | Table 24 Season A and Table 25 Season B, columns District, Maize, Bean. Publication date 31 December 2025. | The 2025 report PDF said all rights reserved, so the workbook is not committed. Season C is not extracted. | Extract: `data/processed/sas_district_production.csv` |
| [geoBoundaries Rwanda ADM2](https://www.geoboundaries.org/api/current/gbOpen/RWA/ADM2/) | Seven Eastern districts. Simplified file from commit `9469f09`. | CC BY 4.0. Source named as Open Data Rwanda. | `data/raw/geoBoundaries-RWA-ADM2_simplified.geojson` and `web/public/data/districts.geojson` |
| [NISR microdata catalog](https://microdata.statistics.gov.rw/index.php/catalog), AHS 2024 (`RWA-NISR-RAHS-2024`) | Not downloaded | Login required. Do not commit microdata if the terms forbid it. | `data/raw/nisr/AHS_2024_MISSING.txt` only |

Direct downloads, also in `scripts/fetch_public_data.sh`:

- Prices: `https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/8c22eeb5-cc2e-46bc-8a0d-08b7486b2486/download/wfp_food_prices_rwa.csv`
- Markets: `https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/31d038ef-416e-4c66-906f-54de20794918/download/wfp_markets_rwa.csv`
- Boundaries: `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/RWA/ADM2/geoBoundaries-RWA-ADM2_simplified.geojson`

World Bank and eSoko were not used. eSoko needs a MINAGRI login.

## Coverage

`data/processed/coverage.md` is the checkpoint.

Non-camp retail prices since 2024 exist in Gatsibo and Kirehe. Bugesera, Kayonza, Ngoma, Nyagatare and Rwamagana stop in 2015 (Kayonza maize in November 2015). Those five districts still have at least seven historical years, so an old seasonal pattern can be used, and today's price is the Eastern Province median for August 2026. The app sets `price_pooled` and shows a province-estimate label.

On the decision date 25 October 2026, the newest WFP date is 15 August 2026, which is 71 days. The stale limit is 60 days.

August 2026 actual non-camp Eastern retail, from the WFP file:

| | Maize, RWF/kg | Beans, RWF/kg | Pooled on the live card |
| --- | --- | --- | --- |
| Gatsibo | 500 | 800 | No |
| Kirehe | 400 | 800 | No |
| Other five districts | 500 | 800 | Yes, province median |

August 2026 maize markets: Mugera 500 and Nyagahanga 500 in Gatsibo; Kabeza 500, Kigufi 400 and Kiyanzi 400 in Kirehe. The five-market median is 500. Gatsibo's own median is 500. Kirehe's own median is 400.

August 2026 bean markets: Mugera 800 and Nyagahanga 800 in Gatsibo; Kabeza 1000, Kigufi 800 and Kiyanzi 700 in Kirehe. The five-market median is 800. Gatsibo's own median is 800. Kirehe's own median is 800.

## Processed files the app reads

`web/public/data/forecasts.json`, `assumptions.json`, `backtest.json`, `supply.json`, `meta.json`, `districts.geojson`.

`python -m pipeline` rewrites them. Commit the JSON after a rebuild.
