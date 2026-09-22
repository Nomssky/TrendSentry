# Phase 2C — Security & Reproducibility Audit

> Tanggal: 2026-09-22 · Baseline: `0ca46a7` `[Phase 2B-2] dead-code and dependency audit`
> **Audit-only** — satu-satunya perubahan repo = dokumen ini.
> Tidak ada kredensial diuji, tidak ada layanan eksternal dipanggil memakai kredensial, tidak ada database diubah/di-query, tidak ada migrasi dijalankan, tidak ada push.
> Password tidak pernah dicetak di dokumen ini maupun di riwayat shell perintah pencarian (pencarian git history memakai variabel runtime, output = daftar commit saja).

## Executive Summary

| Finding | Classification | Confidence | Immediate Action |
|---|---|---|---|
| Hardcoded E2E credential (`free-tier-flow.spec.ts:15-16`) | **HIGH** exposure — password literal akun yang menargetkan auth produksi, di repo **PUBLIC**, ada di Git history sejak `fe75486` (2026-09-21) | MEDIUM-HIGH (realitas akun: *apparently real*; validitas/privilese saat ini: **UNKNOWN — external verification required**, tidak diverifikasi di fase ini) | Owner: verifikasi apakah kredensial aktif → **rotate/revoke dulu**, baru keluarkan dari source; ganti dengan env/CI secret |
| `strategy_templates` rows tidak ter-version | **NOT REPRODUCIBLE** (data-level) — schema+RLS reproduktif, baris template tidak; fresh DB = tabel kosong **diam-diam**, semua test tetap lulus | HIGH (bukti repo lengkap); isi remote = **Previously observed remote state** (bukan inspeksi DB fase ini) | Owner pilih opsi seed (§2.8); prioritas arsitektur tertinggi |

---

# PART A — Hardcoded E2E Credential Audit

## Current Code (A1)

`monitoring/web/e2e/free-tier-flow.spec.ts`:

| Line | Content | Jenis |
|---:|---|---|
| 7 | komentar: *"Test ini melakukan LOGIN NYATA — jangan run di CI."* | deklarasi eksplisit bahwa kredensial nyata |
| 15 | `const EMAIL = "<IDENTIFIER>"` — literal email (identifier akun; sudah publik di commit-author workflow, direkam karena diperlukan bukti) | **literal username/email** |
| 16 | `const PASSWORD = "<REDACTED_PASSWORD>"` | **literal password** |
| 17 | `const AUTH_FILE = "e2e/.auth/user.json"` | path storage-state (bukan kredensial) |
| 20-27 | `login(page)` — isi email + password ke form `/auth/login`, assert redirect `/app/dashboard` | konsumen utama |
| 100 | `storageState({ path: AUTH_FILE })` — tulis session cookie hasil login | konsumen turunan |
| 235-236 | login inline kedua (test "login with real credentials succeeds" → kini `login()` dipakai test lain juga) | konsumen |
| ~227-232 | login inline ketiga di "1-week simulation" | konsumen |

- **Mekanisme:** bukan fixture, bukan env var, bukan generated credential — **literal hardcoded** di source test. `grep` seluruh `.env*`: **tidak ada** key `*E2E*`/`*PASSWORD*`/`*EMAIL*` yang cocok.
- **Test lain memakai kredensial sama?** **TIDAK.** `e2e/auth.spec.ts:37-38` memakai dummy salah (`"tidak-ada-@example.com"` / `"salah-salah-123"`); `e2e/api-smoke-test.mjs` tanpa autentikasi sama sekali. Satu-satunya konsumen = `free-tier-flow.spec.ts`.
- **Playwright config:** `monitoring/web/playwright.config.ts` — **tidak** mereferensikan kredensial apa pun; komentarnya menyatakan spec melawan **"DB Supabase produksi"** dan melarang aksi berdampak.
- **Dokumentasi/env:** `.env`, `.env.example`, `monitoring/web/.env*` — tidak mendeskripsikan akun test ini; tidak ada doc README/runbook yang menyebut akun E2E.

## Repository-Wide Evidence (A2)

