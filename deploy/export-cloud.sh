#!/usr/bin/env bash
# Ekspor tabel paper_* dari Supabase cloud (sumber) ke file dump.
# Pakai: CLOUD_DATABASE_URL=postgres://... ./deploy/export-cloud.sh [outdir]
# Connection string: Supabase dashboard -> Project Settings -> Database -> Connection string.
set -euo pipefail
: "${CLOUD_DATABASE_URL:?isi CLOUD_DATABASE_URL dulu}"
OUT="${1:-/tmp/trendsentry-export}"
mkdir -p "$OUT"
TABLES="paper_signals paper_positions paper_equity_log paper_meta paper_slippage_log paper_yield_log"
pg_dump "$CLOUD_DATABASE_URL" --data-only --column-inserts \
  $(for t in $TABLES; do echo -n "-t public.$t "; done) \
  -f "$OUT/paper_tables.sql"
echo "OK -> $OUT/paper_tables.sql ($(wc -l < "$OUT/paper_tables.sql") baris)"
