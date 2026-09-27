# PHASE 2A — Source of Truth & Dead-Code Audit

> Audit **read-only**: tidak ada file yang dihapus, tidak ada kode/config/strategy/schema/migration/
> behavior yang diubah. Satu-satunya perubahan repo dari phase ini = dokumen ini + 2 koreksi dokumen
> kecil (lihat §7.10). Baseline: HEAD `2ff0727` (post Phase 1). Tanggal audit: **2026-09-22**.
>
> Metode: baca kode aktual sebagai source of truth, grep seluruh repo (source code, bukan cache
> `.next`/`node_modules`), `git log`/`git show` untuk provenance angka, dan **satu re-run backtest
> terisolasi** ke `/tmp/opencode/metric_repro` (via `REPORT_SUBDIR`, tidak menyentuh artefak repo —
> `git status` tidak berubah setelah re-run). Detail di §7.1.

---

## 1. Canonical sources

| Domain | Canonical source | Derived copies | Drift risk | Action |
| --- | --- | --- | --- | --- |
| Pair list (10 pair) | `config.yaml` → `strategy.pairs` | `monitoring/web/lib/constants.ts` `PAIRS` (hardcoded, dipakai daily-sync/prices); `presets/donchian_cluster_a2.yaml` (frozen, dijaga test); `data/historical/*.csv` (BCH/LTC/PAXG = sisa riset, tidak di config) | **MEDIUM** — 2 live code copy (Python baca config, web baca constants.ts), tanpa sync otomatis | DOCUMENT; perubahan pair wajib edit 2 tempat |
| Timeframe `1d` | `config.yaml` → `strategy.timeframe` | presets (frozen), docs | LOW | KEEP |
| Donchian 20/10, ATR 14, ×2.0 | `config.yaml` → `strategy.*` | `presets/*.yaml` (frozen test fixture — `tests/test_presets.py` + `tests/test_parameter_beku.py` assert config==preset, **intentional**); `strategy.py` **tidak punya default** (arg wajib — bagus); baris template di `strategy_templates` (lihat gap §7.6) | MEDIUM | KEEP; template rows = gap terpisah |
| Risk % (`1.0`) | `config.yaml` → `risk.risk_per_trade_pct` | literal bound `1.0` di `risk_manager/guards.validate_config`; `GUARDRAILS.maxRiskPerTradePct = 1.0` di `lib/validations.ts`; `maximum: 1.0` di seed migration params_schema; teks `RULES.md` | **MEDIUM** — nilai sama hari ini, tapi 4 lokasi kode harus diganti bersama kalau pernah berubah | DOCUMENT coupling; jangan ubah satu-satunya |
| Max concurrent (`5`) | `config.yaml` → `risk.max_concurrent_positions` | literal bound `1..5` di guards; `GUARDRAILS.maxConcurrent = 5`; `maximum: 5` seed; presets | MEDIUM | DOCUMENT (sama dengan di atas) |
| Max per cluster (`2`) | `config.yaml` → `strategy.max_positions_per_cluster` | presets; `live_signal.py` baca `.get("max_positions_per_cluster", 0)` — **fallback 0 = cluster-limit nonaktif kalau key hilang** (guard startup tetap menolak config tanpa key ini: validasi `1..5`) | LOW–MEDIUM | DOCUMENT fallback semantics |
| Fee `0.1%` / slippage `0.05%` | `config.yaml` → `backtest.*` | literal bound fee `0..5`/slip `0..2` di guards; `slippageAssumptionPct: 0.05` + `slippageAlertMult: 2` di `backtest-reference.json` (copy untuk web/alert); footer `metrics.md` | MEDIUM | DOCUMENT (json = copy asumsi, bukan config) |
| Starting cash `1000` | `config.yaml` → `backtest.initial_capital_usd` | `constants.ts` `STARTING_CASH = 1000`; fallback `1000.0` di `live_signal.py` | MEDIUM | DOCUMENT |
| APY idle cash `5.0` | `config.yaml` → `paper_trading.yield_apy_idle_cash` | `db-supabase.ts` `apyAssumed` (tampilan `@5%`); fallback `0.0` di `live_signal.py` (hilang → yield 0, fail-safe) | MEDIUM | DOCUMENT |
| Long-only rule | `config.yaml` `direction` + **struktural** (engine tidak punya kode short sama sekali) | `validate_config` (tolak ≠ `long_only`); `GUARDRAILS.direction`; seed `enum ["long_only"]`; `deviation.ts` cek arah | — | KEEP semua lapisan: **intentional defense-in-depth** (PLAN §9 amendemen 2026-09-11) |
| Angka backtest referensi | **PENDING owner decision** (§7.1) | `backtest/reports/metrics.md` (snapshot A), `lib/backtest-reference.json` (snapshot B, dipakai runtime), `DESIGN.md` §6.1, `TASKS.md`, `README.md:98`, `disclaimer/page.tsx`, komentar `config.yaml` + `presets/donchian_cluster_a2.yaml` | **HIGH** —inkonsistensi publik nyata (disclaimer mencampur A & B dalam 1 halaman) | OPEN DECISION §7.1 — **jangan edit angka sebelum keputusan** |
| Discipline score | Formula di DUA tempat: `lib/deviation.ts` + trigger SQL `20260912130000` (keduanya "canonical" untuk kasusnya) | `discipline_scores` = tabel turunan | MEDIUM — tanpa parity test | lihat §2b; parity test = open decision |
| State paper trading | `db/paper_trading.db` (TRACKED, di-commit harian `[paper-trading] update DB state`) + skema `db/schema.sql` | `db/backups/` (ignored, lokal) | LOW | KEEP — jangan hapus |
| Skema produk (Supabase) | `supabase/migrations/` (17 file) | remote Postgres (applied state) | — | KEEP |
| **Baris `strategy_templates`** | **TIDAK ADA di repo** — hanya ada di remote DB | migrasi hanya bikin tabel + `UPDATE params_schema`; **tidak ada satu pun `INSERT` di migrations** | **HIGH gap** — default template tidak ter-version | OPEN DECISION §7.6 |
| Data OHLCV harian | `data/historical/*.csv` (TRACKED), digenerate `scripts/fetch_bitget_data.py` via workflow | — | LOW | KEEP |