- **Nilai password di worktree:** **1 file saja** — `free-tier-flow.spec.ts` (pencarian `grep -rl` seluruh worktree, kecuali `.git/venv/node_modules/.next`, output hanya nama file).
- **Identifier email** juga muncul di (bukan sebagai kredensial login, melainkan sebagai **identitas commit git CI**):
  - `.github/workflows/fetch-bitget-data.yml:40` — `git config user.email ...`
  - `.github/workflows/paper-trading.yml:55` — idem
  - (identitas ini sudah publik sebagai author commit di history — `f66a9dd` "[Fase 2] CI commit pakai identitas user").
- **Variabel/auth patterns:** `TEST_USER`/`TEST_EMAIL`/`E2E_*PASS` → 0 di seluruh repo. `AUTH_FILE`/`storageState` hanya di `free-tier-flow.spec.ts:17,100`. `signIn`/`login` helper: hanya dua spec di atas.
- **Supabase auth setup/seed scripts:** tidak ada script pembuat akun test di repo (tidak ada seed untuk `auth.users`).
- **Arsitektur yang terlihat:** login manual sekali → session cookie disimpan ke `.auth/user.json` (kini gitignored, Phase 2B-1) → *tidak pernah dibaca test lain* (temuan 2A/2B-1) — jadi kredensial literal hanya dibutuhkan oleh spec ini sendiri.

## Git History (A3) — REQUIRED, terpenuhi

- `git log --all -- monitoring/web/e2e/free-tier-flow.spec.ts` → **2 commit**:
  1. **`fe75486`** (2026-09-21 14:52 +0700, Kresna) *"test: free tier E2E tests — API smoke + Playwright flow"* — **commit pertama yang berisi kredensial** (`--diff-filter=A` = file dibuat di sini; `git log -S<pwd>` → hanya commit ini yang menambahkan nilai password).
  2. `3a4dae8` (2026-09-21 15:54) *"test: fix Playwright E2E — all 26 tests pass"* — refaktor besar (helper `login()`, BASE via env), **baris `EMAIL`/`PASSWORD` tidak berubah** (md5 baris password identik di `fe75486`, `3a4dae8`, dan worktree sekarang: `0c5a6b5f…`).
- **Ada di `main` sekarang?** **YA** — `fe75486` terverifikasi ancestor of `main` (`git merge-base --is-ancestor`), nilai password ada di worktree saat ini.
- **Riwayat pernah dihapus/diulang?** **TIDAK pernah dihapus** — nilai hanya bertambah sekali (`fe75486`), tidak pernah dikurangi di commit mana pun (`git log -S` over `--all` hanya menghasilkan `fe75486`).
- **Remote publik?** **YA — FACT:** `origin = https://github.com/Nomssky/TrendSentry.git`, `gh repo view` → `visibility: PUBLIC`, `isPrivate: false` (dicek 2026-09-22). Artinya kredensial dapat diakses siapa pun yang membuka history repo (bukan hanya worktree).
- **History rewrite pantas?** TIDAK dilakukan (larangan fase ini) dan **tidak cukup sebagai remediation** — repo publik sudah bisa di-clone/fork/snapshot pihak lain; rewrite mengurangi keterbacaan jalan lama tetapi **tidak menarik kembali kredensial yang sudah tersebar**. (INFERENCE berdasarkan sifat git + repo publik.)

## Credential Reality Assessment (A4)

Bukti repo (**tanpa login/panggil API apa pun**):

- **FACT** header file: *"LOGIN NYATA"* (nyata), dan test diberi nama **"login with real credentials succeeds"** (`fe75486`/sekarang) — penulis sendiri menyatakan ini kredensial nyata.
- **FACT** target: `BASE` default `https://trendsentry.vercelcel.app` (produksi Vercel) + komentar `playwright.config.ts`: *"DB Supabase produksi"*.
- **FACT** pola password: string alfanumerik pendek personal (bukan placeholder seperti `password123`, bukan dummy `salah-salah-123` yang dipakai spec lain untuk kredensial palsu).
- **FACT** email = identitas yang sama dipakai sebagai git author CI & commit owner.
- **INFERENCE** (menguatkan): kontras sengaja antara dummy spec lain vs literal spec ini.

**Klasifikasi: `apparently real/production` menurut bukti repo — TETAPI validitas saat ini (akun masih aktif? password masih berlaku?) dan privilese akun (free-tier user vs pemilik proyek) = `UNKNOWN — external verification required`.** Fase ini **tidak** mencoba login, tidak memanggil API Supabase/Bitget/Stripe memakai kredensial ini.

