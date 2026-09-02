"""Fetch historical OHLCV data from Bitget API untuk semua pair di config.

Simpan ke data/historical/{PAIR}_{timeframe}.csv (format sama dgn backtest).

Run:
    python scripts/fetch_bitget_data.py          # fetch semua pair
    python scripts/fetch_bitget_data.py BTC/USDT  # fetch 1 pair
"""

import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import ccxt
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "historical"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    with open(ROOT / "config.yaml") as f:
        return yaml.safe_load(f)


def make_exchange() -> ccxt.Exchange:
    return ccxt.bitget({"enableRateLimit": True})


def fetch_pair(exchange: ccxt.Exchange, symbol: str, timeframe: str = "1d") -> pd.DataFrame:
    """Fetch semua historical OHLCV dari Bitget, paginasi manual."""
    all_candles = []
    now_ms = exchange.milliseconds()
    # Bitget max 1000 candles per request, mulai dari 2020-08-01
    start_ms = int(datetime(2020, 8, 1, tzinfo=timezone.utc).timestamp() * 1000)

    current_ms = start_ms
    while current_ms < now_ms:
        try:
            candles = exchange.fetch_ohlcv(symbol, timeframe, since=current_ms, limit=1000)
        except Exception as e:
            print(f"  WARN: {symbol} fetch gagal di {current_ms}: {e}", flush=True)
            break

        if not candles:
            # Retry from later date (listing mungkin lebih baru)
            if current_ms == start_ms:
                retry_dates = [
                    int(datetime(2021, 1, 1, tzinfo=timezone.utc).timestamp() * 1000),
                    int(datetime(2021, 6, 1, tzinfo=timezone.utc).timestamp() * 1000),
                    int(datetime(2022, 1, 1, tzinfo=timezone.utc).timestamp() * 1000),
                    int(datetime(2023, 1, 1, tzinfo=timezone.utc).timestamp() * 1000),
                ]
                for retry_ms in retry_dates:
                    print(f"  {symbol}: retry from {datetime.fromtimestamp(retry_ms/1000, tz=timezone.utc).strftime('%Y-%m-%d')}...", flush=True)
                    try:
                        candles = exchange.fetch_ohlcv(symbol, timeframe, since=retry_ms, limit=1000)
                    except Exception as e:
                        print(f"  WARN: retry gagal: {e}", flush=True)
                        continue
                    if candles:
                        current_ms = retry_ms
                        print(f"  {symbol}: got {len(candles)} candles from retry", flush=True)
                        break
                if not candles:
                    print(f"  {symbol}: empty response at all retry dates", flush=True)
                    break
            else:
                print(f"  {symbol}: empty response at {datetime.fromtimestamp(current_ms/1000, tz=timezone.utc).strftime('%Y-%m-%d')}", flush=True)
                break

        all_candles.extend(candles)
        last_ts = candles[-1][0]
        print(f"  {symbol}: fetched {len(candles)} candles s/d {datetime.fromtimestamp(last_ts/1000, tz=timezone.utc).strftime('%Y-%m-%d')}", flush=True)

        if last_ts <= current_ms:
            break  # no progress
        current_ms = last_ts + 86_400_000  # next day
        time.sleep(0.5)

    if not all_candles:
        return pd.DataFrame()

    df = pd.DataFrame(all_candles, columns=["ts", "open", "high", "low", "close", "volume"])
    df["date"] = pd.to_datetime(df["ts"], unit="ms", utc=True).dt.date
    df = df.drop(columns=["ts"]).drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
    return df


def save_csv(df: pd.DataFrame, symbol: str, timeframe: str) -> Path:
    filename = f"{symbol.replace('/', '_')}_{timeframe}.csv"
    path = DATA_DIR / filename
    df.to_csv(path, index=False)
    return path


def main():
    cfg = load_config()
    pairs = cfg["strategy"]["pairs"]

    if len(sys.argv) > 1:
        pairs = [sys.argv[1]]

    exchange = make_exchange()
    exchange.load_markets()

    print(f"Bitget spot markets with USDT:", flush=True)
    spot_usdt = [s for s in exchange.markets if s.endswith("/USDT") and exchange.markets[s].get("spot")]
    print(f"  {sorted(spot_usdt)[:20]}...", flush=True)
    print(f"  Total spot USDT: {len(spot_usdt)}", flush=True)

    for pair in pairs:
        print(f"Fetching {pair}...", flush=True)
        if pair not in exchange.markets:
            # Try with USDT suffix variants
            alt = pair.replace("/", "")
            found = [s for s in exchange.markets if alt.replace("/", "") in s.replace("/", "")]
            print(f"  NOT in markets. Similar: {found[:5]}", flush=True)
            continue
        m = exchange.markets[pair]
        print(f"  market type={m.get('type')}, spot={m.get('spot')}, active={m.get('active')}, precision={m.get('precision',{}).get('amount')}", flush=True)
        df = fetch_pair(exchange, pair)
        if df.empty:
            # Try direct API call for debugging
            print(f"  DEBUG: trying direct fetch_ohlcv with different params...", flush=True)
            try:
                test = exchange.fetch_ohlcv(pair, '1d', limit=5)
                print(f"  DEBUG: direct call returned {len(test)} candles: {test[:2]}", flush=True)
            except Exception as e:
                print(f"  DEBUG: direct call failed: {e}", flush=True)
            print(f"  SKIP: tidak ada data (0 candles fetched)", flush=True)
            continue
        path = save_csv(df, pair, "1d")
        print(f"  Saved: {path} ({len(df)} rows, {df['date'].iloc[0]} .. {df['date'].iloc[-1]})", flush=True)


if __name__ == "__main__":
    main()