Kontradiksi dokumen-vs-kode yang ditemukan phase ini (catatan, TIDAK diperbaiki di sini):

1. Docstring `guards.validate_config` bilang "dicek DI AWAL semua entry point (paper, live, **backtest**)" — kenyataannya hanya dipanggil `paper_trading/live_signal.py` dan `cli.py` (doctor). **`run_backtest.py` tidak memanggil `validate_config` sama sekali.**
2. Komentar `config.yaml` & preset donchian mengutip DD `-26.19%` (snapshot A) sementara runtime SoT (`backtest-reference.json`) memakai `-26.45%` (snapshot B).
3. `disclaimer/page.tsx` mencampur snapshot: baris 18 memakai A (`−26.19%`), baris 25 memakai B (`+152%`).
4. `TASKS.md` baris 18 (catatan gate historis) mengutip A (`DD -26.19%`) — diklasifikasikan **historical record**, dibiarkan + sudah dianotasi Phase 1 di baris 33.

---

## 2. Duplicate implementations

| Domain | Implementation A | Implementation B | Intentional? | Action |
| --- | --- | --- | --- | --- |
| Position sizing (matematika risk) | `backtest/strategy.py::position_size` | `risk_manager/guards.py` re-export `from backtest.strategy import position_size` | **YA** — eksplisit dengan komentar "re-export, source of truth tunggal, anti-drift" di docstring guards | KEEP (bukan duplikasi) |
| Gerbang max-concurrent | `guards.can_open_position(n_open, max)` (exported + 2 assert di `test_risk.py`) | inline `len(pos) < risk["max_concurrent_positions"]` di `run_backtest.py:128` DAN inline `n_open < risk["max_concurrent_positions"]` di `live_signal.py:476` | **TIDAK** — helper diuji tapi **tidak pernah dipanggil engine mana pun** (duplikasi accidental; semantik identik, tidak ada bug) | REFACTOR (nanti): wire engine ke helper, atau terima + DOCUMENT |
| Discipline score | `lib/deviation.ts::calculateDisciplineScore` (application layer) | trigger `trg_recalc_discipline` (database layer) | **YA** — defense-in-depth: trigger menutup skor yang basi kalau `deviation_log` diubah/dihapus di luar API (koreksi manual) | KEEP keduanya; lihat §2b — parity test belum ada |
| Enforce long-only | `guards.validate_config` | `GUARDRAILS` + seed enum + `deviation` rule + struktur engine tanpa kode short | **YA** (berlapis, dokumentasi PLAN §9) | KEEP semua |
| Bound risk ≤1% / max ≤5 | literal di `guards.validate_config` | konstanta `GUARDRAILS` (product envelope) | **YA** di tingkat kebijakan, tapi angkanya **manual sync** — diverifikasi sama per 2026-09-22 | DOCUMENT |
| Sharpe/Sortino backtest | `run_backtest.py` (period metric) | `daily-sync` `sharpeFromEquity` (rolling equity live) + `test-fair-fee-ads` | **YA** — cakupan berbeda (backtest period vs live equity) | KEEP |
| Kirim Telegram | `paper_trading/telegram_alert.py` (engine Python) | `lib/telegram.ts` (product web) | **YA** — domain berbeda, dependensi berbeda | KEEP |
| Komponen kurva equity | `app/app/dashboard/EquityCurveChart.tsx` (**mati**, 0 importer) | `app/components/EquityChart.tsx` (dipakai `PaperLiveBoard`) | **TIDAK** — duplikat accidental | DELETE candidate → §4 |
| Angka metrik backtest | `backtest/reports/metrics.md` (A) | `lib/backtest-reference.json` (B) + kutipan di docs/public pages | **TIDAK** — A stale pasca P2-7 | regenerate setelah keputusan §7.1 |
| Konstanta start-cash / APY / pairs / slippage | `config.yaml` | `constants.ts`, `db-supabase.ts`, `backtest-reference.json` | Derived copies tanpa sync otomatis | DOCUMENT drift risk (§1) |

