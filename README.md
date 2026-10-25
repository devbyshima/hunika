# Hunika

eSoko tells you today's price. Hunika tells you what to do with it.

Hunika is a mobile web app for cooperative managers in Rwanda's Eastern Province. It covers maize and beans in Bugesera, Gatsibo, Kayonza, Kirehe, Ngoma, Nyagatare and Rwamagana. There is no login and no personal data.

## What data the app uses

- WFP retail prices for maize grain and dry beans, in RWF per kg, downloaded from HDX on 25 October 2026. The newest month in the file is August 2026. Wholesale prices stay in the panel and are not used for a decision.
- NISR rural food CPI through September 2026. The September index was published on 10 October 2026. The app uses it to turn past price ratios into a nominal outlook.
- NISR Seasonal Agricultural Survey 2025 annual tables, published 31 December 2025. The app shows district production in tonnes. One year is not enough for a supply anomaly, so that figure is blank.
- District boundaries from geoBoundaries Rwanda ADM2, simplified GeoJSON, CC BY 4.0.
- The Agricultural Household Survey 2024 is not in the app. It sits behind an NISR microdata login. See `data/raw/nisr/AHS_2024_MISSING.txt`.

Prices are market retail, not farm-gate. Sources, licences and file locations are in `docs/DATA.md`.

## What the app is trying to communicate

A manager should be able to see whether to sell now or store, and what each choice is worth after losses and costs.

**Net gain per tonne is not calculated.** Monthly loss rates, bag costs and the interest rate are still blank in `config/assumptions.yaml`. Until those numbers are sourced, Hunika will not recommend storing. The largest line on Decide says there is no store-or-sell verdict yet. It still shows what selling now is worth, and a 1–4 month price outlook from the August 2026 price.

The backtest of that price outlook is in `docs/METHODOLOGY.md`. The likely range held 1,083 of 1,740 later real prices (62.2%). A useful range should hold about 80 of 100. This one is short of that. Price-only changes are also reported there. They leave out storage costs, so they are not the Hunika result.

## How someone uses it

1. Open the app. Kinyarwanda is the default. English is the other button. The Kinyarwanda lines are drafts and still need a team review.
2. On Decide, pick the crop, the district, the quantity, the storage the cooperative can use, and whether cash is needed now.
3. Read the verdict. If the newest price is more than 60 days old, the card says so. If the district has no price of its own, the card says the figure is a province estimate.
4. Share builds a card. The phone share sheet is used when the browser allows it. Otherwise the WhatsApp link sends the text. Print uses the browser print view.
5. Plan colours the seven districts by the likely price change over three months. Proof shows the backtest. About lists every assumption, including the blanks.

The phone runs the same decision rule as `pipeline/decide.py`. The shared cases are in `tests/fixtures/decide_cases.json`.

## Live link

GitHub Pages: https://devbyshima.github.io/hunika/

The Pages site is the backup host. Vercel is not connected yet.

## Run it

Python 3.11 and Node 22 or newer.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m pipeline
cd web
npm ci
npm run dev
```

`python -m pipeline` rebuilds the panel, the backtest and the JSON under `web/public/data/`. If the CPI workbook or the SAS workbook is missing, the pipeline reuses the committed extracts and prints that it did so. `scripts/fetch_public_data.sh` downloads the public files. The NISR workbooks are gitignored. Do not commit them.

Tests:

```bash
pytest
cd web && npm test && npm run build
```

## Team

Shima Serein. Add the other members here before submission.

The demo video is not recorded. Record `demo/hunika-demo.webm` at phone size, three minutes at most. A script note is in `demo/README.md`.

## Checkpoint, 25 October 2026

Only Gatsibo and Kirehe have a non-camp retail price since 2024. Bugesera, Kayonza, Ngoma, Nyagatare and Rwamagana use the August 2026 Eastern Province median, and the app labels that as a province estimate. On 25 October 2026 that price is 71 days old, so the stale warning is on. Every district still has at least seven historical years. A 2015 price is not today's price. The full table is `data/processed/coverage.md`.
