# Problem

Hunika is for cooperative managers in Eastern Province who sell maize or beans at harvest and want to know whether storage is worth it after losses and costs.

## Evidence cited in the build brief

These points come from the 24 October 2026 build brief. The team should open each link before submission and keep a sentence only if the page still supports it.

- Fixed farm-gate prices ended in October 2025, so farmers without storage or price information are pushed to sell low at harvest peaks. Cited source: [New Times](https://www.newtimes.co.rw/article/30686/humour-a-lecture-on-the-different-species-of-birds/amp). The New Times AMP address carries an unrelated slug, but the page is the article "Why Rwanda ended price controls on farm produce". The same article is syndicated at [AllAfrica](https://allafrica.com/stories/202510220174.html), and the announcement is at [AllAfrica, 8 October 2025](https://allafrica.com/stories/202510080016.html). Follow-up reporting on farmers' reactions described a Kirehe maize farmer being offered Rwf 420 per kg against the earlier government price of Rwf 500, with transport at her own cost ([New Times](https://www.newtimes.co.rw/article/30979/festive-season-is-a-time-to-reflect---bishop-rucyahana/amp), same AMP slug quirk).
- The national average maize price fell 24% from December 2024 to March 2025 as Season A crops reached markets. Beans fell 14% from April to July 2025. Cited source: [FAO GIEWS](https://cb.apps.fao.org/country.jsp?code=RWA).
- Post-harvest losses were 13.8% in 2023, against a government target of 5% by 2029, and over 60% of farmers lack local drying or storage. Cited source: [AllAfrica](https://allafrica.com/stories/202512300006.html).
- MINAGRI's eSoko publishes prices and does not tell a farmer whether to sell or store. Cited source: [IFPRI](https://rwanda.ifpri.info/2024/06/28/reflections-on-the-price-dynamics-for-agriculture-and-nutrition-policy-workshop-leveraging-stata-and-e-soko-market-price-data-a-learning-event-conducted-by-the-international-food-policy-research-inst/).

Hunika's own price file does not measure those national drops. The app's prices are WFP market retail for Eastern Province. See `docs/DATA.md`.

## What NISR's own data adds

- Eastern Province grew 288,537 of Rwanda's 488,622 tonnes of Season A 2026 maize (59%) and 32% of Season A beans, summed from the district rows of SAS 2026 Season A Table 15. Season B 2026: 63% of maize and 40% of beans (Table 13). The sell-or-store question in these seven districts is most of the national maize question.
- Production swings from season to season. Kayonza's Season A 2024 maize was 33,902 tonnes, 69% above the mean of the three previous Season A harvests (20,115 tonnes). Its Season A 2022 beans were 8,789 tonnes, 36% below their three-season mean (13,760 tonnes). Source: `data/processed/sas_supply_anomaly.csv`, built from SAS 2018–2026.
- In the WFP retail series, the Eastern Province real price bottoms in March in 8 of 15 years for Season A maize and in January in 9 of 15 years for Season A beans (`config/seasons.yaml`). That is when cooperatives are under the most pressure to sell.

## Agricultural Household Survey 2024

Weighted summary of Eastern Province households with a maize or bean plot in Season A or B 2024: 983 sampled households, about 664,000 households in the population. Source: NISR AHS 2024 public-use files, `data/processed/ahs_summary.json`.

- **Small lots.** The median household harvested 239 kg of maize and 80 kg of beans in Season A 2024 (Season B: 100 kg and 57 kg). One household cannot store or sell well alone; a cooperative manager advising members is the right user.
- **Cooperatives rarely store.** 13.9% belong to an agricultural cooperative. Of those members, 39.8% say the cooperative markets their products, 49.3% get loans and 42.6% inputs through it, but only 7.7% get storage facilities from it.
- **Cash pressure.** 69.2% of households requested a loan. 69.8% of loans came from tontines or solidarity funds and 17.6% from relatives or friends; SACCOs and banks gave about 5% each. Buying food was the most common purpose (21.9% of loans).
- **Little post-harvest support.** 12.8% received advice on post-harvest handling and storage this season. 2.6% took crop insurance.
- **Bad seasons are common.** In Season B 2024, 85.9% of maize plots and 84.0% of bean plots were reported as producing less than before, mostly from insufficient rainfall or drought. In Season A 2024, 26.0% of maize plots and 45.8% of bean plots produced less. For beans the main reason was heavy rain or hailstones (79.0%); for maize, a lack of fertiliser (42.9%).
- **What AHS cannot tell us.** The public-use files have no question on crop sales, when households sell, storage or post-harvest losses. Hunika's loss rates therefore come from published trials (`config/assumptions.yaml`).

## Interviews

Not done yet. The questions, consent script and log template are in `docs/INTERVIEWS.md`. Summarise the 8 to 10 interviews here: dates, districts, roles, when they sold and why, how they store, what they lost, and how long Hunika took them. Use a quote only with consent. No quotes are in this file yet.

## Cooperative letter

Not obtained. A template the cooperative can adapt is in `docs/outreach/letter_of_interest.md`; it only counts if the cooperative writes, signs and stamps it.
