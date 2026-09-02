"""Test end-to-end flow live_signal.main() dengan exchange palsu (tanpa internet).

- pytest: alert di-capture, TIDAK dikirim (regresi wiring signal->DB->alert).
- `python tests/test_live_signal.py --real`: kirim pesan ENTER+EXIT beneran ke
  Telegram (verifikasi delivery ke HP, butuh .env dengan token valid).
"""

import sqlite3
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "paper_trading"))
sys.path.insert(0, str(ROOT / "monitoring"))
import live_signal as ls  # noqa: E402

DAY_MS = 86_400_000


def make_candles(n: int = 40, spike: bool = False) -> list[list]:
    """n candle harian flat (close 100); spike=True -> candle terakhir breakout (close 114)."""
    base = int(datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
    out = []
    for i in range(n):
        ts = base - (n - i) * DAY_MS  # candle terakhir = kemarin (pasti sudah closed)
        if spike and i == n - 1:
            out.append([ts, 100.0, 115.0, 99.0, 114.0, 1.0])
        else:
            out.append([ts, 100.0, 101.0, 99.0, 100.0, 1.0])
    return out


class FakeExchange:
    """Duck-typed ccxt exchange: cukup method yang dipakai live_signal."""

    urls = {"api": {"public": ""}}

    def __init__(self, candles):
        self.candles = candles
        self.price = candles[-1][4]

    def load_markets(self):
        pass

    def milliseconds(self):
        return int(time.time() * 1000)

    def fetch_ohlcv(self, pair, timeframe="1d", limit=None):
        return self.candles

    def fetch_ticker(self, pair):
        return {"last": self.price}

    def fetch_order_book(self, pair, limit=None):
        return {"bids": [[self.price * 0.9999, 1.0]], "asks": [[self.price * 1.0001, 1.0]]}


def run_scenario(db_path: Path, candles, pre_positions=None, capture_alerts=True) -> list[str]:
    """Jalankan live_signal.main() dengan exchange palsu. Return daftar pesan alert
    yang terkirim (atau ter-capture kalau capture_alerts=True)."""
    ls.DB_PATH = db_path
    sent: list[str] = []
    real_send = ls.send_alert
    if capture_alerts:
        ls.send_alert = lambda m: (sent.append(m), True)[1]
    real_make_exchange = ls.make_exchange
    ls.make_exchange = lambda cfg: FakeExchange(candles)
    try:
        if pre_positions:
            conn = sqlite3.connect(db_path)
            conn.executescript((ROOT / "db" / "schema.sql").read_text())
            conn.executemany(
                "INSERT INTO positions (pair, entry_date, entry_price, units, stop_price, risk_amount) VALUES (?,?,?,?,?,?)",
                pre_positions,
            )
            conn.commit()
            conn.close()
        ls.main()
    finally:
        ls.send_alert = real_send
        ls.make_exchange = real_make_exchange
    return sent


def test_enter_creates_position_and_alert(tmp_path):
    sent = run_scenario(tmp_path / "t.db", make_candles(spike=True))
    conn = sqlite3.connect(tmp_path / "t.db")
    sig = conn.execute("SELECT pair, signal, decision FROM signals").fetchall()
    pos = conn.execute("SELECT pair, status FROM positions").fetchall()
    cash = float(conn.execute("SELECT value FROM meta WHERE key='paper_cash'").fetchone()[0])
    conn.close()
    pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"]
    assert all((p, "LONG_ENTRY", "ENTER") in sig for p in pairs)
    assert all(status == "open" for _, status in pos)
    assert 0 < cash < 1000  # modal terpakai (+ yield harian kecil)
    assert len(sent) == 5 and all("ENTER" in m for m in sent)


def test_exit_closes_position_and_alert(tmp_path):
    pre = [
        ("BTC/USDT", "2026-08-01", 105.0, 0.5, 101.0, 2.0),  # stop 101 > close 100 -> stop_loss
        ("ETH/USDT", "2026-08-01", 105.0, 0.5, 101.0, 2.0),
    ]
    sent = run_scenario(tmp_path / "t.db", make_candles(spike=False), pre_positions=pre)
    conn = sqlite3.connect(tmp_path / "t.db")
    pos = conn.execute("SELECT pair, status, exit_reason, pnl FROM positions").fetchall()
    cash = float(conn.execute("SELECT value FROM meta WHERE key='paper_cash'").fetchone()[0])
    conn.close()
    assert all(status == "closed" and reason in ("stop_loss", "live_stop") and pnl < 0 for _, status, reason, pnl in pos)
    assert cash > 990  # posisi ditutup, cash kembali (dikit) dari 1000
    assert len(sent) == 2 and all("EXIT" in m or "LIVE_STOP" in m for m in sent)


def test_idempotent_no_duplicate(tmp_path):
    db = tmp_path / "t.db"
    run_scenario(db, make_candles(spike=False))
    run_scenario(db, make_candles(spike=False))
    conn = sqlite3.connect(db)
    n = conn.execute("SELECT COUNT(*) FROM signals").fetchone()[0]
    n_pos = conn.execute("SELECT COUNT(*) FROM positions").fetchone()[0]
    n_yield = conn.execute("SELECT COUNT(*) FROM yield_log").fetchone()[0]
    conn.close()
    assert n == 10 and n_pos == 0 and n_yield == 1  # 10 pair x 1 candle, yield 1x/hari, tidak dobel


def test_yield_credit_once_per_day(tmp_path):
    db = tmp_path / "y.db"
    conn = sqlite3.connect(db)
    conn.executescript((ROOT / "db" / "schema.sql").read_text())
    conn.execute("INSERT INTO meta VALUES ('paper_cash', '1000')")
    conn.commit()
    cfg = {"paper_trading": {"yield_apy_idle_cash": 5.0}}
    ls.credit_yield(conn, cfg)
    ls.credit_yield(conn, cfg)  # hari sama -> no-op
    cash = float(conn.execute("SELECT value FROM meta WHERE key='paper_cash'").fetchone()[0])
    n = conn.execute("SELECT COUNT(*) FROM yield_log").fetchone()[0]
    conn.close()
    assert abs(cash - (1000 + 1000 * 5.0 / 100 / 365)) < 1e-6
    assert n == 1


def test_gap_stop_closes_position(tmp_path):
    """Gap stop: candle open <= stop tapi close > stop -> close position via gap_stop."""
    base = int(datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
    candles = []
    for i in range(40):
        ts = base - (40 - i) * DAY_MS
        if i == 39:
            candles.append([ts, 98.0, 103.0, 97.0, 102.0, 1.0])
        else:
            candles.append([ts, 100.0, 101.0, 99.0, 100.0, 1.0])
    pre = [
        ("BTC/USDT", "2026-08-01", 105.0, 0.5, 101.0, 2.0),
    ]
    sent = run_scenario(tmp_path / "t.db", candles, pre_positions=pre)
    conn = sqlite3.connect(tmp_path / "t.db")
    btc = conn.execute("SELECT pair, status, exit_reason, exit_price FROM positions WHERE pair='BTC/USDT'").fetchone()
    conn.close()
    assert btc is not None
    assert btc[1] == "closed"
    assert btc[2] == "gap_stop"
    assert "GAP STOP" in sent[0]


if __name__ == "__main__":
    if "--real" not in sys.argv:
        print("Regresi: pytest tests/test_live_signal.py")
        print("Tes delivery Telegram: python tests/test_live_signal.py --real")
        sys.exit(0)
    print("Kirim ENTER + EXIT beneran ke Telegram ...")
    sent_enter = run_scenario(Path(tempfile.mkdtemp()) / "real.db", make_candles(spike=True), capture_alerts=False)
    pre = [("BTC/USDT", "2026-08-01", 105.0, 0.5, 101.0, 2.0), ("ETH/USDT", "2026-08-01", 105.0, 0.5, 101.0, 2.0)]
    sent_exit = run_scenario(
        Path(tempfile.mkdtemp()) / "real.db", make_candles(spike=False), pre_positions=pre, capture_alerts=False
    )
    print(f"ENTER scenario: {len(sent_enter) if sent_enter else 'terkirim (real send)'} | EXIT scenario: idem")
    print("Cek HP lo — harusnya 2 pesan ENTER + 2 pesan EXIT.")
