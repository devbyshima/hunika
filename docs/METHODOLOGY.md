# Methodology

Decision date for the live outlook: 25 October 2026. Model: `v1_seasonal_ratios`. Model v2 was not built. Model v3 was not built.

## Prices

WFP rows are kept when the commodity is maize grain or dry beans, the currency is RWF, and the unit converts to kilograms. `priceflag=actual` is preferred. An aggregate is used only when that market and date have no actual price. Retail is the decision series. Wholesale stays in the monthly panel and is not forecast.

Months are the median of observations in that month. An interior gap of one or two months is filled in a straight line and flagged `filled`. Filled months are left out of ratios, out of today's price, and out of the coverage counts. Longer gaps are omitted. Camp markets are flagged and left out of cooperative medians, ratios and nearest-market advice.

A real price is the nominal price times the latest rural food index divided by that month's index. The rural series is national, not an Eastern Province index. Prices before February 2009 have no index and drop out of the ratios. The September 2026 rural food index is treated as available on 10 October 2026, because that is the release date of the September 2026 CPI. A month M is treated as available on the 10th of month M+1. The trailing 12-month rural food inflation in the app is 0.2702 (27.02%). That is not the urban food rate in the September 2026 CPI note.

## Model v1

For a calendar month and a horizon of 1 to 4 months, the model collects the real-price ratio of the end month to the start month from past years. The whole window must end before the decision month. There is no look-ahead.

District markets are pooled. If the district has fewer than five distinct years, the district quantiles are blended with the Eastern Province quantiles. The district weight is n/5. A quantile needs at least four ratios. Percentiles 10, 50 and 90 use the linear method in numpy.

The nominal outlook is today's price times the real ratio times `(1 + inflation) ^ (h / 12)`. Inflation is the trailing 12-month rural food rate known on the decision date.

`n` on a horizon is a count of past market windows, not a count of calendar years. `n_up` is how many of those windows had a real ratio above 1. The Decide sentence uses that count.

The live outlook uses August 2026 as the start month because that is the newest price, not because August is a harvest month. August sits between Season A and Season B. The backtest uses the season decision months below.

## Seasons

`config/seasons.yaml` is a proposal. `confirmed` is false. The pipeline will not overwrite it once a person sets `confirmed` to true.

The window for Season A is December–March. The window for Season B is April–July. Inside each window, the decision month is the month that most often holds the bottom of the Eastern Province median real retail price. A tie uses the later month.

| Crop | Season | Decision month | Years compared | What the bottoms did |
| --- | --- | --- | --- | --- |
| Maize | A | March | 15 (2010–2026) | December 2, February 5, March 8 |
| Maize | B | April | 17 (2009–2026) | April 8, May 4, June 2, July 3 |
| Beans | A | January | 15 (2010–2026) | January 9, February 2, March 3, December 1 |
| Beans | B | May | 17 (2009–2026) | April 2, May 7, June 4, July 4 |

Maize Season B bottoming in April is what this price series did. It is not an agronomy finding, and the team has not confirmed it.

## Decision rule

The same function is in `pipeline/decide.py` and `web/src/lib/decide.ts`. Selling now is worth `Q × P_now`. Storing is worth:

`Q × P_hat × (1 − loss × months) × (1 − fee) − Q × cost_per_kg − interest`

`interest = rate × borrow_share × Q × P_now × months / 12`

The phone asks which storage the cooperative can use, and the engine scores that option. It picks the horizon with the highest likely gain, then keeps it only if both gates pass: likely gain at least `g_min` times the sell-now value, and low gain no worse than `−d_max` times the sell-now value. A shorter horizon that would have passed is not used instead. If the cooperative needs cash now, only a warehouse receipt can be a store verdict.

`g_min` is 0.08 and `d_max` is 0.05. Both are marked `ASSUMPTION`. Warehouse fee 0.025 and warehouse borrow share 0.70 are sourced and still need a current check. Home and hermetic fees are 0, and their borrow share is 0, because those options have no warehouse fee and no loan. Loss rates, bag costs and the warehouse interest rate are null. An option with a missing loss, fee, bag cost or borrow share is unpriced. A positive borrow share with a missing interest rate is also unpriced. The live form is unpriced, so the verdict is "no store-or-sell verdict yet".

## Backtest

Each row is one district, crop, season, year and horizon. The forecast uses only prices and CPI published before the 15th of the decision month, so the decision month's own CPI is not yet treated as published. SAS 2025 is dated 31 December 2025 and is not used as a supply feature. There is no rainfall nowcast.

The chosen horizon for the price-only comparison is the one with the highest real p50, not the highest nominal p50. "Inside the range" means the later real price fell between the real p10 and the real p90. The nominal band is stored only as a diagnostic, because scoring a nominal forecast against a nominal price mixes in the inflation forecast.

| Check | Result |
| --- | --- |
| Horizon rows | 1,740 |
| Real prices inside the likely range | 1,083 (62.2%) |
| Maize, real band | 608 of 889 (68.4%) |
| Beans, real band | 475 of 851 (55.8%) |
| Nominal band, diagnostic | 57.1% |
| Decisions scored | 441 |
| Net gain, RWF per tonne | Not calculated |

The net figure is blocked because loss rates, bag costs and interest are blank. Do not fill them in to produce a number.

Price-only comparison, before losses, fees and interest. These are not the Hunika gain.

| Comparison | Value |
| --- | --- |
| Mean nominal follow | 47,551 RWF per tonne |
| Mean real follow | 78,168 RWF per tonne |
| Mean of always storing 4 months, nominal | 49,151 RWF per tonne |
| Always sell | 0 |
| Share of decisions where the real follow was not below selling | 72.6% |
| Worst real follow | −370,355 RWF per tonne |
| District-seasons with a negative real follow | 121 |

The real mean is in September 2026 francs. Historical real prices are scaled by the latest CPI, so an old gap can look larger than the cash gap of that year. The nominal mean includes inflation. Always storing for four months is close to "follow the model" on the nominal price-only mean. That is a warning: following the likely price has not been shown to beat a simple hold once storage costs exist.

The worst listed case is beans, Kayonza, Season A, 2021, and beans, Rwamagana, Season A, 2021, both −370,355.2 RWF per tonne in the rebased series. Those two districts were on the same province price path. It is one path counted twice, not two separate harvests. The Proof screen shows the twelve worst rows. The full file is `data/processed/backtest_rows.csv`.

The 62% real-band coverage means the v1 ranges are too narrow for the hoped-for 80 of 100. The percentiles were not tightened or widened by hand. v2 was not run, so it was neither kept nor rejected. One SAS year cannot support the supply anomaly, and CHIRPS rainfall was not downloaded.

## What this does not claim

- It does not claim a net gain per tonne.
- It does not claim that prices rose in 25 of the past 25 years. A line such as "25 of 25" is 25 market windows.
- It does not claim that a district whose own market died in 2015 has a 2015 price today. Today's price for those districts is the August 2026 province median.
- It does not claim the season months are confirmed.
