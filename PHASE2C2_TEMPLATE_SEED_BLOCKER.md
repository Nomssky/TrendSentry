# Phase 2C-2 — Strategy Templates Reproducibility: Blocker & Decision Report

> Tanggal: 2026-09-22 · Baseline: `de3f7eb` `[Phase 2C-1] remove hardcoded E2E credentials`
> **STOP CONDITION tercapai (#1 + #2):** payload template kanonik TIDAK dapat direkam dari
> bukti repository → implementasi seed DITAHANKAN (mengisi data = mengarang, dilarang).
> Deliverable fase ini = laporan keputusan ini. Tidak ada kode/migrasi/data yang diubah.
> Tidak ada query ke database produksi. Tidak ada push.

## Ringkasan eksekusi

Pencarian pemulihan payload dilakukan menyeluruh (191 commit, reflog, unreachable objects,
seluruh arsip working tree) dan **gagal memulihkan definisi lengkap 8 template**. Yang bisa
dipulihkan persis hanya: (a) 8 nama, (b) overlay guardrail 3 properti — keduanya sudah ada
di migration `20260911120000`. Yang TIDAK bisa dipulihkan: `params_schema.properties`
dasar tiap template (kunci, tipe, default, deskripsi — termasuk seluruh payload 4 template
yang tidak disebut mana pun) dan kolom `description` tiap baris. Karena itu seed tidak boleh
dibuat sekarang. Laporan ini memuat: kepemilikan, hasil rekam jejak, desain mekanisme seed
yang direkomendasikan, model perilaku DB, opsi keputusan owner, dan jalur unblock.

---

## 1. Ownership

**Kesimpulan: fixed built-in product templates** (bukan runtime-managed, bukan user-generated).

Bukti kode:
- **RLS hanya-baca publik, tanpa jalur tulis:** `supabase/migrations/20260909120000_remote_schema.sql:183-184` — policy `strategy_templates_read FOR select TO public USING (true)`; tidak ada policy INSERT/UPDATE/DELETE untuk tabel ini (RLS aktif `:166` → semua operasi tulis diblokir untuk semua role app).
- **Satu-satunya akses aplikasi = GET/SELECT:** `monitoring/web/app/api/templates/route.ts:13` (`.from("strategy_templates").select("*")`); seluruh history route ini (3 commit: `ea4d4e1`, `e37bd76`, `b96decc`) tidak pernah punya POST/PUT/DELETE — diverifikasi `git log --all -p`.
- **Tidak ada kolom ownership** (tidak ada `user_id`/`created_by`/`updated_at` di tabel, `remote_schema.sql:26-30`) — bukan tabel milik user.
- **User hanya MERUJUK:** `user_strategies.template_id` FK (`remote_schema.sql:38`); insert ke `user_strategies` (`api/strategies/route.ts:46`), bukan ke template.
- **Migration menjaga tetap "bawaan":** `20260911120000_seed_strategy_templates.sql:4-11` mengunci guardrail (direction/risk/max_concurrent) di 8 nama tetap — perilaku produk, bukan data user.
- **UI memilih dari daftar server** (`app/app/strategies/new/page.tsx:92,132`) tanpa fitur CRUD template.

## 2. Canonical definitions — HASIL REKAM JEJAK (gagal sebagian)

### Yang BERHASIL dipulihkan (exact, dari repository)

| Data | Sumber |
|---|---|
| 8 nama persis: `Donchian Breakout`, `SMA Crossover`, `RSI Mean-Reversion`, `Custom`, `Bollinger Bands`, `MACD Crossover`, `Ichimoku Cloud`, `VWAP Strategy` | `20260911120000_seed_strategy_templates.sql:9-11` (klause `where name in`) |
| 3 properti guardrail + tipe/default/batas persis: `direction` (enum `long_only`, default `long_only`), `risk_per_trade_pct` (number, default 1.0, min 0.1, max 1.0), `max_concurrent` (integer, default 5, min 1, max 5) | migration yang sama `:5-8` (`jsonb_build_object`) — ini bentuk params_schema **setelah** overlay |
| Bentuk kolom: `id bigint identity PK`, `name text not null unique`, `description text`, `params_schema jsonb not null` | `remote_schema.sql:26-30` |
| Cuplikan semantik 4 dari 8 (bukan skema — hanya teks marketing: "Entry period, exit period, ATR stop multiplier" dst.) | `app/start/page.tsx:33-36` |

### Yang TIDAK dapat dipulihkan (payload inti)

- **`params_schema.properties` dasar tiap template** — kunci properti (mis. entry/exit period, ATR multiplier), tipenya, `default`, `description`, enum, batas, dan struktur JSON lengkap (apakah ada `title`/`required`/dsb.).
- **Kolom `description`** kedelapan baris (nilai asli DB; teks marketing ≠ nilai kolom, dan hanya mencakup 4 nama).
- **4 template yang tak pernah disebut di data parsial mana pun** (Bollinger Bands, MACD Crossover, Ichimoku Cloud, VWAP Strategy) — hanya namanya yang diketahui.
- **ID baris** (identity-generated; tidak diperlukan semantik — desain seed cukup pakai conflict target `name` UNIQUE).

### Jalur pencarian yang sudah DILAKUKAN (semua negatif)

1. `git log --all -S"strategy_templates" / -S"params_schema" / -S"Donchian Breakout"` → hanya migrations, dokumen audit (prose), dan definisi tipe TS — tanpa payload.
2. **Semua 191 commit:** `git grep '"properties"' -- '*.json'` → **0** (tak pernah ada file JSON skema template di history mana pun).
3. **Cari INSERT nyata** ke `strategy_templates` di semua commit + reflog (`git log -g`) → hanya muncul di dokumen audit Phase 2 (kutipan prose "tidak ada INSERT"), tidak pernah sebagai SQL.
4. **Unreachable objects** (`git fsck`): semua blob tak terjangkau di-scan untuk `insert into.*strategy_templates` / `"properties"` → 0 match; commit tak terjangkau = WIP index snapshot pekerjaan lain (retry data 2026-09-02, sync docs 2026-09-06).
5. **`supabase/seed.sql` tidak pernah ada** — `git log --all --diff-filter=D -- supabase/*seed*` kosong; `config.toml:65-70` `[db.seed] sql_paths=["./seed.sql"]` rujuk file yang tak pernah dibuat.
6. **Migration capture bersifat DDL saja:** `923409c "[Schema + Types] capture Supabase schema"` menambah `remote_schema.sql` (CREATE/policy) tanpa data INSERT.
7. **Riwayat kedua jalur tulis:** route `templates` (3 commit) dan `strategies` (`ea4d4e1`) tidak pernah memuat array fallback/seed hardcode.
8. **Artefak/test/fixture:** tidak ada snapshot Playwright, `test-results/` hanya `.last-run.json`, tidak ada fixture API response berisi template, tidak ada berkas `.dump`/`.backup`/snapshot SQL.
9. **DB SQLite paper (`db/paper_trading.db`)**: tabel `meta, signals, positions, slippage_log, yield_log, equity_log, sync_state` — tanpa template.
10. **Docs** (PLAN/DESIGN/ARCHITECTURE/AUDIT/TASKS/README/SECURITY-ACTIONS/DEPLOY RUNBOOK) — tidak ada payload; `deploy/migrate.sh`/`backup.sh` tidak menyentuh template.
11. **`lib/db-supabase.ts` history** (`ad06beb`, `ea4d4e1`) — hanya tipe bentuk `Template`, bukan nilai.

### Status

**`STOP — payload kanonik tidak lengkap.** Yang diketahui = nama + 3 properti guardrail (sudah tercakup migration yang ada). Definisi kanonik yang tersisa hanya hidup di remote DB produksi — mengaksesnya dilarang aturan fase ini ("Do NOT query production"). **Tidak ada definisi yang digarang.**

## 3. Seed mechanism (analisis & rekomendasi — TIDAK diimplementasikan)

**Rekomendasi setelah payload tersedia: Option A — migration seed BARU (forward-only).**

Alasan selaras arsitektur proyek:
- **Migrations = satu-satunya mekanisme yang benar-benar jalan di semua target.** Proyek ini memakai Supabase hosted (link ada di `supabase/.temp/linked-project.json`; `remote_schema.sql` sendiri adalah *capture* dari remote). Migration dijalankan Supabase CLI/hosted pipeline; `[db.seed]` **hanya** jalan pada `supabase db reset` lokal (`config.toml:65-70`) → **Option B (seed.sql) saja tidak menutup fresh environment hosted** dan tidak memenuhi objective ("fresh Supabase environment must obtain templates"). Option B saat ini juga cacat: file rujukannya tidak pernah ada.
- **Option C (application-owned)** bertentangan dengan bukti kepemilikan (§1): tabel adalah fixture produk ber-RLS yang dibaca app; memindahkan kepemilikan ke kode = perubahan arsitektur, bukan perbaikan minimal, dan melanggar "preserve existing behavior/contract".
- **Option A paling kecil:** satu file migration baru dengan `insert ... on conflict (name) do nothing` — memanfaatkan constraint `name text not null unique` yang sudah ada (`remote_schema.sql:28`), tanpa perubahan skema, tanpa sentuh route/UI/test.

**Migration history TIDAK ditulis ulang.** `20260911120000_seed_strategy_templates.sql` (UPDATE) diperlakukan sebagai sudah ter-apply di deployed environments (asumsi wajib per Phase 4) dan dipertahankan apa adanya; remediasi hanya boleh berupa migration baru bertimestamp > `20260911120000`.

Detail desain untuk implementasi nanti (dokumentasi, bukan kode):
- **Payload INSERT = bentuk params_schema PASCA-guardrail** (3 properti overlay sudah termasuk inline), karena pada fresh DB migration UPDATE `20260911120000` berjalan **sebelum** INSERT dan menjadi no-op (0 baris) — overlay tidak akan pernah diterapkan otomatis.
- **Idempoten & aman untuk DB terisi:** `ON CONFLICT (name) DO NOTHING` → produksi yang sudah punya 8 baris = no-op total (tidak ada baris duplikat, tidak ada mutasi data lama — sesuai "do not destroy/overwrite existing remote data").
- **Ordering:** migration baru = langkah terakhir seed; tidak ada dependensi lain selain `20260909120000` (schema).

## 4. Database behavior (model yang dirancang, belum aktif)

| Skenario | Perilaku HARI INI (tanpa implementasi) | Perilaku yang DIRENCANAKAN (Option A, setelah payload ada) |
|---|---|---|
| Fresh DB + semua migration | Schema ✓, policy ✓, **baris kosong** (UPDATE no-op diam) — gap reproducibility **masih aktif** | + INSERT 8 baris pasca-guardrail → 8 baris cocok kanonik |
| DB produksi terisi + migration baru dijalankan | n/a | `ON CONFLICT (name) DO NOTHING` → **no-op**, 0 mutasi, 0 duplikat |
| Duplikasi | Dilindungi constraint `name UNIQUE` + conflict clause | idem |
| Ordering | `remote_schema.sql` → … → UPDATE `20260911120000` (no-op di fresh) → [migration INSERT baru] | |

Skema, RLS, FK, API, UI, dan kontrak aplikasi: **tidak berubah** (tidak ada perubahan apa pun di fase ini).

## 5. Test coverage

- **Test yang menambah assert template: TIDAK ditambahkan.** Alasan: assert yang benar membutuhkan payload kanonik yang justu tidak berhasil dipulihkan; assert terhadap "baris ada" tanpa referensi payload akan gagal pada fresh DB yang memang belum diperbaiki, dan assert lewat production DB dilarang. Test yang menjamin seed = canonical baru bisa ditulis bersama implementasi Option A (assert per-nama + properti guardrail terhadap fixture SQL/migration).
- **`e2e/api-smoke-test.mjs` TIDAK dikoreksi** (dilarang campur scope; temuan buta-401 tetap terdokumentasi di Phase 2C §B4). Fase ini tidak boleh dan tidak mengklaim smoke test membuktikan seed.
- **Fresh database diuji sungguhan? TIDAK.** Supabase CLI tersedia (`npx supabase` → `2.117.0`) tetapi **Docker daemon tidak berjalan** (konektor `/var/run/docker.sock` tidak ada) → stack lokal tidak bisa start. Sesuai aturan: tidak memalsukan hasil fresh-DB, tidak query produksi. Keterbatasan ini **tidak menghalangi** keputusan utama — bahkan dengan DB lokal, seed tetap mustahil tanpa payload.
- **Validasi statis:** seluruh analisis §2-§4 berbasis kode/migrasi git (deterministic, tanpa DB).

## 6. Documentation

- **File yang diubah: 1** — laporan ini saja (`PHASE2C2_TEMPLATE_SEED_BLOCKER.md`).
- **`ARCHITECTURE.md`/`README` dsb. TIDAK diubah:** mekanisme seed baru belum ada, jadi tidak ada pernyataan "source of truth baru" yang boleh ditulis (menulisnya akan dusta). Pernyataan SoT yang benar saat ini tetap: **definisi kanonik = baris remote DB; gap tercatat di `PHASE2_SOURCE_OF_TRUTH.md` §7.6 dan `PHASE2C_..._AUDIT.md` §2** — laporan ini menambahkan hasil rekam jejak yang mengkonsolidasikan temuan itu (payload tidak pernah ada di history, bukan hanya "tidak ditemukan saat audit").
- Payload TIDAK diduplikasi ke banyak dokumen (malah tidak dimiliki repo sama sekali — itulah inti blocker).

## 7. Security

- **Database produksi tidak diakses** — nol query SQL/API Supabase; `supabase/.temp/linked-project.json` hanya dibaca sebagai bukti link (metadata ref publik, sudah ada di `.env.example`).
- **Kredensial produksi tidak dipakai/tidak ditambahkan** — tidak ada secret baru; file `.env` tidak disentuh.
- **Perilaku keamanan lain tidak berubah** — RLS, CSRF, route auth, Bitget allowlist, encryption tidak disentuh (diff = 1 file laporan).
- **Tidak ada data sensitif** dalam laporan (tidak ada payload/secret yang bisa bocor karena payload memang tidak ditemukan).

## 8. Regression (baseline)

| Check | Hasil |
|---|---|
| `pytest tests/ -q` | **64 passed** |
| `npm run typecheck` | **exit 0** |
| `npm run build` | **exit 0** |
| `npm run lint` | **9 problems (2 errors, 7 warnings)** — identik baseline |
| Template-specific validation | Statis saja (§5); local Supabase tidak tersedia (Docker down) |

## 9. Diff

```text
git status --short
 M PHASE2C2_TEMPLATE_SEED_BLOCKER.md   (file baru, untracked → hanya muncul setelah add)
?? backtest/reports/bh_drawdown_and_btc_eth_corr.md
?? backtest/reports/bh_max_drawdown.md

git diff --stat   (working tree: nol perubahan tracked — hanya file laporan baru)
git diff --check  → exit 0
```

Diff = **satu file laporan saja**. Tidak ada migrasi, kode, config, test, atau data yang berubah. `bh_*.md` tetap tak tersentuh. Diff tidak memuat secret apa pun (tidak ada secret yang diketahui/dipakai).

## 10. Commit

- **Message (deviasi dari saran, disengaja):** `[Phase 2C-2] template seed audit: blocked — payload unrecoverable`
  - Pesan saran `make strategy templates reproducible` TIDAK dipakai karena **tidak benar** — fase berhenti di blocker; mengklaim "reproducible" dalam commit message akan menyesatkan reviewer & log.
- **SHA:** lihat laporan chat final setelah commit (commit berisi tepat 1 file di atas).
- **Push: TIDAK** (menunggu review owner).

---

## Keputusan yang dibutuhkan owner (unblock path)

1. **Sediakan dump payload kanonik** — jalur legitimate satu-satunya. Owner (bukan agent) menjalankan di database yang berwenang:
   ```sql
   select id, name, description, params_schema
   from public.strategy_templates order by id;
   ```
   Hasilnya = input Phase 2C-3 (implementasi seed Option A + fixture test + verifikasi fresh-DB). *Catatan: agent dilarang menjalankan query ini (aturan "do not query production").*
2. **Setujui Option A** (migration seed baru, `ON CONFLICT (name) DO NOTHING`, payload pasca-guardrail) — atau nyatakan alternatif (B/C) bila owner punya konteks di luar bukti repo.
3. **Putuskan nasib `config.toml` `[db.seed]` yang menggantung** (`sql_paths=["./seed.sql"]`, file tak pernah ada): buat `seed.sql` sebagai mekanisme lokal-paralel, atau hapus config bohong — terpisah dari opsi 1-2.
4. (Opsional, setelah 1) Rapikan anotasi doc yang menyebut "seed" seolah mekanisme sudah ada (`ARCHITECTURE.md:347` menyebut `seed 20260911120000` — itu hanya UPDATE; dan `REPO_MAP.md:497` "kunci guardrail 8 template").
