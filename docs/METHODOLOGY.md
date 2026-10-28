# Methodology

Decision date for the live outlook: 28 October 2026. Live model: `v1_seasonal_ratios`, with ranges widened by past misses and decisions made in today's money. Model v2 (rainfall supply signal) was built and backtested and is not live, because it lost on net gain. Model v3 was not built.

Every figure below is in `web/public/data/backtest.json`, `data/processed/backtest_rows.csv` or `data/processed/backtest_decisions.csv`, written by `python -m pipeline`.

## Prices

WFP rows are kept when the commodity is maize grain or dry beans, the currency is RWF, and the unit converts to kilograms. `priceflag=actual` is preferred. An aggregate is used only when that market and date have no actual price. Retail is the decision series. Wholesale stays in the monthly panel and is not forecast.

Months are the median of observations in that month. An interior gap of one or two months is filled in a straight line and flagged `filled`. Filled months are left out of ratios, out of today's price, and out of the coverage counts. Longer gaps are omitted. Camp markets are flagged and left out of cooperative medians, ratios and nearest-market advice.

A real price is the nominal price times the latest rural food index divided by that month's index. The rural series is national, not an Eastern Province index. Prices before February 2009 have no index and drop out of the ratios. A month M of CPI is treated as available on the 10th of month M+1. The trailing 12-month rural food inflation known on 28 October 2026 is 27.02% (September 2026 index, published 10 October 2026).

## Supply: SAS 2018–2026

District maize and total bean production comes from 18 SAS seasons (A and B, 2018–2026, all 30 districts). The tables, layouts and publication dates are in `docs/DATA.md`. The supply anomaly is

`A = log(production / mean of the three previous seasons of the same letter)`

so the first anomaly is 2021. Plan shows the newest season for each district with this change. Example: Kayonza Season A 2024 maize was 33,902 tonnes, 69% above the three previous Season A harvests.

SAS for a season is published after its harvest (Season A 2026 on 28 April 2026, Season B 2026 on 22 September 2026), so it is never available on the harvest decision date. The guide's answer is a rainfall nowcast.

## Rainfall nowcast

CHIRPS dekadal rainfall by district (WFP on HDX). For a season and a decision month, the rainfall anomaly is the log of rain from the season's start (September for A, February for B) up to the first day of the decision month, over the mean of the same calendar window in every earlier year from 1981. No later season and no later climatology is used.

How well does full-season rain track the SAS anomaly in the seven Eastern districts, 2021–2026 (42 district-seasons each)?

| Crop | Season | Correlation |
| --- | --- | --- |
| Maize | A | 0.25 |
| Maize | B | 0.38 |
| Beans | A | 0.47 |
| Beans | B | −0.29 |

Rainfall is a weak nowcast of production. Season B beans move the wrong way.

## Model v1, seasonal ratios (live)

For a calendar month and a horizon of 1 to 4 months, the model collects the real-price ratio of the end month to the start month from past years. The whole window must end before the decision month. District markets are pooled. If the district has fewer than five distinct years, the district quantiles are blended with the Eastern Province quantiles, with district weight n/5. A quantile needs at least four ratios. Percentiles 10, 50 and 90 use the linear method in numpy.

**Today's money.** The outlook is today's price times the real ratio. It is not inflated forward. The build guide's v1 multiplies by `(1 + inflation) ^ (h / 12)`; that compares francs in four months with francs today, while the backtest, correctly, scores in purchasing power. With 27% food inflation the two differ a lot: deciding on inflated prices told cooperatives to store in seasons that lost real value. The nominal version is kept as a sensitivity case below.

**Widened ranges.** Raw v1 ranges held only 66% of later real prices (2013–2026), against the 80% a 10–90 range should hold. Before each decision, the range is stretched around its median in log space by the smallest factor that would have put 80% of earlier outcomes inside it. Only forecasts whose outcome month ended before the decision month are used, separately for each crop, with at least 60 of them (a conformal 80% quantile of the stretch each past outcome needed). The live outlook uses every known outcome: maize ranges are stretched 1.15 times and bean ranges 1.91 times.

In the app, horizons run from the decision month (October 2026). The newest WFP price (August 2026) stands in for today's price, with the stale warning, unless the manager types today's price at their market. Then the same ratios are applied to that price.

## Model v2, supply signal (backtested, not live)

`log R = alpha + beta * rain anomaly + e`, fitted by least squares for each crop, decision month and horizon on every Eastern market window before the decision month. The range is the 10th, 50th and 90th percentile of the residuals, widened the same way as v1. At least 12 windows from 5 years are required.

The guide puts the SAS anomaly in this regression and nowcasts it from rainfall. Published SAS anomalies exist only from 2021, which leaves two to five training years for any backtest decision. Because the nowcast is a straight line in rainfall, regressing on rainfall directly gives the same forecast up to scale and can train on 2009 onward. SAS is used to check the link (the correlation table above).