## Security Impact (A5)

**`HIGH`** — berdasar:

- Ini **password** (bukan API key read-only, bukan token kadaluarsa terlihat) — FACT `:16`.
- **Di-commit** dan ada di **Git history** sejak 2026-09-21 — FACT (`fe75486`, ancestor of main).
- Repo **PUBLIC** — FACT (dicek via `gh`).
- Menargetkan **auth sistem produksi** (Vercel + Supabase produksi) — FACT (URL default + komentar config).
- Pengungkapan berkelanjutan: siapa pun bisa membaca history kapan saja.

Hal yang **tidak diketahui** (dan tidak boleh diasumsikan): apakah password masih aktif (**validasi external belum dilakukan**), dan akun apakah itu (privilege scope tidak ada bukti — bisa saja hanya user free-tier, bisa saja owner proyek). Jika owner mengonfirmasi akun sudah non-aktif/pwd sudah diganti → klasifikasi turun ke `MEDIUM`/`LOW` (sisa: kebiasaan & identifier terekspos). Jika ternyata akun owner/proyek aktif → `HIGH`/`CRITICAL` praktis. **Bukti repo tidak bisa memutuskan ini.**

## Recommended Remediation (A6) — TIDAK diimplementasikan

 jalur sesuai bukti = **"Apparently real/active credential"** (karena bukti repo menunjukkan nyata; status aktif UNKNOWN → perlakukan konservatif):

1. **Owner verifikasi dulu** apakah akun/password masih aktif (external, di luar repo — bukan tugas agent).
2. **Jika aktif: rotate/revoke SEBELUM menghapus dari source** (menghapus tanpa rotasi memberi ilusi aman padahal history publik masih berisi).
3. Keluarkan literal dari `free-tier-flow.spec.ts` → env var (mis. `E2E_EMAIL`/`E2E_PASSWORD`) + dokumentasikan di `.env.example` (comment-only, tanpa nilai) + catatan di header spec; test skip dengan pesan jelas bila env tidak di-set.
4. **Repo publik → pertimbangkan Git-history cleanup** (filter-repo/BFG) **hanya sebagai pelengkap setelah rotasi**; sadari fork/clone/cache pihak ketiga tidak bisa ditarik mundur.
5. Jika ternyata dummy/non-aktif: cukup langkah 3 + dokumentasikan sebagai fixture (jangan berpura-pura rahasia).
6. Catatan terkait (sudah ditangani 2B-1): session cookie hasil login disimpan ke `.auth/user.json` yang kini gitignored.

## Evidence / Files (Part A)

- `monitoring/web/e2e/free-tier-flow.spec.ts:7,15-17,20-27,100,235-236` + login inline simulasi 1-minggu
- `monitoring/web/e2e/auth.spec.ts:37-38` (dummy creds — kontras)
- `monitoring/web/e2e/api-smoke-test.mjs` (tanpa auth)
- `monitoring/web/playwright.config.ts:3-5` (komentar "DB Supabase produksi"; tanpa kredensial)
- `.github/workflows/fetch-bitget-data.yml:40`, `paper-trading.yml:55` (email sbg identitas commit)
- History: `fe75486` (add), `3a4dae8` (modify file, password unchanged); `origin` PUBLIC (gh, 2026-09-22)

---

# PART B — `strategy_templates` Reproducibility Audit

## Schema (B1)

**Sumber:** `supabase/migrations/20260909120000_remote_schema.sql`

| Hal | Bukti | Reproduktif? |
|---|---|---|
| CREATE TABLE | `:26-30` — `id bigint generated always as identity PK`, `name text not null unique`, `description text`, `params_schema jsonb not null` | YA |
| FK | `:38` — `user_strategies.template_id bigint references strategy_templates(id)` (nullable) | YA |
| RLS enable | `:166` | YA |
| Policy | `:183-184` — `strategy_templates_read FOR select TO public USING (true)` (read-only publik di level DB; tulis diblokir policy) | YA |
| Index | hanya implicit PK + `unique(name)` — `grep index\|trigger` di migrations utk tabel ini = **0** | YA |
| Triggers/defaults | **tidak ada** | YA |