### 2a. Risk & guardrail — klasifikasi 4 lapis

| Lapis | Lokasi | Isi | Nature |
| --- | --- | --- | --- |
| **A. Engine safety rules** | `risk_manager/guards.py` (`validate_config`: risk 0..1, max 1..5, cluster 1..5, ATR mult >0, CB >0..≤50, fee 0..5, slip 0..2, `mode != live`, `exchange = bitget`, `direction = long_only`; `CircuitBreaker`; `can_open_position`); `strategy.position_size` (raise kalau stop ≥ entry, clamp by equity); `cluster_position_count` | rule teknis yang dijalankan saat runtime engine | Defense-in-depth inti; **duplikasi dengan B = intentional** (policy layer terpisah dari config) |
| **B. Product input validation** | `lib/validations.ts` `GUARDRAILS` + `checkStrategyGuardrails` (direction enum, risk >0 && ≤1.0, max 1..5); `deviation.ts` cek arah | envelope yang mengikat input user di web meski config/guards di backend tidak terbaca | **Intentional** (dinyatakan di komentar file + PLAN §9) |
| **C. Database constraints** | **TIDAK ADA** untuk params — `rules_json`/`params` = jsonb tanpa CHECK constraint; RLS hanya soal akses baris, bukan validasi angka. (Trigger `discipline_scores` = integritas tabel turunan, bukan constraint param) | — | Celah yang diketahui: DB tidak memvalidasi bound; semua validasi di A/B |
| **D. Template defaults** | `20260911120000_seed_strategy_templates.sql` `params_schema`: direction default `long_only`, risk default 1.0 (min 0.1, max 1.0), max_concurrent default 5 (1..5) | default + min/max metadata untuk form bikin strategi | Konsisten dengan A/B (nilai identik); **baris template induknya sendiri tidak ter-version** → §7.6 |

Tidak ditemukan **conflicting implementation** (semua bound bernilai sama per 2026-09-22). Yang accidental hanya: `can_open_position` tidak terpasang di engine, dan bound literal berulang di ≥3 tempat tanpa satu sumber.

### 2b. Discipline score — detail

- **Formula** — identik di dua tempat:
  `score = 100 − critical×25 − (total − critical)×10`, dijepit `0..100`.
  - TS (`lib/deviation.ts`): `score -= criticalDeviations * 25; score -= (total − critical) * 10; Math.max(0, Math.min(100, score))`.
  - SQL trigger: `greatest(0, least(100, 100 − v_critical*25 − (v_total − v_critical)*10))`.
