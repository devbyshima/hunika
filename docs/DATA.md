# Data

Downloaded 25 October 2026 unless a row says otherwise. Every number in the app comes from these files or from `config/assumptions.yaml`.

| Source | What Hunika uses | Licence and notes | In git |
| --- | --- | --- | --- |
| [WFP Rwanda food prices on HDX](https://data.humdata.org/dataset/wfp-food-prices-for-rwanda) | Maize grain and dry beans, retail and wholesale, RWF | CC BY-IGO. File dates run from 2000-01-15 to 2026-08-15. Modified on HDX 19 October 2026. | `data/raw/wfp_food_prices_rwa.csv` |
| Same dataset, market list | Names, districts, coordinates | Coordinates are copied as published. Karangazi and Nyagatare share a point in the source file. | `data/raw/wfp_markets_rwa.csv` and `config/markets.yaml` |
| [NISR CPI time series, September 2026](https://statistics.gov.rw/sites/default/files/documents/2026-10/CPI_time_series_September_2026.xls) | Food and non-alcoholic beverages, rural, urban and national. Base February 2014 = 100. Rural food runs February 2009–September 2026, 212 months. | The September 2026 CPI release is CC BY 4.0. The workbook is local only. Column dates are the 10th of the index month, not the release date. | Extract: `data/processed/cpi_food.csv`. Workbook gitignored. |
| [NISR Seasonal Agricultural Survey](https://statistics.gov.rw/data-sources/surveys/Seasonal-Agricultural-Survey), district tables 2018–2026 | Maize and total beans, in tonnes, for all 30 districts, Seasons A and B. 18 seasons, 540 rows. Downloaded 28 October 2026. Editions and tables are listed below. | The SAS report PDFs say all rights reserved, so the workbooks are not committed. Season C is not extracted. | Extract: `data/processed/sas_district_production.csv` and `data/processed/sas_supply_anomaly.csv`. Workbooks gitignored. |
| [CHIRPS rainfall by district, WFP on HDX](https://data.humdata.org/dataset/rwa-rainfall-subnational) | Dekadal rainfall (`rfh`) for the seven Eastern districts, January 1981 to October 2026. Downloaded 28 October 2026. | CC BY. The 7 MB national file is local only. PCODEs RW51–RW57 are the NISR district codes (Rwamagana, Nyagatare, Gatsibo, Kayonza, Kirehe, Ngoma, Bugesera); pixel counts match the district sizes. | Extract: `data/processed/rain_dekadal_east.csv`. Full file gitignored. |
| [geoBoundaries Rwanda ADM2](https://www.geoboundaries.org/api/current/gbOpen/RWA/ADM2/) | Seven Eastern districts. Simplified file from commit `9469f09`. | CC BY 4.0. Source named as Open Data Rwanda. | `data/raw/geoBoundaries-RWA-ADM2_simplified.geojson` and `web/public/data/districts.geojson` |
| [NISR microdata catalog](https://microdata.statistics.gov.rw/index.php/catalog), AHS 2024 (`RWA-NISR-RAHS-2024`) | Not downloaded | Login required. Do not commit microdata if the terms forbid it. | `data/raw/nisr/AHS_2024_MISSING.txt` only |

Direct downloads, also in `scripts/fetch_public_data.sh`:

- Prices: `https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/8c22eeb5-cc2e-46bc-8a0d-08b7486b2486/download/wfp_food_prices_rwa.csv`
- Markets: `https://data.humdata.org/dataset/a4a84c1c-81d1-491b-9fbe-1955ae736508/resource/31d038ef-416e-4c66-906f-54de20794918/download/wfp_markets_rwa.csv`
- Boundaries: `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/RWA/ADM2/geoBoundaries-RWA-ADM2_simplified.geojson`
- Rainfall: `https://data.humdata.org/dataset/80e9b2b6-a772-4390-89d8-5c50ad80c663/resource/a3eaa5a2-56ce-41a8-ad91-7ecbd65de8e8/download/rwa-rainfall-subnat-full.csv`
- SAS workbooks: one `curl` line per edition in the script.

World Bank and eSoko were not used. eSoko needs a MINAGRI login.

## SAS editions

The backtest may use a SAS season only after the date in the last column. Dates from 2022 onward are the "Dated" field on the NISR publication page. The 2018–2021 pages show only a 2024 or 2025 re-upload date, so those seasons are treated as published on 31 March of the next year, which is later than each workbook's own save date.

| SAS year | Table, Season A | Table, Season B | Treated as published |
| --- | --- | --- | --- |
| 2018 | Appendix 6 (crops down the side) | Appendix 7 | 31 March 2019 |
| 2019 | Table 18 | Table 19 | 31 March 2020 |
| 2020 | Table 20 | Table 21 | 31 March 2021 |
| 2021 | Table 24 | Table 25 | 31 March 2022 |
| 2022 | Table 23 | Table 24 | 9 December 2022 |
| 2023 | Table 22 | Table 23 | 30 December 2023 |
| 2024 | Table 21 | Table 22 | 31 December 2024 |
| 2025 | Table 24 | Table 25 | 31 December 2025 |
| 2026 | Table 15, Season A tables | Table 13, Season B tables | 28 April 2026 (A), 22 September 2026 (B) |

Beans are the `Beans` or `Bean` total column. Table 24 of SAS 2021 has no total, so beans there are the first `Bush bean` column plus `Climbing bean`; in the other 2021 table that sum equals the published total. 2015–2017 workbooks were checked and do not have a district maize and bean table in the same form, so they are not used.

The supply anomaly is the log of a season's production over the mean of the three previous seasons of the same letter, so it starts in 2021. Eastern Province grew 288,537 of Rwanda's 488,622 tonnes of Season A 2026 maize (59%), summed from the district rows of Table 15.

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
