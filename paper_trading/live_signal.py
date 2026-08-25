"""Paper trading signal engine — dummy execution, log only (Fase 2).

Di-run sekali per hari VIA CRON, SETELAH candle harian close (candle 1d close di 00:00 UTC):

    0 1 * * * cd /home/kresna/project && ./venv/bin/python paper_trading/live_signal.py >> paper_trading/logs/live_signal.log 2>&1

Idempotent: candle yang sudah ada di tabel `signals` (UNIQUE candle_date+pair) dilewati,
jadi aman walau cron ke-run ulang atau script dijalankan manual berkali-kali.

Sinyal identik dengan backtest (reuse backtest/strategy.py — satu source of truth):
- Entry long: close candle > highest high 20 hari SEBELUMNYA (donchian di-shift 1, anti look-ahead)
- Exit: close <= stop (entry - 2x ATR14) ATAU close < lowest low 10 hari sebelumnya
- Eksekusi dummy di harga pasar saat ini (open candle baru), size = risk 1% dari paper equity,
  fee + slippage asumsi dari config.yaml, slippage real (spread order book) di-log terpisah.
"""

import logging
import sqlite3
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import ccxt
import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backtest"))
sys.path.insert(0, str(ROOT / "monitoring"))
from strategy import atr, donchian_high, donchian_low, position_size  # noqa: E402
from telegram_alert import send_alert  # noqa: E402

DB_PATH = ROOT / "db" / "paper_trading.db"
SCHEMA_PATH = ROOT / "db" / "schema.sql"
LOOKBACK_CANDLES = 60  # buffer untuk donchian 20 + atr 14 + margin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger("live_signal")


def load_config() -> dict:
    with open(ROOT / "config.yaml") as f:
        return yaml.safe_load(f)


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA_PATH.read_text())
    return conn


def get_cash(conn: sqlite3.Connection, cfg: dict) -> float:
    row = conn.execute("SELECT value FROM meta WHERE key='paper_cash'").fetchone()
    if row is None:
        cash = float(cfg["backtest"]["initial_capital_usd"])
        conn.execute("INSERT INTO meta VALUES ('paper_cash', ?)", (cash,))
        conn.commit()
        return cash
    return float(row[0])


def set_cash(conn: sqlite3.Connection, cash: float) -> None:
    conn.execute("UPDATE meta SET value=? WHERE key='paper_cash'", (cash,))
    conn.commit()


def log_slippage(conn: sqlite3.Connection, exchange: ccxt.Exchange, pair: str) -> None:
    ob = fetch_retry(lambda: exchange.fetch_order_book(pair, limit=5))
    bid, ask = ob["bids"][0][0], ob["asks"][0][0]
    mid = (bid + ask) / 2
    spread_pct = (ask - bid) / mid * 100 if mid else 0.0
    conn.execute(
        "INSERT INTO slippage_log (timestamp, pair, bid, ask, mid, spread_pct) VALUES (?, ?, ?, ?, ?, ?)",
        (datetime.now(timezone.utc).isoformat(), pair, bid, ask, mid, round(spread_pct, 4)),
    )
    conn.commit()


def fetch_retry(fn, tries: int = 3, delay: float = 5.0):
    """Panggil fn() dengan retry sederhana (5s, 10s) sebelum menyerah.

    Hiccup jaringan sesaat tidak boleh menghasilkan "missed day" — baru dianggap
    gagal setelah 3 percobaan, lalu exception naik ke top-level untuk alert.
    """
    last: Exception | None = None
    for attempt in range(tries):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 - semua error fetch ditangani sama
            last = e
            log.warning("fetch gagal (attempt %d/%d): %s", attempt + 1, tries, e)
            time.sleep(delay * (attempt + 1))
    assert last is not None
    raise last