- **Inputs**: baris `deviation_log` per `(user_id, strategy_id, tanggal)` — TS: filter `severity = 'critical'` untuk kritikal, semua baris untuk total; SQL: `count(*) filter (where severity='critical')` + `count(*)`. `total_trades` = jumlah `user_trades` pada jendela yang sama (keduanya).
- **Kapan dieksekusi**:
  - TS: dipanggil aplikasi **setelah API menulis deviasi** (`POST /api/trades`, `daily-sync`) → `upsert discipline_scores` (`onConflict: user_id,strategy_id,date`).
  - SQL: trigger `AFTER INSERT OR UPDATE OR DELETE` **setiap baris** `deviation_log` → recompute idem-poten (upsert, `do update set ...`). Menutup perubahan di luar API (koreksi manual/heatmap delete).
- **Equivalence**: aritmetika identik. Dua beda mikro yang diketahui:
  1. Jendela waktu: TS memakai closed interval `T00:00:00Z..T23:59:59Z` (resolusi detik), SQL memakai half-open `[tanggal, tanggal+1)`. Baris `detected_at` pada detik pecahan `23:59:59.x` dihitung SQL, terlewat TS — hanya teoretis.
  2. `strategy_id IS NULL`: trigger **skip recompute** (guard eksplisit), dan hitungan SQL tidak pernah cocok dengan NULL; TS selalu dipanggil dengan `strategyId` sehingga baris strategy-null juga tidak ikut hitungannya — praktis setara, tapi tidak ada yang menjamin baris strategy-null diperiksa.
- **Automated parity test: TIDAK ADA.** Tidak ada unit test TS (repo tidak pakai vitest/jest), dan pytest tidak menyentuh trigger ini. → open decision §7.9.

---

## 3. Dependency audit

| Dependency | Production | Test | Research | Historical | Verdict |
| --- | --- | --- | --- | --- | --- |
| `ccxt` | ✓ `paper_trading/live_signal.py`, `scripts/fetch_bitget_data.py` | — | — | — | **KEEP** |
| `pandas` | ✓ engine (`run_backtest`, `strategy`, `live_signal`, fetch) | ✓ | ✓ | — | **KEEP** |
| `numpy` | ✗ tidak di-import kode produksi (engine murni pandas) | ✓ `test_strategy.py` | ✓ `regime_segmentation`, `sharpe_benchmark` | juga transitive dependency `pandas` | **KEEP** (test + research + transitive) |
| `matplotlib` | ✓ `run_backtest.py` **opsional** (try/except — kalau ada, PNG digenerate; kalau tidak, non-fatal) | — | ✓ 3 script riset | — | **KEEP** |
| `vectorbt` | ✗ | ✗ | ✗ | **0 import di seluruh repo** (grep `.py` di luar `venv/` = nol) | **UNUSED** — kandidat keluar dari `requirements.txt` → §7.2. **Tidak dihapus di phase ini.** |
| `pytest` | ✗ | ✓ (+ CI) | — | — | **KEEP** (test dep) |
| `PyYAML` | ✓ `run_backtest`, `live_signal`, `fetch_bitget_data`, `cli` | ✓ `test_presets` | ✓ | — | **KEEP** |
| `requests` | ✗ | ✗ | ✓ **hanya** `backtest/research/fetch_funding.py` | — | **KEEP** — research-only; kandidat pindah ke `requirements-research.txt` (§7.5) |
| `rich` | ✓ **hanya** `cli.py` (operational tooling) — `live_signal` TIDAK memakai `rich` | — | — | — | **KEEP** (catatan: CI `paper-trading.yml` memasang `rich` tanpa pemakai — redundansi minor, bukan urusan phase ini) |
| `yfinance` | ✗ | ✗ | ✓ `correlation_mitigation.py` | — | **MISSING** dari `requirements.txt` — gap reproducibility riset → §7.5 (jangan ditambahkan sekarang) |
| `scipy` | ✗ | ✗ | ✓ `sharpe_benchmark.py` | — | **MISSING** dari `requirements.txt` — gap yang sama → §7.5 |
| `requirements-engine.txt` (ccxt, pandas, PyYAML) | dipakai `Dockerfile.engine` (Fase 4, future) | — | — | — | **KEEP** — isinya = import set aktual `live_signal` ✓ |

CI meng-hardcode subset install (`pip install ccxt pandas pyyaml pytest rich`) alih-alih `-r requirements.txt` — dicatat, tidak diubah.

---

## 4. Dead-code candidates

*"No references found" tidak dipakai sendirian sebagai bukti DELETE — kolom Evidence memuat bukti tambahan.*

