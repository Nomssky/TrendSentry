#!/usr/bin/env bash
# Backup harian DB paper trading via SQLite online backup (aman walau DB sedang dipakai).
# Simpan 14 hari terakhir di db/backups/, hapus yang lebih tua.
# Cron: 5 1 * * * (UTC, 5 menit setelah live_signal) bash /home/kresna/project/db/backup_db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p db/backups
DB="db/paper_trading.db"
[ -f "$DB" ] || exit 0
BACKUP="db/backups/paper_trading_$(date -u +%F).db"
sqlite3 "$DB" ".backup '$BACKUP'"
find db/backups -name 'paper_trading_*.db' -mtime +14 -delete
echo "backup OK: $BACKUP"
