"""Run the offline pipeline that the phone does not depend on."""

from __future__ import annotations

from pipeline import coverage, markets
from pipeline.backtest import run_backtest
from pipeline.build_panel import main as build_panel
from pipeline.export_json import load_sas, write_all
from pipeline.ingest_ahs import main as ingest_ahs
from pipeline.ingest_cpi import deflate, main as ingest_cpi
from pipeline.ingest_prices import main as ingest_prices
from pipeline.ingest_sas import main as ingest_sas
from pipeline.paths import PROCESSED
from pipeline.seasons import propose, write_proposal


def main():
    markets.main()
    prices, _report = ingest_prices()
    panel = build_panel(prices)
    cpi = ingest_cpi()
    panel = deflate(panel, cpi)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    panel.to_csv(PROCESSED / "panel_monthly.csv", index=False)
    print(f"deflated panel {len(panel)} real prices {int(panel['price_real'].notna().sum())}")
    write_proposal(propose(panel))
    coverage.main(panel)
    ingest_sas()
    ingest_ahs()
    seasons = load_seasons()
    sas = load_sas()
    result = run_backtest(panel, cpi, seasons)
    if not result["detail"].empty:
        result["detail"].to_csv(PROCESSED / "backtest_rows.csv", index=False)
    print(f"backtest rows {len(result['detail'])}")
    write_all(panel, cpi, sas, result["summary"])


def load_seasons():
    from pipeline.paths import CONFIG
    import yaml

    return yaml.safe_load((CONFIG / "seasons.yaml").read_text()) or {}


if __name__ == "__main__":
    main()
