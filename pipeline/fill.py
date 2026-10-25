"""Short gap fill for the monthly price panel."""

from __future__ import annotations


def fill_short_gaps(prices: list[float | None]) -> list[tuple[float | None, bool]]:
    """Linear-fill interior gaps of one or two months. Longer gaps stay empty."""
    filled = [(price, False) for price in prices]
    index = 0
    last = len(prices)
    while index < last:
        if prices[index] is not None:
            index += 1
            continue
        end = index
        while end < last and prices[end] is None:
            end += 1
        length = end - index
        left_known = index > 0 and prices[index - 1] is not None
        right_known = end < last and prices[end] is not None
        if length <= 2 and left_known and right_known:
            left = prices[index - 1]
            right = prices[end]
            span = end - (index - 1)
            for step, cursor in enumerate(range(index, end), start=1):
                filled[cursor] = (left + (right - left) * (step / span), True)
        index = end
    return filled
