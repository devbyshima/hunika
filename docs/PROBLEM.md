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

Not summarised. The public-use file needs an NISR microdata login. It was not downloaded in this build. It is the right place to look for how Eastern households sell, when they sell, and what they lose in storage.

## Interviews

Not done. The team still needs 8 to 10 conversations with farmers and cooperative leaders. Record the date, the district, and the answers. Use a quote only with consent. Do not add a name without permission. No quotes are in this file.

## Cooperative letter

Not obtained.
