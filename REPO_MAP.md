# REPO_MAP.md — Peta Repository TrendSentry (Phase 0: Repository Reconstruction)

> **Status dokumen: AUDIT ARTIFACT.** Dokumen ini BUKAN pengganti `PLAN.md`.
> Ditulis dari **kode aktual di HEAD** (`3a4dae8`), bukan dari dokumentasi lama.
> Metode: pembacaan penuh semua source/config/skema/workflow, reference search lintas repo,
> eksekusi `pytest` (64 passed), `tsc --noEmit` (exit 0), `eslint` (exit 1: 2 error),
> `next build` (exit 0), query SQLite `db/paper_trading.db`.
> **Tidak ada file yang dihapus, tidak ada kode yang diubah, tidak ada perilaku runtime yang diubah
> dalam phase ini.** Setiap klaim dokumen lama diverifikasi terhadap kode sebelum dilaporkan.

---

## 1. Executive Summary

Repo ini berisi **dua sistem yang hidup berdampingan** dalam satu repository:

1. **Trading engine (Python)** — backtest + paper trading harian untuk dogfood Cluster-A2.
   Dijalankan sekali sehari oleh GitHub Actions, state-nya SQLite `db/paper_trading.db`
   yang di-commit balik ke repo.
2. **Produk SaaS (Next.js + Supabase)** — aplikasi disiplin trading untuk user:
   auth, simpan strategi, simpan API key read-only terenkripsi, ingest fill harian dari Bitget,
   deteksi deviasi, discipline score, dan dashboard marketing/app. Runtime penuh di Vercel
   (server components + API routes), data di Supabase Postgres.

Temuan utama:

- **Kedua sistem sudah jauh melampaui dokumentasi.** `README.md`, `PLAN.md` §4/§8,
  `TASKS.md`, `AGENTS.md`, dan `monitoring/web/README.md` masih menggambarkan web sebagai
  *"Next.js static export yang membaca SQLite saat build"* — kode aktual adalah
  **SSR dinamis + Supabase runtime** (semua route penting `ƒ dynamic`, `output: export`
  tidak pernah di-set, folder `out/` tidak ada). Lihat §12.
- **Ada DUA keluarga angka metrik backtest yang hidup berdapan-pangan** dan keduanya dikutip
  di dokumen/dokumen publik: `backtest/reports/metrics.md` (+149.59%, DD −26.19%, avg win
  +4.31R, PF 2.26) vs `monitoring/web/lib/backtest-reference.json` (+152.0, DD −26.45,
  avg win +4.35R, PF 2.27). Disclaimer publik bahkan **mencampur keduanya dalam satu halaman**.
  Lihat §16.
- **Dead-code kandidat High-confidence: 1 file** —
  `monitoring/web/app/app/dashboard/EquityCurveChart.tsx` (tidak punya satu pun importer).
- **Kontradiksi dokumentasi terverifikasi: 28 butir** (dihitung per klaim di §12, tersebar di
  9 sub-bagian), termasuk Node.js-vs-Python untuk
  Fase 4, path migrasi yang salah, nama file yang tidak ada, klaim WebSocket yang tidak ada.
- **Test**: 64 Python test (semua pass), 34 Playwright E2E + 1 API smoke script.
  Typecheck bersih; **lint gagal dengan 2 error** (`react-hooks/set-state-in-effect`) —
  berbeda dari kesan "sudah bersih" di `AUDIT.md`.
- **Tidak ada kode order/live execution di repo** — terverifikasi: `execution/` tidak ada,
  `validate_config` menolak `mode=live`, `cli.py live` tanpa `--dry-run` ditolak,
  `lib/bitget.ts` hanya punya allowlist endpoint READ.
- **Tidak ada file yang aman untuk dihapus sekarang tanpa keputusan owner** kecuali
  EquityCurveChart (lihat §17 untuk urutan cleanup yang disarankan).

Angka audit:

| Metrik | Nilai |
|---|---|
| File di-repo (di-track + untracked, di luar venv/node_modules/.git) | 201 |
| File di-track di git | 198 |
| Baris inventory di dokumen ini (§10) | 150 baris — mencakup seluruh 201 file; file serupa (mis. 13 CSV data) dikelompokkan jadi satu baris |
| File Python sumber (non-test) | 19 |
| File Python test | 8 (64 test) |
| File TS/TSX | 72 (37 `.ts` + 35 `.tsx`) |
| File test E2E | 34 test Playwright + 1 smoke script `.mjs` |
| Python test | **64 passed** (9.70s) |
| Web typecheck | **exit 0** |
| Web lint | **exit 1 — 2 error, 7 warning** |
| Web build | **exit 0** |

---

## 2. Current Repository Structure

Struktur aktual (HEAD), bukan struktur usulan di `PLAN.md` §4:

```
.
├── README.md PLAN.md AGENTS.md RULES.md TASKS.md AUDIT.md SECURITY-ACTIONS.md
├── REPO_MAP.md                  ← dokumen ini (baru, Phase 0)
├── cli.py                       # CLI lokal: backtest|paper|live --dry-run|watcher|doctor
├── config.yaml                  # SOURCE OF TRUTH parameter strategi + risk + paper + execution
├── requirements.txt             # dep full (termasuk vectorbt yang tidak pernah dipakai)
├── requirements-engine.txt      # dep ramping utk image Docker engine
├── backtest/
│   ├── strategy.py              # Donchian/ATR/SMA/RSI + position_size + cluster limit
│   ├── run_backtest.py          # portfolio sim + metrics + report writer
│   ├── DESIGN.md                # desain backtest (beberapa angka stale)
│   ├── research/                # 7 script riset (tidak masuk CI/runtime)
│   └── reports/                 # metrics.md, decision_log.md, presets/, research/
├── paper_trading/
│   └── live_signal.py           # engine paper harian (file terpanjang: 595 baris)
├── risk_manager/
│   └── guards.py                # validate_config + CircuitBreaker + re-export position_size
├── llm_filter/
│   └── filter.py                # kontrak filter Fase 3 (skeleton, disabled)
├── monitoring/
│   ├── telegram_alert.py        # alert Telegram (Python, dipakai engine)
│   └── web/                     # Next.js 16 app (produk SaaS + dashboard publik)
│       ├── app/                 # routes: marketing, /app (auth), /auth, /api (14 route)
│       ├── lib/                 # supabase, deviation, encryption, bitget, validations, dll
│       ├── e2e/                 # Playwright specs + API smoke + .auth/ (untracked)
│       ├── proxy.ts             # middleware Next 16 (gate /app & /auth)
│       └── package.json tsconfig next.config playwright eslint postcss README AGENTS
├── scripts/
│   ├── fetch_bitget_data.py     # OHLCV historis Bitget → data/historical/
│   ├── sync_paper_to_supabase.py# SQLite → POST /api/cron/paper-sync (inkremental)
│   └── compare_live_vs_backtest.py # gate evaluasi Fase 2 (locked <10 trade)
├── presets/                     # 3 preset beku (donchian/sma/rsi) + gate status
├── db/
│   ├── schema.sql               # DDL SQLite (dijalankan tiap start engine)
│   ├── paper_trading.db         # state runtime — DI-COMMIT ke git (accepted risk)
│   ├── backup_db.sh             # backup lokal (cron lokal sudah dibatalkan)
│   └── backups/                 # ignored lokal
├── supabase/
│   ├── config.toml              # config Supabase CLI (local dev)
│   └── migrations/              # 9 file .sql — SOURCE OF TRUTH skema Postgres
├── deploy/                      # persiapan VPS/Coolify (belum pernah dibuild — RUNBOOK)
├── .github/workflows/           # 4 workflow: paper-trading, daily-sync, fetch-data, test-api
├── data/
│   ├── historical/              # 13 CSV OHLCV (10 pair config + BCH/LTC/PAXG sisa riset)
│   └── funding/                 # 2 CSV funding (riset long-short)
└── tests/                       # 8 file pytest
```

Tidak ada: `execution/`, `llm_filter/deepseek_client.py`, `llm_filter/prompts/`,
`risk_manager/position_sizing.py`, `monitoring/telegram_bot.py`, `backtest/fetch_data.py`,
`db/migrations/`, `conftest.py`, `monitoring/web/out/` — semuanya pernah disebut dokumentasi
(§12) tetapi **tidak ada di kode**.

---

## 3. Actual Architecture

```
┌─────────────────────────────── PYTHON (engine, dijalankan CI harian) ──────────────────────────────┐
│  Bitget public API (ccxt)                                                                       │
│      → paper_trading/live_signal.py                                                               │
│          → risk_manager.validate_config (guardrail startup)                                       │
│          → backtest/strategy.py (Donchian/ATR/position_size/cluster — dipakai BERSAMA backtest)   │
│          → llm_filter.filter.evaluate (HANYA jika llm_filter.enabled=true — saat ini false)      │
│          → SQLite db/paper_trading.db (signals, positions, slippage_log, yield_log, equity_log)   │
│          → monitoring/telegram_alert.py (ENTER/EXIT/STOP/CRASH)                                  │
│      → scripts/sync_paper_to_supabase.py ──POST + Bearer CRON_SECRET──┐                          │
│      → git commit db/paper_trading.db (persist state + backup)        │                          │
└───────────────────────────────────────────────────────────────────────┼──────────────────────────┘
                                                                        │
┌──────────────────────── NODE/TS (Next.js 16, Vercel) ─────────────────┼──────────────────────────┐
│  Browser ── proxy.ts (auth gate /app, /auth) ── server components     │                          │
│          ├── /api/* (14 route: trades, strategies, api-keys,           ▼                          │
│          │    cron/paper-sync ◄───────────────────────────────  Supabase Postgres                 │
│          │    cron/daily-sync, checkout, webhooks/stripe, ...)   paper_* (mirror engine)          │
│          └── lib/ (deviation, guardrails, encryption, bitget read-only) user_* (produk disiplin)  │
│                                                                 profiles, strategy_templates,     │
│                                                                 deviation_log, discipline_scores │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
   GitHub Actions trendsentry-daily-sync.yml ──GET /api/cron/daily-sync──► ingest fill Bitget user
                                                                          → deviasi → discipline score
```

Prinsip batas yang **terverifikasi di kode** (bukan dari dokumen):

- **Web tidak punya jalur order.** `lib/bitget.ts` hanya mendefinisikan
  `USER_KEY_READ_ENDPOINTS` (assets + fills) dengan komentar larangan menambah endpoint order.
  Tidak ada `createOrder`/`submitOrder` di seluruh `monitoring/web/`.
