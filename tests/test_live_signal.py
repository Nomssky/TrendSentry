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
    sig = conn.execute("SELECT pair, signal, decision, reason FROM signals").fetchall()
    pos = conn.execute("SELECT pair, status FROM positions").fetchall()
    cash = float(conn.execute("SELECT value FROM meta WHERE key='paper_cash'").fetchone()[0])
    conn.close()
    # With cluster limit 2 per cluster: 2 from A (BTC, ETH) + 1 from B (HYPE) = 3
    entries = [(p, s, d) for p, s, d, _ in sig if s == "LONG_ENTRY"]
    # 10 pair: cluster A (9) max 2 enter, cluster B (HYPE) 1 enter = 3 total
    assert len(entries) == 3, f"expected 3 entries (2A + 1B), got {len(entries)}"
    entries_pairs = {p for p, _, _ in entries}
    assert "HYPE/USDT" in entries_pairs  # cluster B has its own slot
    assert all(status == "open" for _, status in pos)
    assert len(pos) == 3
    # Remaining 7 cluster-A pairs skipped by cluster limit
    skips = [r for r in sig if "cluster limit" in (r[3] or "")]
    assert len(skips) == 7, f"expected 7 cluster limit skips, got {len(skips)}"
    assert 0 < cash < 1000
    assert len(sent) == 4 and sum(1 for m in sent if "ENTER" in m) == 3


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
    assert len(sent) == 3 and sum(1 for m in sent if "EXIT" in m or "LIVE_STOP" in m) == 2


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


def test_yield_backfill_multiple_days(tmp_path):
    """Yield backfill: jika cron down beberapa hari, backfill otomatis meliputi hari yang terlewat."""
    db = tmp_path / "y.db"
    conn = sqlite3.connect(db)
    conn.executescript((ROOT / "db" / "schema.sql").read_text())
    conn.execute("INSERT INTO meta VALUES ('paper_cash', '1000')")
    # Simulasi: last_yield_date adalah 3 hari lalu
    from datetime import datetime, timedelta, timezone
    three_days_ago = (datetime.now(timezone.utc) - timedelta(days=3)).date().isoformat()
    conn.execute("INSERT INTO meta VALUES ('last_yield_date', ?)", (three_days_ago,))
    conn.commit()
    
    # Run credit_yield
    cfg = {"paper_trading": {"yield_apy_idle_cash": 5.0}}
    ls.credit_yield(conn, cfg)
    
    # Check: dari 3 hari lalu sampai hari ini = 3 hari backfill (2 hari gap + 1 hari hari ini)
    # last_yield_date = 3 hari lalu, backfill 2 hari gap, credit hari ini = 3 total
    n = conn.execute("SELECT COUNT(*) FROM yield_log").fetchone()[0]
    cash = float(conn.execute("SELECT value FROM meta WHERE key='paper_cash'").fetchone()[0])
    conn.close()
    
    assert n == 3, f"Expected 3 yield entries (2 backfill + today), got {n}"
    # Verify cash compounding: 1000 * (1 + 5%/365)^3
    expected_cash = 1000.0 * ((1.0 + 5.0 / 100.0 / 365.0) ** 3)
    assert abs(cash - expected_cash) < 0.01, f"Expected cash ~{expected_cash}, got {cash}"


def test_equity_snapshot_no_double_count_yield(tmp_path):
    """Snapshot: total = cash + MTM. Yield sudah di dalam cash — dilarang nambah lagi."""
    db = tmp_path / "e.db"
    conn = sqlite3.connect(db)
    conn.executescript((ROOT / "db" / "schema.sql").read_text())
    conn.execute("INSERT INTO meta VALUES ('paper_cash', '1000.5')")  # sudah termasuk yield 0.5
    conn.execute("INSERT INTO yield_log (date, cash_before, rate_daily, amount) VALUES ('2026-09-01', 1000.0, 0.0001, 0.5)")
    conn.execute(
        "INSERT INTO positions (pair, entry_date, entry_price, units, stop_price, risk_amount) VALUES (?,?,?,?,?,?)",
        ("BTC/USDT", "2026-09-01", 100.0, 2.0, 90.0, 20.0),
    )
    conn.commit()
    row = ls.snapshot_equity(conn, "2026-09-01", {"BTC/USDT": 110.0})
    saved = conn.execute("SELECT cash, positions_mtm, n_open, total_equity FROM equity_log").fetchone()
    conn.close()
    assert saved == (1000.5, 220.0, 1, 1220.5), saved  # bukan 1221.0 (double-count)
    assert row["total_equity"] == 1220.5


