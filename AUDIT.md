# Audit Menyeluruh — TrendSentry

Tanggal: 2026-09-21
Cakupan: Python engine (backtest, paper, risk, llm, scripts, CLI), web Next.js (API, lib, auth, UI, CSP), Supabase migrations + RLS, GitHub Actions, deploy scripts/Docker, test suite, git hygiene.
Metode: pembacaan penuh semua file kode + config + skema + test; verifikasi fix audit sebelumnya; `pytest` (64 passed).
Status: **Semua P0/P1/P2/P3 dari audit 2026-09-12 sudah di-fix.** Sisa item manual (dashboard-only) tidak berubah.

Legenda: **P0** = wajib segera (uang/keamanan), **P1** = tinggi, **P2** = sedang, **P3** = rendah/hygiene, **P4** = observasi/baru.

---

## Ringkasan Eksekutif

Proyek ini dalam kondisi sehat. Dari 28 temuan audit sebelumnya (P0-3, P1-7, P2-10, P3-12), **semua sudah di-fix** kecuali 3 item yang memang tidak bisa dikerjakan otomatis (leaked password protection butuh plan Pro, rotasi service role & token Telegram butuh akses dashboard). Test suite 64 test pass, guardrail config aktif, stop-loss wajib, tidak ada martingale, anti look-ahead terverifikasi.

**Posisi saat ini:** Fase 2 (Paper Trading) aktif sejak 2026-08-25 (hari ke-27/56). Menunggu ≥10 trade tertutup sebelum evaluasi Fase 2. Tidak ada alasan untuk skip atau merge gate.

### Yang Sudah Benar (jangan diubah tanpa alasan)

- Stop-loss wajib & tidak ada martingale/averaging-down: `backtest/strategy.py`, `paper_trading/live_signal.py:465`
- Anti look-ahead: Donchian di-`shift(1)`, eksekusi open berikutnya
- Idempotensi candle: `UNIQUE(candle_date,pair)` + cek sebelum insert
- Timing-safe compare dengan guard panjang (cron auth)
- Enkripsi API key AES-GCM + IV acak per nilai
- RLS diaktifkan + event trigger auto-enable untuk tabel baru
- Sizing & stop loss punya unit test; anti-drift test `position_size is strat_size`
- LLM filter sengaja hanya boleh veto/flag, tidak pernah "buy/sell"
- Circuit breaker: pure logic, tanpa I/O, unit-tested, resume manual only
- Config validation diawal semua entry point (paper, backtest, CLI doctor)
- Preset parameter beku terkunci mekanis via test

---

## Verifikasi Fix Audit Sebelumnya (2026-09-12)

### P0 — Semua Fixed ✅

| # | Temuan | Fix | Verifikasi |
|---|--------|-----|------------|
| P0-1 | Cron auth bypass saat CRON_SECRET kosong | Fail-fast 500 sebelum bentuk expected string | `daily-sync:79-83`, `paper-sync:21-25` — diverifikasi |
| P0-2 | RLS profiles bisa dipakai naikkan plan sendiri | Migration `20260912120000_harden_profiles_rls.sql` — SELECT saja | Ter-deploy |
| P0-3 | Bug kas negatif backtest (cost basi) | Cost dihitung ulang setelah clamp: `run_backtest.py:136-138` | `test_backtest_cash.py` regresi test |

### P1 — Semua Fixed ✅

| # | Temuan | Fix |
|---|--------|-----|
| P1-1 | Tidak ada .dockerignore | `.dockerignore` ditambah: secret, node_modules, .next, DB |
| P1-2 | Query ke kolom ghost (exit_price, equity) | daily-sync tidak lagi query kolom tidak ada; dailyTrades dihitung dari DB |
| P1-3 | Webhook Stripe tidak handle renewal + unpaid | `invoice.paid` + `customer.subscription.updated` ditambah; `payment_status=unpaid` ditolak |
| P1-4 | daily-sync auto-attach semua trade ke strategies[0] | Atribusi hanya bila tepat 1 strategi aktif (`soleStrategy`) |
| P1-5 | listUsers tidak paginasi | Loop `listUsers({ page, perPage: 1000 })` sampai habis |
| P1-6 | Klaim "read-only enforced" menyesatkan | Komentar jujur: verifikasi hanya key valid + akses read; user wajib buat key read-only sendiri |
| P1-7 | Secret plaintext di working tree | CRON_SECRET + ENCRYPTION_KEY dirotasi; .gitignore bersih (0 commits ke .env) |

