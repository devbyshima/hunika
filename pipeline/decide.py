"""Sell-or-store rule. The same formula lives in web/src/lib/decide.ts."""

from __future__ import annotations

HORIZONS = (1, 2, 3, 4)


def storage_value(quantity_kg, price_hat, horizon, loss_monthly, fee, cost_per_kg, interest_annual, borrow_share, price_now):
    """Value of storing, in RWF. None when the crop would be wiped out."""
    retained = 1 - loss_monthly * horizon
    if retained <= 0:
        return None
    interest = interest_annual * borrow_share * quantity_kg * price_now * (horizon / 12)
    return (
        quantity_kg * price_hat * retained * (1 - fee)
        - quantity_kg * cost_per_kg
        - interest
    )


def _priced(option):
    for key in ("loss_monthly", "fee", "cost_per_kg", "borrow_share"):
        if option.get(key) is None:
            return False
    if option["borrow_share"] > 0 and option.get("interest_annual") is None:
        return False
    return True


def _band(low_gain, likely_gain):
    if likely_gain < 0:
        return "over_50"
    if low_gain < 0:
        return "between_10_and_50"
    return "under_10"


def decide(payload):
    """Pick the highest likely gain, then keep it only if both gates pass.

    The build guide says to choose the option and horizon with the highest
    likely gain, and to recommend selling when that choice fails either gate.
    A weaker horizon that would have passed is not used instead.
    """
    quantity = float(payload["quantity_kg"])
    price_now = float(payload["price_now"])
    g_min = float(payload["g_min"])
    d_max = float(payload["d_max"])
    needs_cash = bool(payload["needs_cash_now"])
    forecasts = {int(k): v for k, v in payload["forecasts"].items()}
    options = payload["options"]
    v0 = quantity * price_now

    priced = [option for option in options if _priced(option)]
    if not priced:
        return _sell("unpriced", v0)

    eligible = [option for option in priced if not needs_cash or option["id"] == "warehouse"]
    if not eligible:
        return _sell("sell_now", v0)

    best = None
    for option in eligible:
        interest = option["interest_annual"] if option["interest_annual"] is not None else 0.0
        for horizon in HORIZONS:
            forecast = forecasts.get(horizon)
            if not forecast:
                continue
            values = {}
            skipped = False
            for key in ("p10", "p50", "p90"):
                value = storage_value(
                    quantity,
                    float(forecast[key]),
                    horizon,
                    option["loss_monthly"],
                    option["fee"],
                    option["cost_per_kg"],
                    interest,
                    option["borrow_share"],
                    price_now,
                )
                if value is None:
                    skipped = True
                    break
                values[key] = value
            if skipped:
                continue
            gain = values["p50"] - v0
            if best is None or gain > best["likely_gain"]:
                best = {
                    "option": option["id"],
                    "horizon_months": horizon,
                    "likely_value": values["p50"],
                    "low_value": values["p10"],
                    "high_value": values["p90"],
                    "likely_gain": gain,
                    "low_gain": values["p10"] - v0,
                    "high_gain": values["p90"] - v0,
                }

    if best is None:
        return _sell("sell_now", v0)

    passes = best["likely_gain"] >= g_min * v0 and best["low_gain"] >= -d_max * v0
    if not passes:
        return _sell("sell_now", v0)

    return {
        "verdict": "store",
        "option": best["option"],
        "horizon_months": best["horizon_months"],
        "v0": v0,
        "likely_value": best["likely_value"],
        "low_value": best["low_value"],
        "high_value": best["high_value"],
        "likely_gain": best["likely_gain"],
        "low_gain": best["low_gain"],
        "high_gain": best["high_gain"],
        "loss_band": _band(best["low_gain"], best["likely_gain"]),
    }


def _sell(verdict, v0):
    return {
        "verdict": verdict,
        "option": None,
        "horizon_months": 0,
        "v0": v0,
        "likely_value": v0,
        "low_value": v0,
        "high_value": v0,
        "likely_gain": 0.0,
        "low_gain": 0.0,
        "high_gain": 0.0,
        "loss_band": None,
    }
