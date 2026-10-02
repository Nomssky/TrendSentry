#!/usr/bin/env bash
# Backup MANUAL-ONLY DB paper trading via SQLite online backup (aman walau DB sedang dipakai).
# Simpan 14 hari terakhir di db/backups/, hapus yang lebih tua.
# MANUAL-ONLY: cron lokal DIBATALKAN (lihat docs/internal/TASKS.md) — jangan baca baris Cron di bawah sebagai jadwal aktif.
# Jalur backup resmi = commit db/paper_trading.db oleh CI harian (paper-trading.yml).
# Cron dulu: 5 1 * * * (UTC) — tidak aktif.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p db/backups
DB="db/paper_trading.db"
[ -f "$DB" ] || exit 0
BACKUP="db/backups/paper_trading_$(date -u +%F).db"
sqlite3 "$DB" ".backup '$BACKUP'"
find db/backups -name 'paper_trading_*.db' -mtime +14 -delete
echo "backup OK: $BACKUP"