**Skema = sepenuhnya reproduktif dari migration.** (FACT — repo.)

## Migration Data (B2)

Semua `INSERT/UPDATE/UPSERT` terhadap tabel (grep seluruh `supabase/migrations/`, 9 file):

1. **`20260911120000_seed_strategy_templates.sql`** — **satu-satunya** migration data:
   - `:4-11` — `UPDATE ... set params_schema = params_schema || ...` (kunci guardrail: `direction=long_only`, `risk 0.1..1.0 default 1.0`, `max_concurrent 1..5 default 5`) **`where name in`** 8 nama: `Donchian Breakout, SMA Crossover, RSI Mean-Reversion, Custom, Bollinger Bands, MACD Crossover, Ichimoku Cloud, VWAP Strategy`.
   - `:3` komentar: ***"(Seed awal 8 template sudah ada — file ini hanya mengencangkan batasnya.)"*** → **migrasi ini MENGASUMSIKAN baris sudah ada**.
2. `20260909120000_remote_schema.sql:26` — CREATE TABLE (bukan data).
3. **`INSERT INTO strategy_templates` di seluruh repo: 0** (grep exit 1; termasuk cek seluruh file SQL di repo — `find *.sql` = migrations + `db/schema.sql` yang terakhir = skema SQLite paper-trading, 0 referensi template).

Jawaban:
1. Migration yang menyentuh tabel: **2 file** (schema + 1 UPDATE).
2. Baris yang diasumsikan sudah ada: **8 baris bernama** (payload `params_schema` lengkap tidak pernah didefinisikan di repo — hanya modifikasi 3 field guardrail).
3. Ada migration yang membuat baris? **TIDAK.**
4. Urutan penting? Ya — UPDATE `:4` bergantung pada keberadaan baris; di DB segar urutan apapun tidak membantu karena **tidak ada tahap pembuat baris**.
5. Berhasil di DB segar? **YA — dan itu masalahnya:** `UPDATE ... where name in (...)` di tabel kosong = **0 baris terpengaruh, tanpa error, tanpa warning** (semantik SQL standar). Migrasi "sukses" menghasilkan tabel kosong. → **bisa diam-diam menghasilkan tabel kosong: YA (FACT mekanisme SQL).**

## Application Usage (B3)

| Referensi | Line | Klasifikasi | Asumsi baris ada? |
|---|---|---|---|
| `app/api/templates/route.ts:13` | `.from("strategy_templates").select("*")` setelah cek auth (`:6-11`, 401 bila tanpa session) | **READ (API)** | mengembalikan `[]` bila kosong — **tidak error** (`data ?? []`, `:16`) |
| `app/app/strategies/new/page.tsx:85,92` | `fetch("/api/templates")` → `setTemplates`; `:95` `.catch(() => setTemplates([]))` | **READ (UI)** | **YA — keras:** render `:132` `templates.map(...)` = 0 kartu; `handleSubmit:112` `if (!selected \|\| !name) return` → **`selected` tidak akan pernah terisi → user TIDAK BISA membuat strategi sama sekali** di DB segar |
| `app/app/strategies/new/page.tsx:116` + `app/api/strategies/route.ts:39,46` | `template_id` dikirim & di-INSERT ke `user_strategies` (FK `:38`) | WRITE ke `user_strategies` (bukan ke template) | FK nullable; insert baru gagal hanya jika `template_id` merujuk id tak ada |
| `lib/validations.ts:17,30-34` | `template_id` zod optional + `GUARDRAILS` konstanta komentar `"selaras ... seed strategy_templates"` | **VALIDATION** (komentar saja, tanpa query DB) | tidak |
| Docs (`ARCHITECTURE.md:347`, `REPO_MAP.md:497`, `PHASE2_*`) | rujukan dokumentasi | DOCS | — |

- **Siapa yang MENCIPTAKAN template?** **Tidak ada kode aplikasi** — tidak ada INSERT/UPDATE/DELETE UI/API terhadap `strategy_templates` (read-only by design: policy `:183` hanya `select`).
- **App berfungsi di DB segar?** Server ya; **alur buat-strategi TIDAK** (lihat guard `:112` — silent, tanpa pesan error, hanya tombol template kosong).
- **API gagal jika tabel kosong?** **TIDAK** — `/api/templates` → `200 []` (dgn auth) / `401` (tanpa auth).
- **UI memakai set template tetap?** Ya — daftar kartu identik isi tabel; 0 baris = 0 pilihan.

