"""Regresi P0-3: saat position_size ter-clamp oleh cash, `cost` wajib dihitung
ulang. Bug lama menyisakan `cost` basi → kas terpotong melebihi cash yang ada.

Invariant yang diuji: cash = equity - deployed_usd tidak boleh negatif (spot,
tanpa leverage). Tanpa fix, `cash -= cost` pakai cost basi → cash < 0 walau
equity masih positif karena tertutup nilai posisi.

Skenario: stop distance 0.2% (ATR sangat kecil) → units mentah 40 > max spot
~10, ter-clamp, dan fee membuat cost basi > cash.
"""

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backtest"))
from run_backtest import run_backtest  # noqa: E402


def _cfg() -> dict:
    return {
        "strategy": {
            "pairs": ["BTC/USDT"],
            "timeframe": "1d",
            "model": "donchian",
            "donchian_entry_period": 20,
            "donchian_exit_period": 10,
            "atr_stop_multiplier": 2.0,
            "max_positions_per_cluster": 0,
        },
        "risk": {"risk_per_trade_pct": 1.0, "max_concurrent_positions": 5},
        "backtest": {"initial_capital_usd": 1000, "fee_pct": 0.1, "slippage_pct": 0.05},
    }


def _df() -> pd.DataFrame:
    n = 25
    idx = pd.date_range("2024-01-01", periods=n, freq="D")
    close = [100.0] * n
    close[-1] = 90.0  # exit: close < don_lo pada bar terakhir
    don_lo = [1.0] * n
    don_lo[-1] = 95.0
    return pd.DataFrame(
        {
            "open": [100.0] * n,
            "high": [100.2] * n,
            "low": [99.8] * n,
            "close": close,
            "don_hi": [90.0] * n,
            "don_lo": don_lo,
            "atr": [0.1] * n,  # stop = 100 - 0.2 = 99.8 → dist 0.2%
        },
        index=idx,
    )


def test_kas_tidak_negatif_saat_sizing_ter_clamp():
    curve, trades = run_backtest({"BTC/USDT": _df()}, _cfg())
    assert not trades.empty, "harus ada trade supaya skenario clamp teruji"
    cash = curve["equity"] - curve["deployed_usd"]
    assert (cash >= -1e-6).all(), f"cash negatif (cost basi): {cash.min()}"


if __name__ == "__main__":
    test_kas_tidak_negatif_saat_sizing_ter_clamp()
    print("OK")
