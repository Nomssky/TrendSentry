"""VaRSR (Deng dkk. 2013, Eq. (12)) — test minimal yang mengunci spesifikasi OD-6.6/6.7.

Spesifikasi terkunci: VaRSR = SR - gamma*sigma_hat(SR); gamma=1.96 (two-sided 95%);
seri return harian equity strategi, rf=0; skewness sampel; kurtosis RAW (excess+3)
masuk Eq. (12); hasil dilaporkan basis harian — TIDAK dikalikan sqrt(365).
"""

import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backtest"))
from run_backtest import compute_metrics, sigma_sr, varsh  # noqa: E402

GAMMA = 1.96


def _series(n=400, seed=7):
    rng = np.random.default_rng(seed)
    return pd.Series(rng.normal(0.0005, 0.02, n))


def test_sigma_sr_normal_case_eq9():
    # skew=0 & raw kurtosis=3 -> Eq. (9): sqrt(1/(n-1) * (1 + SR^2/2))
    n, sr = 500, 0.05
    want = math.sqrt((1.0 / (n - 1)) * (1 + 0.5 * sr**2))
    assert sigma_sr(n, sr, skew=0.0, kurt=3.0) == pytest.approx(want, rel=1e-12)


def test_gamma_default_is_1_96():
    out = varsh(_series())
    assert out["gamma"] == GAMMA


def test_raw_kurtosis_convention():
    s = _series()
    out = varsh(s)
    assert out["kurtosis"] == pytest.approx(float(s.kurt()) + 3.0)  # excess + 3
    assert out["skew"] == pytest.approx(float(s.skew()))


def test_negative_skew_and_excess_kurtosis_raise_uncertainty():
    n, sr = 500, 0.05
    normal = sigma_sr(n, sr, skew=0.0, kurt=3.0)
    stressed = sigma_sr(n, sr, skew=-1.0, kurt=9.0)  # skew negatif, kurtosis mentah tinggi
    assert stressed > normal


def test_varsr_below_sharpe_for_positive_gamma():
    s = _series()
    sr = s.mean() / s.std()
    out = varsh(s)
    assert out["varsh"] < sr  # gamma > 0 dan sigma_hat >= 0


def _cfg():
    return {"backtest": {"initial_capital_usd": 1000.0}, "metrics": {"varsr": {"gamma": 1.96}}}


def _curve(n=300):
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    eq = 1000 * (1 + pd.Series(np.random.default_rng(3).normal(0.0004, 0.015, n))).cumprod()
    return pd.DataFrame({"equity": eq.values}, index=idx)


def test_compute_metrics_varsh_not_annualized():
    curve = _curve()
    trades = pd.DataFrame({"pnl": [10.0, -5.0], "r_multiple": [1.0, -0.5]})
    dfs = {"BTC/USDT": pd.DataFrame({"close": curve["equity"]})}
    m = compute_metrics(curve, trades, dfs, _cfg())
    daily = curve["equity"].pct_change().dropna()
    va = varsh(daily)
    assert m["varsh"] == round(va["varsh"], 4)  # bukan round(va["varsh"] * 365**0.5, 4)
    assert m["varsh_sigma_sr"] == round(va["sigma_sr"], 4)
    assert m["varsh_gamma"] == GAMMA


def test_deterministic():
    s = _series()
    assert varsh(s) == varsh(s)
    curve = _curve()
    trades = pd.DataFrame({"pnl": [10.0, -5.0], "r_multiple": [1.0, -0.5]})
    dfs = {"BTC/USDT": pd.DataFrame({"close": curve["equity"]})}
    a = compute_metrics(curve, trades, dfs, _cfg())
    b = compute_metrics(curve, trades, dfs, _cfg())
    assert a["varsh"] == b["varsh"]


def test_canonical_snapshot_b_unchanged():
    text = (ROOT / "backtest" / "reports" / "metrics.md").read_text()
    assert "| sharpe | 0.82 |" in text
    assert "| max_drawdown_pct | -26.45 |" in text
    assert "| n_trades | 94 |" in text
    assert "| final_equity | 2520.02 |" in text
