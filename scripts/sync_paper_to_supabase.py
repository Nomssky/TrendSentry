#!/usr/bin/env python3
"""Sync paper trading data from SQLite to Supabase."""

import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ypkdnvwlekxmmotxsvrm.supabase.co")
CRON_SECRET = os.environ.get("CRON_SECRET")
DB_PATH = os.environ.get("DB_PATH", "db/paper_trading.db")

def fetch_all(db, table):
    try:
        return [dict(row) for row in db.execute(f"SELECT * FROM {table}").fetchall()]
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
        "positions": fetch_all(db, "positions"),
        "equity_log": fetch_all(db, "equity_log"),
        "meta": {row["key"]: row["value"] for row in db.execute("SELECT * FROM meta").fetchall()},
    }
    db.close()

    total = sum(len(v) if isinstance(v, list) else len(v) for v in data.values())
    print(f"Syncing {total} records...")

    req = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/paper-sync",
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
