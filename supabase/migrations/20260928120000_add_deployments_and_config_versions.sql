-- ============================================================================
-- TrendSentry MVP Phase A: control plane — deployment + config version.
--
-- Menambah 2 tabel baru; TIDAK menyentuh tabel yang sudah ada (profiles,
-- strategy_templates, user_strategies, paper_*, dsb tetap utuh).
--
-- LIFECYCLE STATUS (sengaja minimal — jangan tambah state tanpa keputusan owner):
--   created  default : deployment dibuat + config v1 tersimpan, runtime BELUM jalan
--   running          : runtime menandai dirinya hidup (Phase B) + update last_heartbeat
--   stopped          : runtime berhenti bersih
--   failed           : runtime crash / heartbeat lewat ambang (nilai ambang = Phase B)
--
--   "Baru dibuat vs running/sehat" cukup dengan DUA kolom — bukan sistem monitoring:
--     status         = state yang dilaporkan runtime
--     last_heartbeat = kapan terakhir runtime menyentuh baris ini; NULL = belum pernah
--   Tidak ada tabel heartbeat/monitoring terpisah.
--
-- TOKEN BACA KONFIGURASI (session-free: execution plane -> control plane):
--   deployments.config_token_hash = SHA-256 hex dari token — BUKAN token mentah,
--   sehingga baris deployment tidak pernah memuat secret yang bisa dipakai ulang.
--   Token plaintext = crypto.randomBytes(32) (256 bit), dibuat server, dan hanya
--   dikirim SEKALI pada response POST /api/deployments; tidak pernah bisa dibaca
--   kembali lewat API mana pun.
--   Verifikasi: sha256(token yang dibawa) dibandingkan TIMING-SAFE dengan hash
--   tersimpan — pola persis CRON_SECRET di app/api/cron/*.
--   Token di-per-deployment: satu bocor pun tidak membuka deployment lain, dan
--   tidak ada user yang memegang secret global (CRON_SECRET tidak boleh beredar
--   ke runtime milik user).
--
-- IMUTABILITAS CONFIG VERSION:
--   1. Tidak ada policy UPDATE/DELETE di RLS  -> default deny untuk anon & authenticated.
--   2. Trigger BEFORE UPDATE melempar exception -> service role pun tidak bisa diam-diam
--      mengubah snapshot lama. Tidak ada jalur "silent" untuk memutar mundur versi.
--   3. DELETE sengaja TIDAK diblokir: cascade penghapusan akun
--      (auth.users -> deployments -> deployment_config_versions) harus tetap berjalan
--      (lihat app/api/account/delete/route.ts). Yang dijaga adalah KONTEN tidak
--      berubah, bukan baris tidak boleh hilang.
-- ============================================================================

create table public.deployments (
  id                     bigint generated always as identity primary key,
  user_id                uuid not null references auth.users(id) on delete cascade,
  user_strategy_id       bigint not null references public.user_strategies(id) on delete cascade,
  name                   text not null,
  status                 text not null default 'created'
                           check (status in ('created', 'running', 'stopped', 'failed')),
  current_config_version integer not null default 1 check (current_config_version >= 1),
  config_token_hash      text not null,
  last_heartbeat         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Satu baris per (deployment, versi). `config` = snapshot utuh config bundle
-- (bentuk persis config.yaml yang dibaca live_signal.py + validate_config()).
create table public.deployment_config_versions (
  deployment_id bigint not null references public.deployments(id) on delete cascade,
  version       integer not null check (version >= 1),
  config        jsonb not null,
  created_at    timestamptz not null default now(),
  primary key (deployment_id, version)
);

-- Index konsisten dengan tabel user-scoped lain (idx_user_strategies_user_id, dst).
create index idx_deployments_user_id on public.deployments(user_id);
create index idx_deployments_user_strategy_id on public.deployments(user_strategy_id);

-- ---------------------------------------------------------------------------
-- Immutability guard (lihat catatan di atas: UPDATE = exception, DELETE = cascade OK)
-- ---------------------------------------------------------------------------
create or replace function public.reject_config_version_update()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  raise exception 'deployment_config_versions immutable: UPDATE dilarang (version %)', old.version;
end;
$$;

create trigger trg_deployment_config_versions_immutable
  before update on public.deployment_config_versions
  for each row execute function public.reject_config_version_update();

-- ---------------------------------------------------------------------------
-- RLS — pola sama dengan tabel user-scoped lain: owner-only SELECT ke authenticated.
-- Event trigger rls_auto_enable juga menyalakan RLS untuk 2 tabel baru ini;
-- dinyatakan eksplisit supaya file ini berdiri sendiri kalau trigger tidak ada.
-- ---------------------------------------------------------------------------
alter table public.deployments enable row level security;
alter table public.deployment_config_versions enable row level security;

-- deployments: user hanya boleh MEMBACA miliknya sendiri.
-- Tidak ada policy INSERT/UPDATE/DELETE -> default deny:
--   pembuatan deployment hanya lewat service role di POST /api/deployments,
--   jadi user tidak bisa menulis deployment / config version langsung dari browser
--   (publishable key). Config version = artefak server, bukan input user.
create policy "deployments_select_self" on public.deployments
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- deployment_config_versions: kepemilikan DIWARISI dari induknya — baris versi
-- hanya terbaca kalau deployment-nya milik peminta. Tidak ada policy lain.
create policy "deployment_config_versions_select_self" on public.deployment_config_versions
  for select to authenticated
  using (exists (
    select 1 from public.deployments d
    where d.id = deployment_id
      and d.user_id = (select auth.uid())
  ));