| Path | Evidence | Classification | Confidence | Action |
| --- | --- | --- | --- | --- |
| `monitoring/web/app/app/dashboard/EquityCurveChart.tsx` | (1) grep source: **hanya deklarasinya sendiri**, 0 importer/dinamis; (2) `/app/dashboard` me-render `ScoreTrendChart`; (3) kurva equity live ditampilkan `/papertrading` via komponen **berbeda** `components/EquityChart.tsx`; (4) Next hanya mem-bundle modul yang di-import → tidak masuk runtime path; (5) sudah terdaftar DEAD di `REPO_MAP.md` §13/§17 | **DELETE** | **HIGH** | Hapus di phase cleanup (§7.4) |
| `monitoring/web/public/{next,vercel,file,globe,window}.svg` | 0 referensi di source/dokumen; sisa `create-next-app`; asset statis tidak punya runtime path lain | **DELETE** | MEDIUM (berbahaya nol, tapi bukti = unreferenced + provenance template) | Opsional di cleanup |
| `backtest/run_backtest.py:33` global `REPORTS` | Dibaca nol kali — `save_report()` membuat local `REPORTS = reports_dir()` yang men-shadow-nya; semua tulisan lewat local | **DELETE** | HIGH | Sambil menyentuh backtest nanti |
| `risk_manager/guards.py::can_open_position` | Exported + diuji (`test_risk.py`), tetapi **tidak dipanggil engine mana pun** — kedua engine inline perbandingan identik | **REFACTOR** | HIGH | Putuskan: wire engine ke helper / terima duplikasi (§7.7) |
| Unused locals (lint warnings): `lastRunDate` (`db-supabase.ts`), `fs` (`api-keys`), `SUPABASE_URL` (`api/telegram`), import `SITE` ×3, `m` (`fee-chart`) | eslint `no-unused-vars` — 7 warnings tercatat Phase 0/1 | **DELETE** | HIGH | Fase perbaikan lint (bukan phase ini — phase ini dilarang ubah kode) |
| `monitoring/web/e2e/.auth/` | Ditulis `free-tier-flow.spec.ts:100` (`storageState({path})`), **tidak pernah dibaca** (0 `test.use({storageState})`/konsumen); untracked & tidak masuk `.gitignore` → muncul terus di `git status` | **DELETE** (regenerable) + tambah ignore rule | HIGH | §7.8 — ignore rule dulu, hapus file lokal |
| `.github/workflows/test-bitget-api.yml` | Probe Bitget sekali-pakai (ci:false = manual); `fetch-data.yml` sudah menangani fetch rutin | **INVESTIGATE** | MEDIUM | Keputusan owner: keep sebagai alat manual / archive (§7.8) |
| `db/backup_db.sh` | Scheduler otomatis **dibatalkan** (catatan ARCHITECTURE) — skripnya hidup, manual, berguna | **KEEP / MOVE** | HIGH | Dokumentasikan pemakaian manual; keputusan cron terpisah |
| `backtest/reports/bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md` | Untracked; `.gitignore` reports-top hanya `*.csv`/`*.png` jadi md-nya nongol di status; output analisis B&H manual | **INVESTIGATE** | — | Commit sebagai evidence atau tambah ignore (§7.8) |
| `lib/encryption.ts` branch raw-key legacy | Dibutuhkan untuk mendecrypt key tersimpan era pra-PBKDF2; menghapus = tidak bisa baca key lama | **KEEP** (stale-compat sadar) | HIGH | KEEP sampai ada migrasi key eksplisit |
| `presets/sma_crossover.yaml`, `presets/rsi_mean_reversion.yaml` | Dipakai via env `PRESET` di runner + dibekukan test; live/paper hanya Donchian | **KEEP** | HIGH | KEEP (alat riset/perbandingan) |
| `cli.py` jalur `live --dry-run`, `llm_filter` skeleton (`enabled: false` + 3 test kontrak), `deploy/`, `Dockerfile.engine`, `requirements-engine.txt`, `docker-compose.yml` | Future Fase 4/Fase 3, sudah dijaga test/dokumentasi | **KEEP** (future) | HIGH | KEEP |
| `data/historical/{BCH,LTC,PAXG}_USDT_1d.csv` | Tidak di `config.yaml`; format BCH beda urutan kolom (sisa riset); dipakai script riset lama | **KEEP / MOVE** | MEDIUM | Kandidat pindah ke folder riset — keputusan organisasi (§7.5) |
| `scripts/fetch_bitget_data.py`, `scripts/compare_live_vs_backtest.py` | Workflow `fetch-data.yml`; `compare_live_vs_backtest` = alat gate Fase 2 + diuji pytest | **KEEP** | HIGH | KEEP |

