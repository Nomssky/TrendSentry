"""Fetch OHLCV historical data via ccxt (Binance) dan simpan ke data/historical/.

Digunakan di Fase 1 (backtest). Output: CSV per pair dengan kolom
timestamp(UTC ISO), open, high, low, close, volume.
"""

import logging
import sys
import time
from pathlib import Path

import ccxt
import pandas as pd
import yaml

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("fetch_data")

PAIRS = ["BTC/USDT", "ETH/USDT"]
TIMEFRAME = "1d"
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "historical"


def load_lookback_years() -> int:
    with open(Path(__file__).resolve().parent.parent / "config.yaml") as f:
        return int(yaml.safe_load(f)["backtest"]["lookback_years"])


def fetch_ohlcv(exchange: ccxt.Exchange, symbol: str, timeframe: str, since_ms: int) -> pd.DataFrame:
    """Fetch semua candle sejak since_ms (pagination otomatis, chunk 1000)."""
    all_rows: list[list] = []
    cursor = since_ms
    while True:
        chunk = exchange.fetch_ohlcv(symbol, timeframe, since=cursor, limit=1000)
        if not chunk:
            break
        all_rows.extend(chunk)
        cursor = chunk[-1][0] + 1
        if len(chunk) < 1000:
            break
        time.sleep(exchange.rateLimit / 1000)
    df = pd.DataFrame(all_rows, columns=["ts", "open", "high", "low", "close", "volume"])
    df = df.drop_duplicates(subset="ts").sort_values("ts").reset_index(drop=True)
    return df


def main() -> None:
    exchange = ccxt.binance({"enableRateLimit": True})
    exchange.load_markets()
    since_ms = exchange.milliseconds() - load_lookback_years() * 365 * 24 * 3600 * 1000
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for symbol in PAIRS:
        df = fetch_ohlcv(exchange, symbol, TIMEFRAME, since_ms)
        df["date"] = pd.to_datetime(df["ts"], unit="ms", utc=True).dt.date
        df = df[["date", "open", "high", "low", "close", "volume"]]
        out = OUT_DIR / f"{symbol.replace('/', '_')}_{TIMEFRAME}.csv"
        df.to_csv(out, index=False)
        log.info("%s: %d candles (%s .. %s) -> %s", symbol, len(df), df["date"].iloc[0], df["date"].iloc[-1], out)


if __name__ == "__main__":
    sys.exit(main())
