#!/usr/bin/env bash
# Restore: download dari bucket -> dekripsi gpg -> pg_restore --clean ke target.
# !!! MENIMPA data target. Hanya untuk uji-restore / disaster recovery (RUNBOOK.md).
# Pakai: DATABASE_URL=... CLOUD_SUPABASE_URL=... CLOUD_SERVICE_KEY=... BACKUP_PASSPHRASE=... ./deploy/restore.sh <nama-file>
set -euo pipefail
: "${DATABASE_URL:?}" ; : "${CLOUD_SUPABASE_URL:?}" ; : "${CLOUD_SERVICE_KEY:?}" ; : "${BACKUP_PASSPHRASE:?}"
BUCKET="${BACKUP_BUCKET:-vps-backups}"
FILE="${1:?isi nama file backup}"

# Validasi basename: cegah path traversal (mis. ../../etc/passwd) lewat argumen.
if [[ "$FILE" != "$(basename "$FILE")" || "$FILE" == *".."* ]]; then
  echo "ERROR: nama file tidak valid (harus basename tanpa path)" >&2
  exit 1
fi
TMP="$(mktemp "/tmp/trendsentry_restore.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

read -r -p "TIMPA database target dengan $FILE? ketik YA: " confirm
[ "$confirm" = "YA" ] || { echo batal; exit 1; }
curl -sf "$CLOUD_SUPABASE_URL/storage/v1/object/$BUCKET/$FILE" \
  -H "apikey: $CLOUD_SERVICE_KEY" -H "Authorization: Bearer $CLOUD_SERVICE_KEY" \
  -o "$TMP"
gpg --batch --quiet --decrypt --passphrase-fd 3 "$TMP" 3<<<"$BACKUP_PASSPHRASE" \
  | gunzip | pg_restore --clean --if-exists -d "$DATABASE_URL"
echo "OK restored $FILE"
