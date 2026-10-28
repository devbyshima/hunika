# Methodology

Decision date for the live outlook: 28 October 2026. Live model: `v1_seasonal_ratios`. Model v2 (rainfall supply signal) was built and backtested and is not live, because it lost on net gain. Model v3 was not built.

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

For a calendar month and a horizon of 1 to 4 months, the model collects the real-price ratio of the end month to the start month from past years. The whole window must end before the decision month. District markets are pooled. If the district has fewer than five distinct years, the district quantiles are blended with the Eastern Province quantiles, with district weight n/5. A quantile needs at least four ratios. Percentiles 10, 50 and 90 use the linear method in numpy. The nominal outlook is today's price times the real ratio times `(1 + inflation) ^ (h / 12)`.

In the app, horizons run from the decision month (October 2026). The newest WFP price (August 2026) stands in for today's price, with the stale warning, unless the manager types today's price at their market. Then the same ratios are applied to that price.

## Model v2, supply signal (backtested, not live)

`log R = alpha + beta * rain anomaly + e`, fitted by least squares for each crop, decision month and horizon on every Eastern market window before the decision month. The range is the 10th, 50th and 90th percentile of the residuals. At least 12 windows from 5 years are required.

The guide puts the SAS anomaly in this regression and nowcasts it from rainfall. Published SAS anomalies exist only from 2021, which leaves two to five training years for any backtest decision. Because the nowcast is a straight line in rainfall, regressing on rainfall directly gives the same forecast up to scale and can train on 2009 onward. SAS is used to check the link (the correlation table above).

## Choosing a model

Both models were scored on the same 1,299 forecasts (crop, district, season, year, horizon) where both exist, 2014–2026. Pinball loss is in September 2026 RWF per kg on the real price.

| Model | Pinball, p10 | Pinball, p50 | Pinball, p90 | Mean | Range held the real price | Net gain, hermetic bags, same 329 decisions |
| --- | --- | --- | --- | --- | --- | --- |
| v1 seasonal ratios | 25.0 | 55.2 | 32.3 | 37.5 | 65.8% | +10,489 RWF/t |
| v2 rainfall | 23.5 | 56.2 | 29.9 | 36.5 | 73.7% | −10,645 RWF/t |

v2 has the lower mean loss and the wider, better-calibrated range. It loses on the median and on net gain: on the same decisions, following v2 with hermetic bags lost 10,645 RWF per tonne on average. The rule in the build guide keeps a more complex model only if it wins on both, so v1 stays live. Across all its 1,740 forecasts (2010–2026), v1's range held 62.2% of later real prices (maize 68.4%, beans 55.8%), short of the 80% a well-calibrated 10–90 range should hold.

## Decision rule

The same function is in `pipeline/decide.py` and `web/src/lib/decide.ts`, tested on the shared cases in `tests/fixtures/decide_cases.json`. Selling now is worth `Q × P_now`. Storing is worth:

`Q × P_hat × (1 − loss × months) × (1 − fee) − Q × cost_per_kg − interest`

`interest = rate × borrow_share × Q × P_now × months / 12`

The engine scores the storage the manager chose, picks the horizon with the highest likely gain, then keeps it only if both gates pass: likely gain at least `g_min` (8%) of the sell-now value, and low gain no worse than `−d_max` (5%) of it. If the cooperative needs cash now, only a warehouse receipt can be a store verdict.

Storage values, all in `config/assumptions.yaml` with sources:

| Parameter | Value | Source |
| --- | --- | --- |
| Monthly loss, home bags | 3.56% | 32% maize weight loss in 270 days in untreated polypropylene bags, 32 Kenyan farms (Likhayo et al. 2016) |
| Monthly loss, hermetic bags | 0.2% | 1.8% in 270 days in SuperGrain bags, same farms |
| Monthly loss, warehouse | blank | No published rate. Warehouse receipts are not priced |
| Hermetic bag | 35.5 RWF/kg | Rwf 1,700 per PICS bag in 2019 (The New Times), times 2.09 for NISR all-items CPI to September 2026, per 100 kg, one season |
| Home bags | 0 RWF/kg | No bag purchase beyond what selling needs |
| Warehouse fee | 2.5% of value | EAX notice, January 2017 |
| Borrowed share, warehouse | 70% | EAX and Ecobank |
| Interest | 15.7% a year | BNR average lending rate, August 2026 |
| g_min, d_max | 8%, 5% | Build guide starting values. Not tuned |

Loss rates come from maize trials and are applied to beans. Spreading a 9-month loss evenly over the months understates early losses in some trials and overstates them in others (a Tanzanian on-farm trial lost about 14% by 12 weeks).

## Backtest