## Choosing a model

Both models were scored on the same 1,299 forecasts (crop, district, season, year, horizon) where both exist. Pinball loss is in September 2026 RWF per kg on the real price, after widening.

| Model | Pinball, p10 | Pinball, p50 | Pinball, p90 | Mean | Range held the real price | Net gain, hermetic bags, same 329 decisions |
| --- | --- | --- | --- | --- | --- | --- |
| v1 seasonal ratios | 23.5 | 55.2 | 32.8 | 37.1 | 79.0% | +14,785 RWF/t |
| v2 rainfall | 23.3 | 56.2 | 27.6 | 35.7 | 80.7% | +370 RWF/t |

v2 has the lower mean loss and slightly better coverage. It loses on the median and on net gain. The build guide keeps a more complex model only if it wins on both, so v1 stays live. Across all its 1,383 forecasts, widened v1 ranges held 78.4% of later real prices (maize 81.8%, beans 74.9%); before widening they held 66.0% (maize 74.8%, beans 57.0%).

## Decision rule

The same function is in `pipeline/decide.py` and `web/src/lib/decide.ts`, tested on the shared cases in `tests/fixtures/decide_cases.json`. Selling now is worth `Q × P_now`. Storing is worth:

`Q × P_hat × (1 − loss × months) × (1 − fee) − Q × cost_per_kg − interest`

`interest = rate × borrow_share × Q × P_now × months / 12`

`P_hat` is the forecast price in today's money. The engine scores the storage the manager chose, picks the horizon with the highest likely gain, then keeps it only if both gates pass: likely gain at least `g_min` (8%) of the sell-now value, and low gain no worse than `−d_max` (5%) of it. If the cooperative needs cash now, only a warehouse receipt can be a store verdict.

The manager can replace the loss rate, the bag and handling cost and the interest rate under "Your costs" on Decide. That is also how a cooperative that knows its warehouse's shrinkage can price a warehouse receipt; no published figure exists.

Storage values, all in `config/assumptions.yaml` with sources:

| Parameter | Value | Source |
| --- | --- | --- |
| Monthly loss, home bags | 3.56% | 32% maize weight loss in 270 days in untreated polypropylene bags, 32 Kenyan farms (Likhayo et al. 2016) |
| Monthly loss, hermetic bags | 0.2% | 1.8% in 270 days in SuperGrain bags, same farms |
| Monthly loss, warehouse | blank | No published rate. Warehouse receipts are priced only with the manager's own figure |
| Hermetic bag | 35.5 RWF/kg | Rwf 1,700 per PICS bag in 2019 (The New Times), times 2.09 for NISR all-items CPI to September 2026, per 100 kg, one season |
| Home bags | 0 RWF/kg | No bag purchase beyond what selling needs |
| Warehouse fee | 2.5% of value | EAX notice, January 2017 |
| Borrowed share, warehouse | 70% | EAX and Ecobank |
| Interest | 15.7% a year | BNR average lending rate, August 2026 |
| g_min, d_max | 8%, 5% | Build guide starting values. Not tuned |

Loss rates come from maize trials and are applied to beans. AHS 2024 has no storage-loss question to replace them.

## Backtest

**Decision points.** Each decision is one Eastern district, crop, season and year. The decision month is the most common month of the price bottom in the harvest window of earlier years only (Season A December–March, Season B April–July), with at least four earlier years, so decisions start in 2013 (Season B) and 2014 (Season A). Chosen this way, the months are the same in every year as the full-history choice: maize March (A) and April (B), beans January (A) and May (B).

**No look-ahead.** The forecast uses only prices and CPI published before the 15th of the decision month, rainfall to the first of the month, and range widening from outcomes already known. The decision runs through `pipeline.decide` with a 1-tonne lot. Bag costs, which are in September 2026 francs, are converted to that year's francs. The result is scored with the real price at the chosen horizon. Every cash flow is converted to September 2026 francs with the rural food CPI of the month it happens in: the sale and the interest at the sale month, the bags and the sell-now value at the decision month.

Three strategies: (A) always sell at harvest, gain 0 by definition; (B) always store for 4 months with the same storage; (C) follow Hunika.

### Results, model v1, hermetic bags (the headline)

| Measure | Value |
| --- | --- |
| Decisions | 350 (2013–2026) |
| Hunika said store | 63 (48 at 3 months, 15 at 4) |
| Mean gain of C over A | +14,443 RWF per tonne |
| Decisions at least as good as selling | 95.1% |
| Decisions that lost money | 17 |
| Mean gain when Hunika said store | +80,241 RWF per tonne (27.0% of those lost money) |
| 90th percentile decision | +57,872 RWF per tonne |
| Worst decision | Beans, Kirehe, Season A 2021, −262,691 RWF per tonne |
| B, always store 4 months | +26,931 RWF per tonne, lost money in 46.4% of decisions |
| When Hunika said sell, storing 4 months anyway | +33,957 RWF per tonne on average, lost money in 45.7% |
| Season averages below zero | 13 of 50 crop-season-years |