---

## 5. Research artifacts

*Tidak ada file produksi yang meng-import script riset (grep silang = 0). Semua verdict: aman diarsipkan, TIDAK aman dihapus tanpa keputusan owner — ini evidence keputusan strategi.*

| Path | Purpose | Production dependency | Reproducibility value | Verdict |
| --- | --- | --- | --- | --- |
| `backtest/research/fetch_funding.py` | Ambil funding rate asli Binance untuk riset long/short | none | **HIGH** — dasar keputusan long-only 2026-08-25 (`decision_log.md`); butuh network + `requests` (ada di requirements) | KEEP |
| `backtest/research/run_longshort_backtest.py` | Perbandingan long vs short → `reports/research/longshort/` | none | HIGH — keputusan "short dicoret" | KEEP |
| `backtest/research/correlation_mitigation.py` | Analisis korelasi → dasar Cluster-A2 (max 2/cluster) | none | HIGH — parameter cluster; **butuh `yfinance` yang tidak ada di requirements** | KEEP (catat gap) |
| `backtest/research/regime_segmentation.py` | Segmentasi bull/bear regime | none | MEDIUM — `reports/regime_segmentation_analysis.md` | KEEP |
| `backtest/research/sharpe_benchmark.py` | Benchmark Sharpe buy-and-hold (dikutip `DESIGN.md` §6.1: B&H Sharpe 0.98) | none | HIGH — angka di desain; **butuh `scipy` + `yfinance` yang tidak ada di requirements** | KEEP (catat gap) |
| `backtest/research/portfolio_size_experiment.py` | Efisiensi ukuran portofolio | none | MEDIUM — `portfolio_size_experiment.md` | KEEP |
| `backtest/research/run_capital_efficiency.py` | Yield + multi-pair capital efficiency | none | MEDIUM — `reports/research/capital_efficiency/` | KEEP |
| `backtest/reports/research/*` (md/csv/png), `*_experiment.md`, `sharpe_benchmark_comparison.md`, `sharpe_discrepancy_report.md` | Output ter-commit yang melengkapi laporan & `decision_log.md` | none | HIGH sebagai evidence; `sharpe_discrepancy_report.md` = catatan historis discrepancy | KEEP (jangan diarsipkan tanpa alasan) |
| `backtest/reports/bh_*.md` (untracked) | Analisis B&H manual (DD & korelasi) | none | MEDIUM | INVESTIGATE — commit atau ignore (§7.8) |

Organisasi (folder riset tercampur tooling produksi, requirements riset tercecer): keputusan di §7.5.

---

## 6. Generated artifacts

| Path | Tracked? | Purpose | Safe to remove? | Verdict |
| --- | --- | --- | --- | --- |
| `data/historical/*.csv` | **YA** (di-commit, workflow `[data] update historical OHLCV`) | Input backtest/paper — snapshot data | **TIDAK** (input engine) | **A** — generated tapi sengaja di-commit |
| `backtest/reports/metrics.md` | YA | Laporan hasil run | TIDAK — konten stale menunggu keputusan §7.1 | **A** (evidence) |
| `backtest/reports/equity_curve.csv`, `trades.csv`, `equity_drawdown.png` | TIDAK (ignored `reports/*.csv`, `*.png`) | Digenerate tiap run | YA (regenerable lokal) | **B** |
| `backtest/reports/bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md` | **UNTRACKED** (md tidak kena ignore) | Analisis manual | Keputusan owner | **E** (unknown) → §7.8 |
| `db/paper_trading.db`, `db/schema.sql`, `db/backup_db.sh` | **YA** — `db/paper_trading.db` bukan ignored, di-commit harian oleh cron `[paper-trading] update DB state` | Source of truth state paper trading | **TIDAK — dilarang phase ini** (aturan phase: jangan hapus DB) | **A** — intentionally committed |
| `db/backups/` | TIDAK (ignored) | Backup lokal | YA | **B** |
| `monitoring/web/e2e/.auth/user.json` | **UNTRACKED, TIDAK masuk `.gitignore`** (satu-satunya untracked yang begitu) | Ditulis `storageState` saat test login, tidak pernah dibaca suite; **berisi session cookie akun test** | YA — regenerable dengan menjalankan test; **tambah ignore rule dulu** (§7.8) | **B + D** (should be ignored; sensitive-ish) |
| `monitoring/web/.next/`, `tsconfig.tsbuildinfo`, `test-results/` | TIDAK (ignored oleh `monitoring/web/.gitignore` — diverifikasi `git check-ignore`) | Output build/test | YA lokal | **B** |
| `.vercel/` (root + web), `node_modules/`, `venv/`, `__pycache__/` | TIDAK (ignored) | Cache/dependensi | YA lokal | **B** |
| `paper_trading/logs/`, `logs/*.log` | TIDAK (ignored) | Log runtime | YA lokal | **B** |
| `supabase/.temp`, `monitoring/web/public/uploads/` | TIDAK (ignored) | CLI temp + data checkout E2E | YA lokal | **B** |
| `monitoring/web/e2e/screenshots/*.png` | YA | Evidence E2E | TIDAK tanpa alasan | **A** (evidence) |
| Catatan sensitivitas | — | — | — | **D ringan**: `.auth/user.json` = session token akun test; `db/paper_trading.db` (tracked) memuat `api_keys` **ter-encrypt AEAD** (sesuai desain P2-9) |

