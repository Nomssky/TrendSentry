"""Unit test gate evaluasi compare_live_vs_backtest (pure function, tanpa DB)."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from compare_live_vs_backtest import evaluate  # noqa: E402


def base(n=10):
    return {"n_closed": n, "wins": 4, "win_rate_pct": 40.0, "avg_r": 0.8,
            "avg_win_r": 3.0, "avg_loss_r": -0.9,
            "slip_avg": 0.02, "slip_max": 0.05, "slip_n": 50}


def test_locked_below_min_trades():
    assert evaluate(base(n=9))["locked"] is True
    assert evaluate(base(n=0))["locked"] is True


def test_pass_within_tolerance():
    res = evaluate(base())
    assert res["locked"] is False
    assert all(v[0] == "PASS" for v in res["checks"].values()), res["checks"]


def test_flag_win_rate_far_off():
    s = base()
    s["win_rate_pct"] = 0.0
    assert evaluate(s)["checks"]["win_rate"][0] == "FLAG"


def test_flag_avg_r_below_floor():
    s = base()
    s["avg_r"] = 0.1
    assert evaluate(s)["checks"]["avg_r"][0] == "FLAG"


def test_flag_slippage_over_limit():
    s = base()
    s["slip_avg"] = 0.5
    assert evaluate(s)["checks"]["slippage"][0] == "FLAG"
