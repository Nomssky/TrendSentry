#!/usr/bin/env bash
# Backup harian: pg_dump -> gzip -> enkripsi gpg (AES-256, authenticated) ->
# upload Supabase Storage (cloud). Dijalankan systemd timer di VPS (RUNBOOK.md).
# Retensi: 14 file terbaru.
# Butuh env: DATABASE_URL (lokal), CLOUD_SUPABASE_URL, CLOUD_SERVICE_KEY,
# BACKUP_BUCKET (default: vps-backups), BACKUP_PASSPHRASE, BACKUP_DIR.
#
# Kenapa gpg, bukan `openssl enc -aes-256-cbc`: mode CBC openssl tidak
# authenticated (bisa dimodifikasi tanpa terdeteksi). gpg --symmetric
# memakai AES-256 + integritas (MDC), jadi korupsi/tamper terdeteksi saat restore.
set -euo pipefail
: "${DATABASE_URL:?}" ; : "${CLOUD_SUPABASE_URL:?}" ; : "${CLOUD_SERVICE_KEY:?}" ; : "${BACKUP_PASSPHRASE:?}"
BUCKET="${BACKUP_BUCKET:-vps-backups}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/trendsentry}"
mkdir -p "$BACKUP_DIR"
TS="$(date -u +%F_%H%M)"
FILE="trendsentry_$TS.dump.gz.gpg"
pg_dump "$DATABASE_URL" -Fc | gzip | gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase-fd 3 --output "$BACKUP_DIR/$FILE" 3<<<"$BACKUP_PASSPHRASE"
curl -sf -X POST "$CLOUD_SUPABASE_URL/storage/v1/object/$BUCKET/$FILE" \
  -H "apikey: $CLOUD_SERVICE_KEY" -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
  --data-binary "@$BACKUP_DIR/$FILE" > /dev/null
ls -t "$BACKUP_DIR"/trendsentry_*.dump.gz.gpg | tail -n +15 | xargs -r rm --
echo "OK $FILE ($(du -h "$BACKUP_DIR/$FILE" | cut -f1))"
