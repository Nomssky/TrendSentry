"""Fetch funding rate historis futures Binance (dump resmi data.binance.vision).

Output: data/funding/{SYMBOL}_daily.csv (kolom date, daily_rate).
daily_rate = jumlah 3 rate per-8-jam dalam sehari (fraksi dari notional; positif = long bayar short).
Bulan yang dump-nya belum tersedia diisi trailing average (dicatat di log).
"""

import io
import logging
import sys
import zipfile
from datetime import date
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("fetch_funding")

SYMBOLS = ["BTCUSDT", "ETHUSDT"]
START = (2020, 8)  # sinkron dengan window backtest 6 tahun
OUT_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "funding"
BASE = "https://data.binance.vision/data/futures/um/monthly/fundingRate/{sym}/{sym}-fundingRate-{ym}.zip"


def fetch_month(sym: str, y: int, m: int) -> pd.DataFrame | None:
    url = BASE.format(sym=sym, ym=f"{y}-{m:02d}")
    r = requests.get(url, timeout=30)
    if r.status_code == 404:
        return None  # bulan berjalan / dump belum ada
    r.raise_for_status()
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    csv_name = zf.namelist()[0]
    df = pd.read_csv(zf.open(csv_name))
    return df


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today()
    for sym in SYMBOLS:
        frames = []
        y, m = START
        while (y, m) <= (today.year, today.month):
            try:
                df = fetch_month(sym, y, m)
                if df is not None:
                    frames.append(df)
            except Exception as e:  # noqa: BLE001
                log.warning("%s %04d-%02d gagal: %s", sym, y, m, e)
            m += 1
            if m > 12:
                y, m = y + 1, 1
        if not frames:
            log.error("%s: tidak ada data", sym)
            continue
        raw = pd.concat(frames, ignore_index=True)
        raw["date"] = pd.to_datetime(raw["calc_time"], unit="ms").dt.date
        daily = raw.groupby("date")["last_funding_rate"].sum().rename("daily_rate").reset_index()
        # isi bulan yang bolong (dump telat) dengan trailing average 30 hari
        daily["date"] = pd.to_datetime(daily["date"])
        daily = daily.set_index("date").asfreq("D")
        filled = daily["daily_rate"].fillna(daily["daily_rate"].rolling(30, min_periods=1).mean())
        daily["daily_rate"] = filled
        daily = daily.reset_index()
        daily["date"] = daily["date"].dt.date
        out = OUT_DIR / f"{sym}_daily.csv"
        daily.to_csv(out, index=False)
        log.info("%s: %d hari (%s .. %s) -> %s", sym, len(daily), daily["date"].iloc[0], daily["date"].iloc[-1], out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
