# ARCHITECTURE.md — Arsitektur Aktual TrendSentry

> **Dokumen fakta (code aktual adalah source of truth).** Ditulis dari audit `REPO_MAP.md`
> (Phase 0, HEAD `3a4dae8`, diverifikasi ulang 2026-09-22).
> Dokumen ini menggambarkan **yang berjalan sekarang**, bukan roadmap.
> Roadmap & keputusan historis ada di `PLAN.md`; aturan di `AGENTS.md` / `RULES.md`;
> hasil audit kebersihan kode di `REPO_MAP.md`.

---

## 1. System Overview

TrendSentry hari ini terdiri dari **dua subsistem dalam satu repository**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ A. TRADING ENGINE (Python) — dogfood Cluster-A2                              │
│                                                                              │
│  Bitget public API ─► backtest/strategy.py ─► paper_trading/live_signal.py    │
│  (ccxt, tanpa API key)   (Donchian/ATR/size)        │                        │
│                                                     ├─► SQLite db/paper_     │
│                                                     │   trading.db           │
│                                                     ├─► Telegram alert       │
│                                                     └─► sync ──┐             │
└─────────────────────────────────────────────────────────────────┼─────────────┘
                                                                  │ HTTPS + CRON_SECRET
┌─────────────────────────────────────────────────────────────────▼─────────────┐
│ B. USER PRODUCT (Next.js 16 + Supabase) — deploy di Vercel                     │
│                                                                              │
│  Browser ─► proxy.ts ─► server components / API routes ─► Supabase Postgres   │
│                                      │                                        │
│                                      └─► Bitget REST (read-only, HMAC user    │
│                                          key terenkripsi: fills + assets)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **A** menghasilkan sinyal & posisi **paper** (modal riil Rp/USD 0), state di SQLite,
  disinkronkan ke Supabase supaya **B** bisa menampilkan dashboard publik.
- **B** adalah produk disiplin untuk user: simpan strategi, simpan API key **read-only**,
  tarik **fills** harian user, deteksi **deviasi**, hitung **discipline score**.
- **TIDAK ADA** order submission, live execution, atau LLM filter aktif di kedua subsistem
  (rincian: §15).

---

## 2. Repository Boundaries