### P2 — Semua Fixed ✅

| # | Temuan | Fix |
|---|--------|-----|
| P2-1 | Guardrail strategi bisa dimanipulasi user | `checkStrategyGuardrails` di POST/PUT: long-only, risk ≤1%, max_concurrent ≤5 |
| P2-2 | /api/events tanpa auth/rate limit/origin | validateOrigin + rate limit 30/menit/IP |
| P2-3 | CSRF allowlist kaku | Konfigurable via env `ALLOWED_ORIGINS` |
| P2-4 | Rate limiter x-forwarded-for bisa dipalsukan | IP dari `x-real-ip`, fallback hop pertama XFF; prune tanpa setInterval |
| P2-5 | PaperSyncSchema cap 2000 sync mati permanen | Sync inkremental via watermark + cap naik ke 5000 |
| P2-6 | backfill_equity drift | Yield log sebagai anchor; rollback drift saat ada yield row |
| P2-7 | ATR & RSI tidak di-seed Wilder benar | Seed eksplisit SMA + rekursi manual; angka referensi di-update |
| P2-8 | Duplikasi sumber angka referensi | Satu sumber: `backtest-reference.json`, dibaca Python + TS |
| P2-9 | Backup AES-CBC tanpa autentikasi | GPG AES-256 + MDC; restore.sh validasi basename + mktemp |
| P2-10 | Session/password hygiene | `signOut({scope:'global'})`; password min 10 + karakter |

### P3 — Semua Fixed ✅

| # | Temuan | Fix |
|---|--------|-----|
| P3-1 | Missing CSP/HSTS | CSP + HSTS di `next.config.ts` |
| P3-2 | account/delete cleanup salah kolom | Loop dihapus; FK cascade menangani |
| P3-3 | /api/templates auth konsisten | Auth dipertahankan (defense-in-depth) |
| P3-4 | position_sizing heuristik arbitrer | Severity turun ke "warning" + teks jujur |
| P3-5 | Discipline score bisa basi | Trigger `trg_recalc_discipline` recompute otomatis |
| P3-6 | DB di git | Accepted risk (backup off-disk, bukan secret) |
| P3-7 | ApiKeyPostSchema tanpa batas | `max(256)` ditambah |
| P3-8 | Fallback IP "unknown" tanpa log | Log peringatan eksplisit |
| P3-9 | log_slippage tumbuh cepat | Dedupe 1/pair/hari |
| P3-10 | fetch_bitget_data gap candle | Deteksi gap + duplikat eksplisit |
| P3-11 | config.yaml max_concurrent menyesatkan | Komentar diperjelas (maks riil 3) |
| P3-12 | Tidak ada typecheck/lint | `typecheck` + `lint` di package.json |

---

## Temuan Baru (P4) — Observasi & Hygiene

### P4-1. live_signal.py belum pakai CircuitBreaker (observasi)
- **Lokasi:** `paper_trading/live_signal.py:310` (main loop)
- **Status:** `CircuitBreaker` sudah diimplementasi di `risk_manager/guards.py` dan sudah di-import di `live_signal.py` (via `validate_config`), tapi **tidak di-integrasikan ke main loop** sebagai check setiap run.
- **Dampak:** Circuit breaker 15% tidak auto-pause paper trading saat drawdown. Ini **disengaja** berdasarkan keputusan 2026-09-10 di PLAN.md: "Proteksi realtime (exchange-side stop order + circuit breaker) disyaratkan sebagai syarat masuk Fase 4, bukan dibangun di paper."
- **Verdict:** Bukan bug. Sesuai design. Circuit breaker akan di-integrasikan di Fase 4.

### P4-2. ~~.gitignore punya duplikat pattern~~ ✅ FIXED
- **Fix:** Hapus baris 33-34 (commit `52a52f0`).

### P4-3. ~~conftest.py kosong~~ ✅ FIXED
- **Fix:** Dihapus (commit `52a52f0`).

