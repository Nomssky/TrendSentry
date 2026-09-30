#!/usr/bin/env python3
"""Sync paper trading data from SQLite to Supabase.

Append-only tables (signals, slippage_log, yield_log) dikirim INKREMENTAL:
hanya baris dengan id > watermark terakhir (disimpan di tabel sync_state).
Ini mencegah payload tumbuh melewati cap PaperSyncSchema seiring waktu.

positions: SEMUA baris (upsert by id, dibutuhkan agar status open->closed ikut).
equity_log: semua (upsert by date, kecil).
meta: semua (key-value kecil).

Deployment-aware (Phase B): `DB_PATH` menentukan deployment_id (db/deployments/<id>.db
-> id; selain itu -> 0 = stream global legacy). Payload membawa deployment_id dan
fill_key, dan key unique di cloud ikut memuat deployment_id — dua deployment yang
entry di pair/tanggal yang sama tetap dua baris terpisah.
"""

import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error
from pathlib import Path

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ypkdnvwlekxmmotxsvrm.supabase.co")
VERCEL_URL = os.environ.get("VERCEL_URL", "https://trendsentry.vercel.app")
CRON_SECRET = os.environ.get("CRON_SECRET")
DB_PATH = os.environ.get("DB_PATH", "db/paper_trading.db")

# tabel -> tabel sumber sama; watermark disimpan per tabel.
INCREMENTAL_TABLES = ("signals", "slippage_log", "yield_log")


def deployment_id_for(db_path) -> int:
    """Identitas deployment yang dimiliki sebuah file SQLite.

    Diturunkan dari PATH, bukan dari env terpisah: `db/deployments/<id>.db`
    adalah satu-satunya runtime path yang sah untuk deployment (lihat
    paper_trading/run_deployment.py::db_path_for), jadi payload tidak mungkin
    pernah salah-tagging walau environment salah set. Selain itu
    (mis. db/paper_trading.db) = 0, stream global legacy — tetap ditulis, tetap
    dipisahkan dari baris deployment di cloud.
    """
    path = Path(db_path)
    if path.parent.name == "deployments" and path.stem.isdigit() and int(path.stem) > 0:
        return int(path.stem)
    return 0


def fill_key_for(pair: str, entry_date: str) -> str:
    """Identitas fill deterministik untuk sinkronisasi.

    Satu deployment + satu pair + satu tanggal entry = SATU fill, apa pun
    urutan/retry sync-nya, dan id-nya tidak bergantung pada autoincrement SQLite
    (yang di-reset kalau file DB dibuat ulang). Dua deployment yang entry di
    pair/tanggal yang sama tetap berbeda karena key cloud =
    (deployment_id, fill_key). Ekspresinya HARUS identik dengan backfill di
    migration supabase (pair || '|' || entry_date).
    """
    return f"{pair}|{entry_date}"


def table_exists(db, table) -> bool:
    row = db.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def get_watermark(db, table) -> int:
    row = db.execute("SELECT value FROM sync_state WHERE key=?", (f"last_id_{table}",)).fetchone()
    return int(row[0]) if row else 0


def set_watermark(db, table, last_id) -> None:
    db.execute(
        "INSERT INTO sync_state (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (f"last_id_{table}", str(last_id)),
    )


def get_date_watermark(db, table) -> str:
    row = db.execute("SELECT value FROM sync_state WHERE key=?", (f"last_date_{table}",)).fetchone()
    return row[0] if row else ""


def set_date_watermark(db, table, last_date) -> None:
    db.execute(
        "INSERT INTO sync_state (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (f"last_date_{table}", str(last_date)),
    )


def fetch_incremental(db, table):
    """Baris baru sejak watermark (butuh kolom id). Kosong kalau tabel tak ada."""
    if not table_exists(db, table):
        return [], None
    wm = get_watermark(db, table)
    rows = [dict(r) for r in db.execute(f"SELECT * FROM {table} WHERE id > ? ORDER BY id", (wm,)).fetchall()]
    for row in rows:
        row.pop("id", None)
    last_id = wm
    if rows:
        # id sudah di-pop; ambil ulang max(id) dari sumber untuk watermark.
        row = db.execute(f"SELECT MAX(id) FROM {table}").fetchone()
        last_id = row[0] or wm
    return rows, last_id


def fetch_all(db, table, keep_id=False):
    if not table_exists(db, table):
        return []
    rows = [dict(r) for r in db.execute(f"SELECT * FROM {table}").fetchall()]
    if not keep_id:
        for row in rows:
            row.pop("id", None)
    return rows