- **Engine tidak menyimpan key user.** `live_signal.py` memakai client publik ccxt tanpa API key.
- **Live execution tidak ada.** `guards.validate_config` melempar error bila `execution.mode == "live"`;
  `cli.py cmd_live` menolak tanpa `--dry-run`.
- **Frontend read-only terhadap trading logic** (AGENTS.md #9): file TSX tidak menyentuh
  signal/entry/exit/risk/DB schema. Catatan: batas ini berlaku untuk *file frontend* —
  route API Next.js memang backend produk disiplin (lihat §7).

---

## 4. Backtest Flow

Aktual, ditelusuri dari kode (`backtest/run_backtest.py` + `backtest/strategy.py`):

1. **Market data** — `data/historical/{PAIR}_1d.csv` dibaca `load_ohlcv()`.
   Sumber CSV: `scripts/fetch_bitget_data.py` (Bitget, paginasi manual, deteksi gap + dedupe),
   dipicu manual lewat `.github/workflows/fetch-bitget-data.yml` (workflow_dispatch).
   CSV yang dikonsumsi = 10 pair di `config.yaml` (BCH/LTC/PAXG di folder yang sama tidak dibaca).
2. **Config** — `load_config()` membaca `config.yaml`, lalu **overlay `PRESET` env** bila diset
   (`presets/*.yaml` menimpa `strategy.params`, `strategy.pairs`, `risk`) → parameter preset beku.
   `risk_manager.validate_config` tidak dipanggil di jalur ini (hanya paper/CLI doctor) —
   *catatan: backtest runner memvalidasi parameter tidak seketat paper.*
3. **Strategy** — indikator dihitung di `load_ohlcv` via `strategy.py`:
   `atr` (Wilder seed eksplisit), `donchian_high/low` (`.shift(1)` anti look-ahead),
   atau `sma`/`rsi` bila model preset.
4. **Position sizing** — `strategy.position_size(equity, entry, stop, risk_pct)`:
   risk 1% ÷ stop distance, di-clamp ke `equity/entry` (spot, tanpa leverage),
   `ValueError` kalau stop ≥ entry (SL wajib).
5. **Portfolio simulation** — `run_backtest()`: loop tanggal × pair; eksekusi entry di
   **open hari berikutnya** setelah sinyal close; exit pada `close ≤ stop` / sinyal exit model /
   `open ≤ stop` (gap stop); fee 0.1% + slippage 0.05%; clamp cash (regresi P0-3);
   batas `max_concurrent_positions` + `max_positions_per_cluster` via `cluster_position_count`.
6. **Trades** — daftar trade dengan `pnl`, `r_multiple` (pnl ÷ risk_amount), `exit_reason`
   (`stop_loss` | `donchian_exit`| `gap_stop` | `sma_*` | `rsi_*`).
7. **Metrics** — `compute_metrics()`: return, CAGR, Sharpe/Sortino (√365, rf=0), max DD
   peak-to-trough, win rate, avg R, PF, buy-and-hold equal-weight.
8. **Reports** — `save_report()` → `backtest/reports/` (atau `REPORT_SUBDIR`):
   `equity_curve.csv`, `trades.csv`, `equity_drawdown.png`, `metrics.md`.

Titik masuk: `python backtest/run_backtest.py` / `cli.py backtest` /
`PRESET=presets/x.yaml python backtest/run_backtest.py`.
**Tidak dijalankan CI mana pun secara terjadwal** — hanya manual/eksperimen.

Alur riset paralel (di luar engine): `backtest/research/*.py` memanggil
`run_backtest.run_backtest/compute_metrics/load_ohlcv` lewat `sys.path.insert`
(reuse kode, tidak mengubah engine) → menulis ke `backtest/reports/research/` atau
`backtest/reports/*_experiment.md`.

---

## 5. Paper Trading Flow

Aktual, ditelusuri dari `.github/workflows/paper-trading.yml` + `paper_trading/live_signal.py`:

```
GitHub Actions cron 0 1 * * * UTC
 → checkout → pip install (ccxt pandas pyyaml pytest rich)
 → python -m pytest tests/ -v            # run mati bila test merah (guard gate)
 → python paper_trading/live_signal.py
     1. load config.yaml → validate_config (gagal → alert + exit 1)
     2. load .env → cek TELEGRAM_BOT_TOKEN/CHAT_ID (warning bila kosong)
     3. connect SQLite (WAL) + executescript db/schema.sql (CREATE IF NOT EXISTS)
     4. LIVE STOP CHECK: semua posisi open vs fetch_ticker Bitget → exit bila ≤ stop
     5. per pair (10): fetch_ohlcv 1d (limit 60, retry 3×)
        - proses HANYA candle closed terakhir (anti stale-chase; gap = indikator downtime)
        - idempoten: UNIQUE(candle_date,pair) dicek sebelum insert
        - log slippage (order book, dedupe 1/pair/hari)
        - cek exit: close≤stop | close<don_lo(10) | live≤stop | open≤stop (gap)
        - cek entry: close>don_hi(20) AND n_open<max AND cluster_count<2
            → LLM filter (hanya bila llm_filter.enabled; saat ini FALSE → dilewati)
            → position_size → INSERT positions → set_cash → alert ENTER
        - INSERT signals (HOLD pun dicatat)
     6. credit_yield (5% APY, idempotent per tanggal, backfill hari bolong)
     7. meta.lastRun = now
     8. snapshot_equity (total = cash + MTM, upsert per hari) + backfill_equity
 → python scripts/sync_paper_to_supabase.py
     POST {signals, positions, equity_log, slippage_log, yield_log, meta}
     → https://trendsentry.vercel.app/api/cron/paper-sync (Bearer CRON_SECRET)
     → route memvalidasi PaperSyncSchema → upsert ke tabel paper_* di Supabase
     → watermark sync_state dimaju HANYA setelah HTTP 200
 → git pull --rebase && git add -f db/paper_trading.db && git commit && git push
     (= persistensi antar-run + backup off-disk harian)
 → if failure(): curl Telegram "[paper-trading] workflow FAILED"
```

Karakteristik yang diverifikasi langsung dari DB lokal:

| Isi `db/paper_trading.db` (working tree) | Nilai |
|---|---|
| Rentang candle | 2026-08-24 .. 2026-09-20 |
| `signals` | 235 baris (10 pair × 23.5 hari, HOLD ikut tercatat) |
| `positions` | 6 (3 open, 3 closed) |
| `slippage_log` | 235 sampel, avg spread **0.0124%** |
| `equity_log` / `yield_log` | 29 hari / 27 hari |
| `paper_cash` | 723.00 USD |

**Perbedaan vs klaim dokumentasi:** `TASKS.md` menyebut "125 sampel avg 0.011%" dan
"sekarang 1/10" trade — aktual 235 sampel dan 3 trade tertutup (§12, butir 14).

---

## 6. Web / Backend Flow

Semua di `monitoring/web/app/api/**/route.ts` (14 route), Next.js 16 di Vercel:

| Route | Method | Auth | Fungsi aktual |
|---|---|---|---|
| `/api/cron/paper-sync` | POST | Bearer CRON_SECRET (timing-safe, fail-fast 500 bila secret kosong) | Terima payload SQLite → upsert `paper_signals` (onConflict `candle_date,pair`), `paper_positions` (`id`), `paper_equity_log` (`date`), `paper_slippage_log`, `paper_yield_log`, `paper_meta` |
| `/api/cron/daily-sync` | GET | Bearer CRON_SECRET (timing-safe) | `listUsers` berpaginasi → ambil `user_api_keys` → decrypt (AES-GCM) → fetch fills Bitget per pair → dedupe → insert `user_trades` → atribusi strategi **hanya bila tepat 1 strategi aktif** → `checkDeviation` → `deviation_log` → `calculateDisciplineScore` |
| `/api/trades` | GET/POST | session + CSRF | baca/tulis fill user → deviation check + Telegram alert + recompute skor |
| `/api/strategies` | GET/POST/PUT/DELETE | session + CSRF + `checkStrategyGuardrails` | CRUD `user_strategies`; guardrail: long_only, risk ≤1%, max_concurrent ≤5 |
| `/api/api-keys` | GET/POST | session + CSRF | POST: `verifySpotReadAccess` (endpoint read Bitget) → encrypt AES-GCM → `user_api_keys` |
| `/api/deviation-log` | GET | session | paginasi `deviation_log` |
| `/api/discipline` | GET | session | paginasi `discipline_scores` |
| `/api/templates` | GET | session (defense-in-depth) | `strategy_templates` |
| `/api/prices` | GET | rate limit 60/mnt/IP | proxy ticker Bitget, cache 30s (dipoll browser tiap 3s) |
| `/api/events` | POST | CSRF + rate limit 30/mnt/IP | beacon analitik → `analytics_events` |
| `/api/checkout` | POST | session + CSRF | Stripe Checkout — **gated**: hanya `paper_beta` + `PAYMENTS_ENABLED=true`, selain itu 403 |
| `/api/webhooks/stripe` | POST | signature Stripe | checkout/invoice.paid/subscription.updated/deleted → `profiles.plan` + `plan_expires_at` |
| `/api/account/password` | POST | session + reauth password | ganti password + `signOut({scope:'global'})` |
| `/api/account/delete` | POST | session + reauth password | `deleteUser` → FK cascade membersihkan tabel user |

Middleware: `proxy.ts` (konvensi Next 16, menggantikan middleware) — redirect ke
`/auth/login` untuk `/app/*` tanpa user, ke `/app/dashboard` untuk `/auth/*` saat sudah login.

Layer lib backend: `supabase/{server,client,admin}.ts` (cookie client / browser client /
service-role admin), `csrf.ts` (origin allowlist via `ALLOWED_ORIGINS`), `rate-limit.ts`
(in-memory per-instance — keterbatasan terdokumentasi), `encryption.ts` (AES-GCM,
PBKDF2 100k + legacy raw key), `bitget.ts` (HMAC + allowlist read-only),
`deviation.ts` (rule engine + skor), `validations.ts` (zod + `GUARDRAILS`).

---

## 7. Web / Frontend Flow

**Publik (marketing):**
```
Browser → proxy (tidak kena matcher) → app/layout.tsx (+ AnalyticsBeacon)
→ SiteShell (server component: getUser → Nav isLoggedIn) → halaman:
   / (Hero, ProofStrip, BentoFeatures, Methodology, PricingTeaser)
   /start /proof /live /pricing (+CheckoutButton) /disclaimer /papertrading /papertrading/log
→ data Supabase admin client (paper_*) saat request (force-dynamic)
→ UI (Recharts di PaperLiveBoard: EquityChart + LiveSection → poll /api/prices tiap 3s)
```

**Aplikasi user (auth):**
```
/auth/signup | /auth/login (client, supabase-js) → /auth/callback (verifyOtp token_hash | exchangeCode)
→ /app/* (server components dengan session cookie + RLS)
   /app/dashboard      : discipline score, deviation, strategi, fills, checklist onboarding
                         + ScoreTrendChart (equity curve TIDAK ditampilkan di sini)
   /app/strategies     : daftar; /app/strategies/new : render params_schema dari template
   /app/deviation-log  : log deviasi paginasi
   /app/settings       : submit API key Bitget read-only (client-side), ganti password, hapus akun
   layout /app         : auth check + AppSidebar
```

Catatan implementasi: semua route `ƒ` (dynamic) kecuali `/_not-found` — **tidak ada static export**.
`/papertrading` sengaja tidak di-proxy (data publik, pakai admin client).

---

## 8. Database Flow

**Dua store, dua domain, satu jalur sinkronisasi terarah:**

### A. SQLite `db/paper_trading.db` (domain: engine dogfood)
- DDL: `db/schema.sql`, dieksekusi otomatis tiap start engine (`CREATE IF NOT EXISTS`).
- Tabel: `meta` (paper_cash, lastRun, last_yield_date), `signals` (UNIQUE candle_date,pair =
  idempotency), `positions`, `slippage_log`, `yield_log` (UNIQUE date), `equity_log`
  (PK date, total = cash + MTM), `sync_state` (watermark sinkron).
- Penulis: hanya `paper_trading/live_signal.py`. Pembaca: engine, `cli.py watcher`,
  `scripts/compare_live_vs_backtest.py`, `scripts/sync_paper_to_supabase.py`.
- Persistensi: di-commit ke git tiap run (accepted risk, tercatat di AUDIT.md P3-6).

### B. Supabase Postgres (domain: produk user + mirror paper)
- **Source of truth skema: `supabase/migrations/*.sql` (9 file)**, bukan `db/migrations/`
  (yang disebut AGENTS.md tidak ada).
- Tabel user: `profiles`, `strategy_templates`, `user_strategies`, `user_api_keys`,
  `user_trades` (log fill — TIDAK punya kolom pnl/exit_price), `deviation_log`,
  `discipline_scores`, `analytics_events` (+ kolom referral).
- Tabel mirror: `paper_signals`, `paper_positions`, `paper_equity_log`, `paper_meta`,
  `paper_slippage_log`, `paper_yield_log`.
- RLS aktif di semua tabel + event trigger `rls_auto_enable` untuk tabel baru;
  hardening: `profiles` SELECT-saaja (migration `20260912120000`),
  paper_* write policy di-drop (service role bypass),
  trigger `trg_recalc_discipline` menghitung ulang skor saat `deviation_log` berubah
  (rumus WAJIB sama dengan `lib/deviation.ts`: `100 − critical×25 − lainnya×10`, clamp 0..100).

### Jalur sinkronisasi (SQLite → Supabase)
```
live_signal (SQLite)
 → scripts/sync_paper_to_supabase.py : watermark inkremental per tabel
     signals/slippage_log/yield_log : id > last_id_*   (append-only)
     positions  : open + id > wm + closed ≤30 hari     (supaya status open→closed ikut)
     equity_log : date > last_date_equity_log
     meta       : semua
 → POST /api/cron/paper-sync (PaperSyncSchema cap, pick kolom allowlist)
 → upsert dengan conflict key per tabel; watermark dimaju hanya setelah 200
```
Histori bug yang sudah tercatat: duplikat `paper_positions` karena sync tanpa id
(hotfix `20260910120000`), tabel slippage/yield tidak pernah disync
(hotfix `20260910130000`).

---

## 9. Scheduled Execution Flow

| # | Scheduler | Target | Bukti |
|---|---|---|---|
| 1 | `paper-trading.yml` — cron `0 1 * * *` UTC + dispatch | pytest → `live_signal.py` → `sync_paper_to_supabase.py` → commit `db/paper_trading.db` → failure alert Telegram | file workflow, ada `concurrency: paper-trading` |
| 2 | `trendsentry-daily-sync.yml` — cron `30 1 * * *` UTC + dispatch | `curl` `GET /api/cron/daily-sync` dgn Bearer CRON_SECRET → ingest fill user + deviasi + skor | file workflow |
| 3 | `fetch-bitget-data.yml` — **dispatch saja** | `scripts/fetch_bitget_data.py` → commit `data/historical/` | file workflow |
| 4 | `test-bitget-api.yml` — **dispatch saja** | probe API Bitget (one-off, keputusan venue sudah diambil 2026-08-25) | file workflow |
| 5 | ~~crontab lokal~~ | **dibatalkan** (laptop tidak always-on) — disebut `TASKS.md:40` | tidak ada file crontab di repo |
| 6 | `db/backup_db.sh` via cron lokal `5 1 * * *` | backup SQLite 14 hari | hanya disebut di header skrip; **tidak ada scheduler yang menjalankannya sekarang** (SUSPICIOUS, §13) |

Tidak ada Vercel Cron di repo (`.vercel/` hanya project id) — daily-sync dipicu GitHub Actions,
bukan Vercel cron. `deploy/RUNBOOK.md` menjelaskan rencana pemindahan scheduler ke systemd timer
VPS (belum dieksekusi; Docker image "belum pernah dibuild" menurut RUNBOOK §4).

---

## 10. File Inventory

Kolom: **Rujuk** = siapa yang memakai/meng-import; **Impor** = dependensi keluar;
**Runtime** = kapan/mana dijalankan; **Status** = CORE / SUPPORT / RESEARCH / FUTURE /
SUSPICIOUS / DEAD / UNKNOWN (bukti di §13 bila bukan CORE/SUPPORT).

### 10.1 Dokumen root

| Path | Purpose | Rujuk | Impor | Runtime | Status |
|---|---|---|---|---|---|
| README.md | wajah publik proyek | link eksternal, SITE | — | — | SUPPORT |
| PLAN.md | roadmap, strategi, risk rules, model bisnis | AGENTS.md, RULES.md, TASKS.md, AUDIT.md, kode (komentar) | — | — | SUPPORT |
| AGENTS.md | instruksi agent (otomatis dibaca) | harness | — | — | SUPPORT |
| RULES.md | ringkasan aturan/gate | — (dirujuk dokumen) | — | — | SUPPORT |
| TASKS.md | checklist fase | PLAN.md, AGENTS.md | — | — | SUPPORT |
| AUDIT.md | audit 2026-09-21 (P0–P4) | — | — | — | SUPPORT |
| SECURITY-ACTIONS.md | status rotasi secret manual | — | — | — | SUPPORT |
| LICENSE | AGPL-3.0 + clause SaaS | README.md | — | — | SUPPORT |

### 10.2 Python — engine & tooling (19 file sumber)

| Path | Purpose | Rujuk | Impor | Runtime | Status |
|---|---|---|---|---|---|
| backtest/strategy.py | indikator Donchian/ATR/SMA/RSI, position_size, cluster limit | run_backtest.py, live_signal.py, guards.py, run_longshort_backtest.py, tests | pandas | dipanggil backtest & paper | CORE |
| backtest/run_backtest.py | simulasi portfolio + metrics + report | cli.py, research/*.py (5), tests/test_backtest_cash.py | strategy, pandas, yaml, matplotlib (opsional) | manual / cli / riset | CORE |
| backtest/__init__.py | penanda paket | import path tests | — | — | SUPPORT |
| paper_trading/live_signal.py | engine paper harian (signal→risk→SQLite→alert) | paper-trading.yml, cli.py, tests/test_live_signal.py | strategy, telegram_alert, guards, llm_filter (kondisional), ccxt, pandas, yaml | CI 01:00 UTC / cli paper | CORE |
| risk_manager/guards.py | validate_config, CircuitBreaker, re-export position_size | live_signal.py, cli.py doctor, tests | backtest.strategy | tiap start paper & doctor | CORE |
| risk_manager/__init__.py | penanda paket | — | — | — | SUPPORT |
| cli.py | CLI gratis (backtest/paper/live/watcher/doctor) | PLAN §9, TASKS, tests/test_cli.py | rich, yaml, sqlite3 | manual lokal | SUPPORT |
| llm_filter/filter.py | kontrak filter Fase 3 (pass-through skeleton) | live_signal (bila enabled), tests/test_filter.py | dataclasses | **tidak aktif** (config false) | FUTURE |
| monitoring/telegram_alert.py | kirim alert Telegram | live_signal.py, SECURITY-ACTIONS.md | urllib | tiap run paper | CORE |
| scripts/sync_paper_to_supabase.py | SQLite → /api/cron/paper-sync inkremental | paper-trading.yml, RUNBOOK | urllib, sqlite3 | CI setelah engine | CORE |
| scripts/fetch_bitget_data.py | fetch OHLCV Bitget → CSV | fetch-bitget-data.yml, DESIGN.md | ccxt, pandas, yaml | manual/dispatch | SUPPORT |
| scripts/compare_live_vs_backtest.py | gate evaluasi Fase 2 (locked <10) | tests/test_compare.py, TASKS | backtest-reference.json, sqlite3 | manual | SUPPORT |
| backtest/research/correlation_mitigation.py | eksperimen mitigasi korelasi → laporan | reports/correlation_mitigation_experiment.md | run_backtest, **yfinance (tidak di requirements)** | manual | RESEARCH |
| backtest/research/fetch_funding.py | dump funding rate Binance → data/funding | run_longshort_backtest.py | requests | manual | RESEARCH |
| backtest/research/portfolio_size_experiment.py | 2/4/6/8/10 pair + matriks korelasi → laporan | reports/portfolio_size_experiment.md | run_backtest, yaml | manual | RESEARCH |
| backtest/research/regime_segmentation.py | performa per rezim bull/bear/sideways | reports/regime_segmentation_analysis.md | run_backtest, matplotlib | manual | RESEARCH |
| backtest/research/run_capital_efficiency.py | deployment, yield, multi-pair → laporan | reports/research/capital_efficiency/ | run_backtest, matplotlib | manual | RESEARCH |
| backtest/research/run_longshort_backtest.py | long-short vs long-only vs short-only (riset, "tidak dipakai paper") | reports/research/longshort/ | run_backtest, strategy, matplotlib | manual | RESEARCH |
| backtest/research/sharpe_benchmark.py | Sharpe identik formula vs B&H | reports/sharpe_benchmark_comparison.md | run_backtest, **scipy (tidak di requirements)** | manual | RESEARCH |

### 10.3 Python — tests (8 file, 64 test)

| Path | Test | Melindungi | Status |
|---|---|---|---|
| tests/test_strategy.py | 24 | position_size, ATR Wilder, Donchian anti look-ahead, cluster, SMA, RSI | CORE |
| tests/test_risk.py | 13 | guards: sizing reuse anti-drift, CircuitBreaker, validate_config | CORE |
| tests/test_live_signal.py | 11 | engine paper e2e (FakeExchange): enter/exit/idempoten/yield/snapshot/backfill/gap | CORE |
| tests/test_compare.py | 5 | gate `compare_live_vs_backtest.evaluate` | CORE |
| tests/test_presets.py | 4 | guardrail preset + parameter beku | CORE |
| tests/test_cli.py | 4 | cli: help, live refused, doctor, watcher | CORE |
| tests/test_filter.py | 2 | kontrak LLM filter (verdict sempit, skeleton pass) | CORE |
| tests/test_backtest_cash.py | 1 | regresi P0-3 (kas negatif saat clamp) | CORE |

### 10.4 Config, data, presets, DB

| Path | Purpose | Rujuk | Runtime | Status |
|---|---|---|---|---|
| config.yaml | parameter strategi/risk/paper/backtest/llm/execution | live_signal, run_backtest, fetch_bitget_data, cli doctor, tests/test_presets | tiap run | CORE |
| requirements.txt | dep full (ccxt, pandas, numpy, matplotlib, **vectorbt**, pytest, PyYAML, **requests**, rich) | README, CI (sebagian) | install | CORE |
| requirements-engine.txt | dep ramping image engine | Dockerfile.engine | build image | SUPPORT |
| .env.example | template secret (exchange, deepseek, telegram, RUN_MODE) | telegram_alert.load_env, README | runtime lokal | SUPPORT |
| .gitignore | ignore venv/.env/report csv/db/node_modules | — | git | CORE |
| .dockerignore | jangan bawa secret/venv/node_modules ke image | Docker builds | build | SUPPORT |
| db/schema.sql | DDL SQLite 7 tabel | live_signal (`executescript`), cli | tiap start paper | CORE |
| db/paper_trading.db | state paper (3 closed trade, 235 signal) | semua pembaca SQLite; **di-commit ke git** | CI harian | CORE |
| db/backup_db.sh | backup SQLite harian 14 hari | TASKS.md; cron lokal **dibatalkan** | tidak terjadwal | SUSPICIOUS |
| db/backups/paper_trading_2026-08-14.db | artefak backup lokal (ignored) | — | — | SUSPICIOUS |
| presets/donchian_cluster_a2.yaml | preset 1 (gate passed) | run_backtest (PRESET env), tests | manual | CORE |
| presets/sma_crossover.yaml | preset 2 (gate failed, frozen) | tests | manual | CORE |
| presets/rsi_mean_reversion.yaml | preset 3 (gate failed, frozen) | tests | manual | CORE |
| data/historical/*.csv (13 file) | OHLCV 1D: 10 pair config + BCH/LTC/PAXG | run_backtest (10 pair saja) | backtest | CORE |
| data/historical/{BCH,LTC,PAXG}_USDT_1d.csv (3) | sisa riset, tidak di config | tidak ada konsumen aktif | — | RESEARCH |
| data/funding/{BTC,ETH}USDT_daily.csv (2) | funding rate utk riset long-short | run_longshort_backtest | riset | RESEARCH |

### 10.5 GitHub Actions (4)

| Path | Trigger | Fungsi | Status |
|---|---|---|---|
| .github/workflows/paper-trading.yml | cron 01:00 UTC + dispatch | pytest → engine → sync → commit DB → failure alert | CORE |
| .github/workflows/trendsentry-daily-sync.yml | cron 01:30 UTC + dispatch | panggil /api/cron/daily-sync | CORE |
| .github/workflows/fetch-bitget-data.yml | dispatch | refresh CSV historis + commit | SUPPORT |
| .github/workflows/test-bitget-api.yml | dispatch | probe konektivitas Bitget (one-off) | SUSPICIOUS |

### 10.6 Deploy / Docker (9)

| Path | Purpose | Status |
|---|---|---|
| deploy/docker-compose.yml | validasi lokal web+engine vs Supabase cloud | FUTURE |
| deploy/Dockerfile.engine | image engine (requirements-engine) | FUTURE |
| deploy/Dockerfile.web | image Next standalone (DOCKER_BUILD=1) | FUTURE |
| deploy/backup.sh | pg_dump → gzip → gpg AES256 → Storage (VPS) | FUTURE |
| deploy/restore.sh | restore terverifikasi (validasi basename, mktemp) | FUTURE |
| deploy/migrate.sh | jalankan supabase/migrations ke Postgres target | FUTURE |
| deploy/export-cloud.sh | ekspor tabel paper_* dari cloud | FUTURE |
| deploy/RUNBOOK.md | rencana cutover VPS/Coolify | FUTURE |
| deploy/.env.example | template env web+engine | FUTURE |

Semua `deploy/*` disiapkan untuk cutover VPS yang **belum pernah dieksekusi**
(RUNBOOK §4: image "belum pernah dibuild"). Bukan dead — persiapan Fase-4/VPS yang disengaja.

### 10.7 Supabase (11)

| Path | Purpose | Status |
|---|---|---|
| supabase/config.toml | config CLI local dev (Postgres 17, password policy) | SUPPORT |
| supabase/migrations/20260909120000_remote_schema.sql | **SoT skema**: 12 tabel, index, RLS, fungsi, trigger | CORE |
| supabase/migrations/20260909120001_add_stripe_columns.sql | kolom billing profiles | CORE |
| supabase/migrations/20260909130000_fix_rls_policies.sql | drop policy paper_*, harden rls_auto_enable | CORE |
| supabase/migrations/20260910120000_fix_paper_positions_upsert_and_dedupe.sql | hotfix duplikat positions | CORE |
| supabase/migrations/20260910130000_add_paper_slippage_yield_tables.sql | tabel slippage + yield | CORE |
| supabase/migrations/20260911120000_seed_strategy_templates.sql | kunci guardrail 8 template | CORE |
| supabase/migrations/20260911130000_metrics_referral_events.sql | analytics_events + referral | CORE |
| supabase/migrations/20260912120000_harden_profiles_rls.sql | profiles SELECT saja | CORE |
| supabase/migrations/20260912130000_recalc_discipline_score_trigger.sql | recompute skor saat deviasi berubah | CORE |
| supabase/.gitignore + .temp/* | artefak CLI (project-ref, versi) | SUPPORT |

### 10.8 Backtest reports & research docs (15 baris / 25 file)

| Path | Purpose | Status |
|---|---|---|
| backtest/DESIGN.md | desain engine (§6.1 angka = keluarga metrics.md) | SUPPORT |
| backtest/reports/metrics.md | output backtest resmi (149.59% / DD −26.19) | CORE |
| backtest/reports/decision_log.md | kronologi keputusan — dirujuk SITE + PLAN | CORE |
| backtest/reports/presets/{sma,rsi}/metrics.md | bukti preset gagal gate | CORE |
| backtest/reports/correlation_mitigation_experiment.md | laporan riset korelasi (dasar cluster) | RESEARCH |
| backtest/reports/portfolio_size_experiment.md | laporan riset 2→10 pair | RESEARCH |
| backtest/reports/regime_segmentation_analysis.md | laporan riset rezim | RESEARCH |
| backtest/reports/sharpe_benchmark_comparison.md | Sharpe vs B&H (formula sama) | RESEARCH |
| backtest/reports/sharpe_discrepancy_report.md | investigasi Sharpe 1.06 vs 0.53 (snapshot 2026-09-05) | RESEARCH |
| backtest/reports/research/{capital_efficiency,longshort}/ (2 md + 9 csv/png) | laporan riset terpublikasi | RESEARCH |
| backtest/reports/bh_max_drawdown.md (**untracked**) | riset B&H drawdown | RESEARCH |
| backtest/reports/bh_drawdown_and_btc_eth_corr.md (**untracked**) | riset korelasi BTC/ETH | RESEARCH |
| backtest/reports/{equity_curve.csv,trades.csv,equity_drawdown.png} (ignored lokal) | artefak run terakhir | SUPPORT |
| backtest/reports/presets/*/{equity_curve.csv,trades.csv,*.png} (ignored lokal) | artefak run preset | SUPPORT |

### 10.9 Web — konfigurasi (14)

| Path | Purpose | Status |
|---|---|---|
| monitoring/web/package.json | dep + script dev/build/start/lint/typecheck/test:e2e | CORE |
| monitoring/web/package-lock.json | lockfile | CORE |
| monitoring/web/tsconfig.json | strict TS, path `@/*` | CORE |
| monitoring/web/next.config.ts | CSP/HSTS/headers, `output: standalone` hanya bila `DOCKER_BUILD` | CORE |
| monitoring/web/proxy.ts | middleware auth gate `/app`, `/auth` | CORE |
| monitoring/web/playwright.config.ts | E2E vs localhost:3000 + larangan aksi destruktif | CORE |
| monitoring/web/eslint.config.mjs | eslint-config-next core-web-vitals + TS | CORE |
| monitoring/web/postcss.config.mjs | Tailwind v4 plugin | CORE |
| monitoring/web/next-env.d.ts | artefak generator Next (di-track) | SUPPORT |
| monitoring/web/README.md | **klaim static export/SQLite build-time (SALAH, §12)** | SUSPICIOUS |
| monitoring/web/AGENTS.md | blok auto-nextjs (di-regenerate `next dev`) | SUPPORT |
| monitoring/web/.gitignore | ignore .next/out/env | CORE |
| monitoring/web/.env.example | template env web | SUPPORT |
| monitoring/web/.env + .env.local | secret lokal (ignored, tidak di-track) | SUPPORT |

### 10.10 Web — lib (16)

| Path | Purpose | Rujuk | Status |
|---|---|---|---|
| lib/backtest-reference.json | **SATU sumber angka referensi backtest** | reference.ts, compare_live_vs_backtest.py | CORE |
| lib/reference.ts | bind JSON → konstanta TS | papertrading pages, tests? (tidak) | CORE |
| lib/constants.ts | PAIRS (10), STARTING_CASH, fmt | prices, daily-sync, LiveSection, PaperLiveBoard | CORE |
| lib/db-supabase.ts | `getDashboardData()` — agregasi paper_* untuk dashboard | papertrading/* | CORE |
| lib/deviation.ts | rule engine deviasi + `calculateDisciplineScore` | trades & daily-sync route | CORE |
| lib/validations.ts | zod schema + `GUARDRAILS` + `checkStrategyGuardrails` | semua route mutasi | CORE |
| lib/supabase/{server,client,admin}.ts | cookie / browser / service-role client | proxy, pages, routes | CORE |
| lib/bitget.ts | HMAC + `USER_KEY_READ_ENDPOINTS` + `verifySpotReadAccess` | api-keys, daily-sync | CORE |
| lib/encryption.ts | AES-GCM + PBKDF2 (legacy path dipertahankan) | api-keys, daily-sync | CORE |
| lib/csrf.ts | validasi origin allowlist | semua route mutasi | CORE |
| lib/rate-limit.ts | limiter in-memory per-instance | prices, events | CORE |
| lib/env.ts | validasi env wajib | encryption | CORE |
| lib/stripe.ts | Stripe client + `STRIPE_PLANS` (paper_beta $19, live_assist $49) | checkout, webhook, pricing | CORE |
| lib/telegram.ts | alert Telegram deviasi (TS) | trades route | CORE |
| lib/site.ts | copy/tautan marketing (`SITE`, `NAV_LINKS`) | Nav, Footer, marketing pages | CORE |

### 10.11 Web — API routes (14)

Semua `monitoring/web/app/api/**/route.ts`: `account/delete`, `account/password`, `api-keys`,
`checkout`, `cron/daily-sync`, `cron/paper-sync`, `deviation-log`, `discipline`, `events`,
`prices`, `strategies`, `templates`, `trades`, `webhooks/stripe` — fungsi per route ada di §6.
Semua **CORE**.

### 10.12 Web — halaman & komponen (35 tsx + 1 css)

| Path | Purpose | Rujuk | Status |
|---|---|---|---|
| app/layout.tsx | root layout + AnalyticsBeacon | next | CORE |
| app/page.tsx | landing marketing | next | CORE |
| app/globals.css | Tailwind + token styling | layout | CORE |
| app/favicon.ico | ikon | next | SUPPORT |
| app/papertrading/page.tsx | dashboard publik paper (force-dynamic) | NAV_LINKS | CORE |
| app/papertrading/PaperLiveBoard.tsx | board live: EquityChart + LiveSection | papertrading/page | CORE |
| app/papertrading/log/page.tsx | log sinyal + trade lengkap | link dari page | CORE |
| app/papertrading/ui.tsx | Card/Badge/Meter/fmtUsd lokal | papertrading pages | CORE |
| app/app/layout.tsx | auth check + AppSidebar | next | CORE |
| app/app/AppSidebar.tsx | navigasi app (client) | layout | CORE |
| app/app/dashboard/page.tsx | ringkasan user + checklist | /app | CORE |
| app/app/dashboard/ScoreTrendChart.tsx | grafik tren skor | dashboard | CORE |
| app/app/dashboard/EquityCurveChart.tsx | grafik equity (client) | **TIDAK ADA** | DEAD |
| app/app/strategies/page.tsx | daftar strategi | /app | CORE |
| app/app/strategies/new/page.tsx | buat strategi dari template schema | /app | CORE |
| app/app/deviation-log/page.tsx | log deviasi | /app | CORE |
| app/app/settings/page.tsx | API key, password, delete account | /app | CORE |
| app/auth/{login,signup}/page.tsx | form auth (client) | proxy | CORE |
| app/auth/callback/route.ts | verifyOtp token_hash + fallback code | email confirm | CORE |
| app/auth/signout/route.ts | signOut + redirect | Nav | CORE |
| app/start|proof|live|pricing|disclaimer/page.tsx | halaman marketing | NAV_LINKS | CORE |
| app/pricing/CheckoutButton.tsx | trigger /api/checkout | pricing | CORE |
| app/components/AnalyticsBeacon.tsx | beacon + `storedReferral` | root layout, signup | CORE |
| app/components/EquityChart.tsx | kurva equity Recharts | PaperLiveBoard | CORE |
| app/components/LiveSection.tsx | ticker live + unrealized PnL (poll 3s) | PaperLiveBoard | CORE |
| app/components/marketing/{SiteShell,Nav,Footer}.tsx | kerangka situs + auth-aware nav | semua page publik | CORE |
| app/components/marketing/{Hero,ProofStrip,BentoFeatures,Methodology,PricingTeaser,ui}.tsx | konten landing | page.tsx, pages (ui) | CORE |
| app/public/*.svg (5) | aset default create-next-app | **tidak direferensikan** | DEAD |

### 10.13 Web — E2E (3)

| Path | Purpose | Status |
|---|---|---|
| e2e/auth.spec.ts | 8 test alur auth callback/redirect/signup | CORE |
| e2e/free-tier-flow.spec.ts | 26 test alur free tier + API + mobile | CORE |
| e2e/api-smoke-test.mjs | smoke HTTP manual (`node e2e/api-smoke-test.mjs`) | SUPPORT |
| e2e/.auth/user.json (**untracked**) | storage state Playwright (session login tes) | SUSPICIOUS |

---

## 11. Core / Support / Research / Future / Dead Classification

Rekap status (dihitung dari tabel §10):

| Status | Definisi | Jumlah baris inventory |
|---|---|---|
| CORE | masuk execution path produksi (CI harian, runtime web, SoT) | 88 |
| SUPPORT | dibutuhkan operasi/docs/tests tapi bukan execution path langsung | 28 |
| RESEARCH | reproducible research / artefak riset | 17 |
| FUTURE | disengaja untuk fase mendatang (LLM filter Fase 3, deploy VPS) | 10 |
| SUSPICIOUS | ada bukti tidak terjadwal/tidak terpakai, perlu keputusan owner | 5 |
| DEAD | bukti kuat tidak direferensikan & tidak ada runtime path | 2 baris = **6 file** (EquityCurveChart.tsx + 5 SVG) |
| UNKNOWN | tidak berhasil diklasifikasi | 0 |
| **Total** | | **150 baris** |

Catatan hitungan: 150 baris inventory memetakan **seluruh 201 file repo** (198 ter-track git +
3 file untracked), **ditambah** ±15 artefak lokal ter-`.gitignore` yang ikut didokumentasikan
dengan jelas (file `.env` lokal, `db/backups/`, CSV/PNG run terakhir, `.temp/` Supabase).
Beberapa baris sengaja mengelompokkan banyak file serupa (13 CSV historis, 2 CSV funding,
11 file laporan riset, 5 SVG) — perinciannya tertulis di kolom Path.

Entri DEAD/SUSPICIOUS dengan bukti lengkap → §13.
**Tidak ada file yang disimpulkan DEAD hanya dari nama** — semua punya hasil grep + runtime path check.

Klasifikasi per domain (ringkas):

- **A. Production/core engine**: `backtest/{strategy,run_backtest}.py`, `paper_trading/live_signal.py`,
  `risk_manager/guards.py`, `monitoring/telegram_alert.py`, `config.yaml`, `db/schema.sql`,
  `scripts/sync_paper_to_supabase.py`, `paper-trading.yml`, `trendsentry-daily-sync.yml`,
  seluruh `monitoring/web/app|lib` + `supabase/migrations`, `lib/backtest-reference.json`,
  `backtest/reports/{metrics.md,decision_log.md,presets/}`.
- **B. Reproducible research**: `backtest/research/*.py` + `backtest/reports/research/` +
  `*_experiment.md` + `data/funding` + preset reports (dijalankan manual, dependensi
  sebagian tidak ada di requirements — lihat §13).
- **C. Historical experiment artifacts**: `sharpe_discrepancy_report.md` (snapshot 2026-09-05,
  angka 0.53 sudah digantikan), `bh_*.md` (untracked), CSV/PNG artefak run, `data/historical`
  pair non-config (BCH/LTC/PAXG).
- **D. Obsolete experiments**: belum ada yang bisa dinyatakan obsolete tanpa keputusan owner;
  kandidat terkuat hanya `test-bitget-api.yml` (keputusan venue sudah diambil).

---

## 12. Documentation Drift

Semua butir di bawah **sudah diverifikasi terhadap kode** sebelum dilaporkan.

### 12.1 Node.js vs Python untuk live execution (Fase 4)
- Klaim lama: `README.md:39` "Execution: Python (paper), **Node.js (live, Fase 4)**";
  `AGENTS.md:43` "Execution | Node.js + TypeScript, ccxt"; `RULES.md:111` "Execution |
  Node.js + TypeScript, ccxt"; `PLAN.md:105` diagram "Execution Engine (Node.js, Fase 4)";
  `PLAN.md:124` tabel stack Fase 4 "Node.js + ccxt"; `PLAN.md:158` struktur `execution/ # Fase 4, Node.js`.
- Realitas: **tidak ada kode Node execution sama sekali**; `PLAN.md:127` (amendemen 2026-09-11)
  menetapkan eksekusi live **tetap Python**.
- Status: **kontradiksi** — amendemen PLAN bertabrakan dengan diagram/tabel PLAN sendiri dan
  dengan README/AGENTS/RULES yang belum diupdate.

### 12.2 Static export + SQLite build-time vs SSR + Supabase runtime
- Klaim lama: `README.md:40` "Dashboard: Next.js static export → Vercel";
  `PLAN.md:209` "Next.js 16 static export"; `PLAN.md:210` "DB dibaca saat build (bukan runtime)";
  `TASKS.md:37` "Next.js static export → Vercel gratis";
  `monitoring/web/README.md:6-7,19,24` "static export", "Data is read from
  `db/paper_trading.db` at build time — no runtime database access", "npm run build # outputs
  static export to out/".
- Realitas (diverifikasi): `next.config.ts` **tidak pernah set `output: 'export'`**
  (hanya `standalone` saat `DOCKER_BUILD=1`); folder `out/` tidak ada; `next build` menghasilkan
  route `ƒ (Dynamic)` untuk semua halaman data; `/papertrading` memakai
  `export const dynamic = "force-dynamic"` + `getDashboardData()` → **Supabase runtime**;
  tidak ada satu pun pembacaan `db/paper_trading.db` dari kode web.
- Status: **kontradiksi besar** (5 dokumen).

### 12.3 Struktur folder lama (`PLAN.md` §4) vs repository aktual
- `PLAN.md:142-167` menggambarkan `crypto-trend-bot/` dengan `llm_filter/deepseek_client.py`,
  `llm_filter/prompts/`, `execution/` (Node.js), `risk_manager/position_sizing.py`,
  `monitoring/telegram_bot.py`.
- Realitas: keempat path itu **tidak ada** (dicek `[ -e ]`). Yang ada: `risk_manager/guards.py`,
  `monitoring/telegram_alert.py`, `llm_filter/filter.py`, plus direktori yang tidak pernah
  disebut: `monitoring/web/`, `scripts/`, `presets/`, `supabase/`, `tests/`, `deploy/`, `cli.py`.
- `AGENTS.md:42` "Migration tersimpan di `db/migrations/`" → **tidak ada**; aktual
  `supabase/migrations/` (9 file).
- `AGENTS.md:5` "Ikuti struktur folder di PLAN.md Section 4" → mewarisi struktur yang sudah basi.
- Status: **kontradiksi**.

### 12.4 Nama file lama yang tidak ada
| Klaim | Lokasi | Realitas |
|---|---|---|
| `backtest/fetch_data.py` | TASKS.md:9 (dicentang `[x]`!) | tidak ada; aktual `scripts/fetch_bitget_data.py` |
| `fetch_data.py # Data fetcher (Binance mirror)` | DESIGN.md:14 | tidak ada + venue sudah Bitget |
| `monitoring/telegram_bot.py` | TASKS.md:68, PLAN.md:166 | tidak ada; aktual `monitoring/telegram_alert.py` |
| `llm_filter/deepseek_client.py` + `prompts/` | TASKS.md:51-52, PLAN.md:156-157 | tidak ada (Fase 3 belum dikerjakan) |
| `risk_manager/position_sizing.py` | PLAN.md:162 | tidak ada; aktual `risk_manager/guards.py` (re-export) |
| `conftest.py` | AUDIT.md menyebut sudah dihapus | benar sudah tidak ada (klaim AUDIT valid) |

### 12.5 Klaim "file sudah dihapus/mati" yang ternyata masih ada atau sebaliknya
- `AUDIT.md:222` daftar perbaikan masih mencantumkan **"P4-4 Buat deploy/.env.example" sebagai
  pending** — file `deploy/.env.example` **sudah ada** (berisi 10+ var). Drift status audit.
- `TASKS.md:40` crontab lokal "dibatalkan", tetapi `db/backup_db.sh:4` masih menulis
  "Cron: 5 1 * * * …" seolah aktif — backup lokal **tidak lagi terjadwal** (§13).
- Sebaliknya: `AUDIT.md` menyebut `live_signal.py:595` — aktual 595 baris ✓ (klaim benar).

### 12.6 Diagram arsitektur basi
- `README.md:32-36` diagram "Data (ccxt) → Signal Engine → Risk Manager → Paper/Live Execution →
  DB + Alerts" tanpa Supabase/produk user — tidak menggambarkan sistem disiplin-user yang aktual.
- `PLAN.md:86-116` diagram masih menaruh LLM Filter & Execution Node.js di jalur utama
  (LLM filter nyata = skeleton nonaktif; execution = tidak ada).
- `monitoring/web/AGENTS.md` bukan arsitektur project (blok generator Next) — jangan dijadikan referensi.

### 12.7 Deskripsi bisnis/produk basi
- `README.md:23` "Real-time dashboard … ✅ Active" vs `README.md:25` "Discipline Benchmark …
  Coming soon" — padahal **discipline score/deviation sudah terimplementasi & teruji**
  (`lib/deviation.ts`, trigger SQL, halaman `/app/*`). Bagian "What It Does" tidak menyebut
  produk disiplin SaaS (API key, strategi user, Stripe) yang kini menjadi inti.
- `README.md:42` "Data: SQLite (paper), **PostgreSQL (live, future)**" — PostgreSQL (Supabase)
  **sudah dipakai produksi hari ini** (tabel paper_* + user_*).
- `README.md:67` "Private Beta … validating the discipline model before opening up user accounts"
  vs kode: signup terbuka, Stripe terpasang (gated), daily-sync user aktif. Framing basi.
- `RULES.md:110` "Backtest | Python 3.11+, ccxt, pandas, **vectorbt**" — `vectorbt` **tidak
  pernah di-import** di kode mana pun (hanya ada di requirements).
- `AGENTS.md:44` "Testing | pytest untuk Python, **vitest/jest** untuk Node.js" — repo web
  tidak punya vitest/jest; yang ada Playwright + script smoke manual.

### 12.8 Klaim teknis spesifik yang salah/ basi
| Klaim | Lokasi | Realitas (bukti) |
|---|---|---|
| "live ticker + unrealized PnL realtime (WebSocket)" | TASKS.md:37 | **tidak ada WebSocket** di repo; aktual REST polling `/api/prices` tiap 3 detik |
| "bot CI commit db → Vercel auto-redeploy → DB dibaca saat build" | PLAN.md:210 | commit DB tetap terjadi (backup), tetapi web **tidak membacanya**; jalur data = sync → Supabase |
| "slippage 125 sampel, avg 0.011%" | TASKS.md:44 | DB aktual: **235 sampel, avg 0.0124%** |
| "sekarang 1/10 trade" | TASKS.md:46 | DB aktual: **3 trade tertutup** (3/10) |
| "Sharpe valid 0.53" | reports/sharpe_discrepancy_report.md:10 | angka Cluster-A2 pasca cluster-limit = **0.82** (report adalah snapshot 2026-09-05; basi) |
| pointer "`DESIGN.md:176` Sharpe ~1.06" | sharpe_discrepancy_report.md:71 | DESIGN.md:176 kini berisi tabel definisi metrik; angka 1.06 sudah tidak ada di DESIGN.md (pointer basi) |
| lint sudah bersih / P3-12 selesai | AUDIT.md (implisit) | `npm run lint` **exit 1**: 2 error `react-hooks/set-state-in-effect` (AppSidebar:24, strategies/new:107) + 7 warning unused var |
| "Discipline Benchmark 🔜 Coming soon" | README.md:25 | sebagian sudah ada (score/deviation), tapi simulasi benchmark memang belum — perlu framing ulang |

### 12.9 Preset/gate vs dokumentasi (konsisten — dicatat agar tidak "diperbaiki" keliru)
- Preset SMA & RSI berstatus `gate: failed` di YAML **selaras** TASKS.md:87-88 dan metrics.md
  preset. Jangan dianggap drift.

---

## 13. Dead-Code Candidates

Metode: grep referensi lintas repo (Python/TS/TSX/YAML/MD) + penelusuran runtime path.
**Belum ada yang dihapus.**

| # | File | Kenapa mencurigakan | Referensi ditemukan | Bukti runtime path | Confidence |
|---|---|---|---|---|---|
| 1 | `monitoring/web/app/app/dashboard/EquityCurveChart.tsx` | komponen export tanpa importer | **hanya deklarasinya sendiri** (grep seluruh repo: 1 match) | `/app/dashboard` memakai `ScoreTrendChart`; kurva equity ditampilkan di `/papertrading` via `components/EquityChart` (komponen berbeda) | **HIGH** |
| 2 | `monitoring/web/public/{file,globe,next,window,vercel}.svg` (5) | aset default create-next-app | 0 referensi di `app/` maupun `next.config.ts` | tidak ada route yang merujuk | MEDIUM (dead, tapi dampak nol) |
| 3 | `db/backup_db.sh` | fungsi backup yang kehilangan scheduler | hanya `TASKS.md:39` + komentar dirinya sendiri | crontab lokal **dibatalkan** (TASKS:40); jalur backup resmi kini = commit `db/paper_trading.db` di CI | MEDIUM (masih berguna manual) |
| 4 | `.github/workflows/test-bitget-api.yml` | probe one-off untuk keputusan yang sudah diambil | tidak direferensikan workflow lain | `workflow_dispatch` saja; venue Bitget sudah dipakai produksi | MEDIUM (obsolete sebagai prosedur) |
| 5 | `backtest/research/correlation_mitigation.py` | import `yfinance` — **tidak ada di requirements** | hanya dirujuk laporan riset | manual; dari install bersih akan ImportError | MEDIUM (reproducibility, bukan dead) |
| 6 | `backtest/research/sharpe_benchmark.py` | import `scipy` — **tidak ada di requirements** | hanya dirujuk laporannya | manual; ImportError dari install bersih | MEDIUM (reproducibility) |
| 7 | `requirements.txt` → `vectorbt` | tidak pernah di-import di kode repo | 0 import (grep `vectorbt` hanya requirements) | — | **HIGH** (unused dependency) |
| 8 | `requirements.txt` → `requests` | hanya dipakai riset `fetch_funding.py` | 1 import (research) | bukan dep runtime engine | LOW-MEDIUM (keputusan: pisahkan ke research requirements) |
| 9 | Unused vars hasil lint | `lib/db-supabase.ts:85 lastRunDate`, `e2e/free-tier-flow.spec.ts:12 fs`, `e2e/api-smoke-test.mjs:12 SUPABASE_URL`, import `SITE` di `Hero.tsx`/`PricingTeaser.tsx`/`start/page.tsx`, import `createClient` di `strategies/new:3` | lint | dead local | HIGH (kecil) |
| 10 | `db/backups/paper_trading_2026-08-14.db` | artefak backup lokal (ignored, bukan bagian repo) | tidak ada | — | LOW (bukan repo content) |
| 11 | `monitoring/web/e2e/.auth/user.json` (untracked) | storage state login tes di working tree | dipakai Playwright storageState? **spec tidak menyetel `storageState`** — auth.spec memakai redirect-only, free-tier login via form | berpotensi membawa session tes; tidak di-ignore | MEDIUM (hygiene) |
| 12 | `backtest/DESIGN.md` | tidak direferensikan kode; sebagian angka basi | hanya dokumen | — | LOW (dokumentasi berguna — jangan dihapus, perlu review angka) |

**Kandidat yang sudah dicurigai tapi TIDAK dead (diverifikasi):**
- `ScoreTrendChart.tsx` → dipakai `app/app/dashboard/page.tsx:4`.
- `llm_filter/filter.py` → di-import `live_signal.py:491` (kondisional, config false) → FUTURE, bukan dead.
- `deploy/*` → tidak dijalankan sekarang tetapi disiapkan RUNBOOK → FUTURE.
- `presets/*.yaml` → dibaca `run_backtest.load_config` via env `PRESET` + dikunci test → CORE.
- `scripts/compare_live_vs_backtest.py` → punya unit test + dipakai TASKS Fase 2 → SUPPORT.

---

## 14. Duplicate-Code Candidates

| # | Duplikasi | Lokasi | Risiko | Catatan |
|---|---|---|---|---|
| 1 | **Dua keluarga angka metrik backtest** | `backtest/reports/metrics.md` + `backtest/DESIGN.md` §6.1 (+149.59, DD −26.19, avg win 4.31, avg loss −0.84, avgR 1.02, PF 2.26) **vs** `lib/backtest-reference.json` (+152.0, DD −26.45, 4.35, −0.85, 1.03, 2.27) | keputusan gate & klaim publik memakai angka berbeda | `backtest-reference.json` disebut "SATU sumber" dan memang dipakai kode; `metrics.md` adalah output runner dan tidak diupdate setelah re-run Wilder seed |
| 2 | **Angka dikutip ulang di 6 tempat** | README (+149%, −26.19), PLAN (−26.19), TASKS (−26.45), disclaimer (`−26.19` di baris 18 DAN `+152` di baris 25 — **campur dalam 1 halaman**), presets yaml, DESIGN | drift berulang tiap re-run | kandidat: jadikan JSON satu-satunya, dokumen cukup menautkan |
| 3 | Equity chart ganda | `app/components/EquityChart.tsx` (dipakai) vs `app/app/dashboard/EquityCurveChart.tsx` (mati) | perubahan gaya tidak sinkron | lihat §13 #1 |
| 4 | Perhitungan Sharpe/MDD **tiga implementasi** | `run_backtest.compute_metrics` (Python), `app/papertrading/page.tsx:41-62` (TS, single-pass), `research/sharpe_benchmark.py` | hasil web vs backtest bisa berbeda definisi (web pakai equity curve harian paper) | documented? belum ada komentar hubungan |
| 5 | Rumus discipline score **dua implementasi wajib sinkron** | `lib/deviation.ts:196-199` vs trigger SQL `20260912130000` | drift diam-diam mengubah skor | sudah diberi komentar "HARUS sama" — kandidat untuk satu test paritas |
| 6 | Guardrail **tiga lokasi** | `risk_manager/guards.validate_config` (Python), `lib/validations.ts GUARDRAILS` (TS), seed `20260911120000` (SQL) | perubahan salah satu = inkonsistensi | semua membatasi long_only/risk≤1%/max≤5 — kandidat kontrak tunggal |
| 7 | Alert Telegram **dua implementasi** | `monitoring/telegram_alert.py` vs `lib/telegram.ts` | format/telemetri berbeda | beda runtime (CI vs Vercel) — dapat diterima, catat saja |
| 8 | Pasangan pair & modal **duplikat** | `config.yaml strategy.pairs` vs `lib/constants.ts PAIRS`; `backtest.initial_capital_usd` vs `STARTING_CASH` | web menghardcode 10 pair (daily-sync, prices) — ubah pair = wajib ubah 2 tempat | kandidat: generate/sync dari satu sumber |
| 9 | Backup **tiga mekanisme** | commit CI `db/paper_trading.db`, `db/backup_db.sh` (lokal, mati), `deploy/backup.sh` (pg, VPS) |Operasional membingungkan | dokumentasikan mana yang aktif |
| 10 | Klien Supabase **empat pembangunan** | `lib/supabase/{server,client,admin}.ts` + inline `createServerClient` di `proxy.ts` | proxy tidak memakai helper bersama | dapat diterima (middleware beda runtime), catat |
| 11 | Fetch/timeout/retry pola berulang | `fetch_retry` (Python), `AbortSignal.timeout` (TS), `time.sleep` loop | — | minor |
| 12 | `papertrading/ui.tsx` vs `components/marketing/ui.tsx` | dua modul "ui" berbeda domain | kebingungan import | minor |

---

## 15. Test Coverage Map

### 15.1 Python (pytest) — 8 file, **64 test, semua PASS (9.70s)**

| Implementasi | Test yang melindungi | Status |
|---|---|---|
| `backtest/strategy.py:position_size` | test_strategy.TestPositionSize + test_risk.sizing reuse | terlindungi (ganda, disengaja anti-drift) |
| `backtest/strategy.py:atr` (Wilder) | test_strategy.TestATR | terlindungi |
| `backtest/strategy.py:donchian_*` (anti look-ahead) | test_strategy.TestDonchian | terlindungi |
| `backtest/strategy.py:cluster_*` | test_strategy.TestClusterLimit | terlindungi |
| `backtest/strategy.py:sma_*/rsi_*` | test_strategy.TestSMA/TestRSI | terlindungi |
| `backtest/run_backtest.py:run_backtest` (cash clamp) | test_backtest_cash | terlindungi (1 regresi) |
| `backtest/run_backtest.py:compute_metrics` | — | **TIDAK diuji langsung** (hanya lewat visual report) |
| `backtest/run_backtest.py:save_report/load_config` | — | tidak diuji (preset overlay diuji via test_presets membaca YAML, bukan loader) |
| `paper_trading/live_signal.py` | test_live_signal (11: enter, exit, idempoten, yield, yield backfill, gap stop, snapshot, backfill, main, make_exchange) | terlindungi (monkeypatch module global — dicatat AUDIT P4-8) |
| `risk_manager/guards.py` | test_risk (13) | terlindungi |
| `scripts/compare_live_vs_backtest.py:evaluate` | test_compare (5) | terlindungi |
| `llm_filter/filter.py` | test_filter (2) | terlindungi (kontrak sempit) |
| `cli.py` | test_cli (4) | terlindungi |
| `presets/*.yaml` | test_presets (4) termasuk `test_parameter_beku` | terlindungi |
| `scripts/sync_paper_to_supabase.py` (watermark) | — | **TIDAK diuji** |
| `scripts/fetch_bitget_data.py` | — | tidak diuji (butuh network) |
| `monitoring/telegram_alert.py` | — | tidak diuji |

**Test tanpa implementasi:** tidak ada — semua 64 test menunjuk file yang ada.
**Duplicate coverage:** `position_size` sengaja diuji 2× (anti-drift, ada test khusus
`position_size is strat_size`).
**Test perilaku lama/deprecated:** tidak ditemukan.

### 15.2 Web / E2E

| jenis | jumlah | isi | status |
|---|---|---|---|
| Playwright `e2e/auth.spec.ts` | **8** | callback token_hash/code basi, proteksi redirect, render signup/login, login salah, resend, start page | — |
| Playwright `e2e/free-tier-flow.spec.ts` | **26** | landing/proof/paper/pricing/disclaimer, login sukses, dashboard, sidebar, settings, strategies, deviation-log, cron 401, prices, events, simulasi 1 minggu, transisi cepat, mobile viewport | — |
| Total E2E Playwright | **34** | | — |
| `e2e/api-smoke-test.mjs` | 10 fungsi smoke (HTTP, manual `node`) | publik/auth redirect/cron/prices/events/templates | — |
| Unit test TS (vitest/jest) | **0** | — | gap |

**Catatan angka:** commit terakhir menulis "all 26 tests pass" — itu = `free-tier-flow.spec.ts`
saja; total suite = 34.

**Implementation dengan test lemah/tidak ada (web):** `lib/deviation.ts` (rule engine +
skor — hanya teruji E2E page-load), `lib/encryption.ts`, `lib/csrf.ts`, `lib/rate-limit.ts`,
`lib/bitget.ts` (signature HMAC), `lib/validations.ts:checkStrategyGuardrails`,
semua 14 API route. E2E juga **dilarin menulis data** (playwright.config komentar:
tanpa signup submit / connect key) → jalur tulis produk tidak teruji otomatis.

### 15.3 Status build web (dijalankan saat audit ini)

| cek | perintah | hasil |
|---|---|---|
| Typecheck | `npm run typecheck` | **PASS (exit 0)** |
| Lint | `npm run lint` | **FAIL (exit 1): 2 error, 7 warning** — error `react-hooks/set-state-in-effect` di `AppSidebar.tsx:24` dan `strategies/new/page.tsx:107` |
| Build | `npm run build` | **PASS (exit 0)**, 32 static pages generated, semua route aplikasi `ƒ dynamic` |
| Python | `pytest tests/ -q` | **PASS (64 passed)** |

---

## 16. Configuration / Source-of-Truth Map

| Domain | Source of truth aktual | Salinan/duplikat lain | Konflik? |
|---|---|---|---|
| **Parameter strategi** (pair, timeframe, Donchian 20/10, ATR14×2, cluster 2) | `config.yaml` `strategy:` | `presets/donchian_cluster_a2.yaml` (salinan eksplisit, dikunci test), `PLAN.md` §1, `RULES.md` §B, `AGENTS.md` (via PLAN), `lib/constants.ts PAIRS` | Tidak ada konflik nilai saat ini; **PAIRS di TS = duplikat yang harus dijaga manual** |
| **Parameter risk** (risk 1%, max 5, CB 15%) | `config.yaml` `risk:` + guard `risk_manager/guards.validate_config` | `presets/*.yaml risk`, `lib/validations.ts GUARDRAILS` (web), seed SQL template | Konsisten (1% / 5 / long_only) di 3 tempat — sumber terpisah |
| **Paper execution behavior** | `paper_trading/live_signal.py` (+ `config.yaml paper_trading`) | — | tunggal |
| **Database schema SQLite** | `db/schema.sql` | dibaca ulang tiap start (idempoten) | tunggal |
| **Database schema Postgres** | `supabase/migrations/*.sql` (9) | `AGENTS.md` salah menyebut `db/migrations/` | Dokumentasi salah, kode benar |
| **Backtest reference metrics** | **ambigu**: `monitoring/web/lib/backtest-reference.json` (dipakai kode) vs `backtest/reports/metrics.md` (output runner) | DESIGN §6.1, README, PLAN, TASKS, RULES, disclaimer, presets | **YA — 2 keluarga angka beda (§12.9/§14 #1-2)** |
| **Web user strategy model** | Supabase `user_strategies` + `strategy_templates` (seed SQL) + `lib/validations.ts` guardrail | `lib/deviation.ts parseRules` (interpretasi params) | Konsisten; interpretasi rules ada di 1 tempat |
| **Paper trading data (untuk web)** | Supabase `paper_*` (mirror), diisi `/api/cron/paper-sync` | `db/paper_trading.db` (asli, di CI) | Tidak konflik — arah sinkron satu jalir; **tetapi README/PLAN masih mengklaim web membaca SQLite** |
| **Business/product rules** | `PLAN.md` §9 (+ amendemen) — "tidak jual sinyal, tidak pegang dana, baca-saja" | direplikasi komentar kode: `lib/bitget.ts`, `checkout` gate, `validate_config` menolak live | Konsisten terverifikasi di kode |
| **Decision log / histori gate** | `backtest/reports/decision_log.md` (dirujuk `SITE.decisionLog`, PLAN) | `TASKS.md`, `AUDIT.md` | kronologis, tidak konflik |

**Dokumen yang jangan diasumsikan benar** (hasil verifikasi):
- `README.md` — drift static-export, Node.js, PostgreSQL "future", deskripsi produk basi.
- `PLAN.md` — §4 struktur basi, §8 data flow web basi, diagram §3 vs amendemen §3 sendiri.
- `AGENTS.md` — path migrasi salah, Node.js execution, vitest/jest tidak ada.
- `RULES.md` — vectorbt tidak dipakai, Node.js execution.
- `TASKS.md` — nama file `backtest/fetch_data.py`, `telegram_bot.py`, WebSocket, angka
  slippage/trade basi.
- `AUDIT.md` — status P4-4 basi (file sudah ada); kesan lint bersih tidak akurat;
  pointer `DESIGN.md:176` di laporan terkait sudah bergeser.
- `monitoring/web/README.md` — **seluruh bagian Stack/Build/Data salah** (static export +
  build-time SQLite).
- `monitoring/web/AGENTS.md` — bukan dokumen proyek (blok generator Next).

---

## 17. Recommended Cleanup Plan (BELUM dieksekusi)

Urutan yang disarankan — masing-masing butuh konfirmasi owner sesuai aturan AGENTS.md:

**Langkah 0 — kebersihan working tree (risiko nol)**
1. Putuskan nasib 2 laporan untracked (`bh_max_drawdown.md`,
   `bh_drawdown_and_btc_eth_corr.md`): commit sebagai riset, atau pindah ke folder riset.
2. Tambah ignore untuk `monitoring/web/e2e/.auth/` (session storage) — atau hapus isinya.

**Langkah 1 — drift dokumentasi (dokumen saja, nol perubahan kode)**
3. `monitoring/web/README.md`: ganti klaim static export/SQLite build-time → SSR + Supabase.
4. `README.md`: arsitektur + stack (Python live, PostgreSQL sudah aktif), diagram §"What It Does".
5. `PLAN.md` §4 (struktur folder) dan §8 (data flow web) ditandai "usulan lama → aktual";
   diagram §3 diselaraskan dengan amendemen Python.
6. `AGENTS.md`: path `supabase/migrations/`, hapus vitest/jest (Playwright), execution Python.
7. `RULES.md` §H: hapus vectorbt (atau catat sebagai tidak dipakai), Node.js → Python.
8. `TASKS.md`: `backtest/fetch_data.py` → `scripts/fetch_bitget_data.py`;
   `telegram_bot.py` → `telegram_alert.py`; WebSocket → REST polling; perbarui angka
   3/10 trade & 235 sampel.
9. `AUDIT.md`: tandai P4-4 done; catat status lint 2 error.

**Langkah 2 — keputusan angka (butuh re-run backtest, JANGAN ubah parameter)**
10. Re-run `run_backtest.py` (config beku) dan tentukan keluarga angka yang benar; jadikan
    `backtest-reference.json` satu-satunya sumber, sinkronkan `metrics.md`/DESIGN/disclaimer.
    *Ini sentuh angka publik → wajib persetujuan owner + catat di PLAN.md (AGENTS #2).*

**Langkah 3 — dead code (konfirmasi dulu)**
11. Hapus `app/app/dashboard/EquityCurveChart.tsx` (HIGH confidence) — satu-satunya kandidat
    yang buktinya kuat.
12. Putuskan `test-bitget-api.yml` (arsipkan) dan `db/backup_db.sh` (aktifkan kembali atau
    dokumentasikan sebagai manual-only).
13. Bersihkan unused vars (7 warning lint) — menyelamatkan `npm run lint` dari error:
    2 error `set-state-in-effect` perlu pola alternatif (bukan sekadar hapus).

**Langkah 4 — dependensi & riset**
14. `requirements.txt`: keluarkan `vectorbt`; pisahkan `requests`/`scipy`/`yfinance` ke
    `requirements-research.txt` agar riset reproducible.
15. (Opsional) tandai `run_longshort_backtest.py` sebagai arsip eksperimen.

**Langkah 5 — struktur (paling akhir, paling hati-hati)**
16. Struktur yang direkomendasikan **mendukung kode yang ada** (lihat §18 struktur sasaran):
    `backtest/` (engine), `backtest/research/` (sudah ada), `backtest/reports/` (sudah ada),
    `paper_trading/`, `risk_manager/`, `scripts/`, `monitoring/`, `presets/`, `supabase/`.
    **Tidak perlu restructure besar** — yang kurang hanya pemisahan artefak data non-config
    (`data/historical/{BCH,LTC,PAXG}`, `data/funding`) ke `research/data/`, dan keputusan
    apakah `monitoring/web` dipisah (monorepo kecil, tidak mendesak).

---

## 18. DO NOT TOUCH YET (daftar eksplisit)

Dalam Phase 0 dan sampai owner memberi instruksi lain, **dilarang** mengubah/menghapus:

**Trading behavior & parameter**
1. `config.yaml` seluruh blok `strategy` / `risk` / `paper_trading` / `backtest` (Donchian 20/10,
   ATR×2, risk 1%, max 5, cluster 2, CB 15%, yield 5% APY, fee/slippage).
2. `presets/*.yaml` — parameter **beku**; `gate:`-nya adalah keputusan tertulis.
3. `backtest/strategy.py` (shift(1) anti look-ahead, sizing clamp), `run_backtest.py`
   (urutan eksekusi, cash clamp, exit paths).
4. `paper_trading/live_signal.py` — idempotensi, anti-stale-chase, live-stop check,
   yield/backfill/snapshot, alert.
5. `risk_manager/guards.py` — validate_config batas (risk ≤1, max ≤5, tolak `mode=live`).
6. `db/schema.sql` dan isi `db/paper_trading.db` (data produksi yang di-commit).

**Keamanan & produk**
7. `supabase/migrations/*` yang sudah ter-deploy + kebijakan RLS (terutama
   `harden_profiles_rls`, `fix_rls_policies`, drop paper_* write policies).
8. `lib/bitget.ts` allowlist endpoint read-only (menambah endpoint = melanggar PLAN §9).
9. `lib/encryption.ts`, `lib/csrf.ts`, cron auth (CRON_SECRET timing-safe + fail-fast).
10. Gate pembayaran `checkout` (`PAYMENTS_ENABLED`, larangan `live_assist`) dan
    `webhooks/stripe` handling.
11. Guardrail `checkStrategyGuardrails` + seed `strategy_templates` + rumus discipline score
    (TS dan SQL harus tetap paritas).

**Dokumen & riset**
12. Seluruh dokumen root (README/PLAN/AGENTS/RULES/TASKS/AUDIT) — Phase 0 tidak me-rewrite
    dokumentasi; koreksi dilakukan di phase terpisah dengan catatan.
13. `backtest/reports/**` termasuk `decision_log.md` dan laporan riset (artefak bukti gate).
14. `backtest/research/*.py` + `data/funding` + CSV pair non-config (artefak riset; jangan
    dihapus hanya karena tidak dipakai engine).
15. Angka di `backtest-reference.json` — perubahan = re-backtest + catatan di PLAN.md (AGENTS #2).

**Test & CI**
16. Seluruh `tests/**` dan `e2e/**` (tidak ada modifikasi test di phase ini).
17. `paper-trading.yml` dan `trendsentry-daily-sync.yml` (double-run/scheduler = urusan cutover).

**Infra masa depan**
18. `deploy/**` dan `llm_filter/filter.py` (persiapan Fase 4 / Fase 3 — jangan dianggap dead).

---

## Lampiran A — Sasaran struktur (rekomendasi, TANPA eksekusi)

Struktur yang **didukung kuat oleh kode yang ada** (evolusi minimal, bukan rewrite):

```
backtest/            # engine backtest (CORE) — sudah ada
  research/          # script riset reproducible — sudah ada
  reports/           # laporan resmi (metrics, decision_log, presets) — sudah ada
    research/        # artefak riset — sudah ada
  DESIGN.md
paper_trading/       # engine paper (CORE) — sudah ada
risk_manager/        # guardrail (CORE) — sudah ada
llm_filter/          # Fase 3 (FUTURE) — sudah ada
scripts/             # orkestrasi data/sync/eval — sudah ada
presets/             # preset pack produk — sudah ada
supabase/            # SoT skema Postgres — sudah ada
monitoring/          # telegram + web (produk) — sudah ada
deploy/              # FUTURE VPS — sudah ada
tests/               # pytest — sudah ada
data/
  historical/        # hanya pair config (10)
  research/          # (baru) pindahkan BCH/LTC/PAXG + funding bila restructure disetujui
```

Kesimpulan: **tidak butuh restructure besar**; yang dibutuhkan adalah pemisahan
`data` riset vs produksi dan (opsional) pemisahan artifact output.

## Lampiran B — Bukti eksekusi audit

```
pytest tests/ -q                → 64 passed in 9.70s
npm run typecheck               → exit 0
npm run lint                    → exit 1 (2 errors, 7 warnings)
npm run build                   → exit 0 (32 halaman; route aplikasi semua ƒ dynamic)
sqlite3 db/paper_trading.db     → signals 235, positions 6 (3 closed), slippage 235 (avg 0.0124%),
                                  equity 29 hari, yield 27 hari, cash 723.00, rentang 2026-08-24..2026-09-20
git status (sebelum audit)      → untracked: bh_drawdown_and_btc_eth_corr.md, bh_max_drawdown.md,
                                  monitoring/web/e2e/.auth/
grep referensi                  → EquityCurveChart: 1 match (deklarasi); vectorbt: 0 import;
                                  WebSocket: 0 match di kode; output:'export': tidak ada
```

*Dokumen ini dibuat tanpa mengubah file sumber mana pun selain menambahkan `REPO_MAP.md` itu sendiri.*