### P4-4. deploy/docker-compose.yml tidak punya .env.example (P3)
- **Lokasi:** `deploy/docker-compose.yml` membutuhkan 10 env vars tapi tidak ada template.
- **Dampak:** Deploy manual butuh baca docker-compose.yml untuk tahu env apa yang dibutuhkan.
- **Fix:** Buat `deploy/.env.example` dengan placeholder.

### P4-5. ~~Backtest metrics sedikit berbeda dari TASKS.md~~ ✅ FIXED
- **Fix:** Update referensi di TASKS.md (commit `52a52f0`).

### P4-6. live_signal.py 595 baris — border-file (observasi)
- File terpanjang di proyek. Logic utama (entry, exit, live_stop, yield, backfill, snapshot) semuanya di satu file.
- **Dampak:** Readable karena alurnya linear (satu fungsi main), tapi kalau bertambah fitur (Fase 3/4), worth splitting.
- **Verdict:** Bukan masalah sekarang. Revisit saat Fase 3/4.

### P4-7. In-memory rate limiter di serverless (P3 diketahui)
- **Lokasi:** `monitoring/web/lib/rate-limit.ts`
- **Keterbatasan:** Map per-instance; tidak persist lintas cold start. Sudah didokumentasikan di komentar file.
- **Dampak:** Rate limit bisa bypass setelah cold start. Untuk pertahanan sejati pakai Vercel WAF.
- **Verdict:** Acceptable. Sudah diketahui dan didokumentasikan.

### P4-8. test_live_signal.py monkey-patching (nit)
- **Lokasi:** `tests/test_live_signal.py:66-72` — patching `ls.DB_PATH`, `ls.send_alert`, `ls.make_exchange` langsung di module global.
- **Dampak:** Fungsi. Tapi fragile kalau refactor import structure. Pertimbangkan dependency injection di versi mendatang.

---

## Re-Audit Web Frontend (2026-09-21, sesi kedua)

Cakupan: semua file TSX/TS di `monitoring/web/` (70+ file), termasuk komponen React, API routes, lib, CSS, proxy, e2e test.

### P0 — Fixed ✅

| # | Temuan | Lokasi | Fix |
|---|--------|--------|-----|
| W-0 | Dashboard query kolom tidak ada: `pnl`, `r_multiple`, `exit_price` di `user_trades` — stats selalu 0/null | `app/app/dashboard/page.tsx:14` | Ganti dengan Total Fills + Deviations Detected (commit `1daf764`) |

### P1 — Fixed ✅

| # | Temuan | Lokasi | Fix |
|---|--------|--------|-----|
| W-1 | Render-phase setState di AppSidebar (React anti-pattern) | `app/app/AppSidebar.tsx:21-24` | `useEffect(() => setOpen(false), [pathname])` (commit `1daf764`) |
| W-2 | Render-phase setState di strategies/new (sama) | `app/app/strategies/new/page.tsx:103-112` | `useEffect` untuk default params (commit `be0e271`) |
| W-3 | Sharpe ratio O(n²): mean di-recompute di inner loop | `app/papertrading/page.tsx:45-48` | Pre-compute mean, single-pass variance (commit `1daf764`) |
| W-4 | Max drawdown O(n²): `Math.max` diulang tiap slice | `app/papertrading/page.tsx:50-54` | Single-pass running peak (commit `1daf764`) |

### P2 — Fixed ✅

| # | Temuan | Lokasi | Fix |
|---|--------|--------|-----|
| W-5 | Password success message tidak pernah hijau: exact match vs actual message | `app/app/settings/page.tsx:135` | `.startsWith()` check (commit `be0e271`) |
| W-6 | Disclaimer hardcoded `+149.59%` (stale dari P2-7) | `app/disclaimer/page.tsx:25` | Ganti `+152%` (commit `be0e271`) |
| W-7 | TASKS.md backtest numbers stale (P2-7 Wilder seed) | `TASKS.md:27,33` | Update angka (commit `52a52f0`) |
| W-8 | `.gitignore` duplikat pattern override exceptions | `.gitignore:33-34` | Hapus duplikat (commit `52a52f0`) |
| W-9 | `conftest.py` kosong 0 baris | `/conftest.py` | Dihapus (commit `52a52f0`) |

