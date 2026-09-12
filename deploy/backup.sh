#!/usr/bin/env bash
# Backup harian: pg_dump -> gzip -> enkripsi openssl -> upload Supabase Storage (cloud).
# Dijalankan systemd timer di VPS (lihat RUNBOOK.md). Retensi: 14 file terbaru.
# Butuh env: DATABASE_URL (lokal), CLOUD_SUPABASE_URL, CLOUD_SERVICE_KEY,
# BACKUP_BUCKET (default: vps-backups), BACKUP_PASSPHRASE, BACKUP_DIR.
set -euo pipefail
: "${DATABASE_URL:?}" ; : "${CLOUD_SUPABASE_URL:?}" ; : "${CLOUD_SERVICE_KEY:?}" ; : "${BACKUP_PASSPHRASE:?}"
BUCKET="${BACKUP_BUCKET:-vps-backups}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/trendsentry}"
mkdir -p "$BACKUP_DIR"
TS="$(date -u +%F_%H%M)"
FILE="trendsentry_$TS.dump.gz.enc"
pg_dump "$DATABASE_URL" -Fc | gzip | openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -out "$BACKUP_DIR/$FILE"
curl -sf -X POST "$CLOUD_SUPABASE_URL/storage/v1/object/$BUCKET/$FILE" \
  -H "apikey: $CLOUD_SERVICE_KEY" -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
  --data-binary "@$BACKUP_DIR/$FILE" > /dev/null
ls -t "$BACKUP_DIR"/trendsentry_*.dump.gz.enc | tail -n +15 | xargs -r rm --
echo "OK $FILE ($(du -h "$BACKUP_DIR/$FILE" | cut -f1))"