## Test / Smoke-Test Usage (B4)

> **Koreksi path:** file berada di **`monitoring/web/e2e/api-smoke-test.mjs`** — *bukan* `monitoring/web/scripts/` (direktori itu tidak ada; diverifikasi `find`).

`testStrategyTemplates()` (`:86-101`):
- Request **tanpa token/cookie/header autentikasi** (grep `Authorization|token|cookie` di file = 0 yang relevan).
- Ekspektasi aktual: **`401 → ok`** (`:92-93`, komentar *"This endpoint requires auth, so 401 is expected without token"*).
- Cabang `200 → data.length > 0` (`:96`) **hanya tercapai kalau endpoint mengembalikan 200**, yang menurut `route.ts:6-11` butuh session — **yang tidak pernah dikirim skrip ini** → dalam praktiknya cabang `fail("empty")` **tidak tercapai baik tabel kosong maupun penuh**.
- **Jalankan sukses terhadap DB segar kosong?** **YA — lulus** (jalur 401). Jadi **klaim Phase 2B-2 §6 bahwa "smoke test gagal" pada DB kosong adalah KELIRU untuk kondisi run tanpa auth saat ini** — koreksi dicatat di sini (2B-2 menyimpulkan dari ekspektasi `length > 0` tanpa memverifikasi cabang auth).

`free-tier-flow.spec.ts:155-165` ("strategy creation page loads with templates"): cek `content.includes("Donchian")` → hanya **`console.log` (`:165`), tanpa `expect`** → **lulus juga** walau template 0 (beda dengan versi `fe75486` yang punya `isVisible().catch` tetapi pun juga tidak assert). → E2E **tidak** menjaga agar baris template ada.

## Seed / Remote-State Evidence (B5)

**Repository evidence (FACT):**
- **Mekanisme seed resmi ada tapi FILE-nya tidak:** `supabase/config.toml:65-70` — `[db.seed] enabled = true`, `sql_paths = ["./seed.sql"]` → **`supabase/seed.sql` TIDAK ADA** (`ls` gagal; `git log --all -- supabase/seed.sql` = kosong → **tidak pernah ada di history pun**). Jadi `supabase db reset` lokal akan merujuk seed file yang tiada berisi apa pun (bila tidak error).
- Tidak ada SQL di luar `supabase/migrations` yang menyentuh tabel (`find *.sql`: 9 migrations + `db/schema.sql` yang terakhir = SQLite paper-trading, 0 referensi).
- Tidak ada script部署/setup/admin yang membuat baris template (grep `insert`+`template` di docs = hanya anotasi "seed sudah ada").
- Tidak ada instruksi runbook manual membuat template (ARCHITECTURE/DESIGN/PLAN/README: 0 instruksi INSERT).

**Previously observed remote state (BUKAN inspeksi fase ini — tidak ada tool koneksi DB yang dipakai; klaim hanya dari dokumen audit sebelumnya):**
- `PHASE2_SOURCE_OF_TRUTH.md:32,220` — "baris 8 template hanya hidup di remote DB".
- `TASKS.md:100` — "guardrail 8 template dikunci" (pekerjaan 2026-09-11).
- Migration comment `:3` — "Seed awal 8 template sudah ada" + commit `bd613b3` subjek "kunci guardrail 8 template watcher".
- → **Kesimpulan: baris dibuat secara manual di masa lalu lewat jalur yang tidak tercatat di repo** (waktu & payload awal tidak direproduksi di mana pun).

## Fresh-Install Reproducibility (B6)

```text
Fresh Supabase
    ↓
Run migrations                        → OK (semua migrasi valid)
    ↓
Schema created?                       → YA  (remote_schema.sql:26)
    ↓
Policies created?                     → YA  (RLS :166 + select-public :183)
    ↓
Template rows created?                → TIDAK ✗  ← TITIK PUTUS REPRODUCIBILITY
    ↓   (UPDATE seed = 0 baris, sukses diam; supabase/seed.sql tidak ada)
Application starts?                   → YA  (server sehat; /api/templates → [] / 401)
    ↓
API smoke test passes?                → YA  (jalur 401 = ok — lulus "buta")
    ↓
User bisa buat strategi?              → TIDAK (page.tsx:112 guard; 0 kartu template)
```

