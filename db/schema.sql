-- Schema log paper trading (SQLite). Di-execute otomatis oleh live_signal.py tiap start (CREATE IF NOT EXISTS).

-- Meta: state berjalan (paper cash, dll)
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Setiap candle close yang diproses + keputusan. UNIQUE(candle_date, pair) = idempotency:
-- candle yang sudah diproses tidak akan diproses ulang walau script dijalankan berulang.
CREATE TABLE IF NOT EXISTS signals (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    candle_date   TEXT NOT NULL,      -- tanggal candle yang close (UTC)
    processed_at  TEXT NOT NULL,      -- waktu deteksi
    pair          TEXT NOT NULL,
    close_price   REAL NOT NULL,
    donchian_hi   REAL,               -- highest high 20 hari sebelum candle ini
    donchian_lo   REAL,               -- lowest low 10 hari sebelum candle ini
    atr           REAL,
    signal        TEXT NOT NULL,      -- LONG_ENTRY | LONG_EXIT | HOLD
    decision      TEXT NOT NULL,      -- ENTER | EXIT | IGNORE
    reason        TEXT,               -- angka pendukung, biar anti-look-ahead bisa diverifikasi
    UNIQUE (candle_date, pair)
);

-- Posisi paper (dummy execution, tidak ada order beneran)
CREATE TABLE IF NOT EXISTS positions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    pair         TEXT NOT NULL,
    entry_date   TEXT NOT NULL,
    entry_price  REAL NOT NULL,
    units        REAL NOT NULL,
    stop_price   REAL NOT NULL,
    risk_amount  REAL NOT NULL,       -- units * (entry - stop), buat hitung R-multiple
    status       TEXT NOT NULL DEFAULT 'open',  -- open | closed
    exit_date    TEXT,
    exit_price   REAL,
    exit_reason  TEXT,                -- stop_loss | donchian_exit | gap_stop
    pnl          REAL,                -- sudah termasuk fee + slippage
    r_multiple   REAL
);

-- Slippage realita: spread order book di tiap signal (kriteria sukses: bandingkan dgn asumsi 0.05%)
CREATE TABLE IF NOT EXISTS slippage_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT NOT NULL,
    pair        TEXT NOT NULL,
    bid         REAL,
    ask         REAL,
    mid         REAL,
    spread_pct  REAL NOT NULL         -- (ask - bid) / mid * 100
);