By crop and district, hermetic bags:

| | Decisions | Stored | Mean RWF/t | Not worse | Lost |
| --- | --- | --- | --- | --- | --- |
| Beans | 175 | 41 | +28,033 | 97.1% | 5 |
| Maize | 175 | 22 | +854 | 93.1% | 12 |
| Bugesera | 50 | 12 | +28,100 | 98.0% | 1 |
| Gatsibo | 50 | 1 | +619 | 100% | 0 |
| Kayonza | 50 | 23 | +448 | 74.0% | 13 |
| Kirehe | 50 | 6 | +15,072 | 98.0% | 1 |
| Ngoma | 50 | 10 | +23,569 | 98.0% | 1 |
| Nyagatare | 50 | 11 | +33,296 | 98.0% | 1 |
| Rwamagana | 50 | 0 | 0 | 100% | 0 |

A cooperative with 100 tonnes of beans in hermetic bags that followed Hunika made 2,803,311 RWF more per season on average than one that sold at harvest (100 × 28,033), and did at least as well as selling in 97.1% of decisions.

**Home bags**, model v1: mean −1,128 RWF per tonne over 350 decisions, 31 store verdicts, 95.1% not worse than selling, 17 losses. When Hunika said store with home bags, those decisions lost 12,733 RWF per tonne on average (54.8% lost). In the 319 decisions where it said sell, storing in home bags for 4 months anyway would have lost 46,847 RWF per tonne on average and lost money 69.2% of the time. Always storing 4 months in home bags averaged −49,058 RWF per tonne.

### Sensitivity

Only the backtest changes. The app keeps the values in `config/assumptions.yaml`.

| Case | Hermetic: decisions, store, mean RWF/t, not worse | Home: store, mean RWF/t, not worse |
| --- | --- | --- |
| As shipped | 350, 63, +14,443, 95.1% | 31, −1,128, 95.1% |
| Decide on nominal prices, carrying food inflation forward | 350, 78, +7,503, 91.1% | 36, +2,071, 95.1% |
| Ranges not widened by past misses (66% coverage) | 350, 83, +18,783, 93.7% | 60, +1,803, 93.1% |
| Season months picked from all years, from 2010 | 441, 76, +13,269, 94.8% | 29, −2,481, 96.4% |
| Home bags lose 41.2% in 8 months (Ng'ang'a et al. 2016) | unchanged | 0, 0, 100% |
| Hermetic bag reused for 3 seasons | 350, 72, +19,738, 94.9% | unchanged |
| No gates: store whenever the likely gain is above zero | 350, 311, +30,098, 61.7% | 255, −7,485, 59.4% |

Two choices cost average gain on purpose. Narrow, unwidened ranges earn more on average (+18,783) because they understate the bad case; Hunika shows the honest range and gives up some gain. Dropping the gates earns +30,098 on average but loses money in 38.3% of decisions instead of 4.9%. Hunika is built for a cooperative that cannot afford a bad season.

### What the results say

- With hermetic bags, following Hunika beat selling at harvest by about 14,400 RWF per tonne on average and was not worse in 95 of 100 decisions. When it said store, the gain was about 80,000 RWF per tonne.
- The value is in beans. On maize, Hunika's hermetic decisions were close to break-even (+854).
- Storing every harvest in hermetic bags earned more on average (+26,931) but lost money almost half the time. When Hunika said sell, storing anyway would still have earned about 34,000 on average with a 46% chance of loss: the gates trade average gain for safety.
- With home bags, storage loses money on average under every rule tested. Hunika mostly says sell, which avoided an average loss of about 47,000 RWF per tonne. Its few home-bag store calls lost money on average; a home-bag store verdict deserves caution.

## Limits

- Five of seven districts have had no market of their own since 2015 and use the province price, so 59% of decisions share a price path with another district. The worst seasons repeat for that reason.
- Prices are market retail, not farm-gate.
- Loss rates are from Kenyan maize trials, not Rwandan beans. AHS 2024 was checked: its public-use files have no question on storage, sales or post-harvest losses, so it cannot calibrate them. It is used for who faces the decision (`docs/PROBLEM.md`).
- Widened v1 ranges hold 78% of outcomes, close to but under the 80% target; bean ranges hold 75%.
- g_min and d_max were not tuned.
- The live outlook starts from an August 2026 price that is 74 days old on 28 October 2026, unless the manager types today's price.

## What this does not claim

- It does not claim prices rose in N of N years. "9 of 10 past market windows" counts windows across markets, not calendar years.
- It does not claim a warehouse-receipt result. Warehouse loss is not published.
- It does not claim the season months are confirmed. `config/seasons.yaml` is `confirmed: false`.