**Klasifikasi: `NOT REPRODUCIBLE`** (untuk data/fungsionalitas; skema & kebijakan sendiri reproducible). Sifat penting: **semua automated test tetap lulus** → gap terdeteksi hanya oleh manusia yang membuka UI.

## Current Source of Truth (B7)

- **De facto canonical saat ini = remote Supabase database** (satu-satunya tempat payload `params_schema` 8 template hidup; repo tidak memilikinya — FACT).
- Kandidat lain sudah tersingkir: migrations (hanya UPDATE), application constants (`validations.ts` = guardrail terbatas, bukan definisi template), file repo lain (0).
- **`DECISION REQUIRED`** — karena sumber kanonik yang berlaku sekarang ada di luar version control: tidak bisa di-review di PR, tidak bisa dipindah ke environment baru, tidak bisa dipulihkan bila remote hilang; dan repo tidak menunjuk mekanisme pembuatnya (seed.sql tiada).

## Remediation Options (B8) — audit only, TANPA ranking "terbaik"

| | **A — Migration seed** | **B — Dedicated seed mechanism** | **C — Application-owned** | **D — Remote existing tetap kanonik** |
|---|---|---|---|---|
| Deskripsi | Migration `INSERT` 8 baris (dump dari remote), idempoten (`on conflict do nothing` by `name`) | Isi `supabase/seed.sql` (sudah dikonfigurasi `config.toml:67` tapi filenya tiada) atau script `supabase db seed`/runbook | Definisi template di kode app (TS/JSON) → disinkronkan ke tabel (seed script atau read-through) | Tidak ada perubahan; remote = kebenihan |
| Reproducibility | Tinggi — reset/proyek baru otomatis identik | Tinggi utk **lokal** (`db reset`); remote staging/prod perlu langkah manual terpisah | Tinggi — kode = sumber, DB hanyalah cache | **Nol** — state hilang = hilang selamanya |
| Deployment complexity | Rendah — ikut alur migrasi biasa | Sedang — perlu dijalankan eksplisit tiap env; mudah lupa di env baru | Sedang-tinggi — perlu mekanisme sinkronisasi (cron/startup/migration hybrid) | Rendah hari ini, mahal saat disaster/re-env |
| Drift risk | Rendah (migrasi sekali jalan) | Sedang — seed bisa dijalankan ulang/berubah → drift vs prod | Rendah bila read-through; sedang bila sync berkala | **Tinggi permanen** — tak terlihat, tak terukur |
| Rollback/versioning | Baik — melekat history migrasi (tapi migration umumnya append-only; ubah template = migration baru) | Sedang — seed tak punya versi bawaan | Baik — diff PR = review versi | Tidak ada versi sama sekali |
| Testing implications | Bisa assert isi tabel di test DB lokal; smoke/E2E bisa disetel ketat | Test tergantung langkah seed dijalankan dulu (gampang "lulus buta" seperti sekarang) | Test paling mudah (data fixture dari kode) | Test selalu bergantung state eksternal tak terjaminkan |

*Pemilihan = keputusan owner/arsitektur (tidak diputuskan di fase ini).*

## Evidence / Files (Part B)

- Schema/RLS/FK: `supabase/migrations/20260909120000_remote_schema.sql:26-30,38,166,183-184`
- Data: `supabase/migrations/20260911120000_seed_strategy_templates.sql:3,4-11` (UPDATE saja; komentar "seed awal sudah ada"); **0 INSERT** di 9 migration + `db/schema.sql`
- Seed config: `supabase/config.toml:65-70` → `./seed.sql` **tidak ada & tak pernah ada** (ls + `git log --all`)
- App: `app/api/templates/route.ts:6-16`; `app/app/strategies/new/page.tsx:85,92,95,112,116,132`; `app/api/strategies/route.ts:39,46`; `lib/validations.ts:17,30-34`
- Tests: `e2e/api-smoke-test.mjs:86-101` (401 path; `length>0` tak tercapai tanpa auth); `e2e/free-tier-flow.spec.ts:155-165` (console.log, tanpa expect)
- Remote-state klaim (dokumen lama, bukan inspeksi): `PHASE2_SOURCE_OF_TRUTH.md:32,220`, `TASKS.md:100`, commit `bd613b3`