---

## 7. Open decisions

### 7.1 Canonical backtest metric — bukti provenance (keputusan TETAP di tangan owner)

Pertanyaan audit dijawab dengan bukti:

1. **Dari mana tiap angka berasal?**
   - **Snapshot A** = `backtest/reports/metrics.md` (return **+149.59%**, DD **−26.19%**, avg win **+4.31R**, avg loss −0.84R, PF **2.26**, avg R 1.00; common: Sharpe 0.82, win 36.17%, 94 trade, B&H +155.03%, 2123 hari). File terakhir ditulis commit **`e6188de` 2026-09-06** — output runner, sebelum fix P2-7.
   - **Snapshot B** = `monitoring/web/lib/backtest-reference.json` (return **+152.0%**, DD **−26.45%**, avg win **+4.35R**, avg loss −0.85R, PF **2.27**, avg R 1.03; common sama). Dibuat commit **`029a311` 2026-09-12 23:00** — commit **yang sama** dengan rewrite ATR/RSI (seed Wilder eksplisit + rekursi manual, +29 baris di `backtest/strategy.py`, +29 test); `sharpeRatio` ditambahkan `9769a0c` 2026-09-13.
2. **Run/config/data sama?** Data **identik**: CSV `data/historical` terakhir di-commit **2026-09-02** (btc/eth berakhir `2026-09-02`), di antara kedua snapshot. Config **identik di angka numerik**: dua perubahan `config.yaml` setelah 2026-09-06 hanya komentar (`b96decc`) dan komentar `data_source` (`4376e10`) — diverifikasi via `git show`. **Satu-satunya pembeda = kode (fix ATR/RSI P2-7).**
3. **Apakah `backtest-reference.json` dari runner terbaru?** — **Dikonfirmasi** oleh re-run Phase 2A (butir 5).
4. **Apakah `metrics.md` bisa direproduksi sekarang?** **TIDAK** dengan kode HEAD — butuh checkout kode pra-`029a311`. → **`metrics.md` = stale artifact of pre-P2-7 code.**
5. **Apakah kode sekarang menghasilkan salah satu snapshot?** **YA — snapshot B, persis.** Re-run aman 2026-09-22 (`REPORT_SUBDIR=/tmp/opencode/metric_repro`, repo tidak tersentuh, `git status` identik): `total_return 152.0, cagr 17.24, sharpe 0.82, sortino 0.85, max_dd −26.45, n_trades 94, win 36.17, avg_r 1.03, avg_win 4.35, avg_loss −0.85, pf 2.27, bh 155.03, final_equity 2520.02, period_days 2123` — semua 14 metrik identik dengan `backtest-reference.json`.
6. **Ada perubahan data/config/seed yang menjelaskan diskrepansi?** Data tidak, config tidak — **ya, perubahan kode seed ATR/RSI (P2-7 `029a311`)**.

Status: **`REQUIRES OWNER DECISION`** (re-run teknis sudah dilakukan, aman, terisolasi). Yang perlu diputuskan: mengadopsi snapshot B sebagai canonical → lalu regenerate `metrics.md`, perbaiki komentar `config.yaml`/preset, samakan `disclaimer/page.tsx` (sekarang mencampur A+B), rapikan anotasi `DESIGN.md` §6.1 & `TASKS.md`. **Phase 2A tidak mengubah satu pun angka.**

