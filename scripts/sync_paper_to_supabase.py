#!/usr/bin/env python3
"""Sync paper trading data from SQLite to Supabase."""

import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ypkdnvwlekxmmotxsvrm.supabase.co")
VERCEL_URL = os.environ.get("VERCEL_URL", "https://trendsentry.vercel.app")
CRON_SECRET = os.environ.get("CRON_SECRET")
DB_PATH = os.environ.get("DB_PATH", "db/paper_trading.db")

def fetch_all(db, table, keep_id=False):
    try:
        rows = [dict(row) for row in db.execute(f"SELECT * FROM {table}").fetchall()]
        if not keep_id:
            for row in rows:
                row.pop("id", None)
        return rows
    except sqlite3.OperationalError:
        return []

def main():
    if not CRON_SECRET:
        print("ERROR: CRON_SECRET not set")
        sys.exit(1)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    data = {
        "signals": fetch_all(db, "signals"),
        # ponytail: positions WAJIB bawa id SQLite — route upsert onConflict=id.
        # Tanpa id, Postgres generate identity baru tiap sync = duplikat open
        # positions berlipat (root cause board 3 posisi tampil 6).
        "positions": fetch_all(db, "positions", keep_id=True),
        "slippage_log": fetch_all(db, "slippage_log"),
        "yield_log": fetch_all(db, "yield_log"),
        "equity_log": fetch_all(db, "equity_log"),
        "meta": {row["key"]: row["value"] for row in db.execute("SELECT * FROM meta").fetchall()},
    }
    db.close()

    total = sum(len(v) if isinstance(v, list) else len(v) for v in data.values())
    print(f"Syncing {total} records...")

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
        sys.exit(1)

if __name__ == "__main__":
    main()