---

## 3. Cross-Cutting Findings

1. **Keduanya berakar dari "environment yang dikonfigurasi manual, tak terekam di repo":** kredensial akun nyata di-hardcode **karena** alur E2E bergantung state akun + data produksi yang tak bisa dibuat dari repo — hardcoding menyamarkan dependensi pada environment yang di-setup tangan. (FACT ketergantungan: spec login ke produksi; INFERENCE kausal.)
2. **E2E free-tier memang bergantung baris template remote:** `free-tier-flow.spec.ts:155-165` memuat `/api/templates` (data remote) — **tetapi tidak meng-assert**, jadi ketergantungan itu **tersembunyi**: pada DB segar E2E tetap lulus dengan `Donchian template=false`. Test tak mendeteksi gap reproducibility.
3. **Smoke test memberi kepercayaaan palsu parsial:** jalurnya `401 = ok` — tidak pernah memverifikasi isi tabel; "smoke hijau" ≠ template ada. (FACT jalur kode; INFERENCE implikasi.)
4. **Akun test & data template sama-sama "hanya hidup di remote":** kredensial (akun) dan payload (baris) keduanya tidak dapat direproduksi dari repo → environment baru pasti membutuhkan setup manual diam-diam untuk keduanya.
5. **Tidak ditemukan interaksi lain** (mis. kredensial dipakai untuk membuat template via admin API): tidak ada bukti di repo — **tidak di-assert**.

## 4. Decisions Required

1. **Kredensial E2E** (OWNER, urgensi tertinggi): verifikasi apakah akun/password masih aktif (external — di luar kemampuan & larangan fase ini); lalu putuskan rotate/revoke → env-secret → pertimbangan history-cleanup pada repo publik (§A6).
2. **Bentuk seed `strategy_templates`**: Opsi A/B/C/D (§B8) — keputusan arsitektur; opsi D = menerima gap.
3. **Mekanisme `supabase/seed.sql`** yang terkonfigurasi tapi tiada: buat file (mengisi jalur yang sudah dideklarasikan) atau hapus konfigurasi `[db.seed]` — perlu diselaraskan dengan keputusan #2.
4. **Ekspektasi test:** apakah smoke/E2E harus di-*tighten* agar mendeteksi tabel kosong (mis. cabang auth pada smoke test, atau assert `Donchian` di spec) — perubahan test = fase terpisah (larangan fase ini).
5. (Turunan #1) Jika kredensial dipindah ke env: dokumentasikan var di `.env.example` + keputusan apakah spec boleh tetap auto-login di CI lokal.

## 5. Recommended Next Phases

Diurutkan risiko/dependensi:

1. **Phase 2C-REM-1 — Kredensial remediation** (owner verifikasi dulu; rotate bila aktif → ganti literal dengan env/secret → dokumentasi `.env.example`; opsional history-cleanup menyusul). Butuh konfirmasi owner; satu-satunya temuan bertipe keamanan aktif.
2. **Phase 2C-REM-2 — `strategy_templates` seed** (putuskan Opsi A/B + isi `supabase/seed.sql` atau migration INSERT idempoten dari dump remote; verifikasi di Supabase branch/local stack: `db reset` → 8 baris ada → guard `page.tsx:112` terpenuhi). Menutup `NOT REPRODUCIBLE`.
3. **Phase 2C-REM-3 — Test tightening** (cabang auth smoke test / assert template di E2E) agar gap masa depan terdeteksi otomatis — setelah #2, supaya assert-nya benar.
4. Sisa backlog 2B-2 (lint safe-cleanup, `REPORTS`, `vectorbt`, `requirements-research.txt`, `can_open_position`) — independen, kapanpun.

---

*Fase ini audit-only: tidak ada kode fungsional, test, CI, migrasi, DB, env, metric, atau riset yang diubah; tidak ada kredensial diuji secara eksternal; tidak ada push. Verifikasi: lihat bagian Final Report.*
