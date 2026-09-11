"""Check kontrak filter: schema verdict valid + skeleton selalu pass transparan."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from llm_filter.filter import FilterVerdict, SignalContext, evaluate  # noqa: E402


def ctx() -> SignalContext:
    return SignalContext(pair="BTC/USDT", close=100.0, donchian_hi=99.0,
                         donchian_lo=90.0, atr=2.0, signal="LONG_ENTRY")


def test_skeleton_pass_transparan():
    v = evaluate(ctx())
    assert v.verdict == "pass"
    assert "nonaktif" in v.reasoning
    assert v.to_log()["version"]


def test_verdict_sempit():
    with pytest.raises(ValueError):
        FilterVerdict(verdict="buy", risk_factors=[], reasoning="dilarang")
