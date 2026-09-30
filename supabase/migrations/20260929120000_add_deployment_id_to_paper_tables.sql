-- ============================================================================
-- TrendSentry MVP Phase B: deployment identity sebagai bagian dari sync identity.
--
-- Kenapa: Phase B menjalankan SATU file SQLite per deployment
-- (db/deployments/<id>.db), tapi mirror Supabase tetap satu set tabel `paper_*`.
-- Key unique lama hanya memuat kunci bisnis (candle_date+pair, date, key, ...):
--   deployment A + BTC + tanggal X  dan  deployment B + BTC + tanggal X
-- akan saling menimpa (upsert onConflict) atau memicu unique violation.
--
-- Perubahan:
--   1. +1 kolom `deployment_id bigint not null default 0` di 6 tabel `paper_*`.
--      0 = stream global legacy (db/paper_trading.db) — baris lama ikut dapat 0,
--      jadi perilaku sync legacy tidak berubah sama sekali.
--   2. SEMUA key unique diganti memuat `deployment_id`.
--   3. `paper_positions` +2 kolom: `side` (selalu 'buy' — arah dibekukan
--      long_only oleh validate_config) dan `fill_key` (pair|entry_date),
--      identitas fill deterministik yang tidak bergantung autoincrement SQLite.
--
-- Yang TIDAK diubah: tidak ada tabel baru, tidak ada kolom lain diubah, RLS tidak
-- disentuh (mirror tetap public read + service role write), migrasi Phase A tidak
-- disentuh (forward-only, file baru).
--
-- `deployment_id` sengaja TIDAK jadi FK ke `deployments(id)`: nilai 0 (legacy)
-- tidak ada di tabel deployments, dan mirror tidak boleh ikut terhapus saat
-- deployment/akun dihapus. Kolom ini identitas penanda, relasi sudah dijaga di
-- sisi SQLite (file per deployment) dan control plane.
--
-- CATATAN: file ini ditulis tapi BELUM pernah dieksekusi di database manapun
-- dari sesi ini (tidak ada Supabase lokal yang berjalan). Blok verifikasi di
-- bawah dibuat supaya kegagalan parsial (mis. nama constraint lama yang tidak
-- cocok) memunculkan EXCEPTION, bukan diam-diam mempertahankan key lama.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolom identitas deployment di semua tabel mirror
-- ---------------------------------------------------------------------------
alter table public.paper_signals      add column if not exists deployment_id bigint not null default 0;
alter table public.paper_positions    add column if not exists deployment_id bigint not null default 0;
alter table public.paper_equity_log   add column if not exists deployment_id bigint not null default 0;
alter table public.paper_meta         add column if not exists deployment_id bigint not null default 0;
alter table public.paper_slippage_log add column if not exists deployment_id bigint not null default 0;
alter table public.paper_yield_log    add column if not exists deployment_id bigint not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Identitas fill (hanya paper_positions)
--    Ekspresi backfill HARUS identik dengan scripts/sync_paper_to_supabase.py
--    ::fill_key_for -> f"{pair}|{entry_date}".
-- ---------------------------------------------------------------------------
alter table public.paper_positions add column if not exists side text not null default 'buy';
alter table public.paper_positions add column if not exists fill_key text;

update public.paper_positions
   set fill_key = pair || '|' || entry_date
 where fill_key is null;

alter table public.paper_positions alter column fill_key set not null;

-- ---------------------------------------------------------------------------
-- 3. Ganti key unique: buang key lama (yang tidak memuat deployment_id),
--    pasang key baru. Nama constraint lama = konvensi auto-nama PostgreSQL
--    + nama eksplisit dari migration 20260910120000.
--    PK berbasis `id` (paper_signals, paper_positions, paper_slippage_log)
--    sengaja TIDAK disentuh: id tetap di-generate server, tidak pernah dikirim
--    sync, jadi tidak pernah bentrok antar deployment.
-- ---------------------------------------------------------------------------
alter table public.paper_signals      drop constraint if exists paper_signals_candle_date_pair_key;
alter table public.paper_positions    drop constraint if exists paper_positions_pair_entry_uniq;
alter table public.paper_equity_log   drop constraint if exists paper_equity_log_pkey;
alter table public.paper_meta         drop constraint if exists paper_meta_pkey;
alter table public.paper_slippage_log drop constraint if exists paper_slippage_log_timestamp_pair_key;
alter table public.paper_yield_log    drop constraint if exists paper_yield_log_pkey;

alter table public.paper_signals      add constraint paper_signals_sync_key      unique (deployment_id, candle_date, pair);
alter table public.paper_positions    add constraint paper_positions_sync_key    unique (deployment_id, fill_key);
alter table public.paper_equity_log   add constraint paper_equity_log_sync_key   unique (deployment_id, date);
alter table public.paper_meta         add constraint paper_meta_sync_key         unique (deployment_id, key);
alter table public.paper_slippage_log add constraint paper_slippage_log_sync_key unique (deployment_id, timestamp, pair);
alter table public.paper_yield_log    add constraint paper_yield_log_sync_key    unique (deployment_id, date);

-- ---------------------------------------------------------------------------
-- 4. Verifikasi: kegagalan parsial harus MELEMPAR, bukan lolos diam-diam.
--    Kalau ada unique/PK constraint di tabel `paper_*` yang TIDAK memuat
--    deployment_id (di luar PK berbasis `id`), key lama masih berdiri dan dua
--    deployment masih bisa bertabrakan -> migration gagal dan harus diperbaiki.
-- ---------------------------------------------------------------------------
do $$
declare
  leftover text;
begin
  select string_agg(rel.relname || '.' || con.conname, ', ' order by rel.relname)
    into leftover
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public'
     and rel.relname in ('paper_signals', 'paper_positions', 'paper_equity_log',
                         'paper_meta', 'paper_slippage_log', 'paper_yield_log')
     and con.contype in ('u', 'p')
     and con.conname not in ('paper_signals_pkey', 'paper_positions_pkey', 'paper_slippage_log_pkey')
     and not exists (
           select 1
             from pg_attribute a
            where a.attrelid = con.conrelid
              and a.attnum = any (con.conkey)
              and a.attname = 'deployment_id'
         );

  if leftover is not null then
    raise exception 'sync identity belum lengkap — constraint lama masih berdiri: %', leftover;
  end if;
end
$$;
