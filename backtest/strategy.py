"""Strategy logic: Donchian breakout + ATR stop + position sizing.

Pure pandas, tanpa look-ahead bias:
- Breakout dicek terhadap 20 hari SEBELUMNYA (donchian di-shift 1).
- ATR dihitung dari candle penutupan hari sinyal, bukan hari berikutnya.
Semua nilai period/multiplier dibaca dari config.yaml, bukan hardcode.
"""

import pandas as pd


def atr(df: pd.DataFrame, period: int) -> pd.Series:
    """Average True Range (Wilder smoothing), value hari t = dari data s.d. hari t."""
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    # Wilder = EMA alpha=1/period, seed dengan SMA awal biar stabil.
    atr_series = tr.iloc[:period].mean()
    result = tr.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    result.iloc[: period - 1] = float("nan")
    result.iloc[period - 1] = atr_series
    return result


def donchian_high(df: pd.DataFrame, period: int) -> pd.Series:
    """Highest high period hari SEBELUM hari t (exclude hari t, cegah look-ahead)."""
    return df["high"].rolling(period).max().shift(1)


def donchian_low(df: pd.DataFrame, period: int) -> pd.Series:
    """Lowest low period hari SEBELUM hari t (exclude hari t)."""
    return df["low"].rolling(period).min().shift(1)


def position_size(equity: float, entry_price: float, stop_price: float, risk_pct: float) -> float:
    """Jumlah unit aset: risk_pct% dari equity dibagi jarak entry->stop.

    Dibatasi oleh equity (spot, no leverage): size * entry <= equity.
    Raises ValueError kalau stop_price >= entry_price (long harus punya SL di bawah entry).
    """
    if entry_price <= 0 or stop_price >= entry_price:
        raise ValueError(f"invalid stop: entry={entry_price}, stop={stop_price}")
    risk_amount = equity * risk_pct / 100.0
    stop_distance = entry_price - stop_price
    units = risk_amount / stop_distance
    max_units = equity / entry_price
    return min(units, max_units)


def entry_signal(df: pd.DataFrame, idx: int, entry_period: int) -> bool:
    """Long entry: close hari ini > highest high 20 hari sebelumnya."""
    return bool(df["close"].iloc[idx] > donchian_high(df, entry_period).iloc[idx])


def exit_signal(df: pd.DataFrame, idx: int, exit_period: int) -> bool:
    """Exit: close hari ini < lowest low 10 hari sebelumnya."""
    return bool(df["close"].iloc[idx] < donchian_low(df, exit_period).iloc[idx])