def test_equity_snapshot_upsert_same_day(tmp_path):
    """Run ulang di hari sama menimpa baris, tidak dobel."""
    db = tmp_path / "e.db"
    conn = sqlite3.connect(db)
    conn.executescript((ROOT / "db" / "schema.sql").read_text())
    conn.execute("INSERT INTO meta VALUES ('paper_cash', '1000')")
    conn.execute(
        "INSERT INTO positions (pair, entry_date, entry_price, units, stop_price, risk_amount) VALUES (?,?,?,?,?,?)",
        ("BTC/USDT", "2026-09-01", 100.0, 1.0, 90.0, 10.0),
    )
    conn.commit()
    ls.snapshot_equity(conn, "2026-09-01", {"BTC/USDT": 100.0})
    ls.snapshot_equity(conn, "2026-09-01", {"BTC/USDT": 120.0})
    rows = conn.execute("SELECT total_equity FROM equity_log").fetchall()
    conn.close()
    assert rows == [(1120.0,)]


def test_equity_backfill_reconstructs_history(tmp_path):
    """Backfill: tanggal bolong direkonstruksi dari signals + yield_log + positions."""
    db = tmp_path / "e.db"
    conn = sqlite3.connect(db)
    conn.executescript((ROOT / "db" / "schema.sql").read_text())
    conn.execute("INSERT INTO meta VALUES ('paper_cash', '1000')")
    for pair, dates in {
        "BTC/USDT": [("2026-01-01", 100.0), ("2026-01-02", 102.0), ("2026-01-03", 101.0), ("2026-01-04", 103.0)],
        "ETH/USDT": [("2026-01-01", 48.0), ("2026-01-02", 50.0), ("2026-01-03", 52.0), ("2026-01-04", 55.0)],
    }.items():
        for d, c in dates:
            conn.execute(
                "INSERT INTO signals (candle_date, processed_at, pair, close_price, signal, decision) VALUES (?,?,?,?,?,?)",
                (d, d, pair, c, "HOLD", "IGNORE"),
            )
    conn.executemany(
        "INSERT INTO yield_log (date, cash_before, rate_daily, amount) VALUES (?,?,?,?)",
        [("2026-01-01", 900.0, 0.0001, 0.1), ("2026-01-02", 850.0, 0.0001, 0.1), ("2026-01-03", 950.0, 0.0001, 0.1)],
    )
    conn.executemany(
        "INSERT INTO positions (pair, entry_date, entry_price, units, stop_price, risk_amount, status, exit_date, exit_price, pnl) "
        "VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            ("BTC/USDT", "2026-01-01", 100.0, 1.0, 90.0, 10.0, "open", None, None, None),
            ("ETH/USDT", "2026-01-02", 50.0, 2.0, 45.0, 10.0, "closed", "2026-01-04", 55.0, 9.89),
        ],
    )
    conn.commit()
    cfg = {"backtest": {"fee_pct": 0.1, "initial_capital_usd": 1000.0}}
    filled = ls.backfill_equity(conn, cfg, "2026-01-05")
    rows = conn.execute("SELECT date, cash, positions_mtm, n_open, total_equity FROM equity_log ORDER BY date").fetchall()
    filled2 = ls.backfill_equity(conn, cfg, "2026-01-05")  # idempotent
    conn.close()
    assert filled == 4, rows
    assert filled2 == 0
    by_date = {r[0]: r[1:] for r in rows}
    assert by_date["2026-01-01"] == (900.1, 100.0, 1, 1000.1), by_date["2026-01-01"]
    assert by_date["2026-01-02"] == (850.1, 202.0, 2, 1052.1), by_date["2026-01-02"]
    assert by_date["2026-01-03"] == (950.1, 205.0, 2, 1155.1), by_date["2026-01-03"]
    # 01-04 tanpa yield row -> replay: 950.1 + proceeds ETH (9.89+100) = 1059.99; BTC open @103
    assert by_date["2026-01-04"] == (1059.99, 103.0, 1, 1162.99), by_date["2026-01-04"]


def test_main_writes_equity_snapshot(tmp_path):
    """main() menulis baris equity hari ini (mark dari candle close yang diproses)."""
    db = tmp_path / "t.db"
    run_scenario(db, make_candles(spike=True))
    conn = sqlite3.connect(db)
    today = datetime.now(timezone.utc).date().isoformat()
    row = conn.execute("SELECT cash, positions_mtm, n_open, total_equity FROM equity_log WHERE date=?", (today,)).fetchone()
    cash = float(conn.execute("SELECT value FROM meta WHERE key='paper_cash'").fetchone()[0])
    units = conn.execute("SELECT COALESCE(SUM(units), 0) FROM positions WHERE status='open'").fetchone()[0]
    conn.close()
    assert row is not None, "equity snapshot hari ini tidak tertulis"
    assert row[2] == 3  # 2 cluster A + 1 HYPE, seperti test_enter
    assert abs(row[3] - (cash + units * 114.0)) < 0.01, row  # mark = close spike 114


def test_make_exchange_bitget_only():
    """Venue tunggal Bitget — source lain fail fast, tidak ada fallback diam-diam."""
    import ccxt

    ex = ls.make_exchange({"paper_trading": {"data_source": "bitget"}})
    assert isinstance(ex, ccxt.bitget)
    with pytest.raises(ValueError):
        ls.make_exchange({"paper_trading": {"data_source": "binance_vision"}})


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
