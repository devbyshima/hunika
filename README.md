# Hunika

eSoko tells you today's price. Hunika tells you what to do with it.

**Live app:** https://devbyshima.github.io/hunika/ (no login, works offline after the first visit)

**Backtest:** on 350 past harvest decisions in Eastern Province (2013–2026), each made only with data published before that day, a cooperative that followed Hunika with hermetic bags made **+14,443 RWF per tonne** on average against selling at harvest, after storage losses, bags and interest, in September 2026 francs. It was at least as good as selling in **95%** of decisions, and when Hunika said store the gain was **+80,241 RWF per tonne**. For 100 tonnes of beans that is about 2.8 million RWF more per season. With ordinary home bags, Hunika mostly says sell: storing anyway in those seasons lost 46,847 RWF per tonne on average. Losing seasons are shown, the worst being −262,691 RWF per tonne (beans, Kirehe, Season A 2021). Details: [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

Hunika is a mobile web app for cooperative managers and farmer promoters in Rwanda's Eastern Province: Bugesera, Gatsibo, Kayonza, Kirehe, Ngoma, Nyagatare and Rwamagana. It covers maize and beans, Seasons A and B. NISR 2026 Big Data Hackathon, Track 1.

## What data the app uses

- **NISR Seasonal Agricultural Survey**, district tables for Seasons A and B, 2018–2026. Production of maize and beans in every district, and the change against the three previous seasons of the same letter. Newest: Season B 2026, published 22 September 2026. Eastern Province grew 59% of Rwanda's Season A 2026 maize.
- **NISR Consumer Price Index**, rural food, through September 2026. Used to compare prices across years in real terms and to carry the outlook forward with food inflation (27.0% over the last 12 months).
- **WFP retail prices** for maize grain and dry beans by market, from HDX, 2008 to August 2026.
- **CHIRPS rainfall** by district, from WFP on HDX, 1981 to October 2026. Feeds model v2.
- **geoBoundaries** district boundaries for the map.
- **Storage costs and losses** from published trials and notices, each with a source in [`config/assumptions.yaml`](config/assumptions.yaml) and on the app's Method screen.
- **NISR Agricultural Household Survey 2024**, public-use files, weighted for Eastern Province maize and bean households: harvest size, cooperative membership and services, loans and why seasons went badly. Only 7.7% of cooperative members get storage from their cooperative, and buying food is the top reason for loans. AHS has no question on sales, storage or losses. The microdata needs an NISR login and is not committed; the summary is in `data/processed/ahs_summary.json`.

Prices are market retail, not farm-gate. Every source, licence and download date is in [`docs/DATA.md`](docs/DATA.md). Processed data is committed under `data/processed/` and `web/public/data/`. The NISR workbooks and the national rainfall file are linked, not committed: `scripts/fetch_public_data.sh` downloads them. AHS 2024 must be downloaded by hand from the [NISR microdata catalog](https://microdata.statistics.gov.rw/index.php/catalog/123) into `data/raw/nisr/ahs2024/`; without it the pipeline reuses the committed summary.

## What the app is trying to communicate

Post-harvest losses were 13.8% in 2023 against a government target of 5% by 2029, and over 60% of farmers lack local drying or storage ([AllAfrica](https://allafrica.com/stories/202512300006.html)). Since farm-gate price controls ended in October 2025 ([AllAfrica](https://allafrica.com/stories/202510220174.html)), a cooperative decides alone whether to sell at harvest, when prices are lowest, or to store and risk losses. Hunika answers that for one lot in under 30 seconds: **sell now** or **store for N months**, what each is worth in RWF after losses, bags, fees and interest, the likely range, and how often prices rose over that window in the past. It recommends storing only when the likely gain is at least 8% and the bad case loses no more than 5%. Every number is tested on past harvests, losing seasons included. The backtest also shows the loss side of the target: storing every harvest in home bags for 4 months lost about 49,000 RWF per tonne on average, and hermetic bags turn the same decision into a gain. Prices are compared in today's money, and the likely range is widened until it would have held 80% of past outcomes.

## How someone uses it

1. Open the link on a phone. Kinyarwanda is the default, English is one tap away. The Kinyarwanda text is a draft awaiting team review.
2. **Decide:** pick maize or beans, the district, the quantity, the storage the cooperative can use, and whether cash is needed now. Optionally type today's price at your market (from eSoko or the market), and under "Your costs" your own loss rate, bag cost or loan rate. A cooperative that knows its warehouse's monthly loss can price a warehouse receipt there. Read the verdict, the money line, the range and the reason. The card warns when the newest price is more than 60 days old and when a district price is a province estimate.
3. **Share:** a square card and a short message for WhatsApp, through the phone's share sheet or a `wa.me` link, and a print view.
4. **Plan:** a map of the seven districts coloured by the likely price change over three months. Tap a district for its price path and its latest SAS production change.
5. **Proof:** the backtest, per season, by storage, crop and district, with every losing season and the model comparison.
6. **About:** the method, data sources and every assumption with its source.

The phone runs the same decision rule as `pipeline/decide.py`. Both are tested against `tests/fixtures/decide_cases.json`.

## Run it

Python 3.11 and Node 22 or newer.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
bash scripts/fetch_public_data.sh
python -m pipeline
cd web
npm ci
npm run dev
```

`python -m pipeline` rebuilds the price panel, SAS extracts, rainfall features, AHS summary, backtest, sensitivity runs and the JSON under `web/public/data/` in about 20 seconds. If a raw NISR or rainfall file is missing, it reuses the committed extract and says so.

Tests:

```bash
pytest
cd web && npm test && npm run build
```

GitHub Actions runs both on every push. The web test fails after 28 October 2026 until every Kinyarwanda string has been reviewed and removed from `_review` in `web/src/i18n/rw.json`.

Kinyarwanda review: `python scripts/rw_review.py export` writes `docs/review/kinyarwanda_review.csv` (opens in Excel). The reviewer corrects `kinyarwanda_final` where needed and writes `yes` in `approved`. `python scripts/rw_review.py apply` writes the approved lines into `rw.json` and clears them from `_review`; it refuses a line whose placeholders, such as `{amount}`, differ from the English.

## Repository

| Path | What |
| --- | --- |
| `pipeline/` | Ingest, panel, model v1 and v2, decision rule, backtest, JSON export |
| `config/` | Markets, season calendar, storage assumptions |
| `data/processed/` | Panel, SAS extract and anomalies, rainfall extract, backtest rows and decisions |
| `web/` | Vite, React, TypeScript, Tailwind, Recharts, Leaflet, installable PWA. Fonts are Inter, Pixelify Sans and Press Start 2P, all SIL Open Font License, in `web/public/fonts/` with `LICENSES.md` |
| `docs/` | Problem, methodology, data, declaration, phase 2 |

## Team

Shima Serein. Add the other members here before submission.

The demo video is not recorded yet. It goes in `demo/hunika-demo.webm`, three minutes at most. The script is in [`demo/README.md`](demo/README.md).

Originality: [`docs/DECLARATION.md`](docs/DECLARATION.md). Intellectual property in the submission passes to NISR.
