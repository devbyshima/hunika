# Phase 2

Not in this build.

- USSD or SMS through a government partner, for managers who are not on a smartphone.
- Crops and provinces outside maize, beans and the seven Eastern districts.
- A live eSoko feed, if MINAGRI access is granted. The WFP prices stop in August 2026, so today a manager types the current price by hand.
- Warehouse partners who can publish a loss rate and confirm the fee and loan rate. The warehouse loss rate is the one blank that keeps warehouse receipts unpriced, including for cooperatives that need cash now.
- Rwandan storage-loss data. AHS 2024 has no storage or loss questions, so a short survey of partner cooperatives, or a request to NISR or MINAGRI for post-harvest loss data, would replace the Kenyan trial rates.
- Separate loss rates for maize and beans. The engine takes one rate per storage option today.
- Model v2 kept the better price range (73.7% of outcomes against 65.8%) but lost on net gain. A next version could use v2's wider range with v1's centre, or SAS anomalies directly once enough published seasons exist (from 2021 now).
- Tune g_min and d_max on training years only, with a held-out test period.
- Confirmed season windows. `config/seasons.yaml` is still `confirmed: false`.
- A district price for Bugesera, Kayonza, Ngoma, Nyagatare and Rwamagana. WFP stopped collecting there in 2015, so those districts use the province price.