def collect_payload(db, db_path):
    """Kumpulkan payload sinkron untuk SATU file SQLite.

    Return (payload, watermarks, eq_rows). Watermark sengaja dipisah: ia hanya
    boleh dimajukan SETELAH server menerima payload dengan 200 (lihat main),
    supaya run yang gagal mengirim ulang baris yang sama.

    Payload selalu membawa `deployment_id` di level atas — route menanamkannya ke
    setiap baris, jadi identitas sync tidak mungkin beda antar tabel dalam satu
    kiriman. Tabel cloud memakai key (deployment_id, ...) sehingga dua deployment
    yang entry di pair/tanggal yang sama menghasilkan dua baris berbeda.
    """
    deployment_id = deployment_id_for(db_path)
    db.row_factory = sqlite3.Row  # dict(r) di fetch_all/fetch_incremental butuh ini

    data = {}
    watermarks = {}
    for table in INCREMENTAL_TABLES:
        rows, last_id = fetch_incremental(db, table)
        data[table] = rows
        if last_id is not None:
            watermarks[table] = last_id

    # positions: kirim open + baris baru (id > watermark) + yang baru ditutup
    # (30 hari), agar perubahan status ikut terkirim tanpa mengirim seluruh
    # tabel selamanya. `id` SQLite TIDAK dikirim: id autoincrement per-file,
    # jadi id=1 milik deployment A dan B sama dan akan saling menimpa. Identitas
    # sync-nya (deployment_id, fill_key).
    position_rows = fetch_all(db, "positions", keep_id=True)
    pos_wm = get_watermark(db, "positions")
    open_ids = {r["id"] for r in position_rows if r.get("status") == "open"}
    new_ids = {r["id"] for r in position_rows if r.get("id", 0) > pos_wm}
    recent_closed = {
        r["id"]
        for r in db.execute(
            "SELECT id FROM positions WHERE status='closed' AND exit_date >= date('now','-30 day')"
        ).fetchall()
    }
    keep_ids = open_ids | new_ids | recent_closed
    positions = [r for r in position_rows if r.get("id") in keep_ids]
    for row in positions:
        # SQLite tidak menyimpan kolom side (arah dibekukan long_only di
        # validate_config) — diisi di sini supaya mirror cloud punya field-nya.
        row["side"] = "buy"
        row["fill_key"] = fill_key_for(str(row.get("pair")), str(row.get("entry_date")))
    data["positions"] = positions
    # equity_log: inkremental per tanggal (cloud menyimpan histori lama).
    eq_wm = get_date_watermark(db, "equity_log")
    eq_rows = [
        dict(r)
        for r in db.execute(
            "SELECT * FROM equity_log WHERE date > ? ORDER BY date", (eq_wm,)
        ).fetchall()
    ]
    data["equity_log"] = eq_rows
    data["meta"] = {
        row["key"]: row["value"]
        for row in db.execute("SELECT key, value FROM meta").fetchall()
    }
    data["deployment_id"] = deployment_id

    return data, watermarks, eq_rows


def main():
    if not CRON_SECRET:
        print("ERROR: CRON_SECRET not set")
        sys.exit(1)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    data, watermarks, eq_rows = collect_payload(db, DB_PATH)

    total = sum(len(v) if isinstance(v, (list, dict)) else 1 for v in data.values())
    print(
        f"Syncing {total} records (deployment {data['deployment_id']}) "
        f"(signals:{len(data.get('signals', []))} positions:{len(data.get('positions', []))} "
        f"equity_log:{len(data.get('equity_log', []))})..."
    )

    req = urllib.request.Request(
        f"{VERCEL_URL}/api/cron/paper-sync",
        data=json.dumps(data).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {CRON_SECRET}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            result = json.loads(res.read())
            print(f"Sync result: {json.dumps(result, indent=2)}")
    except urllib.error.HTTPError as e:
        print(f"ERROR: {e.code} {e.read().decode()}")
        db.close()
        sys.exit(1)

    # Watermark hanya dimajukan SETELAH server menerima (200). Kalau gagal,
    # baris yang sama dikirim ulang pada run berikutnya.
    positions = data["positions"]
    for table, last_id in watermarks.items():
        set_watermark(db, table, last_id)
    if positions:
        set_watermark(db, "positions", max(r["id"] for r in positions))
    if eq_rows:
        set_date_watermark(db, "equity_log", eq_rows[-1]["date"])
    db.commit()
    db.close()


if __name__ == "__main__":
    main()