| Area | Batas keras |
|---|---|
| `backtest/`, `paper_trading/`, `risk_manager/` | Engine Python. Satu-satunya tempat logika sinyal/sizing/exit. |
| `monitoring/web/` | Frontend + backend produk. **Tidak boleh** berisi logika signal/entry/exit/risk/DB trading (AGENTS.md #9). Boleh: logika produk disiplin miliknya sendiri (guardrail, deviasi, skor). |
| `monitoring/web` → order | **Dilarang permanen** — tidak ada jalur order di web (PLAN.md §9 amendemen 2026-09-11, terverifikasi audit). |
| `supabase/migrations/` | Satu-satunya source of truth skema Postgres. |
| `config.yaml` | Satu-satunya source of truth parameter strategi/risk (preset = salinan terkunci test). |
| `db/schema.sql` + `db/paper_trading.db` | Skema & state SQLite engine (DB di-commit = accepted risk, backup off-disk). |
| `deploy/`, `llm_filter/` | Persiapan fase mendatang — **bukan** bagian sistem yang berjalan. |
| `backtest/research/`, `backtest/reports/research/` | Riset terpisah dari engine; meng-`import` engine, tidak mengubahnya. |

```
Repo
├── engine Python (A)     backtest/ paper_trading/ risk_manager/ monitoring/telegram_alert.py
├── orkestrasi            scripts/ .github/workflows/ cli.py config.yaml
├── produk web (B)        monitoring/web/  → Supabase (schema: supabase/migrations/)
├── masa depan            llm_filter/ (disabled) deploy/ (belum dijalankan)
└── riset & bukti         backtest/research/ backtest/reports/ presets/
```

---

## 3. Python Engine

| File | Peran |
|---|---|
| `backtest/strategy.py` | Indikator `donchian_high/low` (`.shift(1)` anti look-ahead), `atr` (Wilder seed), `sma`, `rsi`; `position_size` (risk 1% ÷ stop, clamp equity, tanpa leverage); `cluster_position_count` |
| `backtest/run_backtest.py` | Simulasi portfolio, `compute_metrics`, `save_report` |
| `paper_trading/live_signal.py` | Engine harian: fetch → indikator → exit/entry → SQLite → alert (595 baris, 1 file) |
| `risk_manager/guards.py` | `validate_config` (guardrail startup), `CircuitBreaker` (belum diintegrasikan ke loop — by design, Fase 4), re-export `position_size` |
| `monitoring/telegram_alert.py` | Alert ENTER/EXIT/STOP/CRASH |
| `llm_filter/filter.py` | Kontrak filter Fase 3 — **skeleton, nonaktif** (`llm_filter.enabled: false`) |
| `config.yaml` | Semua parameter (strategy, risk, paper, backtest, llm, execution) |

Eksekusi: GitHub Actions harian (§13), `cli.py` lokal, atau `python paper_trading/live_signal.py`.
Market data: **API publik Bitget via ccxt tanpa API key** (exchange-order-book & ticker publik).

---

## 4. Backtest Flow

```
data/historical/{PAIR}_1d.csv          ◄── scripts/fetch_bitget_data.py (Bitget, manual/dispatch)
        │
        ▼
load_config()  = config.yaml  (+ overlay presets/*.yaml bila env PRESET diset)
        │
        ▼
load_ohlcv() → indikator (ATR seed Wilder, Donchian shift(1), SMA/RSI utk preset)
        │
        ▼
run_backtest()  — entry di OPEN hari berikutnya setelah sinyal close (anti look-ahead)
        │         exit: close≤stop | close<don(10) | open≤stop (gap stop)
        │         fee 0.1% + slippage 0.05% | clamp cash | max 5 posisi + 2/cluster
        ▼
compute_metrics() → return, CAGR, Sharpe/Sortino (√365), max DD, win rate, avg R, PF, vs B&H
        │
        ▼
save_report() → backtest/reports/  (equity_curve.csv, trades.csv, equity_drawdown.png, metrics.md)
```

- Dijalankan **manual** (bukan scheduler).
- Angka referensi: **dua snapshot hidup berdempetan — lihat §16 (keputusan pending).**

---

## 5. Paper Trading Flow

```
GitHub Actions  cron 0 1 * * * UTC  (.github/workflows/paper-trading.yml)
 1. pip install → python -m pytest tests/        # suite merah = run mati
 2. python paper_trading/live_signal.py
      validate_config ──gagal──► alert + exit 1
      live stop check (semua posisi open vs ticker)
      per pair (10): fetch_ohlcv 1d
        • proses hanya candle CLOSED terakhir (anti stale-chase)
        • idempoten: UNIQUE(candle_date,pair) → tidak pernah duplikat
        • slippage: order book, dedupe 1/pair/hari
        • exit: close≤stop | close<don(10) | live≤stop | open≤stop
        • entry: close>don(20) ∧ n_open<5 ∧ cluster<2
             └► (LLM filter HANYA bila enabled — saat ini tidak dipanggil)
             └► position_size → INSERT positions → set_cash → alert ENTER
        • INSERT signals (HOLD pun dicatat)
      yield 5% APY (idempoten per tanggal) → equity snapshot (cash+MTM) + backfill
 3. python scripts/sync_paper_to_supabase.py     # SQLite → /api/cron/paper-sync (§7)
 4. git add -f db/paper_trading.db && git commit && git push   # persist + backup
 5. gagal ──► alert Telegram "[paper-trading] workflow FAILED"
```

Sifat: **dummy execution** — tidak pernah mengirim order; exit dihitung dari harga.

---

## 6. SQLite Persistence

- DDL: `db/schema.sql` (dijalankan `executescript` tiap start engine, idempoten).
- State: `db/paper_trading.db` (di-commit ke repo tiap run = backup off-disk; accepted risk).

| Tabel | Isi | Kunci |
|---|---|---|
| `meta` | `paper_cash`, `lastRun`, `last_yield_date` | `key` |
| `signals` | semua sinyal/hari/pair termasuk HOLD | `UNIQUE(candle_date,pair)` = idempotensi |
| `positions` | posisi paper (entry/exit/stop/r_multiple/exit_reason) | `id` |
| `slippage_log` | spread order book per signal | dedupe 1/pair/hari |
| `yield_log` | kredit yield harian | `UNIQUE(date)` |
| `equity_log` | total = cash + MTM | `date` PK, upsert harian |
| `sync_state` | watermark inkremental sinkron ke Supabase | per-tabel |

Pembaca: engine, `cli.py watcher`, `scripts/compare_live_vs_backtest.py`,
`scripts/sync_paper_to_supabase.py`. **Web tidak pernah membaca file ini.**

---

## 7. Supabase Synchronization

Arah: **satu jalur, SQLite → Supabase** (web hanya membaca Supabase).

```
live_signal.py ──► SQLite ──► scripts/sync_paper_to_supabase.py
                                │  watermark inkremental (sync_state):
                                │  append-only: id > last_id / date > last_date
                                │  positions: open semua + closed ≤30 hari (status ikut update)
                                ▼
                   POST https://<vercel>/api/cron/paper-sync
                   Header: Authorization: Bearer <CRON_SECRET>   (timing-safe, fail-fast)
                                ▼
                   Validasi PaperSyncSchema (cap 5000, pick kolom allowlist)
                                ▼
                   Supabase upsert per tabel (onConflict: signals=candle_date,pair,
                   positions=id, equity_log=date, yield_log=date, meta=key)
                                ▼
                   watermark dimaju HANYA setelah HTTP 200
```

- **Skema Postgres: `supabase/migrations/*.sql` (10 file) = source of truth.**
  (Bukan `db/migrations/` — path itu tidak pernah ada.)
- **Seed 8 `strategy_templates` built-in** = migration `20260922120000_insert_builtin_strategy_templates.sql`
  (`INSERT … ON CONFLICT (name) DO NOTHING`, ID 1–8 eksplisit + sinkron sequence).
  Ini **satu-satunya** mekanisme seed — berlaku untuk DB segar maupun yang sudah terisi
  (no-op, tanpa overwrite). `supabase/seed.sql` & blok `[db.seed]` di `config.toml` **dihapus**
  (file tak pernah ada; payload tidak diduplikasi). Ubah template = migration baru, forward-only.
- Tabel `paper_*` = mirror dashboard; tabel `user_*`/`profiles` = domain produk.
- RLS aktif di semua tabel + event trigger auto-enable tabel baru.

---

## 8. Next.js Backend / API

Next.js **16 (App Router)** di Vercel, 14 API route di `monitoring/web/app/api/`:

| Kategori | Route | Auth |
|---|---|---|
| Sinkron paper | `cron/paper-sync` (POST) | Bearer `CRON_SECRET` |
| Ingest harian user | `cron/daily-sync` (GET) | Bearer `CRON_SECRET` |
| Produk user (CRUD) | `strategies`, `trades`, `deviation-log`, `discipline`, `templates` | session + CSRF |
| API key user | `api-keys` (GET/POST) | session + CSRF; POST verifikasi **read-only** via Bitget |
| Market proxy | `prices` (GET) | rate limit 60/mnt/IP, cache 30s |
| Analytics | `events` (POST) | CSRF + rate limit 30/mnt/IP |
| Billing | `checkout`, `webhooks/stripe` | session / signature Stripe; gated `PAYMENTS_ENABLED` |
| Akun | `account/password`, `account/delete` | session + **re-auth password** |

Middleware: `proxy.ts` (konvensi Next 16) — gate `/app/*` (wajib login) dan `/auth/*`.
Layer lib: `supabase/{server,client,admin}.ts`, `csrf.ts`, `rate-limit.ts`,
`encryption.ts` (AES-GCM), `bitget.ts` (HMAC + allowlist **read-only**),
`deviation.ts`, `validations.ts` (zod + guardrail), `reference.ts`.

---

## 9. Frontend

Kategori route (App Router):

```
/ , /start , /proof , /live , /pricing , /disclaimer      Marketing (publik, SiteShell)
/papertrading , /papertrading/log                          Data paper publik (force-dynamic)
/auth/signup , /auth/login , /auth/callback , /auth/signout
/app/dashboard , /app/strategies(+new) , /app/deviation-log , /app/settings
                                                          Aplikasi user (server component + RLS)
/api/* (14)                                                Backend (bukan halaman)
```

- Render: **server components dinamis** (semua route data `ƒ dynamic`) — **bukan static export.**
- Data publik: Supabase **admin client** (service role) saat request.
- Data user: session cookie + **RLS** (server client biasa).
- Realtime harga: **REST polling `/api/prices` tiap 3 detik** dari client —
  **tidak ada WebSocket.**
- Charts: Recharts (`EquityChart`, `ScoreTrendChart`, `LiveSection`).

---

## 10. User Strategy Flow

```
signup (Supabase Auth) ─► /auth/callback (token_hash verifyOtp)
   │
   ▼
/app/strategies/new ─► POST /api/strategies
   │                    guardrail: long_only, risk ≤1%, max_concurrent ≤5
   ▼
/app/settings ─► POST /api/api-keys
   │              1. verifySpotReadAccess (hanya endpoint read Bitget)
   │              2. encrypt AES-GCM → user_api_keys
   ▼
setiap hari 01:30 UTC: GET /api/cron/daily-sync
   │  listUsers → ambil key → decrypt → fetch fills (read-only) → user_trades
   │  atribusi ke strategi HANYA bila tepat 1 strategi aktif
   ▼
checkDeviation(trade, strategi) ─► deviation_log ─► recompute discipline_score
   ▼
dashboard /app/* menampilkan strategi, fills, deviasi, skor
```

`user_trades` = **log fill** (tanpa kolom pnl/exit_price) — disengaja.

---

## 11. Deviation Detection

- Sumber aturan: `strategy.params` + `strategy.rules_json` (dibaca `lib/deviation.ts::parseRules`).
- Aturan terdeteksi: `direction` (long_only vs sell), `allowed_pairs`, `position_sizing`
  (deviasi risk/sizing), `stop_loss` (entry tanpa SL), `max_daily_trades`, `min_holding_days`,
  `no_trade_hours`, `max_position_size_pct`.
- Severity: `critical` (melanggar hard rule) vs `warning`.
- Dipanggil dari: `POST /api/trades` (input manual) dan `GET /api/cron/daily-sync` (fill otomatis).
- Tidak pernah memblokir trade — **mencatat** (read-only terhadap perilaku trading user).

---

## 12. Discipline Scoring

```
deviation_log berubah
   ├─► aplikasi TS : calculateDisciplineScore()  = 100 − 25×critical − 10×lainnya (clamp 0..100)
   └─► database    : trigger trg_recalc_discipline (migration 20260912130000) — formula sama
```

- **Dua implementasi, satu formula** — wajib paritas (diberi komentar di kedua tempat;
  belum ada test paritas otomatis → dicatat sebagai risiko drift di `REPO_MAP.md` §14).
- Trigger menjamin skor tidak basi walau `deviation_log` diisi luar jalur aplikasi.

---

## 13. Scheduled Jobs

| # | Scheduler | Aksi | Status |
|---|---|---|---|
| 1 | `paper-trading.yml` — cron `0 1 * * *` UTC | pytest → engine → sync → commit DB → failure alert | **aktif** |
| 2 | `trendsentry-daily-sync.yml` — cron `30 1 * * *` UTC | `GET /api/cron/daily-sync` (CRON_SECRET) → fills user → deviasi → skor | **aktif** |
| 3 | `fetch-bitget-data.yml` — manual (dispatch) | refresh CSV historis + commit `data/historical/` | manual |
| 4 | `test-bitget-api.yml` — manual (dispatch) | probe konektivitas Bitget (one-off 2026-08-25) | usang — kandidat diarsipkan |
| — | crontab lokal | **dibatalkan** (laptop tidak always-on) | tidak aktif |
| — | `db/backup_db.sh` via cron lokal `5 1 * * *` | backup SQLite 14 hari | **tidak terjadwal lagi** (jalur backup resmi = commit DB di CI) |
| — | Vercel Cron | tidak ada — daily-sync dipicu GitHub Actions | n/a |

---

## 14. Security Boundaries

| Area | Mekanisme (terverifikasi di kode) |
|---|---|
| Cron endpoints | `CRON_SECRET` timing-safe compare + **fail-fast 500** bila secret kosong |
| API key user | hanya endpoint **read** (`/api/v2/spot/account/assets`, `/api/v2/spot/trade/fills`) — allowlist tertutup di `lib/bitget.ts` |
| Enkripsi key | AES-GCM + IV acak; PBKDF2 100k (path legacy dipertahankan) |
| CSRF | `validateOrigin` allowlist (`ALLOWED_ORIGINS`) di semua route mutasi |
| Rate limit | in-memory per-IP (`x-real-ip`, fallback hop XFF) — keterbatasan cold start terdokumentasi |
| Data user | RLS di semua tabel + hardening profiles (SELECT saja) + event trigger auto-enable |
| Akun | password policy (min 10 + karakter); hapus akun = re-auth + `deleteUser` (FK cascade) |
| Web security headers | CSP + HSTS di `next.config.ts` |
| Re-auth | ganti password & hapus akun butuh password saat ini |
| Engine | tanpa API key exchange (data publik); `.env` tidak pernah ter-commit (terverifikasi git history) |
| Payments | Stripe webhook signature check; gate `PAYMENTS_ENABLED` |

---

## 15. Live Execution Boundary

**Fakta (bukan rencana):** repo ini **tidak bisa** menjalankan order hari ini.

```
Tidak ada di repo:                 Penjaga yang memastikan:
  execution/ (folder)                validate_config → ValueError bila execution.mode == "live"
  createOrder / submitOrder          cli.py live → ditolak tanpa --dry-run
  jalur order di web                 lib/bitget.ts hanya allowlist READ
  LLM filter aktif                   llm_filter.enabled: false → filter tidak dipanggil
```

- Live execution = **Fase 4, GATED** (gate Fase 2 belum lolos: butuh ≥10 trade tertutup
  & 8 minggu). Stack yang **dikunci lewat amendemen 2026-09-11: Python + ccxt**
  (bukan Node.js).
- Desain envelope Fase 4 (paritas paper/live, stop berlapis, circuit breaker 15%,
  dry-run, modal $50-100) ada di `PLAN.md` §3 — **rencana, belum implementasi.**
- Perilaku yang **tidak ada & tidak boleh ditambah implisit**: martingale/averaging-down,
  auto-increase risk, auto-top-up, order dari server.

---

## 16. Source-of-Truth Map

| Domain | Source of truth | Salinan yang harus disinkronkan |
|---|---|---|
| Parameter strategi & risk | `config.yaml` | `presets/*.yaml` (terkunci `test_parameter_beku`), `lib/constants.ts PAIRS/STARTING_CASH` |
| Skema SQLite | `db/schema.sql` | — |
| Skema Postgres | **`supabase/migrations/*.sql`** | — (`db/migrations/` tidak ada) |
| Paper trading data (untuk web) | Supabase `paper_*` (mirror) ← SQLite `db/paper_trading.db` (asli) | arah sinkron satu jalur §7 |
| Guardrail strategi (web) | `lib/validations.ts GUARDRAILS` | `risk_manager/guards.py` (engine), seed `20260911120000` + `20260922120000` (template) |
| Formula discipline score | `lib/deviation.ts` **dan** trigger SQL — keduanya identik, wajib paritas | — |
| Web strategy model | Supabase `user_strategies` + `strategy_templates` | `lib/deviation.ts::parseRules` (interpretasi) |
| Business/product rules | `PLAN.md` §9 | komentar kode: `lib/bitget.ts`, checkout gate, `validate_config` |
| Decision log | `backtest/reports/decision_log.md` | `TASKS.md`, `AUDIT.md` (kronologis) |

### METRIC SOURCE OF TRUTH — **PENDING (keputusan canonical belum diambil)**

> **Reference metric discrepancy — see canonical source decision pending.**
>
> Ada **dua snapshot metrik backtest yang hidup berdempetan** dan **keduanya tidak boleh
> diubah/dipilih sepihak** sebelum keputusan owner + (bila perlu) re-run backtest:
>
> | Metrik | Snapshot A — `backtest/reports/metrics.md` & `backtest/DESIGN.md` §6.1 | Snapshot B — `monitoring/web/lib/backtest-reference.json` & `TASKS.md` |
> |---|---|---|
> | Total return | +149.59% | +152.0% |
> | Max drawdown | −26.19% | −26.45% |
> | Avg win R / Avg loss R | +4.31 / −0.84 | +4.35 / −0.85 |
> | Avg R / Profit factor | +1.02 / 2.26 | +1.03 / 2.27 |
> | Sharpe / Trades / Win rate / B&H | 0.82 / 94 / 36.17% / +155.03% | **sama** |
>
> - Snapshot B diperbarui setelah fix RSI/ATR Wilder seed (P2-7, 2026-09-12);
>   Snapshot A adalah keluaran runner yang tidak ditulis ulang pada saat itu.
> - Kode memakai **Snapshot B** (`backtest-reference.json` dibaca `lib/reference.ts`
>   dan `scripts/compare_live_vs_backtest.py`) — tetapi **itu bukan pemilihan canonical**,
>   hanya fakta implementasi.
> - **Jangan** "mengkonsistenskan" angka dengan mengedit salah satu file.
>   Resolusi butuh: keputusan owner → re-run backtest config beku → tulis ulang
>   SEMUA kutipan dari satu sumber, dicatat di `PLAN.md`.

---

## 17. Current vs Future Components

| Komponen | CURRENT (berjalan) | FUTURE (direncanakan/di-gate) |
|---|---|---|
| Backtest engine | ✅ manual + riset | — |
| Paper trading engine | ✅ harian via GitHub Actions | — |
| SQLite state | ✅ | — |
| Sinkron Supabase | ✅ inkremental + watermark | — |
| Web produk (auth, strategi, key, deviasi, skor) | ✅ Vercel + Supabase | — |
| Dashboard paper publik | ✅ | — |
| Billing Stripe | ⚙️ kode ada, **gated** (`PAYMENTS_ENABLED`) | aktifkan saat siap jual |
| LLM filter | ❌ skeleton nonaktif | **Fase 3** — gate Fase 2 lolos dulu |
| Discord notify | ❌ (tidak ada kode) | Fase 3 (belum dikerjakan) |
| Live execution | ❌ **tidak ada** | **Fase 4, GATED** — Python + ccxt, envelope di PLAN §3 |
| Circuit breaker di loop paper | ❌ by design | integrasi di Fase 4 |
| VPS/Docker (`deploy/`) | ❌ belum pernah dibuild | cutover VPS (RUNBOOK) |
| CLI (`cli.py`) | ✅ backtest/paper/watcher/doctor; `live` hanya `--dry-run` | otomasi live-runner CLI |
| Preset pack | ✅ 3 preset (2 gagal gate — dipublikasikan apa adanya) | distribusi publik |

---

*Dokumen ini dijaga sinkron dengan kode pada setiap perubahan arsitektur.
Perubahan arsitektur → update `ARCHITECTURE.md` + `REPO_MAP.md` di commit yang sama.*