def main() -> int:
    cfg = load_config()
    strat, risk, bt = cfg["strategy"], cfg["risk"], cfg["backtest"]
    fee, slip = bt["fee_pct"] / 100.0, bt["slippage_pct"] / 100.0
    conn = connect()
    cash = get_cash(conn, cfg)
    # Spot-only + mirror market-data-only Binance: data sama persis dengan api.binance.com,
    # tapi tidak kena geo-block 451 dari GitHub Actions runner (IP US).
    exchange = ccxt.binance({
        "enableRateLimit": True,
        "options": {"fetchMarkets": ["spot"]},
    })
    exchange.urls["api"]["public"] = "https://data-api.binance.vision/api/v3"
    exchange.load_markets()
    now_ms = exchange.milliseconds()

    for pair in strat["pairs"]:
        ohlcv = fetch_retry(lambda: exchange.fetch_ohlcv(pair, strat["timeframe"], limit=LOOKBACK_CANDLES))
        df = pd.DataFrame(ohlcv, columns=["ts", "open", "high", "low", "close", "volume"])
        df["date"] = pd.to_datetime(df["ts"], unit="ms", utc=True).dt.date

        # Hanya proses candle yang SUDAH close (ts candle + 1 hari <= now).
        # Candle terakhir dari fetch_ohlcv 1d biasanya masih berjalan -> otomatis di-skip.
        # Hanya candle closed TERAKHIR yang diproses: kalau ada hari terlewat (cron down),
        # sinyal stale TIDAK dikejar (eksekusi harus di open hari berikutnya, bukan nanti),
        # dan gap-nya terlihat di tabel signals = indikator downtime untuk review mingguan.
        closed = df[df["ts"] + 86_400_000 <= now_ms]
        if closed.empty:
            log.info("%s: tidak ada candle closed", pair)
            continue
        candle = closed.iloc[-1]
        d = str(candle["date"])
        if conn.execute("SELECT 1 FROM signals WHERE candle_date=? AND pair=?", (d, pair)).fetchone():
            log.info("%s: candle %s sudah diproses (idempotent)", pair, d)
            continue

        i = df.index[df["date"] == candle["date"]][0]
        close, don_hi, don_lo, atr_v = (
            candle["close"], donchian_high(df, strat["donchian_entry_period"]).iloc[i],
            donchian_low(df, strat["donchian_exit_period"]).iloc[i],
            atr(df, strat["atr_period"]).iloc[i],
        )
        log_slippage(conn, exchange, pair)

        pos = conn.execute(
            "SELECT id, entry_price, units, stop_price, risk_amount FROM positions WHERE pair=? AND status='open'",
            (pair,),
        ).fetchone()
        n_open = conn.execute("SELECT COUNT(*) FROM positions WHERE status='open'").fetchone()[0]
        decision, reason, signal = "IGNORE", "tidak ada sinyal", "HOLD"

        if pos:  # cek exit dulu (seperti backtest)
            p_id, p_entry, p_units, p_stop, p_risk = pos
            if close <= p_stop or close < don_lo:
                ticker = fetch_retry(lambda: exchange.fetch_ticker(pair))
                exit_price = ticker["last"] * (1 - slip)
                proceeds = p_units * exit_price * (1 - fee - slip)
                pnl = proceeds - p_units * p_entry
                r = pnl / p_risk if p_risk else 0.0
                conn.execute(
                    "UPDATE positions SET status='closed', exit_date=?, exit_price=?, exit_reason=?, pnl=?, r_multiple=? WHERE id=?",
                    (d, round(exit_price, 2), "stop_loss" if close <= p_stop else "donchian_exit",
                     round(pnl, 2), round(r, 3), p_id),
                )
                set_cash(conn, cash + proceeds)
                cash += proceeds
                decision, signal = "EXIT", "LONG_EXIT"
                reason = f"close {close:.2f} <= stop {p_stop:.2f}" if close <= p_stop else f"close {close:.2f} < don_lo(10) {don_lo:.2f}"
                log.info("%s: EXIT %s pnl=%.2f r=%.3f", pair, reason, pnl, r)
        elif close > don_hi and n_open < risk["max_concurrent_positions"]:  # entry
            ticker = fetch_retry(lambda: exchange.fetch_ticker(pair))
            entry_price = ticker["last"] * (1 + slip)
            stop = close - strat["atr_stop_multiplier"] * atr_v
            units = position_size(cash, entry_price, stop, risk["risk_per_trade_pct"])
            cost = units * entry_price * (1 + fee)
            if cost > cash:
                units = cash / (entry_price * (1 + fee)) if entry_price > 0 else 0.0
            if units > 0:
                conn.execute(
                    "INSERT INTO positions (pair, entry_date, entry_price, units, stop_price, risk_amount) VALUES (?,?,?,?,?,?)",
                    (pair, d, round(entry_price, 2), round(units, 6), round(stop, 2), round(units * (entry_price - stop), 2)),
                )
                set_cash(conn, cash - cost)
                cash -= cost
                decision, signal = "ENTER", "LONG_ENTRY"
                reason = f"close {close:.2f} > don_hi(20) {don_hi:.2f}"
                log.info("%s: ENTER @%.2f units=%.4f stop=%.2f (risk 1% = %.2f)", pair, entry_price, units, stop, cash * risk["risk_per_trade_pct"] / 100)

        conn.execute(
            "INSERT INTO signals (candle_date, processed_at, pair, close_price, donchian_hi, donchian_lo, atr, signal, decision, reason) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (d, datetime.now(timezone.utc).isoformat(), pair, round(close, 2),
             round(don_hi, 2) if pd.notna(don_hi) else None, round(don_lo, 2) if pd.notna(don_lo) else None,
             round(atr_v, 2) if pd.notna(atr_v) else None, signal, decision, reason),
        )
        conn.commit()
        log.info("%s %s: %s %s (%s)", pair, d, signal, decision, reason)
    conn.close()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        log.exception("live_signal crash")
        send_alert(
            f"[paper-trading] live_signal.py CRASH {datetime.now(timezone.utc).isoformat()}\n"
            + traceback.format_exc()[-1200:]
        )
        sys.exit(1)