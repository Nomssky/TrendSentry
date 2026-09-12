#!/usr/bin/env bash
# Restore: download dari bucket -> dekripsi -> pg_restore --clean ke DATABASE_URL target.
# !!! MENIMPA data target. Hanya untuk uji-restore / disaster recovery (lihat RUNBOOK.md).
# Pakai: DATABASE_URL=... CLOUD_SUPABASE_URL=... CLOUD_SERVICE_KEY=... BACKUP_PASSPHRASE=... ./deploy/restore.sh <nama-file>
set -euo pipefail
: "${DATABASE_URL:?}" ; : "${CLOUD_SUPABASE_URL:?}" ; : "${CLOUD_SERVICE_KEY:?}" ; : "${BACKUP_PASSPHRASE:?}"
BUCKET="${BACKUP_BUCKET:-vps-backups}"
FILE="${1:?isi nama file backup}"
read -r -p "TIMPA database target dengan $FILE? ketik YA: " confirm
[ "$confirm" = "YA" ] || { echo batal; exit 1; }
curl -sf "$CLOUD_SUPABASE_URL/storage/v1/object/$BUCKET/$FILE" \
  -H "apikey: $CLOUD_SERVICE_KEY" -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
  -o "/tmp/$FILE"
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "/tmp/$FILE" | gunzip | pg_restore --clean --if-exists -d "$DATABASE_URL"
rm -f "/tmp/$FILE"
echo "OK restored $FILE"