Each decision is one Eastern district, crop, season and year, at the decision month in `config/seasons.yaml`, 2010–2026. The forecast uses only prices and CPI published before the 15th of the decision month, and rainfall to the first of the month. The decision runs through `pipeline.decide` with a 1-tonne lot and the values above. Bag costs, which are in September 2026 francs, are converted to that year's francs for the decision. The result is scored with the real price at the chosen horizon. Every cash flow is converted to September 2026 francs with the rural food CPI of the month it happens in: the sale and the interest at the sale month, the bags and the sell-now value at the decision month.

Three strategies: (A) always sell at harvest, gain 0 by definition; (B) always store for 4 months with the same storage; (C) follow Hunika.

### Results, model v1, hermetic bags (the headline)

| Measure | Value |
| --- | --- |
| Decisions | 441 |
| Hunika said store | 147 (74 at 4 months, 71 at 3, 2 at 2) |
| Mean gain of C over A | +16,111 RWF per tonne |
| 10th and 90th percentile decision | −26,312 and +105,617 RWF per tonne |
| Decisions at least as good as selling | 88.0% |
| Decisions that lost money | 53 |
| Worst decision | Beans, Gatsibo, Season B 2023, −379,884 RWF per tonne |
| Mean gain when Hunika stored | +48,334 RWF per tonne |
| B, always store 4 months | +34,300 RWF per tonne, lost money in 45.2% of decisions |
| Season averages below zero | 18 of 63 crop-season-years |

By crop and district, hermetic bags:

| | Decisions | Stored | Mean RWF/t | Not worse | Lost |
| --- | --- | --- | --- | --- | --- |
| Beans | 217 | 105 | +37,313 | 88.9% | 24 |
| Maize | 224 | 42 | −4,428 | 87.1% | 29 |
| Bugesera | 63 | 22 | +24,495 | 88.9% | 7 |
| Gatsibo | 63 | 15 | +180 | 88.9% | 7 |
| Kayonza | 63 | 30 | +11,791 | 76.2% | 15 |
| Kirehe | 63 | 22 | +15,779 | 87.3% | 8 |
| Ngoma | 63 | 28 | +39,694 | 90.5% | 6 |
| Nyagatare | 63 | 20 | +22,830 | 92.1% | 5 |
| Rwamagana | 63 | 10 | −1,990 | 92.1% | 5 |

Home bags, model v1: mean −2,592 RWF per tonne over 441 decisions, 83 store verdicts, 90.2% not worse than selling, 43 losses. Always storing 4 months in home bags averaged −44,956 RWF per tonne and lost money in 67.5% of decisions. At 3.6% a month, home storage rarely pays, and Hunika's gates do not fully protect against it.

### Sensitivity

Only the backtest changes. The app keeps the values in `config/assumptions.yaml`.

| Case | Hermetic: store, mean RWF/t, not worse | Home: store, mean RWF/t, not worse |
| --- | --- | --- |
| Values in `assumptions.yaml` | 147, +16,111, 88.0% | 83, −2,592, 90.2% |
| Home bags lose 41.2% in 8 months (Ng'ang'a et al. 2016) | unchanged | 42, −5,561, 94.6% |
| Hermetic bag reused for 3 seasons | 181, +25,689, 86.2% | unchanged |
| No gates: store whenever the likely gain is above zero | 383, +31,837, 61.5% | 350, −9,415, 55.6% |

The gates halve the average hermetic gain and cut the share of losing decisions from 38.5% to 12.0%. Hunika is built for a cooperative that cannot afford a bad season, so the gates stay.

### What the results say

- With hermetic bags, following Hunika beat selling at harvest by about 16,000 RWF per tonne on average and was not worse in 88 of 100 decisions. The gain comes from beans. On maize, Hunika lost 4,428 RWF per tonne on average.
- Simply storing every harvest in hermetic bags for 4 months earned more on average (34,300) but lost money almost half the time. Hunika's value is in the seasons it says sell.
- With home bags, storage loses money on average under any rule tested. Telling a cooperative that is also worth money: the always-store strategy lost about 45,000 RWF per tonne.

## Limits

- Decision months were picked from the whole price series (the month the price most often bottoms). That flatters every storage strategy against selling, Hunika and always-store alike.
- Five of seven districts have had no market of their own since 2015 and use the province price, so 48% of decisions share a price path with another district. The worst seasons repeat for that reason.
- Prices are market retail, not farm-gate.
- Loss rates are from Kenyan maize trials, not Rwandan beans. AHS 2024, which asks Rwandan households about storage losses, is behind an NISR login and was not used.
- The v1 range holds 62% of outcomes, not 80%. The low case on the card can be worse than shown.
- g_min and d_max were not tuned.
- The live outlook starts from an August 2026 price that is 74 days old on 28 October 2026, unless the manager types today's price.

## What this does not claim

- It does not claim prices rose in N of N years. "9 of 10 past market windows" counts windows across markets, not calendar years.
- It does not claim a warehouse-receipt result. Warehouse loss is not published.
- It does not claim the season months are confirmed. `config/seasons.yaml` is `confirmed: false`.