### Observasi (bukan bug)

| # | Temuan | Catatan |
|---|--------|---------|
| W-10 | Pricing page seluruhnya `"use client"` | Bisa dioptimasi jadi server + client islands. Bukan bug, hanya performance. |
| W-11 | `/papertrading` tidak di-proxy middleware | By design — data publik pakai admin client. |
| W-12 | `fmt()` pakai `toLocaleString` | Locale-dependent, tapi acceptable untuk display. |
| W-13 | Proxy file benar: `proxy.ts` (Next.js 16 convention) | Middleware deprecated → renamed to proxy. Sudah sesuai docs. |

### Tidak ditemukan (verifikasi negatif)

- ❌ Tidak ada hardcoded stale numbers yang tersisa (sudah bersih)
- ❌ Tidak ada render-phase setState lain yang tersisa
- ❌ Tidak ada query ke kolom tidak ada yang tersisa
- ❌ Tidak ada security hole baru (CSRF, RLS, auth — semua solid)
- ❌ TypeScript check: **0 errors**
- ❌ Next.js build: **success**
- ❌ Python tests: **64 passed**

---

## Kesehatan Test Suite

```
64 passed in 10.13s
```

Coverage area kritis:
- ✅ Position sizing (termasuk clamp equity, invalid stop)
- ✅ ATR Wilder seed + rekursi
- ✅ Donchian anti look-ahead
- ✅ SMA entry/exit (golden/dead cross + rezim filter)
- ✅ RSI Wilder seed + entry/exit
- ✅ Cluster limit (same, different, mixed)
- ✅ Circuit breaker (trip, sticky, reset, baseline baru)
- ✅ Config validation (semua parameter boundary)
- ✅ Backtest cash tidak negatif (regresi P0-3)
- ✅ Live signal end-to-end (enter, exit, gap stop, idempotent, yield)
- ✅ Equity snapshot (no double-count yield, upsert same day)
- ✅ Equity backfill (reconstruct history)
- ✅ Compare gate (locked <10, pass, flag win rate/avg R/slippage)
- ✅ LLM filter contract (skeleton pass, verdict sempit)
- ✅ Preset guardrails + parameter beku
- ✅ CLI (help, doctor, watcher, live refusal)

---

## Git Hygiene

- ✅ `.env` tidak pernah ter-commit (0 commits di git history)
- ✅ Commit messages deskriptif (format: `[Fase X]` atau `[scope]`)
- ✅ `.gitignore` menutupi: venv, __pycache__, .env*, node_modules, .next, db/*.db, db/backups
- ✅ Branch kerja: bersih, tidak ada long-lived branches
- ⚠️ `db/paper_trading.db` di-commit (accepted risk — backup off-disk)

---

## Prioritas Perbaikan (Jika Dikerjakan)

| Urutan | Item | Alasan | Effort | Status |
|--------|------|--------|--------|--------|
| 1 | ~~P4-5 Update referensi di TASKS.md~~ | ~~Inkonsistensi angka backtest vs aktual~~ | ~~1 menit~~ | ✅ Done |
| 2 | ~~P4-2 Bersihkan .gitignore duplikat~~ | ~~Hygiene~~ | ~~1 menit~~ | ✅ Done |
| 3 | ~~P4-3 Hapus conftest.py kosong~~ | ~~Hygiene~~ | ~~1 menit~~ | ✅ Done |
| 4 | P4-4 Buat deploy/.env.example | Deploy experience | 5 menit | |
| 5 | P3-6 Rotasi service role (manual) | Higiene kredensial (opsional) | 15 menit | |
| 6 | P3-6 Rotasi token Telegram (manual) | Higiene kredensial (opsional) | 10 menit | |

---

## Catatan Verifikasi

- `pytest tests/ -q` → **64 passed** (naik dari 54 di audit lama — 10 test baru: SMA, RSI, cluster, risk, presets, compare, filter, CLI)
- Supabase security advisor: 1 warning (Leaked Password Protection disabled — butuh Pro plan)
- Tidak ditemukan secret di git history
- Semua P0/P1/P2/P3 audit lama sudah di-fix dan terverifikasi
