#!/usr/bin/env bash
# Terapkan supabase/migrations/*.sql berurutan ke Postgres target.
# Pakai: DATABASE_URL=postgres://... ./deploy/migrate.sh
# Idempoten bila migrasi ditulis dgn IF NOT EXISTS / ON CONFLICT DO NOTHING.
set -euo pipefail
: "${DATABASE_URL:?isi DATABASE_URL dulu}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "== $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo OK