Peta kutipan per file:

| File | Snapshot |
| --- | --- |
| `backtest/reports/metrics.md` | A (stale, pre-P2-7) |
| `monitoring/web/lib/backtest-reference.json` → `reference.ts` + compare script | B (runtime SoT, terbukti reproducible) |
| `backtest/DESIGN.md` §6.1 | tabel = A + anotasi kedua snapshot |
| `TASKS.md` baris 18 (gate historis) | A — historical record |
| `TASKS.md` baris 27/33 | B + anotasi kedua snapshot |
| `README.md:98` | menampilkan keduanya + pending note |
| `app/disclaimer/page.tsx:18` / `:25` | **A / B — campur dalam satu halaman** |
| `config.yaml` komentar / `presets/donchian_cluster_a2.yaml` | A (kutipan DD −26.19%) |
| `proof/page.tsx`, `ProofStrip.tsx` | hanya angka common (0.82 / 94 / 36.17) — tidak terpengaruh |

### 7.2 `vectorbt` di `requirements.txt`

0 import di seluruh repo (bukti §3). Kandidat dihapus — membutuhkan keputusan owner + catatan di `PLAN.md` (AGENTS.md aturan 2). **Belum dihapus.**

### 7.3 Duplikasi konstanta (PAIRS, start-cash, APY, bound risk/max, slippage)

Sekarang terdokumentasi (§1). Pilihan: (a) biarkan + anggap dokumentasi cukup, atau (b) phase nanti menurunkan satu sumber (mis. web baca nilai lewat API/config ter-zonasi). Tidak ada yang diubah sekarang.

### 7.4 Hapus `EquityCurveChart.tsx` (+ 5 SVG template?)

Evidence HIGH di §4. Menunggu persetujuan phase cleanup.

### 7.5 Organisasi riset

`backtest/research/*` tercampur tooling; `yfinance`/`scipy` dipakai riset tapi tidak tercatat di `requirements.txt`; `data/historical` menyimpan CSV riset non-config (BCH/LTC/PAXG). Opsi: `requirements-research.txt` + pindahkan data riset. Tidak diubah sekarang.

### 7.6 Baris `strategy_templates` tidak ter-version

Tidak ada `INSERT INTO strategy_templates` di `supabase/migrations/*` — baris 8 template (params_schema lengkap, donchian periods, dll) **hanya hidup di remote DB**. Next: buat migration seed eksplisit atau dokumentasikan bahwa seed manual = bagian dari runbook. Gap SoT nyata; di luar scope phase ini (dilarang ubah Supabase).

### 7.7 `can_open_position` / bound literal berulang

Putuskan wire-vs-terima di phase code berikutnya (§2).

### 7.8 Keputusan kecil artifacts/workflow

- Tambah ignore rule `monitoring/web/e2e/.auth/` lalu hapus file lokalnya.
- `backtest/reports/bh_*.md`: commit sebagai evidence atau ignore.
- Nasib `.github/workflows/test-bitget-api.yml` (keep manual / archive).

### 7.9 Parity test discipline score (TS vs SQL trigger)

Belum ada (§2b). Kandidat test kecil di phase test berikutnya.

### 7.10 Koreksi dokumen kecil yang menyertai commit Phase 2A

1. `TASKS.md` — hapus baris duplikat task `execution/` (duplikatnya ada di **`TASKS.md`** baris 74/76, bukan `PLAN.md` seperti tertulis di instruksi — `PLAN.md` hanya punya catatan historis struktur lama; baris `[GATED]` yang dipertahankan).
2. `TASKS.md` wording `vectorbt` — **sudah cukup** (anotasi Phase 1 di baris 7: "tidak dipakai oleh kode mana pun… lihat REPO_MAP §13"); tidak diubah.
3. `AUDIT.md` P2-8 — tambah klarifikasi riwayat: historis dianggap selesai di P2, Phase 0 menemukan kembali diskrepansi dua snapshot, canonical masih pending.

### 7.11 Lainnya (tidak memblokir)

Lint 2 errors + 7 warnings (dibiarkan sesuai aturan phase); docstring `validate_config` menyebut "backtest" padahal runner tidak memanggilnya (kontradiksi §1 #1 — kandidat perbaikan dokumen phase berikutnya); instalasi `rich` di CI tanpa pemakai.
