"""Unit test untuk bagian paling kritis: position sizing, ATR, dan Donchian (anti look-ahead)."""

import numpy as np
import pandas as pd
import pytest

from backtest.strategy import atr, donchian_high, donchian_low, position_size, cluster_name, cluster_position_count
from backtest.strategy import sma, sma_entry_signal, sma_exit_signal, rsi, rsi_entry_signal, rsi_exit_signal


def make_df(high, low, close, prev_close=None):
    return pd.DataFrame({"high": high, "low": low, "close": close})


class TestPositionSize:
    def test_basic_risk_based(self):
        # 1% dari 1000 = 10; stop distance 5 -> 2 unit
        assert position_size(1000, 100, 95, 1.0) == pytest.approx(2.0)

    def test_capped_by_equity(self):
        # 10% risk -> 20 unit, tapi max = equity/entry = 10 unit (spot, no leverage)
        assert position_size(1000, 100, 95, 10.0) == pytest.approx(10.0)

    def test_invalid_stop_raises(self):
        with pytest.raises(ValueError):
            position_size(1000, 100, 100, 1.0)  # stop == entry
        with pytest.raises(ValueError):
            position_size(1000, 100, 110, 1.0)  # stop > entry (bukan long)


class TestATR:
    def test_constant_range(self):
        # TR konstan 10 -> ATR(14) harus 10 (Wilder converge di konstanta)
        n = 40
        df = make_df([110.0] * n, [100.0] * n, [105.0] * n)
        result = atr(df, 14)
        assert result.iloc[13] == pytest.approx(10.0)
        assert result.iloc[-1] == pytest.approx(10.0)
        assert result.iloc[:13].isna().all()  # belum cukup data

    def test_tracks_volatility(self):
        # TR naik dari 10 ke 20 -> ATR harus naik mengikuti
        n = 60
        highs = [110.0] * (n // 2) + [120.0] * (n // 2)
        lows = [100.0] * (n // 2) + [100.0] * (n // 2)
        df = make_df(highs, lows, [105.0] * n)
        result = atr(df, 14)
        assert result.iloc[-1] > result.iloc[20]  # naik setelah vol naik


class TestDonchian:
    def test_no_lookahead(self):
        # don_hi hari t harus EXCLUDE high hari t
        df = make_df([1.0, 2.0, 4.0, 5.0], [1.0] * 4, [1.0] * 4)
        dh = donchian_high(df, 2)
        assert dh.iloc[3] == 4.0  # max high hari 1-2 (idx 1-2), EXCLUDE high idx 3 (=5)
        assert np.isnan(dh.iloc[0]) and np.isnan(dh.iloc[1])

    def test_donchian_low(self):
        df = make_df([10.0] * 4, [9.0, 8.0, 6.0, 7.0], [10.0] * 4)
        dl = donchian_low(df, 2)
        assert dl.iloc[3] == 6.0  # min dari low hari 1-2


class TestClusterLimit:
    def test_cluster_name_known(self):
        assert cluster_name("BTC/USDT") == "A"
        assert cluster_name("ETH/USDT") == "A"
        assert cluster_name("HYPE/USDT") == "B"

    def test_cluster_name_unknown(self):
        assert cluster_name("UNKNOWN/USDT") is None

    def test_cluster_position_count_empty(self):
        assert cluster_position_count({}, "BTC/USDT") == 0

    def test_cluster_position_count_same_cluster(self):
        pos = {"ETH/USDT": {"units": 1}, "SOL/USDT": {"units": 1}}
        assert cluster_position_count(pos, "BTC/USDT") == 2

    def test_cluster_position_count_different_cluster(self):
        pos = {"HYPE/USDT": {"units": 1}}
        assert cluster_position_count(pos, "BTC/USDT") == 0

    def test_cluster_position_count_mixed(self):
        pos = {"BTC/USDT": {"units": 1}, "HYPE/USDT": {"units": 1}}
        # ETH is in cluster A, counts BTC (1) in that cluster
        assert cluster_position_count(pos, "ETH/USDT") == 1
        # SOL is in cluster A, also counts BTC (1)
        assert cluster_position_count(pos, "SOL/USDT") == 1

def ohlc(close):
    n = len(close)
    return pd.DataFrame({
        "high": [c + 1 for c in close],
        "low": [c - 1 for c in close],
        "close": close,
    })


class TestSMA:
    def test_sma_basic(self):
        df = ohlc([10.0, 20.0, 30.0])
        assert sma(df, 3).iloc[2] == pytest.approx(20.0)
        assert pd.isna(sma(df, 3).iloc[1])  # warmup, bukan tebakan

    def test_entry_golden_cross_kemarin(self):
        # flat 10x10 lalu naik: cross terjadi di bar kemarin, sinyal di bar ini
        df = ohlc([10.0] * 10 + [11.0, 12.0])
        assert sma_entry_signal(df, 11, 2, 5) is True
        # di bar cross itu sendiri (idx 10) belum sinyal — anti look-ahead
        assert sma_entry_signal(df, 10, 2, 5) is False

    def test_entry_butuh_rezim_uptrend(self):
        # cross tanpa close > slow tidak dihitung
        df = ohlc([20.0] * 10 + [5.0, 6.0])
        assert sma_entry_signal(df, 11, 2, 5) is False

    def test_exit_dead_cross(self):
        df = ohlc([10.0] * 10 + [30.0, 29.0, 5.0, 4.0, 3.0])
        assert sma_exit_signal(df, 14, 2, 5) is True
        assert sma_exit_signal(df, 13, 2, 5) is False


class TestRSI:
    def test_pure_uptrend_mendekati_100(self):
        df = ohlc([float(c) for c in range(1, 40)])
        assert rsi(df, 14).iloc[-1] > 90

    def test_pure_downtrend_mendekati_0(self):
        df = ohlc([float(40 - c) for c in range(40)])
        assert rsi(df, 14).iloc[-1] < 10

    def test_warmup_nan(self):
        df = ohlc([10.0] * 10)
        assert pd.isna(rsi(df, 14).iloc[5])

    def test_entry_keluar_oversold_kemarin(self):
        # jatuh dalam lalu memantul: RSI(14) lag 1 bar, cross 30 selesai di bar 21 -> sinyal di 22
        df = ohlc([100.0 - c * 3.0 for c in range(20)] + [45.0, 60.0, 70.0])
        assert rsi_entry_signal(df, 22, 14, 30) is True
        assert rsi_entry_signal(df, 21, 14, 30) is False  # cross belum selesai: anti look-ahead

    def test_exit_di_atas_level(self):
        df = ohlc([float(c) for c in range(1, 40)])
        assert rsi_exit_signal(df, 38, 14, 55) is True
        df2 = ohlc([100.0 - c * 3.0 for c in range(30)])
        assert rsi_exit_signal(df2, 29, 14, 55) is False
