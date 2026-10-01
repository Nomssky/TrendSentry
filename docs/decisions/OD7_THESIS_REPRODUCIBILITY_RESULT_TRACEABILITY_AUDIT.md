# OD-7 — Thesis Reproducibility, Result Traceability & Final Evidence Pipeline Audit

> **Repo:** `Nomssky/TrendSentry` · **HEAD:** `d728ec891036a62f142d98ade8913a0e86176370` (main, == origin/main)
> **Tesis:** *Analisis Efektivitas Strategi Long-Only Donchian Channel Breakout pada Portofolio
> Cryptocurrency Multi-Aset* (approved PPT: `Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf`)
> **Mode:** AUDIT ONLY — tidak ada perubahan source/dataset/config/preset/reports/tests/deps/PPT;
> tidak ada perbaikan bug; tidak memilih Snapshot A/B; tidak memilih benchmark; tidak memilih
> treatment missing-data; tidak memilih formula statistik; tidak memperlakukan forensic
> sensitivity sebagai hasil tesis. Semua eksperimen dijalankan pada salinan di `/tmp`.
> **Output repo tunggal:** file ini. **Tidak ada commit, tidak ada push.**
> **Dataset status:** keputusan **OD-1 … OD-6 belum ada yang diselesaikan owner** → tidak ada
> baseline thesis yang frozen; audit ini hanya memetakan ketertelusuran.
> **Register:** OD-7.1 – OD-7.12 (§28). Audit ini **tidak memberi verdict strategi**.
> **Batas:** tidak ada section bernomor di luar 30 (§30 Final Answers memuat 14 jawaban).

---

## 1. Executive Summary

Pertanyaan utama dijawab dengan bukti repository (bukan normatif) — detail di §21, §27:

1. **Snapshot B (152.00%/0.82/−26.45%/94/2520.02) bisa direproduksi hari ini, persis — `VERIFIED`.**
   Tiga run `backtest/run_backtest.py` ke `/tmp` (dua run paralel + satu run dengan working
   directory berbeda) menghasilkan output **byte-identical** (sha256 sama, §21) dan **14 metrik
   identik** dengan `monitoring/web/lib/backtest-reference.json` (9 field numerik yang ada)
   dan dengan re-run dokumentasi `PHASE2_SOURCE_OF_TRUTH.md:183`. Tidak ada data/config/seed
   yang berubah sejak snapshot dibuat.
2. **Snapshot A (149.59/−26.19/2495.92) juga bisa direproduksi — tapi hanya dengan checkout
   historical — `VERIFIED`.** Clone di `/tmp/od7_clone` @ `e6188de` (2026-09-06) + run yang sama
   menghasilkan `metrics.md` **byte-identical** dengan `backtest/reports/metrics.md` yang tersimpan.
   Dengan kode HEAD, A **tidak** bisa dihasilkan (`STRONGLY SUPPORTED`: pembeda tunggal = rewrite
   indikator ATR/RSI Wilder `029a311`; data 10-pair identik — `git diff e6188de HEAD --
   data/historical/` hanya menambah 3 CSV pair riset).
3. **Tidak ada raw trade/equity ledger yang tersimpan untuk Snapshot B — `VERIFIED` (ketiadaan).**
   `backtest/reports/*.csv` **di-gitignore**; ledger yang ada di worktree (`trades.csv`,
   `equity_curve.csv`, mtime 2026-09-06 22:58, final 2495.92) adalah **era Snapshot A**.
   Ledger B hanya bisa dikembalikan lewat re-run; run asli pembuat `backtest-reference.json`
   tidak meninggalkan artefak di repo (`PROVENANCE UNKNOWN` untuk run-nya; angkanya sendiri
   terbukti re-derivable).
4. **`backtest-reference.json` (Snapshot B) tidak pernah ditulis oleh script apa pun — `VERIFIED`.**
   Konsumennya `lib/reference.ts` + `scripts/compare_live_vs_backtest.py`; tidak ada writer →
   artefak **hand-transcribed**; hanya memuat 9 dari 14 metrik; label `period`
   `"2020-08 .. 2026-08"` **bertentangan dengan data aktual `2020-11-09..2026-09-02`** (dimiliki
   OD-5.5, §25).
5. **Command default menimpa file tracked — `VERIFIED` (code path).** `python backtest/run_backtest.py`
   tanpa `REPORT_SUBDIR` menulis ke `backtest/reports/metrics.md` yang **tracked** → "command
   paling obyektif" untuk mereproduksi B **mengubah artifact Snapshot A di working tree**.
   Non-destruktif hanya bila `REPORT_SUBDIR` dipakai (trik yang terdokumentasi di audit docs,
   bukan di runner docstring) → ketergantungan manipulasi manual (§22).
6. **Tiga generator laporan statistik crash di HEAD — `VERIFIED` (re-run sesi ini).**
   `sharpe_benchmark.py`, `regime_segmentation.py`, `portfolio_size_experiment.py` →
   `KeyError: 'donchian_entry_period'` (`load_ohlcv` dipanggil tanpa cfg sejak `0ad6cc6`) →
   angka t-test/korelasi-jendela/regime yang ada di laporan = **frozen artifact** yang tidak bisa
   digenerasi ulang tanpa intervensi manual (tidak dilakukan di audit ini).
7. **Empat laporan thesis-facing tidak punya generator — `NOT TRACEABLE`:**
   `bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md` (keduanya commit `d728ec8`),
   `sharpe_discrepancy_report.md`, `decision_log.md` (hand-authored) — tidak ada script yang
   menulis file-file ini (§9, §10).
8. **Dataset `PARTIAL` (bukan "fully reproducible"):** 1.635 missing bar direproduksi ulang
   (tabel §6); timestamp mentah dibuang (`fetch_bitget_data.py` `df.drop(columns=["ts"])`);
   **tidak ada checksum/manifest/metadata sidecar di mana pun** (findrepo: 0); refetch Bitget
   terblokir jaringan (OD-5 §26); provenance lengkap + env pinned menunggu **OD-5.1–OD-5.9**.
9. **Konfigurasi parameter strategi single-source dengan duplikat yang sepakat — `PARTIAL`.**
   `config.yaml` = SoT (`ARCHITECTURE.md` §16); duplikat `presets/donchian_cluster_a2.yaml`,
   `lib/constants.ts PAIRS/STARTING_CASH`, `validations.ts GUARDRAILS` **semua numerik sepakat**
   (dicek sesi ini). **Tapi**: konstanta statistik (rf=0, √365, formula B&H, window/threshold
   regime, α t-test) **hardcoded di script**; `lookback_years: 6` **tidak pernah dibaca kode
   mana pun** (periode = data-driven); komentar `config.yaml:23` & preset mengutip **Snapshot A**.
10. **Determinisme internal `VERIFIED`; ketergantungan urutan-aset lintas-portofolio tetap nyata
    — `OWNER DECISION REQUIRED`.** Dua run identik byte-identical (tanpa RNG, tanpa jam,
    tanggal = `sorted(set.union)`) — tapi OD-4: data sama, tiga urutan iterasi →
    **152.00% / 159.17% / 162.51%** (`FORENSIC SENSITIVITY`, selisih 10.51pp). PPT tidak
    menentukan urutan iterasi → urutan adalah **isu metodologis tak terselesaikan** (OD-4.8 /
    OD-3.9) → diangkat sebagai **OD-7.9** (carried).
11. **Implementasi Donchian bisa diidentifikasi unik — `VERIFIED`:** satu implementasi aktif
    `backtest/strategy.py` (donchian_high/low `rolling().shift(1)`, ATR Wilder, position_size)
    + loop engine `run_backtest.py:71–176`; dipakai bersama oleh `paper_trading/live_signal.py`
    (`product-shared`); varian historis ada di git; loader riset mandiri ada (`research-only`).
    Tidak ada duplikasi formula Donchian lain (grep: hanya import dari `strategy.py`).
12. **Statistik: VaR/VaRSR `NOT IMPLEMENTED` (0 hit — konfirmasi ulang sesi ini); koreksi
    cash-day wajib-PPT `NOT IMPLEMENTED`**; t-test/korelasi/regime `PARTIAL` (§16, cross-ref OD-6).
13. **Sepuluh angka yang ditandai prompt semuanya terklasifikasi (§10):** `149.59/−26.19` =
    Snapshot A (stale-by-design, masih hidup di `metrics.md`, komentar config/preset,
    `RULES.md:56`, `disclaimer:18`, `decision_log:111`); `152.0/−26.45/0.82/155.03` =
    Snapshot B/common; `0.98` = B&H sleeve (`sharpe_benchmark_comparison.md:18`); `−77.63` =
    report-only tanpa generator; `−58.49` = **MDD strategi vanilla** — muncul di konteks B&H
    hanya di `decision_log.md:99` (**mislabel**, sudah ditandai Phase 2H AR-03/OD-11) dan
    `PLAN.md:42` (konteks eksperimen 862%).
14. **Environment `PARTIAL`:** requirements hanya range-pin (tanpa lockfile/pyproject/
    .python-version), `scipy`+`yfinance` dipakai research tapi **tidak ada di requirements.txt**,
    `vectorbt` di requirements tapi 0 import, venv tercatat Python 3.14.6 sedang runtime 3.14.7
    (drift patch), `pip check` bersih, 70 test pass (§14).
15. **Kesimpulan kesiapan (bukan verdict strategi):** *current* Snapshot B = reproducible dari
    state repo (`VERIFIED`). *Angka tesis final* = **belum bisa** direproduksi/ditelusuri utuh
    oleh peneliti lain: keputusan OD-1…OD-6 belum ada, dataset belum frozen, canonical snapshot
    belum dipilih (`ARCHITECTURE.md` §16), ledger B tidak disimpan, generator statistik rusak,
    VaRSR absen, dan 4 laporan tanpa generator (§27).

---

## 2. Audit Scope

**BOLEH (dilakukan sesi ini):** membaca source/PPT/laporan/audit sebelumnya; menjalankan existing
script/test; eksperimen pada salinan `/tmp`; rekonstruksi hasil; static search; git history
inspection; membuat SATU file baru ini.

**DILANGGAR = gagal audit:** mengubah source code/strategy logic/dataset/CSV/config/preset/
database/reports resmi/migration/tests/package/workflow/PPT/PDF/material tesis; memperbaiki bug;
refactor; memilih Snapshot A/B; memilih benchmark; memilih treatment missing-data; memilih
formula statistik; memperlakukan forensic sensitivity sebagai hasil tesis; commit; push;
menghapus/menamai/memindahkan/merefaktorkan `backtest/research/*`, `backtest/reports/*`,
artifact tesis, file benchmark historis, BH reports, dataset riset (`UNKNOWN ≠ DEAD` — §R).

**Salinan `/tmp` yang dipakai:** `/tmp/od7_repro_a`, `/tmp/od7_repro_b`, `/tmp/od7_repro_c`
(3 run Snapshot B), `/tmp/od7_clone` (clone repo, checkout `e6188de`, uji Snapshot A),
`/tmp/od7_data.py` (inventaris dataset + perbandingan snapshot), `/tmp/od7_sb`, `/tmp/od7_rg`
(folder output uji crash — tidak ada file yang tertulis karena crash sebelum menulis).

**Diagnostics yang dijalankan (semua dari `/tmp` atau read-only terhadap repo):**

| # | Diagnostic | Hasil ringkas |
|---|---|---|
| D1 | `git status --porcelain` / `git rev-parse HEAD` / `origin/main` / `git diff --check` | hanya 4 untracked (OD-3..OD-7 docs); HEAD == origin/main `d728ec8`; `diff --check` exit 0 |
| D2 | Run Snapshot B ×2 + byte-compare | `metrics.md`/`equity_curve.csv`/`trades.csv`/`equity_drawdown.png` **BYTE-IDENTICAL** |
| D3 | Run Snapshot B dari cwd `/tmp` | byte-identical → cwd-independent |
| D4 | Perbandingan 14 metrik vs `backtest-reference.json` + vs `metrics.md` | B: 9/9 field match · A: 6 dari 8 berbeda (A stale) |
| D5 | Clone `/tmp/od7_clone` @ `e6188de` + run | `metrics.md` **BYTE-IDENTICAL** ke Snapshot A tersimpan |
| D6 | `cmp` ledger worktree vs run HEAD | `trades.csv`/`equity_curve.csv` worktree = era A (mtime 2026-09-06, final 2495.92) ≠ run B |
| D7 | Inventaris data per pair (`/tmp/od7_data.py`) | total missing **1.635** (cocok OD-5); 0 duplikat |
| D8 | `git diff e6188de HEAD -- data/historical/` | hanya +BCH/LTC/PAXG (riset) → **10-pair CSV identik A↔B** |
| D9 | Crash test `sharpe_benchmark.py` & `regime_segmentation.py` di HEAD | keduanya `KeyError 'donchian_entry_period'` |
| D10 | `pytest -q -p no:cacheprovider` | **70 passed** (7.10s) |
| D11 | Greps: VaR/VaRSR, report-writer, `random`/clock, `lookback_years`, checksum/manifest, compute_metrics/load_ohlcv copies, strategy importers | hasil di §6–§9, §14–§16 |
| D12 | `pip check`, requirements vs installed, `pyvenv.cfg` | bersih; scipy/yfinance tak tercatat; drift 3.14.6→3.14.7 |
| D13 | Git history metrics.md / reference.json / data / report files | §11, §12, §10 |
| D14 | Sweep 10 angka kritis (md/py/ts/tsx/yaml, tanpa node_modules/.next) | §10, §24 |
| D15 | `git status --porcelain` final + `git diff HEAD` | **tidak ada tracked file berubah** |

---

## 3. Source Hierarchy

Urutan otoritas yang dipakai (persis instruksi owner; kontradiksi **tidak** direkonsiliasi
diam-diam — dicatat di §25):

1. Approved PPT `Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf` (ekstrak kanonik
   `/tmp/opencode/od2_ppt.txt`; `:xx` = baris ekstrak).
2. Explicit owner decisions yang sudah diberikan setelah PPT (termasuk arahan pembukaan OD-7 ini).
3. `PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md`
4. `PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md`
5. `OD2_ENTRY_EXECUTION_STOP_DECISION.md`
6. `OD3_EXIT_POSITION_LIFECYCLE_ACCOUNTING_DECISION.md`
7. `OD4_RISK_SIZING_PORTFOLIO_ALLOCATION_DECISION.md`
8. `OD5_DATA_INTEGRITY_REBUILD_DECISION.md`
9. `OD6_BENCHMARK_METRICS_STATISTICAL_VALIDITY_DECISION.md`
10. Current repository implementation (HEAD `d728ec8`).
11. General research/statistical knowledge — **hanya bila perlu**, tidak pernah menggantikan
    metodologi sumber di atas.

Label yang dipakai hanya dari daftar resmi: `VERIFIED` · `STRONGLY SUPPORTED` · `INFERRED` ·
`PARTIAL` · `UNKNOWN` · `PROVENANCE UNKNOWN` · `NOT TRACEABLE` · `NOT IMPLEMENTED` ·
`OWNER DECISION REQUIRED` · `FORENSIC SENSITIVITY`. Ketiadaan = `NOT IMPLEMENTED` /
`NOT TRACEABLE`, **bukan** "tesis invalid".

---

## 4. Thesis Evidence Model

Model bukti tesis = rantai 13 node (prompt) dan keadaan repo hari ini:

```text
Methodology Freeze            → BELUM (PPT punya item terbuka :294; freeze menunggu OD-1..OD-6)
      ↓
Owner Decision Record         → ADA (Phase 2H OD-1..12; OD-2.1..2.9; OD-3.1..3.11;
                                    OD-4.1..4.11; OD-5.1..5.10; OD-6.1..6.12) — SEMUA belum dijawab
      ↓
Frozen Dataset                → BELUM (OD-5.1..5.10 pending)
      ↓
Dataset Manifest + Checksums  → TIDAK ADA (0 file manifest/checksum — D11)
      ↓
Frozen Config                 → PARTIAL (config.yaml SoT + duplikat sepakat; konstanta statistik
                                    hardcoded; komentar masih Snapshot A)
      ↓
Strategy Commit               → ADA (HEAD `d728ec8`; implementasi unik `strategy.py` — §8)
      ↓
Backtest Command              → ADA tapi TIDAK TUNGGAL/bersih (§13: 2 command resmi +
                                    REPORT_SUBDIR; default menimpa file tracked; research cmds rusak)
      ↓
Raw Trade Ledger              → Snapshot A: ADA di worktree (di-gitignore); Snapshot B: TIDAK ADA
      ↓
Equity Curve                  → A: ADA (worktree, gitignored); B: TIDAK ADA (re-derivable)
      ↓
Metrics                       → ADA dua snapshot (A stale, B runtime) — canonical BELUM (ARCH §16)
      ↓
Statistical Tests             → PARTIAL (t-test/korelasi/regime = frozen report; generator crash;
                                    VaR/VaRSR tidak ada)
      ↓
Tables/Figures                → report .md + .png; thesis .tex/.pdf TIDAK ADA di repo (§10)
      ↓
Thesis Claims                 → BELUM ada dokumen tesis; klaim hidup di PPT + laporan + web
```

Setiap node dipetakan detail (ada/kurang/stale/ambigu) di §26. Prinsip: **angka di
dokumentasi tidak diasumsikan current** (prompt §F) — setiap kutipan diklasifikasi di §10/§24.

---

## 5. Methodology-to-Implementation Matrix

Kutipan PPT memakai ekstrak `/tmp/opencode/od2_ppt.txt` (`:xx`); referensi OD-2..OD-6 tidak
diduplikasi, hanya dirujuk.

| Methodology Item | PPT Requirement | Current Implementation | Decision Dependency | Evidence | Status |
|---|---|---|---|---|---|
| Universe 10 assets | "10 aset" (:244), eksplorasi 10 pair (:51) | `config.yaml` pairs = 10; `lib/constants.ts PAIRS` urutan sama | OD-5.6 | `config.yaml:5-16`, `constants.ts:1` | `VERIFIED` (implementasi & duplikat sepakat) |
| Asset selection criteria | **masih terbuka**: "Mohon saran batasan jumlah/kriteria pemilihan cryptocurrency untuk meminimalkan potensi survivorship bias" (:294) | **tidak ada kriteria pemilihan terdokumentasi**; 10 pair = pilihan yang ada di config tanpa aturan seleksi | OD-5.6 (kriteria PPT tak pernah ada) | `config.yaml:5`; PPT:294; `OD5:OD-5.6` | `NOT IMPLEMENTED` |
| Daily timeframe | sinyal pada close harian (:187) | `timeframe: "1d"`; CSV harian | — | `config.yaml:18` | `VERIFIED` |
| Donchian entry (20) | "Close menembus Highest High 20 hari sebelumnya" (:185-187 area) | `donchian_high = rolling(20).max().shift(1)`; entry `prev.close > prev.don_hi` (strict) | — | `strategy.py:61-63`, `run_backtest.py:128-129` | `VERIFIED` |
| Donchian exit (10) | "Close menembus Lowest Low 10 hari sebelumnya, atau menyentuh stop" (:187) | `donchian_low = rolling(10).min().shift(1)`; exit `close < don_lo` (strict) | — | `strategy.py:66-68`, `run_backtest.py:99` | `VERIFIED` |
| Shift / look-ahead prevention | "sinyal dihitung dari data yang sudah tertutup, eksekusi … open hari berikutnya" (dikutip OD-2 :157) | channel `shift(1)`; sinyal dari bar t−1; eksekusi `open[t]` | OD-2.1/2.3 (anchor & timestamp ATR) | `run_backtest.py:128-133`; OD-2 | `VERIFIED` (mekanisme anti look-ahead ada) |
| Execution timing (entry) | next-day open | `entry_price = open[i] × (1+slip)` | OD-2.8 (exit timing) | `run_backtest.py:133` | `VERIFIED` |
| Execution timing (exit) | PPT umum "open hari berikutnya" vs praktik kode: exit di **close hari yang sama** | exit check pada close hari sinyal | OD-2.8 / OD-3.1 | `run_backtest.py:102-103`; OD-2 :157 | `PARTIAL` (kode jelas, PPT ambigu) |
| ATR period | ATR(14) (:189) | `atr_period: 14`; `strategy.atr` | — | `config.yaml:19`, `strategy.py:37-55` | `VERIFIED` |
| ATR seed / method | PPT tidak menyebut seed/metode smoothing | Wilder smoothing + seed SMA `period` TR pertama (rekursi manual) | OD-2.3 (timestamp), method = fakta kode | `strategy.py:133-144` (`029a311`) | `PARTIAL` (kode `VERIFIED`, spesifikasi PPT `UNKNOWN`) |
| Stop anchor | "Stop loss dinamis: **Entry − 2 × ATR(14)**" (:189) | `stop = prev_close − 2 × prev_atr` (**bukan** Entry-anchored) — konflik terdokumentasi, tidak direkonsiliasi | **OD-2.1 / OD-2.2** | `run_backtest.py:133`; OD-2 :49 | `OWNER DECISION REQUIRED` |
| Stop timing | menyentuh stop (:187) | evaluasi `close ≤ stop` + cek `open ≤ stop` (gap) pada bar yang sama; same-bar priority tak dispesifikasi | OD-2.5 / OD-2.6 / OD-3.3 | `run_backtest.py:102, 151-176` | `PARTIAL` |
| Stop execution | fee/slippage "per eksekusi" (:197) | exit stop memakai `×(1−fee−slip)` | OD-2.7 / OD-3.5 | `run_backtest.py:104` | `PARTIAL` |
| Position sizing | "Risiko maksimal 1% dari ekuitas per posisi" (:191) | `units = (equity×1%)/(entry−stop)`, cap `equity/entry` (spot) | OD-4.1 (definisi 1%), OD-4.2 (snapshot equity), OD-4.3 (anchor harga) | `strategy.py:71-83`; OD-4 | `PARTIAL` |
| 1% risk | idem (:191) | gross stop-distance = 1.000000% pada 94/94 trade (OD-4) | OD-4.1 | OD-4 §evidence | `PARTIAL` (definisi net/gross menunggu) |
| Cluster cap | "maksimal 2 posisi aktif per kluster" (:193) | `max_positions_per_cluster: 2` + guard loop | — | `config.yaml:22`, `strategy.py:29-34`, `run_backtest.py:125-127` | `VERIFIED` |
| Max concurrent | Gap: "10 pair + maks 5 posisi aktif" (:51) | `max_concurrent_positions: 5` (plafon; efektif struktural ≤3 — OD-4.10) | OD-4.10 | `config.yaml:31-33` | `VERIFIED` (implementasi) |
| Fees | "0,1% fee taker … per eksekusi" (:197) | `fee_pct: 0.1`, dua sisi (entry+exit) | OD-3.4 (entry fee tidak masuk trade PnL) | `config.yaml:42`, `run_backtest.py:76,104,135` | `PARTIAL` (tarif `VERIFIED`; akuntansi PnL menunggu OD-3.4) |
| Slippage | "0,05% slippage per eksekusi" (:197) | `slippage_pct: 0.05`, dua sisi | OD-3.5 | `config.yaml:43` | `VERIFIED` |
| Long-only | long-only (judul & :89) | `direction: "long_only"` + GUARDRAILS web `long_only` | — | `config.yaml:21`, `validations.ts:34` | `VERIFIED` |
| Period | "data Bitget 2020–2026" (:89); label reference.json "2020-08 .. 2026-08" | data aktual **2020-11-09 .. 2026-09-02** (2123 hari; first candle per pair berjenjang) | **OD-5.5** | `BTC_USDT_1d.csv` baris 2..akhir; `reference.json:3`; OD-5.5 | `PARTIAL` (angka jelas, label salah) |
| Missing data treatment | PPT tidak menspesifikasi | skip hari tanpa bar; MTM exclude pair yang hilang; stop tak dievaluasi saat hole; 1.635 bar hilang | **OD-5.3** + OD-3.7 | OD-5 §14; D7; `run_backtest.py:84-85,168-175` | `OWNER DECISION REQUIRED` |
| End-of-period positions | PPT tidak menspesifikasi | 3 posisi terbuka: **masuk** equity, **keluar** dari statistik trade | **OD-3.6** | OD-3 (23.53pp unrealized); `run_backtest.py:182-230` | `OWNER DECISION REQUIRED` |
| Benchmark (B&H) | B&H 10 pair (RQ1 :114-116) | ≥6 konstruksi berbeda; resmi engine = scalar `Σ100×(last/first)` = 155.03% | **OD-6.1–OD-6.3** | OD-6 §24; `run_backtest.py:206-211` | `PARTIAL` |
| Sharpe | RQ1 "Sharpe Ratio / VaRSR" (:114-116) | `mean/std × √365`, rf=0, arithmetic, equity curve | OD-6.4 | `run_backtest.py:189-190`; OD-6 §9 | `VERIFIED` (reproduksi 0.8234→0.82) |
| MDD | klaim PPT MDD (:78-80) + gate internal | `equity/cummax − 1` minimum, harian | OD-6.1 (definisi benchmark), OD-5.3 (trough = hari artefak) | `run_backtest.py:194-196` | `VERIFIED` (implementasi & reproduksi) |
| VaR | input VaRSR (Deng 2013) (:62) | **0 hit** seluruh repo | OD-6.6/6.7 | D11 grep | `NOT IMPLEMENTED` |
| VaRSR | RQ1 (:115), novelty (:269-273) | **0 hit** seluruh repo | **OD-3.11** + OD-6.6/6.7 | D11 grep; OD-6 §14 | `NOT IMPLEMENTED` |
| Paired t-test | "dengan koreksi metodologis untuk hari-hari posisi tunai (cash days) agar tidak bias" (:236-242) | `scipy.stats.ttest_rel` ada; **koreksi cash-day tidak ada**; generator crash di HEAD; angka strategy di-report hardcoded | OD-6.8 | `sharpe_benchmark.py:149-150,32-33,171-172`; D9 | `PARTIAL` |
| Correlation | "Memetakan korelasi return antar 10 aset…" (:243-245) | Pearson daily `pct_change().dropna()` → sampel 615 hari (jendela HYPE), matriks direproduksi persis | OD-6.9 | `portfolio_size_experiment.py:32-49`; OD-6 §16 | `PARTIAL` |
| Regime analysis | "berdasarkan distribusi imbal hasil bergulir" (:246-250) | BTC rolling 90d; BEAR ≤ −20%, BULL ≥ +40% (konstanta hardcoded); parameter tak ada di PPT; generator crash | OD-6.10 | `regime_segmentation.py:38-51`; D9 | `PARTIAL` |
| Regime MDD bear (aktif vs pasif) | "membandingkan MDD … segmen bear/crash" (:250-256) | ada di `regime_segmentation_analysis.md` §4 (frozen) | OD-6.10 | report §4 | `PARTIAL` |
| Diversification analysis | RQ3 jumlah aset & korelasi mengurangi risiko (:116) | korelasi + eksperimen ukuran/cluster saja; **tanpa** diversification ratio / risk contribution / portfolio vol | bagian scope tesis | D11 (0 hit) | `PARTIAL` |

---

## 6. Data Provenance Chain

Rantai: `Bitget API → scripts/fetch_bitget_data.py → dataframe → data/historical/*.csv →
load_ohlcv (fitur in-memory) → run_backtest → outputs`. Per tautan:

| Link | Source | Script | Transformasi | Timestamp/TZ | Filtering | Missing-bar | Path | Checksum | Deterministik? | Reproducible hari ini? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1. API → raw df | Bitget via `ccxt` (`enableRateLimit`), start hardcoded **2020-08-01 UTC** (`:36-37`), paginasi 1000 candle, retry ladder 2021-01…2025-01 (`:45-56`), `sleep(0.5)` | `scripts/fetch_bitget_data.py` | `fetch_ohlcv` → list candle | ms epoch UTC → `pd.to_datetime(unit="ms", utc=True).dt.date` = **tanggal kalender UTC** (`:97`) | dedupe `date` **ambil pertama** (`:119`), sort ascending | deteksi gap **hanya WARN** (`:105-117`), lubang dibiarkan | — | — | Ya, selama respons venue sama | **`UNKNOWN`/terblokir** — refetch terfilter ISP (OD-5 §26); restatement venue tak bisa dicek |
| 2. raw df → CSV | idem | `save_csv` (`:126-130`) | `df.to_csv(index=False)`; **`ts` mentah DIBUANG** (hanya kolom `date`) | tidak ada timezone column; tidak ada jam | idem | 1.635 bar hilang tercatat di file (D7: BTC 204, ETH 204, SOL 203, BNB 203, XRP 204, AVAX 104, LINK 204, DOGE 204, ADA 104, HYPE 1) | `data/historical/{PAIR}_1d.csv` (13 file) | **TIDAK ADA** (find: 0 manifest/checksum) | Ya (file committed) | Ya untuk **membaca**; tidak untuk **regenerasi** (link 1) |
| 3. CSV → fitur | — | `load_ohlcv` (`run_backtest.py:52-69`) | ATR/don_hi/don_lo dihitung in-memory (tidak ada feature store) | indeks = kolom `date` | tanpa filter tambahan; `cfg=None` → **KeyError** (`:59`) | pair absen pada tanggal → dilewati loop (`:84-85`) | — | — | Ya | Ya |
| 4. fitur → backtest | — | `run_backtest` (`:71-176`) | loop tanggal = `sorted(set.union)` (`:81`); iterasi aset = urutan `config.pairs` | — | — | MTM hanya pair yang punya bar (`:168-175`) | — | Ya (dibuktikan byte-identical, §15) | Ya |
| 5. backtest → output | — | `save_report` (`:251-288`) | `equity_curve.csv`, `trades.csv`, `equity_drawdown.png`, `metrics.md` | — | — | — | `backtest/reports/` (atau `REPORT_SUBDIR`) | csv/png top-level **di-gitignore** | Ya | Ya |

**Fakta provenance kunci:**

- **Commit data:** history `data/historical/` = 6 commit "[data] update historical OHLCV dari Bitget"
  (2026-09-02, `90886b7`→`3e5caae`) + `c42a478` (2026-09-07, menambah **BCH/LTC/PAXG** — pair
  riset, di luar universe thesis). **`git diff e6188de HEAD -- data/historical/` = hanya 3 CSV
  riset** → **10-pair CSV identik antara snapshot A dan B (`VERIFIED`)** — mengkonfirmasi
  PHASE2G "same data (D4)".
- **1.635 missing bars** (OD-5) **direproduksi independen** sesi ini (D7) — angka cocok persis.
- **Timestamp mentah hilang permanen** (`df.drop(columns=["ts"])`, `:98`) → audit timezone /
  jam candle tidak bisa dilakukan dari CSV (hanya tanggal UTC).
- **Dataset provenance `PARTIAL`:** tanpa manifest, tanpa checksum, tanpa log fetch tersimpan,
  tanpa versi endpoint; refetch terblokir → **klaim "dataset fully provenance-traceable"
  TIDAK didukung bukti** (`PARTIAL` — semuanya menunggu OD-5.1/5.2/5.9).
- **Env fetch unpinned** (ccxt version hanya tercatat lewat venv aktual `4.5.73`, tidak di-lock).
- **4 hari all-absent** (2025-02-11/03-29/07-09/07-13) + resume days → perlakuan treatment =
  OD-5.3/OD-5.4 (tidak dipilih di sini).

---

## 7. Configuration Provenance

Inspeksi: `config.yaml`, `presets/*.yaml`, kode `backtest/`, `backtest/research/*`, laporan
`backtest/reports/*`, `decision_log.md`, dokumentasi (`DESIGN.md`, `RULES.md`, `ARCHITECTURE.md`,
`PLAN/TASKS/README/REPO_MAP`), referensi web (`lib/constants.ts`, `lib/validations.ts`,
`lib/reference.ts`, halaman `app/*`).

Pertanyaan per parameter: (1) didefinisikan di mana · (2) ada duplikat? · (3) sepakat? ·
(4) artefak historis mana yang memakainya? · (5) hasil historis bisa direproduksi darinya?

| Parameter | (1) Definisi sekarang | (2) Duplikat | (3) Sepakat? | (4) Artefak historis | (5) Reproducible dari sini? |
|---|---|---|---|---|---|
| Universe 10 pair | `config.yaml:5-16` (SoT) | preset `donchian_cluster_a2.yaml`, `constants.ts:1` | **Ya** (urutan identik) | metrics.md, reference.json, semua report | Ya |
| Entry period 20 | `config.yaml:17` | preset `params` | Ya | A & B | Ya |
| Exit period 10 | `config.yaml:18` | preset | Ya | A & B | Ya |
| ATR period 14 | `config.yaml:19` | preset | Ya | A & B | Ya |
| Stop multiplier 2.0 | `config.yaml:20` | preset | Ya (selalu `2.0` sejak diperkenalkan — cek history) | A & B | Ya |
| Risk 1% | `config.yaml:30` | preset `risk`, `GUARDRAILS.maxRiskPerTradePct` | Ya | A & B | Ya |
| Cluster cap 2 | `config.yaml:22` | preset | Ya | A & B | Ya |
| Max concurrent 5 | `config.yaml:31` | preset, `GUARDRAILS.maxConcurrent` | Ya | A & B | Ya |
| Fee 0.1% | `config.yaml:42` | preset? (tidak di preset — pakai config) | — | A & B | Ya |
| Slippage 0.05% | `config.yaml:43` | `reference.json slippageAssumptionPct` | Ya | B & web | Ya |
| Date range / period | **TIDAK di config** — data-driven (first/last CSV) | `lookback_years: 6` (`config.yaml:37`) **TIDAK DIBACA kode mana pun** (D11); label `reference.json:3` "2020-08..2026-08"; fetch start hardcoded 2020-08-01 | **Tidak** (label ≠ data) | semua | Label = **tidak**; angka periode = ya (dari data) → **OD-5.5** |
| Starting capital 1000 | `config.yaml:41` | `constants.ts:3` | Ya | A & B | Ya |
| Benchmark settings | **hardcoded** `run_backtest.py:206-211` (bukan config) | varian lain hardcoded di research/report | **Tidak** (≥6 konstruksi) | metrics.md 155.03, sleeve 0.98, dll. | Reproduksi per-konstruksi; **canonical = OD-6.1** |
| Statistical settings (rf, √365, ddof) | **hardcoded** `run_backtest.py:189-192` | deskripsi di `DESIGN.md:169`, header report | Ya (dok vs kode) | A & B | Ya |
| Regime window/thresholds | **hardcoded** `regime_segmentation.py:44-46` (90d, −20%, +40%) | tidak ada di config/PPT | — | regime report | **Tidak** (script crash; parameter tak terdaftar) → OD-6.10 |
| Correlation window/method | **hardcoded** dalam pipeline script (`pct_change().dropna()`) | — | — | portfolio report | **Tidak** (script crash) → OD-6.9 |
| T-test α / pairing | hardcoded (`ttest_rel`, p<0.05 di report) | — | — | sharpe_benchmark_comparison | **Tidak** (script crash; koreksi cash-day absen) |
| Preset overlay | `PRESET` env → `load_config` (`run_backtest.py:40-50`) | `presets/*.yaml` (3) | param donchian = copy config ✓ | preset reports (26bdafe, 0ad6cc6) | Ya (runner bekerja) |
| Model (donchian/sma/rsi) | `config.yaml` tidak punya `model` → `setdefault("donchian")` (`:51`) | preset punya `model` | — | A & B = donchian | Ya |

**Temuan konfigurasi:**
- Single-source untuk parameter **strategi/risk** ada dan setuju (`VERIFIED`) — konsisten
  `ARCHITECTURE.md` §16 baris 1.
- **Konstanta kritis untuk statistik/thesis tidak punya source tunggal** — tersebar hardcoded
  di ≥4 script → bagian dari **OD-7.5**.
- **`lookback_years` = parameter mati** (`VERIFIED` absence — 0 pembacaan) — komentar
  `config.yaml:37` mengklaim periode 2020-08..2026-08 yang juga tidak terjadi → `PARTIAL`.
- Komentar `config.yaml:23` & `presets/donchian_cluster_a2.yaml:2` mengutip **Snapshot A**
  (−26.19) sementara runtime SoT = B → stale citation (§24, dimiliki ARCH §16/Phase 2G C4).

---

## 8. Strategy-Code Traceability

**Fakta implementasi (bacaan kode sesi ini, cross-ref OD-2/OD-3/OD-4):**

| Aspek | Implementasi aktual | Evidence | Klasifikasi |
|---|---|---|---|
| Entry window | `rolling(20).max().shift(1)`; trigger `prev.close > prev.don_hi` (strict `>`) | `strategy.py:61-63`, `run_backtest.py:128-129` | unik |
| Exit window | `rolling(10).min().shift(1)`; trigger `close < don_lo` (strict `<`) | `strategy.py:66-68`, `run_backtest.py:99` | unik |
| Shift | semua channel shift(1) → info ≤ t−1 saat sinyal | `strategy.py:64,69` | unik |
| Execution price | entry `open[i]×(1+slip)`; exit/stop `close[i]` (atau `open[i]` gap-stop) | `run_backtest.py:133,104,154` | unik |
| Stop formula | `prev_close − 2.0 × prev_atr` (L4) — **bukan** PPT `Entry − 2×ATR` | `run_backtest.py:133` | konflik → OD-2.1 |
| ATR implementation | Wilder, seed = SMA TR `period` pertama, rekursi manual | `strategy.py:133-144` | unik (sejak `029a311`) |
| Gap behavior | `open ≤ stop` → exit `gap_stop` (ada blok terpisah setelah cek entry) | `run_backtest.py:151-176` | unik; 0 kejadian historis `gap_stop` (OD-6 §13) |
| Same-day exit | exit/close-check dulu (`if symbol in pos`), entry di `else` → tak bisa re-entry hari yang sama | `run_backtest.py:97-148` | unik; OD-3.8/OD-2.5 |
| Fee treatment | `(1−fee−slip)` di exit; `(1+fee)` di cost entry | `run_backtest.py:104,135` | unik |
| Slippage treatment | entry `×(1+slip)`; exit `×(1−fee−slip)` | idem | unik |
| Position sizing | `risk_amount/stop_distance`, cap `equity/entry`; clamp cash `cost>cash` | `strategy.py:71-83`, `run_backtest.py:135-140` | unik; OD-4.1/4.3/3.10 |
| Portfolio capacity | global `< max_concurrent(5)` + cluster `< 2` (guard `continue`) | `run_backtest.py:124-127` | unik |
| Ordering | iterasi aset = urutan `dfs` = urutan `config.pairs` (BTC…HYPE) | `run_backtest.py:84` | **ORDER-DEPENDENT** (OD-4 §15) → OD-4.9/OD-7.9 |

**Inventaris implementasi & klasifikasi (tidak ada yang dihapus/dikonsolidasi):**

| Artefak | Klasifikasi | Keterangan |
|---|---|---|
| `backtest/strategy.py` (158 baris) | **active + product-shared** | satu-satunya definisi formula Donchian/ATR/sizing; diimport `run_backtest.py`, `paper_trading/live_signal.py`, `research/run_longshort_backtest.py`, `research/correlation_mitigation.py` (D11) |
| `backtest/run_backtest.py` loop | **active** | 1 loop portofolio; sumber Snapshot A & B |
| Versi `e6188de` & pra-`029a311` | **historical** | menghasilkan Snapshot A (bukti byte-identical, §11) |
| `research/sharpe_benchmark.py`, `regime_segmentation.py`, `portfolio_size_experiment.py` | **research-only** | panggil `load_ohlcv` tanpa cfg → **crash di HEAD** (D9) |
| `research/correlation_mitigation.py:35` `load_ohlcv` sendiri | **research-only** | loader mandiri (baca CSV polos, tanpa indikator) → masih jalan |
| `presets/*.yaml` + runner `PRESET` | **active** (gate publik) | model sma/rsi berbagi engine; 2 preset gagal gate (frozen) |
| Duplikasi formula Donchian lain | **tidak ada** | grep `don_hi/rolling(max` hanya menemukan import dari `strategy.py` |

**Apakah tesis bisa mengutip satu implementasi tak ambigu?** Ya untuk **sinyal & eksekusi
strategi** (`VERIFIED` — satu aktif); **`PARTIAL`** untuk artefak keseluruhan karena (a) dua
versi historis menghasilkan dua snapshot berbeda, (b) loop engine sendiri punya semantik yang
masih diperdebatkan (OD-2.x/OD-3.x), (c) loader riset terpisah dengan perilaku tak identik.

---

## 9. Result Generation Chain

Klasifikasi per hasil utama: `calculated` (dihitung kode), `copied`, `hardcoded`,
`manually transcribed`, `generated by script`, `stale snapshot`, `different commit`,
`different configuration`.

| Hasil | Generator | Sifat | Evidence / catatan |
|---|---|---|---|
| Return 152.00% / 149.59% | `compute_metrics` (`run_backtest.py:185-187`) | calculated | dua hasil = **different commit** (B: HEAD, A: `e6188de`) |
| Final equity 2520.02 / 2495.92 | idem `:229` | calculated | idem |
| Sharpe 0.82 | `:189-190` | calculated | identik di A & B |
| MDD −26.45 / −26.19 | `:194-196` | calculated | different commit |
| Trade count 94, win rate 36.17 | `:198-204` | calculated | identik di A & B |
| Profit factor 2.27 / 2.26 | `:205` | calculated | different commit |
| Avg R 1.03 / 1.02 | `:201` | calculated | different commit; entry-fee belum masuk (OD-3.4) |
| B&H return 155.03% | `:206-211` | calculated (scalar) | identik A & B |
| B&H Sharpe 0.98 / 0.83 | `research/sharpe_benchmark.py` | calculated by script | report frozen; script **crash di HEAD**; angka strategy di tabel report **hardcoded** (`:32-33`, `:171-172`) |
| B&H MDD −77.63% | **tidak ada script** | manually computed/transcribed | `bh_max_drawdown.md` commit `d728ec8`, **no writer** (D11) → `NOT TRACEABLE` |
| B&H MDD −58.44%, corr 0.838 | **tidak ada script** | transcribed | `bh_drawdown_and_btc_eth_corr.md` (d728ec8), no writer |
| Paired t-test (0.0743/0.0193) | `sharpe_benchmark.py:149-150` | calculated (frozen run 2026-09-05; report committed `c42a478`) | generator crash; koreksi cash-day absen → `PARTIAL` |
| Correlation matrix (0.843 …) | `portfolio_size_experiment.py:32-49` | calculated (frozen) | fungsi matriks masih bisa dijalankan langsung; `run_single` crash; window 615-hari tak terdokumentasi sebagai keputusan |
| Regime performance tables | `regime_segmentation.py` | calculated (frozen) | generator crash; param post-hoc (`INFERRED`) |
| Diversification metrics | — | **absen** | `NOT IMPLEMENTED` (0 hit) |
| VaR / VaRSR | — | **absen** | `NOT IMPLEMENTED` (0 hit) |
| −58.49% (vanilla) | run historis `45c42f3`/2026-09-05 + tabel hardcode di report | copied/hardcoded | re-run HEAD = −58.64 (OD-6 §7) → stale-by-engine-drift |
| Angka web (marketing) | `lib/backtest-reference.json` (hand-transcribed `029a311`+`9769a0c`) → `reference.ts` | transcribed → consumed | `disclaimer:18` memakai A, `:25` memakai B (**campur**) |
| Ledger/trade harian A | run native 2026-09-06 (mtime 22:58) | generated | **ada** di worktree, di-gitignore |
| Ledger/trade harian B | run asli tak dikenal | **tidak ada artefak** | `PROVENANCE UNKNOWN` (nilai re-derivable, §21) |
| `decision_log.md`, `sharpe_discrepancy_report.md` | hand-authored | manually written | tanpa generator (D11) |

---

## 10. Thesis Table/Figure Traceability

Repo **tidak berisi** dokumen tesis (0 file `.tex/.bib/bab/skripsi` — find D11). Artefak
thesis-facing = laporan `backtest/reports/*.md`, figure `.png`, dan halaman web. Claim/evidence
matrix (10 angka wajib ditandai + pendukung):

| Thesis Claim / Number | Source Artifact | Generated By | Commit | Config | Dataset | Reproducible? | Status |
|---|---|---|---|---|---|---|---|
| `149.59%` (Return A) | `backtest/reports/metrics.md:5` | run native `run_backtest.py` | `e6188de` (last write 2026-09-06) | config.yaml A-identik | 10-pair CSV = sama dgn HEAD | **Ya — via checkout `e6188de`** (byte-identical, §11) | Snapshot A, **stale vs HEAD** (`PARTIAL` untuk pemakaian sebagai angka kini) |
| `−26.19%` (MDD A) | `metrics.md:9` + kutipan `config.yaml:23`, `presets/donchian_cluster_a2.yaml:2`, `RULES.md:56`, `decision_log:111`, `disclaimer:18`, `DESIGN.md:193` | idem + **manual citation** | idem | idem | idem | Ya (checkout) | Snapshot A tersebar di 6+ tempat — stale citation (`§24`) |
| `152.0%` (Return B) | `monitoring/web/lib/backtest-reference.json:11` | **hand-transcribed** (tanpa writer script) | `029a311` (2026-09-12) | HEAD | 10-pair CSV | **Ya — run HEAD** (3×, §21) | Snapshot B, runtime SoT (`VERIFIED` repro) — **bukan** pemilihan canonical |
| `−26.45%` (MDD B) | `reference.json:10` | idem | idem | idem | idem | Ya | idem |
| `0.82` (Sharpe) | `reference.json:9`; juga common A/B; kutipan `proof:32`, `disclaimer:25`, `config.yaml:23` | calculated (engine) | A & B sama | idem | idem | Ya | angka common kedua snapshot (`VERIFIED`) |
| `0.98` (B&H Sharpe) | `sharpe_benchmark_comparison.md:18` (+ kutip `DESIGN.md`, `decision_log:95`) | `sharpe_benchmark.py` run 2026-09-05 | report committed `c42a478` | **bukan baseline kini** (max_conc 5 tanpa cluster) | sama | **Sebagian** — fungsi reproduksi jalan (OD-6) tapi **script crash di HEAD**; angka strategy hardcoded | `PARTIAL` |
| `−26.19 →` vs `−26.45` | ARCH §16 tabel | kedua snapshot | `e6188de` / `029a311` | idem | idem | Ya (masing-masing) | **keduanya non-canonical** (pending ARCH §16) |
| `−58.49%` **sebagai B&H** | `decision_log.md:99` ("DD −26.19% vs B&H −58.49%") | hand-written | `e6188de` | — | — | **Tidak** — salah label: −58.49 = MDD **strategi vanilla** (PPT :78-80; `DESIGN.md:132`) | `NOT TRACEABLE` sebagai B&H → errata = **Phase 2H OD-11** (`VERIFIED` kontradiksi) |
| `−58.49%` (konteks benar: strategi vanilla / eksperimen 862%) | `sharpe_discrepancy_report.md:36-37,97`, `portfolio_size_experiment.md:54`, `PLAN.md:42`, `decision_log:24,52,69` | frozen run 2026-09-05 (report tanpa generator) | `c42a478` | max_conc 5, tanpa cluster | sama | Frozen ya; **HEAD = −58.64** (engine drift) | `PARTIAL` |
| `−77.63%` (B&H MDD) | `bh_max_drawdown.md:67,75` | **tidak ada script** | `d728ec8` | — | sama (rekonstruksi OD-6 −77.54) | **Tidak persis** (tanpa generator; endpoint deviasi +9.3% di recon OD-6) | `NOT TRACEABLE` (exact) / `PARTIAL` (nilai dalam klaim PPT −75..−85) |
| `155.03%` (B&H scalar) | `metrics.md:16`, `DESIGN.md:198`, preset reason fields | calculated `run_backtest:206-211` | A & B | idem | idem | Ya (`VERIFIED`) | angka common (`VERIFIED`); canonical benchmark = OD-6.1 |
| `t-test p=0.0743/0.0193` | `sharpe_benchmark_comparison.md` | scipy (frozen run) | `c42a478` | non-baseline | sama | **Tidak tanpa intervensi** (crash; koreksi cash-day tidak dijalankan) | `PARTIAL` |
| Corr `0.843` | `portfolio_size_experiment.md` + `bh_drawdown_and_btc_eth_corr.md` | matriks script (frozen) | `c42a478`/`d728ec8` | — | 615-hari window | fungsi matriks jalan; window tak terdokumentasi (0.838 full-period juga tercatat) | `PARTIAL` (label "periode penuh" konflik — OD-6 §16) |
| Regime tables (bull/bear/sideways) | `regime_segmentation_analysis.md` | `regime_segmentation.py` (frozen) | `c42a478` | 3 konfig strategi (max_conc 1/5) | sama | **Tidak** (crash) | `PARTIAL` |
| Return/Sharpe preset RSI & SMA (`+5.99%`, `+41.17%`) | `backtest/reports/presets/*/metrics.md` | runner `PRESET=…` | `26bdafe`/`0ad6cc6` | preset | sama | Ya (runner aktif) | `VERIFIED` (artefak gate; frozen) |
| Web "BACKTEST REFERENCE" | `reference.json` → `ProofStrip.tsx` (`BACKTEST_REFERENCE`) | transcribed | `029a311`/`9769a0c` | — | — | Ya (== run HEAD) | `VERIFIED` == B |
| Figur: `equity_drawdown.png` | run tiap backtest | matplotlib (`save_report:258-277`) | — | — | — | Ya (byte-identical antar run) | output **di-gitignore** (tidak diretas di git) |

**Flag stale eksplisit (prompt §F):** `149.59` & `−26.19` = Snapshot A (6+ kutipan, §24);
`152.0` & `−26.45` = Snapshot B; `0.82` = common; `0.98` = B&H sleeve (bukan strategi);
`−58.49` di konteks B&H = **mislabel 1 lokasi** (`decision_log:99`) + `PLAN.md:42` (konteks 862%);
`−77.63` = report-only.

---

## 11. Snapshot A Trace

| Dimensi | Temuan | Evidence | Status |
|---|---|---|---|
| Angka | 149.59 / 17.04 / 0.82 / 0.84 / −26.19 / 94 / 36.17 / 1.02 / 4.31 / −0.84 / 2.26 / 155.03 / **2495.92** / 2123 | `backtest/reports/metrics.md` | `VERIFIED` isi file |
| Exact commit | **`e6188de`** (2026-09-06 23:54, "[Fase 1/2] Implementasi Cluster-A2…"); metrics.md last-write di commit ini (mtime worktree `Sep 6 23:55`, tidak pernah ditulis ulang) | `git log --follow -- backtest/reports/metrics.md` + `ls -la` | `VERIFIED` |
| Code state | pra-`029a311` (indikator ATR = versi lama); judul report masih **hardcoded string** `"…ATR(14)x2, long-only"` (`e6188de:run_backtest.py:202/:206`) | `git show e6188de:…` | `VERIFIED` |
| Config state | `config.yaml` numerik identik dengan HEAD (dua perubahan pasca-09-06 hanya komentar — PHASE2G C2; `atr_stop_multiplier` selalu `2.0`) | `git show e6188de:config.yaml`; history | `VERIFIED` |
| Data state | 10-pair CSV **identik dengan HEAD** | `git diff e6188de HEAD -- data/historical/` (hanya +BCH/LTC/PAXG) | `VERIFIED` |
| Report path | `backtest/reports/metrics.md` (+ ledger worktree `trades.csv`/`equity_curve.csv` era-A, **gitignored**, mtime 2026-09-06 22:58, final 2495.92) | D6 | `VERIFIED` |
| Generation command | **tidak tercatat** di repo; direkonstruksi: `python backtest/run_backtest.py` pada checkout `e6188de` | uji `/tmp/od7_clone` (§21) | `INFERRED` untuk command historisnya; **reproduksi = `VERIFIED` byte-identical** |
| Reproducible hari ini? | **Ya — hanya via checkout historical** (clone `e6188de`); **tidak** dengan kode HEAD | D5 + D4 (HEAD run ≠ A) | `VERIFIED` |
| Kenapa beda dari B | Pembeda tunggal = rewrite ATR/RSI **seed Wilder** `029a311` (2026-09-12); data & config identik | PHASE2G §9; D8; `git log` | `STRONGLY SUPPORTED` |
| Canonical status | **TIDAK dipilih audit ini** — `ARCHITECTURE.md` §16 pending; `OD-5.10` juga membuka status freeze | ARCH §16 | `OWNER DECISION REQUIRED` |

---

## 12. Snapshot B Trace

| Dimensi | Temuan | Evidence | Status |
|---|---|---|---|
| Angka | 152.00 / 17.24 / 0.82 / 0.85 / −26.45 / 94 / 36.17 / 1.03 / 4.35 / −0.85 / 2.27 / 155.03 / **2520.02** / 2123 | run sesi ini (§21) + `PHASE2_SOURCE_OF_TRUTH:183` | `VERIFIED` |
| Exact commit | artefak `monitoring/web/lib/backtest-reference.json` dibuat **`029a311`** (2026-09-12 23:00 — commit **sama** dengan rewrite Wilder); `sharpeRatio` ditambahkan **`9769a0c`** (2026-09-13) | `git log --follow -- backtest-reference.json`; PHASE2 SoT §7.1 | `VERIFIED` |
| Code state | HEAD `d728ec8` (== kode `029a311` untuk jalur engine — tidak ada perubahan engine sesudahnya selain `0ad6cc6`/`c42a478` yang menambah preset/riset) | `git log` | `VERIFIED` (dibuktikan: run HEAD == B) |
| Config state | numerik identik dengan era A (§11) | idem | `VERIFIED` |
| Data state | 10-pair CSV sama dengan era A | D8 | `VERIFIED` |
| Report path | `reference.json` (json) — **bukan** output runner; `backtest/reports/metrics.md` TIDAK berisi B (masih A) | D4 | `VERIFIED` |
| Generation command | **tidak tercatat** untuk run asli 2026-09-12; re-run dokumentasi: `REPORT_SUBDIR=/tmp/… python backtest/run_backtest.py` (PHASE2 SoT :183; OD-2/3/4 memakai pola sama) | §21 | `PARTIAL` (command rekonstruksi `VERIFIED`; command asli `PROVENANCE UNKNOWN`) |
| Reproducible hari ini? | **Ya** — 3 run byte-identical, 14/14 metrik == json | D2/D3/D4 | `VERIFIED` |
| Dependency pada ATR rewrite | **Ya** — B ada karena fix Wilder (`029a311`); tanpa fix itu kode HEAD menghasilkan A | §11 | `VERIFIED` |
| Ledger B | **tidak ada artefak** (csv/png gitignored; worktree berisi ledger A) | D6 | `PROVENANCE UNKNOWN` (run asli); nilai re-derivable |
| Canonical status | **TIDAK dipilih audit ini** (fakta implementasi: kode membaca B; `ARCHITECTURE.md` §16 = "itu bukan pemilihan canonical") | ARCH §16 | `OWNER DECISION REQUIRED` |

---

## 13. Backtest Command Reproducibility

**Inventaris command:**

| Command | Fungsi | Terdokumentasi di | Status di HEAD |
|---|---|---|---|
| `python backtest/run_backtest.py` | backtest utama → `backtest/reports/` | `README.md:120`, docstring runner | **jalan** — tapi **menimpa `metrics.md` tracked** (Snapshot A) |
| `REPORT_SUBDIR=/tmp/x python backtest/run_backtest.py` | idem, output terisolasi | audit docs (OD-2/3/4/5/6), PHASE2 SoT | **jalan** (dipakai sesi ini) |
| `cli.py backtest` | wrapper `subprocess` → script sama | `cli.py:29-30`, ARCH §17 | jalan (sama saja) |
| `PRESET=presets/*.yaml … run_backtest.py` | overlay preset | `run_backtest.py:40-50` | jalan (2 preset frozen) |
| `PYTHONPATH=. python backtest/research/sharpe_benchmark.py` | t-test & B&H Sharpe | docstring `:8` | **CRASH** (KeyError, D9) |
| `PYTHONPATH=. python backtest/research/regime_segmentation.py` | regime | docstring `:6` | **CRASH** (D9) |
| `PYTHONPATH=. python backtest/research/portfolio_size_experiment.py` | ukuran portofolio + matrix | docstring `:3` | **CRASH** (`run_single` `:73`; fungsi matriks aman) |
| `PYTHONPATH=. python backtest/research/correlation_mitigation.py` | eksperimen korelasi | docstring `:3` | loader mandiri (perlu dicek per-fungsi; tidak dijalankan penuh sesi ini — `UNKNOWN` untuk run penuh) |
| `python scripts/fetch_bitget_data.py` | regenerasi CSV | docstring | **terblokir jaringan** (OD-5 §26) |

**Uji reconstruksi Snapshot B (§21 detail):**

| Run | CWD | Command | Output | Hasil |
|---|---|---|---|---|
| A | `/home/kresna/project` | `REPORT_SUBDIR=/tmp/od7_repro_a ./venv/bin/python backtest/run_backtest.py` | metrics/curve/trades/png | 14 metrik == B |
| B | `/home/kresna/project` | idem → `/tmp/od7_repro_b` | idem | **byte-identical** ke run A |
| C | `/tmp` | `REPORT_SUBDIR=/tmp/od7_repro_c …/backtest/run_backtest.py` | idem | **byte-identical** → cwd-independent |

- **Working directory:** bebas (`ROOT = Path(__file__)`, config dibaca via path absolut —
  `run_backtest.py:30`, `:38-39`).
- **Python:** `./venv/bin/python` = 3.14.7 (venv dibuat 3.14.6 — §14).
- **Package environment:** venv lokal repo (range-pin, tanpa lockfile — §14).
- **Config path:** `config.yaml` (default) / overlay `PRESET` env.
- **Input:** `data/historical/{10 pair}_1d.csv`.
- **Expected outputs:** `metrics.md`, `equity_curve.csv`, `trades.csv`, `equity_drawdown.png`.
- **Byte-identical antar run? YA** (cmp + sha256, D2). **Numerically identical ke `reference.json`? YA** (9/9 field + 5 metrik lain cocok dengan catatan PHASE2 SoT).

**Apakah ada SATU command authoritative untuk hasil tesis? — `TIDAK` (`OWNER DECISION REQUIRED`, OD-7.2).** Alasan berbasis bukti: (a) dua command resmi (`cli.py` vs langsung) tidak ditetapkan mana canonical; (b) command default **mengubah file tracked** — reproduksi "obyektif" punya side-effect; (c) seluruh command riset/statistik **crash**; (d) tidak ada satu pun command yang menghasilkan **semua** artefak tesis (statistik terpisah & rusak); (e) run asli Snapshot B tidak terekam.

---

## 14. Environment Reproducibility

| Item | Keadaan | Klasifikasi |
|---|---|---|
| Python version | `venv/pyvenv.cfg` = **3.14.6** (saat venv dibuat); runtime = **3.14.7** (drift patch in-place); AGENTS.md minta "3.11+" | **partially pinned** (minor/major bebas; patch drift nyata) |
| `requirements.txt` | range pin saja: `ccxt>=4.5,<5`, `pandas>=3.0,<4`, `numpy>=2.0,<3`, `matplotlib>=3.10,<4`, `vectorbt>=1.0,<2`, `pytest>=8,<9`, `PyYAML>=6,<7`, `requests>=2.28,<3`, `rich>=13,<14` | **partially pinned** |
| Lockfile / pyproject / `.python-version` | **tidak ada** (find D11) | **unpinned** |
| Installed aktual (venv) | Python 3.14.7, pandas 3.0.5, numpy 2.5.2, ccxt 4.5.73, matplotlib 3.11.1, PyYAML 6.0.3, vectorbt 1.1.0, scipy 1.18.0, yfinance 1.7.0 | snapshot implisit (tidak terekam di file) |
| `scipy` (dipakai `ttest_rel`) | **tidak ada di requirements.txt** | **unpinned** → install bersih tak bisa menjalankan t-test research |
| `yfinance` (import di research) | **tidak ada di requirements.txt** | **unpinned** |
| `vectorbt` | di requirements, **0 import** di repo (PHASE2G §3; D11) | irrelevant (kandidat hapus — keputusan owner) |
| `pip check` | "No broken requirements found" | `VERIFIED` bersih |
| Tests | `pytest -q -p no:cacheprovider` → **70 passed** (7.10s) | `VERIFIED` |
| Timezone | fetch memakai UTC; CSV hanya tanggal UTC; engine tanpa `datetime.now` (D11) → hasil tak bergantung TZ lokal | `VERIFIED` |
| Locale | tidak memengaruhi output numerik (pemformatan report fixed-format) | `VERIFIED` (D11: tidak ada `strftime` lokal di jalur metric) |
| Random seeds | **tidak ada RNG** di engine (`random`/`np.random` 0 hit; "seed" = seed indikator Wilder) | `VERIFIED` |
| Nondeterministic ordering | lihat §15 (lintas-aset ORDER-DEPENDENT) | `OWNER DECISION REQUIRED` |
| Filesystem iteration | engine tidak iterasi direktori (pair dari config) | `VERIFIED` |
| Multiprocessing/parallelism | tidak ada | `VERIFIED` |
| External API dependencies | hanya fetch data (terblokir); backtest offline penuh | `VERIFIED` |

**Kesimpulan:** environment **`PARTIAL`** — cukup untuk reproduksi lokal di mesin ini (terbukti
3× run identik), tetapi **belum bisa direproduksi lingkungan bersih secara deterministik**
(tanpa lockfile, tanpa catatan versi persis Python, scipy/yfinance tak tercatat) → **OD-7.4**.

---

## 15. Determinism and Ordering

**Determinisme dalam-run (`VERIFIED`):** dua run identik → 4 output **byte-identical**
(sha256 tersimpan §21); PNG juga identik (matplotlib deterministik dengan input sama). Sumber
nondeterminism yang dicari (D11): RNG = 0; jam = 0 pada jalur metrik; `set` digunakan hanya
untuk union tanggal yang lalu `sorted` (`run_backtest.py:81`); iterasi dict = insertion order
config (stabil); filesystem iteration = tidak dipakai; multiprocessing = tidak ada.

**Ketergantungan urutan lintas-aset — tetap nyata (`VERIFIED` oleh OD-4, dikutip di sini):**

> Data identik, tiga urutan iterasi aset → return **152.00% / 159.17% / 162.51%** (selisih
> **10.51pp**), 94/93/92 trade, cluster-skip 498/509/503; toy portfolio delta **−23.34**
> dilaporkan engine sebagai `ORDER-DEPENDENT` (OD-4 §15, §21 baris A/C).
> Baris urutan-konfig = baseline kanonik saat ini (152.00). Angka 159.17/162.51 =
> **`FORENSIC SENSITIVITY`** (bukan hasil tesis).

- **Mekanisme:** urutan menentukan aset mana yang memakan slot cluster/hari yang sama
  (same-day entry ordering Case M — OD-3.9; capacity reuse OD-3.8).
- **PPT:** tidak meresepkan urutan iterasi (`NOT SPECIFIED IN APPROVED PPT` — OD-4 §15).
- **Apakah urutan bagian dari metodologi saat ini?** Secara *de facto* ya (urutan `config.pairs`
  menentukan hasil); secara *de jure* **bukan** — tidak ada keputusan yang menetapkannya.
  Status: **isu metodologis tak terselesaikan** → keputusan sudah terdaftar **OD-4.8** (+
  OD-3.9), diangkat kembali untuk evidence-chain sebagai **OD-7.9 (CARRIED)**.
- Audit ini **tidak mengubah** urutan apa pun (larangan "do not fix").

---

## 16. Statistical Pipeline Traceability

Cross-ref: **OD-6** (audit statistik lengkap) — sini hanya status ketertelusuran + klasifikasi.

| Pipeline | Input series | Frequency / annualization / rf | Missing & zero treatment | Klasifikasi reproduksi | Evidence & Status |
|---|---|---|---|---|---|
| **Sharpe** | equity curve `pct_change().dropna()` | harian, `mean/std×√365`, rf=0, ddof=1 | 4 hari artefak disertakan; 35.9% hari-nol disertakan | **reproducible** | `run_backtest.py:189-190`; 3 run == 0.82 (`VERIFIED`); konvensi = OD-6.4 |
| **MDD** | equity harian (`cummax`) | — | trough jatuh di hari artefak 2023-01-22; MTM exclude pair hilang; posisi terbuka ikut MTM | **reproducible** (angka) / **partially** (interpretasi — treatment gap OD-5.3, open-pos OD-3.6) | `:194-196` (`VERIFIED`) |
| **VaR** | — | — | — | **not implemented** | 0 hit (D11) `NOT IMPLEMENTED` |
| **VaRSR** | — | — | — | **not implemented** | 0 hit (D11) `NOT IMPLEMENTED` (OD-3.11, OD-6.6/6.7) |
| **Paired t-test** | daily return strategy vs sleeve, `intersection` (n=1919/2119) | harian; dua-sided `ttest_rel` | **koreksi cash-day (wajib PPT) tidak ada**; artefak kedua series ikut masuk | **partially reproducible** — angka frozen (0.0743/0.0193) bisa direkonstruksi (OD-6), tetapi **script crash** + tabel strategy **hardcoded** + config non-baseline | `sharpe_benchmark.py:149-150,32-33,171-172`; D9 (`PARTIAL`, OD-6.8) |
| **Correlation** | daily `pct_change` 10 aset, `dropna()` listwise | harian; Pearson | sampel menyusut ke **615 hari**; 9 hari dibuang senyap (4 hole + 4 resume + 1 baris) | **partially reproducible** — fungsi matriks jalan & reproduksi sel persis (OD-6); **run penuh script crash**; window tak diputuskan | `portfolio_size_experiment.py:32-49`; OD-6 §16 (`PARTIAL`, OD-6.9) |
| **Regime analysis** | BTC rolling 90d return | label trailing (≤t) → **tanpa look-ahead**; threshold −20%/+40% hardcoded | 200 hari hole BTC tanpa label; blok terpecah | **partially reproducible** — report frozen reproduksi-nya terblokir (crash); parameter tak terdaftar di PPT → post-hoc (`INFERRED`) | `regime_segmentation.py:43-51`; D9; OD-6 §18-20 (`PARTIAL`, OD-6.10) |
| **Regime performance (per segmen)** | equity/trade dipotong segmen | DD = `cummax` **lokal segmen**; trade lintas-batas keluar dari `n_trades` | segmen <5 hari dibuang dari tabel | **partially** (frozen; tak bisa regenerasi) | `compute_metrics_in_period` `:58-88` (`PARTIAL`) |
| **Diversification metrics** | — | — | — | **not implemented** | 0 hit diversification-ratio/risk-contribution/portfolio-vol (D11) `NOT IMPLEMENTED` |
| **Multiple-testing control** | — | — | — | **not implemented** | 2 t-test + matriks regime + 9-ekperimen tanpa koreksi (OD-6 §22) `NOT IMPLEMENTED` |
| **Assumption checks** (normalitas/dll.) | — | — | — | **not specified / not implemented** | 0 hit shapiro/ljung/autocorr (OD-6 §23) `NOT IMPLEMENTED` |

---

## 17. Owner Decision Dependency Graph

`Decision → affected implementation → affected metric → affected thesis claim`. Tidak ada
keputusan yang diputuskan di sini.

| Decision | Implementation yang terpengaruh | Metric | Thesis claim |
|---|---|---|---|
| **OD-2.1/2.2** stop anchor (Entry vs prev_close) | `run_backtest.py:133` stop & sizing distance | semua trade/R/metric | risk-control fidelity claim |
| **OD-2.3** timestamp ATR | `prev["atr"]` pemakaian | stop trigger, sizing | eksekusi anti look-ahead claim |
| **OD-2.4–2.7** dinamis/prioritas/gap/stop-cost | loop exit `:97-176` | exit reason mix, PnL | exit-management claim |
| **OD-2.8/2.9** exit fill timing & touch semantics | harga exit `:103/:104` | semua return/DD | execution realism claim |
| **OD-3.1–3.5** exit timing/kos/fee-pnL | trade `pnl`, `r_multiple` | PF, avg R, win rate | trade-quality claim |
| **OD-3.6** posisi akhir periode | `compute_metrics` equity vs trades | **+23.53pp** dari 152.00 | headline return claim |
| **OD-3.7 + OD-5.3** treatment gap / posisi saat hole | MTM & stop `:168-176` | Sharpe (0.82↔1.10), MDD (−26.45↔−18.08) | **risk-adjusted effectiveness claim** (contoh struktur prompt) |
| **OD-3.8/3.9** same-day capacity & ordering antar aset | loop `:97-148` | trades count, equity | capacity/robustness claim |
| **OD-3.11** VaRSR implement vs amend | pipeline statistik baru | VaRSR | **RQ1 claim** (Sharpe/VaRSR vs B&H) |
| **OD-4.1–4.3, 4.11** definisi 1% & basis sizing | `position_size`, basis equity | units, R, semua metric | position-sizing correctness claim |
| **OD-4.6/4.7/4.10** rounding/cap/portfolio cap | sizing & guard | sizing outliers | risk-cap claim |
| **OD-4.8 (→ OD-7.9)** urutan iterasi aset | `for symbol in dfs.items()` `:84` | return spread **10.51pp** | hasil apapun → sensitivity claim |
| **OD-4.9** cash-shortfall policy | clamp `:135-140` | sizing realisasi (0 kejadian historis) | cash policy claim |
| **OD-5.1/5.2** sumber & rebuild dataset | `data/historical/*` | **semua** | seluruh angka tesis |
| **OD-5.4/5.5** kalender & periode | index dates, label period | date set semua metrik | "periode 2020–2026" claim |
| **OD-5.6/5.7** universe & HYPE | config pairs, benchmark window | B&H & strategy | survivorship-bias claim (PPT:294) |
| **OD-5.8/5.9** acceptance & checksum | manifest dataset | trust atas data | data-integrity claim |
| **OD-5.10** freeze status Snapshot B | baseline resmi | semua | apakah 152.00 boleh jadi baseline tesis |
| **OD-6.1–6.3** definisi benchmark | `run_backtest:206-211` + variant | B&H return/Sharpe/MDD | RQ1 comparison claim |
| **OD-6.4/6.5** konvensi Sharpe & alignment | `compute_metrics:189` | Sharpe | risk-adjusted claim |
| **OD-6.6/6.7** formula/confidence VaRSR | pipeline belum ada | VaRSR | RQ1 (Deng 2013) claim |
| **OD-6.8** koreksi cash-day t-test | `sharpe_benchmark:149-150` | p-value | significance claim |
| **OD-6.9** window korelasi | `portfolio_size_experiment:32-49` | matriks 0.843/0.838 | RQ3 diversification claim |
| **OD-6.10** definisi regime | `regime_segmentation:43-51` | segmen, MDD bear | RQ2 regime claim |
| **OD-6.11 (=OD-5.3)** treatment missing | (lihat baris OD-3.7) | idem | idem |
| **OD-6.12** multiple testing | koreksi uji | p-value agregat | generalisasi klaim statistik |
| **ARCH §16** snapshot kanonik (A/B) | semua kutipan angka | semua metric | seluruh tabel tesis |
| **OD-7.1–7.12** (register §28) | evidence-chain nodes §26 | semua di atas | ketertelusuran tesis itu sendiri |

---

## 18. One-Number-One-Source Audit

| Metric/angka | Formula tunggal? | Input series tunggal? | Config tunggal? | Hasil tunggal? | Provenance path | Verdict |
|---|---|---|---|---|---|---|
| Total return | Ya (`:185`) | equity curve (A vs B berbeda kode) | Ya | **Tidak — 149.59 vs 152.00** | json(B) vs metrics.md(A) | **kompetitif** → ARCH §16 / OD-7.1 |
| Max DD | Ya (`:194`) | idem | Ya | **Tidak — −26.19 vs −26.45** (+varian segment OD-6) | idem | **kompetitif** |
| Strategy Sharpe | Ya (`:189`) | idem | Ya | Ya (0.82 di kedua snapshot) | keduanya | tunggal (angka), dua jalur bukti |
| Avg R / PF / avg win/loss | Ya (`:198-205`) | trade rows (A vs B berbeda) | Ya | **Tidak — 1.02/2.26 vs 1.03/2.27** (+varian entry-fee OD-3.4) | idem | **kompetitif** |
| B&H return | **Tidak** — ≥6 konstruksi (OD-6 §24) | berbeda (scalar/sleeve/rebalance/period-limited) | formula hardcoded | **Tidak** — 155.03 / +767% / 401% / 418% / 570.78 / 154.85 | beberapa tanpa generator | **kompetitif** → OD-6.1 |
| B&H Sharpe | formula sama (rf=0, √365) | **Tidak** — sleeve vs BTC vs 2-pair | — | **Tidak** — 0.98 / 0.83 / 0.8310 (+tanpa-artefak 0.8787 `FORENSIC SENSITIVITY`) | frozen report | **kompetitif** → OD-6.1 |
| B&H MDD | Ya per konstruksi | berbeda | — | **Tidak** — −58.44 / −76.63 / −76.89 / −77.63 / −96.69 | 2 report tanpa generator | **kompetitif** → OD-6.1 |
| Period | data-driven | — | `lookback_years` tak terbaca | **Tidak** — label "2020-08..2026-08" vs data 2020-11-09..2026-09-02 vs curve 2120 baris | json vs csv | **kompetitif** → OD-5.5 |
| Universe | — | — | config + constants + preset (**sepakat**) | Ya (10 pair) | config.yaml | tunggal ✓ (`VERIFIED`) |
| Fee/slippage rates | — | — | config (+ json copy sepakat) | Ya | config.yaml | tunggal ✓ (akuntansi PnL = OD-3.4) |
| −58.49% | — | — | — | **Tidak** — MDD strategi vanilla; dikutip sebagai "B&H" di `decision_log:99` | report frozen | **kompetitif (konteks)** → Phase 2H OD-11 |
| Paired t-test p | satu fungsi | — | α hardcoded | report frozen 1 pasang; sensitivitas lain `FORENSIC SENSITIVITY` (OD-6) | report | sebagian (`PARTIAL`) |
| VaRSR | — | — | — | — | — | **`NOT IMPLEMENTED`** |
| Expectancy | **tidak ada di kode** | — | — | — | — | **`NOT IMPLEMENTED`** (OD-6 §13) |
| Raw trade ledger (B) | — | — | — | — | — | **tidak ada** (`PROVENANCE UNKNOWN`) |

Tidak ada upaya memaksa angka menjadi satu definisi (larangan prompt §M).

---

## 19. Reproducibility Tier Classification

- **R0** tidak terlacak · **R1** hasil ada, provenance tidak lengkap · **R2** reproducible dari
  state repo tapi tidak terdokumentasi independen · **R3** reproducible dari command/config/data
  terdokumentasi · **R4** frozen data + checksum + env + config + commit + command + expected
  output (semua bukti ada).

| Output thesis-kritis | Tier | Alasan (bukti) |
|---|---|---|
| Snapshot B — 14 metrik utama | **R3** | command terdokumentasi (`README:120`, docstring), config & data di repo, 3 run byte-identical == json. **Tidak R4**: tanpa checksum data (OD-5.9), tanpa lockfile env (OD-7.4), tanpa expected-output tercatat (json hanya 9 field), run asli tak terekam |
| Snapshot B — raw trade ledger & equity curve | **R0** | artefak tidak pernah disimpan (gitignored; worktree = ledger A) → jalur ke hasil mentah B `NOT TRACEABLE` |
| Snapshot A — semua | **R2** | reproducible hanya via checkout historis `e6188de` (byte-identical, §11); tidak ada command resmi yang menghasilkannya; bukan output state repo kini |
| Sharpe/Sortino/CAGR/B&H-scalar (dari run) | **R3** | ikut command §13 |
| Web `backtest-reference.json` values | **R2** | == run HEAD (terverifikasi) tapi artefak hand-transcribed tanpa generator & tanpa 5 metrik |
| B&H sleeve Sharpe 0.98 + t-test | **R1** | hasil ada di report; generator **crash** di HEAD; angka strategy di report **hardcoded**; run asli config non-baseline |
| Correlation matrix (0.843) | **R1** | fungsi matriks bisa dijalankan ulang, tapi window/criteria keputusan tak terdokumentasi + report penuh tak bisa digenerate (crash) |
| Regime tables + MDD bear | **R1** | report frozen; generator crash; parameter post-hoc (`INFERRED`) |
| B&H MDD −77.63 (`bh_max_drawdown.md`) | **R1** | method deskripsi-prosa, **tanpa script**; recon OD-6 hanya ≈ (MDD −77.54, endpoint +9.3% beda) |
| B&H 0.838/−58.44 (`bh_drawdown_and_btc_eth_corr.md`) | **R0** | tanpa generator; angka tidak bisa ditelusuri ke command |
| `sharpe_discrepancy_report.md` (0.53/155.82/−58.49) | **R1** | freeze run dikenal (2026-09-05) tapi tanpa script; HEAD menghasilkan −58.64 |
| `decision_log.md` numbers | **R1** | hand-written; sebagian salah-label (−58.49 B&H) |
| Preset gate metrics (RSI/SMA) | **R3** | runner `PRESET=` aktif & terdokumentasi (docstring); report committed |
| Dataset `data/historical/*` (baca) | **R2** | file committed & stabil (hash git), tapi **tanpa checksum manifest, tanpa log fetch, tanpa raw timestamps** |
| Dataset (regenerasi dari venue) | **R0** | refetch terblokir + tanpa metadata versi endpoint → jalur regenerasi `NOT TRACEABLE` saat ini |
| VaR / VaRSR | **—** | `NOT IMPLEMENTED` (klaim apa pun tentangnya `NOT TRACEABLE`) |
| Figure `equity_drawdown.png` (B) | **R1** | bisa diregenerasi (byte-identical) tapi output gitignored & tidak ada expected-hash |
| Environment (rekonstruksi bersih) | **R1** | requirements range-pin saja; scipy/yfinance tak tercatat; tanpa lockfile |
| **Tidak ada output yang R4** | — | tidak ada kombinasi frozen-data+checksum+lockfile+expected-output (§23) | `VERIFIED` (ketiadaan) |

---

## 20. Claim Risk Register

| Claim | Evidence | Risk | Why | Required Resolution |
|---|---|---|---|---|
| "Return +152% / DD −26.45%" (B) | `reference.json` + 3 run reproduksi | **HIGH** | benar ter-reproduce, tapi canonical belum dipilih & treatment gap belum diputus (OD-5.3; trough = hari artefak) | OD-5.10 + ARCH §16 + OD-5.3 |
| "Return +149.59% / DD −26.19%" (A) di 6+ file | `metrics.md` + kutipan | **HIGH** | stale-by-design; pembaca bisa menganggap current | OD-7.8 (carried Phase 2H OD-11 + ARCH §16 procedure) |
| "Sharpe 0.82 vs B&H 0.98" | report frozen + OD-6 | **HIGH** | perbandingan treatment-dependent (urutan berbalik tanpa artefak — OD-6 §10); benchmark belum canonical | OD-6.1/6.4/6.5 + OD-5.3 |
| "B&H MDD −77.63%" (klaim PPT −75..−85) | report tanpa generator | **MEDIUM** | nilai masuk akal (recon −77.54) tapi `NOT TRACEABLE` ke command | OD-7.6/OD-7.2 (generator resmi) |
| "B&H −58.49%" (`decision_log:99`) | hand-written | **MEDIUM** | **salah label** (−58.49 = strategi vanilla; PPT:78-80) | Phase 2H OD-11 (errata beranotasi) |
| t-test "p=0.0743/0.0193" | report frozen | **HIGH** | generator crash; cash-day correction wajib-PPT tidak dijalankan; config non-baseline | OD-6.8 + OD-7.11 |
| "korelasi BTC–ETH 0.843 (periode penuh)" | report | **MEDIUM** | 0.843 = window 615-hari; full = 0.838; label konflik | OD-6.9 |
| Regime bull/bear/sideways findings | report frozen | **MEDIUM** | parameter post-hoc (`INFERRED`), generator crash | OD-6.10 |
| Dataset "data Bitget 2020–2026" (PPT:89, label json) | data aktual mulai 2020-11-09 | **MEDIUM** | label ≠ data; venue history-depth `INFERRED` | OD-5.5 |
| "1.635 missing bar sudah tercatat" | D7 == OD-5 | **HIGH** (jika treatment tak dipilih) | 4 hari all-absent memengaruhi Sharpe/MDD | OD-5.3 |
| Ledger mentah tersedia untuk audit ulang | A: ada (ter-ignore); B: tidak ada | **MEDIUM** | klaim mentah (per-trade) B tak bisa diaudit tanpa re-run | OD-7.10 |
| Environment bisa dibangun ulang | requirements range-pin | **MEDIUM** | tanpa lockfile; scipy/yfinance tak tercatat; drift Python patch | OD-7.4 |
| Urutan aset tidak memengaruhi hasil | OD-4: 152.00/159.17/162.51 | **HIGH** | hasil = fungsi urutan yang tak terpreskripsi | OD-4.8 → OD-7.9 |
| VaRSR di RQ1 tesis | 0 hit | **BLOCKER** (untuk RQ1 sesuai PPT) | metric yang dijanjikan PPT tidak ada | OD-3.11 → OD-6.6/6.7 |
| Web marketing numbers == backtest | `ProofStrip` via json; `disclaimer` campur A/B; `proof:32` hardcoded | **MEDIUM** | satu halaman memakai dua snapshot (`disclaimer:18` A vs `:25` B) | OD-7.6/OD-7.8 |
| "Satu command menghasilkan semua angka tesis" | §13 | **HIGH** | tidak ada; research commands crash | OD-7.2 |

Tidak ada label "pass/fail" yang dipakai untuk klaim tesis (larangan prompt §O).

---

## 21. Current Snapshot B Reconstruction

**Urutan persis yang harus dilakukan peneliti lain untuk mereproduksi Snapshot B dengan repo
kini (diuji sesi ini):**

```bash
# 1. Prasyarat (dari repo; tidak ada langkah tersembunyi kecuali item §22)
source venv/bin/activate            # Python 3.14.7 aktual (lihat §14)
# 2. Pilih output aman (OPSIONAL untuk angka, WAJIB agar tak menimpa metrics.md Snapshot A)
REPORT_SUBDIR=/tmp/repro python backtest/run_backtest.py
#    (tanpa REPORT_SUBDIR → menimpa backtest/reports/metrics.md yang tracked)
# 3. Bandingkan
#    metrics.md (14 baris) vs monitoring/web/lib/backtest-reference.json (9 field) + §183 PHASE2 SoT
```

**Record uji (semua `VERIFIED`):**

| Run | cwd | Waktu | Output | Hasil |
|---|---|---|---|---|
| `od7_repro_a` | repo | 16:54 | metrics/curve/trades/png | 14 metrik == B (152.0/17.24/0.82/0.85/−26.45/94/36.17/1.03/4.35/−0.85/2.27/155.03/2520.02/2123) |
| `od7_repro_b` | repo | 16:54 | idem | byte-identical (cmp semua file) |
| `od7_repro_c` | `/tmp` | 17:01 | idem | byte-identical → cwd-independent |

sha256 (run a; b & c sama):
`equity_curve.csv 13b9594b…76b8` · `metrics.md a4bd49ff…1527a6b` · `trades.csv b0759df5…57f9e51` ·
`equity_drawdown.png cce74a51…b982d7a`.

**Manual intervention yang dibutuhkan untuk angka B: praktis nol memilih metodologi** —
config default, data bawaan, command dokumentasi. Intervensi manual yang **dibutuhkan untuk
reproduksi yang tidak merusak / untuk verifikasi** didaftarkan di §22.

**Bandingkan dengan reproduksi Snapshot A** (dilakukan di `/tmp/od7_clone`): checkout `e6188de`
→ run → `metrics.md` **byte-identical** dengan Snapshot A tersimpan — membuktikan A = output
kode pra-Wilder pada data yang sama (§11).

---

## 22. Manual Intervention Register

Tiap intervensi manual = ketergantungan reproduksibility.

| # | Intervensi | Diperlukan untuk | Jenis | Catatan |
|---|---|---|---|---|
| M1 | Memilih `REPORT_SUBDIR` (atau menerima menimpa `metrics.md` tracked) | reproduksi non-destruktif | **hidden requirement** | tanpa ini, run "resmi" mengubah artefak Snapshot A di tree (§13) |
| M2 | Mengetahui **report mana** yang berisi B (json, bukan `metrics.md`) | verifikasi hasil | knowledge | `metrics.md` masih berisi A |
| M3 | Mengetahui `reference.json` = hand-transcribed (bukan output) untuk interpretasi provenance | audit | knowledge | §12 |
| M4 | Checkout historis `e6188de` | mereproduksi Snapshot A | hidden commit | tidak ada dokumen repo yang menyebut command ini (ada di audit docs) |
| M5 | Install `scipy` (tak tercatat di requirements) | menjalankan t-test research | environment | bahkan sebelum crash diperbaiki |
| M6 | Memberi `cfg` ke `load_ohlcv` (memperbaiki crash) | menjalankan generator statistik | **dilarang di audit ini** (perbaikan bug) → tetap blocker | D9 |
| M7 | Menafsirkan gap data (1.635 bar; 4 hari all-absent) | menentukan apakah angka B "benar" | **keputusan methodology** (OD-5.3) — TIDAK boleh dipilih peneliti | §6 |
| M8 | Memilih benchmark variant bila membandingkan Sharpe | klaim RQ1 | **keputusan** (OD-6.1) | §18 |
| M9 | Mengetahui konfigurasi non-baseline di balik report statistik (max_conc 1/5, tanpa cluster) | menafsirkan t-test/korelasi/regime | knowledge | §16 |
| M10 | Mengetahui run asli B (2026-09-12) tidak terekam | audit ledger | `PROVENANCE UNKNOWN` | §12 |
| M11 | Menentukan urutan iterasi aset (de facto = config order) | mereproduksi 152.00 vs 159.17 vs 162.51 | **keputusan** (OD-4.8) | §15 |
| M12 | Memilih Python/versi paket yang sama persis | reproduksi lingkungan bersih | `UNKNOWN` (tanpa lockfile) | §14 |

---

## 23. Missing Evidence Register

| # | Yang hilang | Dampak | Cross-ref |
|---|---|---|---|
| G1 | Dataset manifest + checksum + metadata sidecar + log fetch | dataset tak bisa divalidasi/dibekukan | **OD-5.9 / OD-7.3** |
| G2 | Raw timestamp candle (dibuang ke `date` saja) | audit timezone/jam tak mungkin | OD-5.4 |
| G3 | Env lockfile / catatan versi persilangan (scipy, yfinance, patch Python) | rebuild lingkungan tak deterministik | **OD-7.4** |
| G4 | Raw trade ledger & equity curve Snapshot B (semua output gitignored) | audit mentah klaim B | **OD-7.10** |
| G5 | Command authoritative tunggal + catatan run (tanggal/commit/env) | rekonstruksi bergantung pengetahuan tersembunyi | **OD-7.2** |
| G6 | Generator untuk `bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md`, `sharpe_discrepancy_report.md`, `decision_log.md` | `NOT TRACEABLE` | OD-7.6/OD-7.11 |
| G7 | Implementasi VaR/VaRSR + formula terdaftar | RQ1 PPT tak terjawab | OD-3.11 → OD-6.6/6.7 |
| G8 | Koreksi cash-day untuk t-test (wajib PPT :236-242) | uji tak sesuai protokol PPT | OD-6.8 |
| G9 | Generator statistik yang jalan di HEAD (3 script crash) | report frozen tak bisa digenerate ulang | OD-7.11 |
| G10 | Kriteria seleksi asset (diminta PPT:294) | survivorship-bias control tak terdokumentasi | OD-5.6 |
| G11 | Keputusan urutan aset & same-day ordering (terdaftar, belum dijawab) | hasil = fungsi urutan | OD-4.8/OD-3.9 → OD-7.9 |
| G12 | Expected-output record (hash/metrik resmi per run) | tak ada tolok banding otomatis | OD-7.6 |
| G13 | Dokumen tesis (tabel/figure) di repo | traceability klaim akhir baru bisa dinilai saat dokumennya ada | OD-7.7 |
| G14 | Pemeriksaan asumsi statistik + koreksi multiple testing | klaim signifikansi lemah | OD-6.12 |

---

## 24. Stale Evidence Register

| # | Lokasi | Angka/konten stale | Snapshot/era | Klasifikasi |
|---|---|---|---|---|
| S1 | `backtest/reports/metrics.md` (seluruh file) | 149.59 / −26.19 / 2495.92 / header `ATR(14)x2` | A, `e6188de` | stale-vs-HEAD, **sengaja** (ARCH §16: jangan diedit sepihak) |
| S2 | `config.yaml:23` komentar | "Sharpe 0.82, DD -26.19%" | A | stale citation |
| S3 | `presets/donchian_cluster_a2.yaml:2` | "DD -26.19%" | A | stale citation |
| S4 | `RULES.md:56` teks gate | "DD -26.19%" | A | stale citation (gate text) |
| S5 | `monitoring/web/app/disclaimer/page.tsx:18` vs `:25` | `−26.19%` (A) + `+152%` (B) **dalam satu halaman** | A+B campur | mixed-snapshot |
| S6 | `decision_log.md:99` | "B&H −58.49%" | mislabel | **contradiction** (→ Phase 2H OD-11) |
| S7 | `decision_log.md:111-112` tabel | 149.59 / −26.19 | A | stale (historical record — boleh dibiarkan beranotasi) |
| S8 | `DESIGN.md:193-194` §6.1 tabel | 149.59 / −26.19 (dengan anotasi `:180-181`) | A + anotasi | stale-dengan-catatan |
| S9 | `backtest-reference.json:3` | label period `2020-08 .. 2026-08` | salah vs data | stale/wrong metadata → OD-5.5 |
| S10 | `config.yaml:37` `lookback_years: 6` | mengklaim window 2020-08..2026-08; **tak pernah dibaca kode** | dead config | misleading |
| S11 | `sharpe_benchmark_comparison.md` kolom strategy | 0.94 / 0.53 hardcoded (bukan run baseline) | config riset lama | hardcoded-in-report |
| S12 | `sharpe_discrepancy_report.md:97` gate table | −58.49 (HEAD kini −58.64) | frozen run 2026-09-05 | stale-by-engine-drift |
| S13 | worktree `trades.csv`/`equity_curve.csv`/`equity_drawdown.png` | ledger era A (2026-09-06) | A | stale-vs-B + **ter-ignore git** |
| S14 | `AUDIT.md:169` (W-6) | mencatat disclaimer pernah stale `+149.59` → diperbaiki `be0e271` | historis | catatan historis (benar) |
| S15 | laporan research internal "2026-09-05" vs commit `c42a478` (09-07) | tanggal run ≠ tanggal commit | generator state tak terkunci | `PROVENANCE UNKNOWN` (state kode saat run) |

---

## 25. Contradiction Register

| # | Kontradiksi | Pihak A | Pihak B | Penyelesaian |
|---|---|---|---|---|
| C1 | Angka headline | `metrics.md` 149.59/−26.19 (A) | `reference.json` 152.0/−26.45 (B) | **ARCH §16 pending** + OD-7.1 (tidak direkonsiliasi di sini) |
| C2 | −58.49 sebagai "B&H" | `decision_log:99` | PPT:78-80 (strategi vanilla) + `DESIGN:132` | Phase 2H OD-11 (errata beranotasi) |
| C3 | Periode | label `2020-08..2026-08` (json, `config:37`, PPT:89) | data 2020-11-09..2026-09-02 | OD-5.5 |
| C4 | Stop anchor | PPT "Entry − 2×ATR" (:189) | kode `prev_close − 2×prev_atr` | OD-2.1 (sudah terdaftar) |
| C5 | Exit timing | PPT "open hari berikutnya" (umum) | kode exit di close hari yang sama | OD-2.8/OD-3.1 |
| C6 | "periode penuh" korelasi | `bh_drawdown_and_btc_eth_corr.md` label | nilai 0.843 = window 615-hari (full = 0.838) | OD-6.9 |
| C7 | Header report A | hardcoded `ATR(14)x2` (kode lama) | kini terhitung `ATR(14)x2.0` | kosmetik; bukti generator berubah (S1) |
| C8 | Guardrail gate Sharpe | `RULES.md:55-57` teks historis (Sharpe≥1 → >B&H) | Phase 2H F4: aritmetika gate vs angka | sudah tercatat Phase 2H (AR-04/OD-5); tidak diduplikasi |
| C9 | `lookback_years` | komentar config (mengklaim window) | 0 pembacaan di kode | dead config → bagian OD-7.5/OD-5.5 |
| C10 | Report internal date 2026-09-05 vs commit 09-07 | isi report | `git log` | `PROVENANCE UNKNOWN` state kode saat run (S15) |

---

## 26. Future Evidence Chain

Rekomendasi rantai minimum (audit only — **bukan** tugas implementasi):

| Node | Sudah ada? | Kurang | Stale | Ambigu |
|---|---|---|---|---|
| 1. Methodology Freeze | PPT + register audit lengkap (OD-2..OD-7) | jawaban owner atas semua register | — | item PPT terbuka (:294) |
| 2. Owner Decision Record | 5 dokumen register + Phase 2H | **eksekusi** keputusan & pencatatan di `decision_log`/`PLAN` | `decision_log` campur historis/salah-label | mana register = final |
| 3. Frozen Dataset | 10-pair CSV committed stabil | freeze formal + keputusan treatment | label period (S9) | sumber primer Bitget vs lain (OD-5.1) |
| 4. Dataset Manifest + Checksums | **tidak ada** (G1) | sidecar + manifest + log fetch | — | — |
| 5. Frozen Config | `config.yaml` numerik setuju | snapshot config yang di-lock + konstanta statistik keluar dari hardcoded | komentar A (S2) | `lookback_years` mati (S10) |
| 6. Strategy Commit | HEAD `d728ec8` + 70 test pass | keputusan OD-2.x/OD-3.x/OD-4.x → re-run | — | stop anchor, urutan aset |
| 7. Backtest Command | 2 kandidat + `REPORT_SUBDIR` | penetapan SATU command resmi + tidak-memutasi-tree | — | mana canonical |
| 8. Raw Trade Ledger | A: worktree (ignored) | retensi ledger B + keputusan ignore/not | ledger A vs metrics B | — |
| 9. Equity Curve | sama | idem | sama | — |
| 10. Metrics | dua snapshot | pemilihan canonical + regenerate kutipan dari satu sumber | 15+ kutipan stale (§24) | A vs B |
| 11. Statistical Tests | kode parsial (t-test/korelasi/regime) + report frozen | perbaikan generator (owner-authorized), VaRSR, cash-day, koreksi multiple | report hardcoded | formula VaRSR |
| 12. Tables/Figures | report .md/.png + web | provenance per tabel tesis; generator untuk 4 report; penyimpanan figur | disclaimers campuran | belum ada dokumen tesis (G13) |
| 13. Thesis Claims | PPT (RQ1-3) | dokumen tesis yang menautkan tiap angka ke node di atas | PPT angka era lama (0.98, −58.49 konteks) | canonical claim set |

---

## 27. Final Thesis Reproduction Readiness

**Jawaban forensic terhadap pertanyaan utama:**

> *"Jika seluruh keputusan OD-1…OD-6 selesai, apakah peneliti lain bisa mengambil source data +
> config + code + decision record dari repo ini dan menghasilkan angka tesis final yang sama,
> lalu menelusuri setiap angka tabel/grafik ke evidence mentah?"*

**Kondisi saat keputusan BELUM selesai (status kini):**

1. **Yang sudah `VERIFIED` bisa:** Snapshot B (152.00/0.82/−26.45/94/2520.02) direproduksi
   byte-identical dari state repo (3 run, §21); Snapshot A direproduksi byte-identical via
   checkout `e6188de` (§11); implementasi strategi teridentifikasi unik (§8); determinisme-run
   terbukti (§15); 70 test pass (D10); 10-pair data identik antara era A/B (D8); 1.635 gap
   tervalidasi (D7).
2. **Yang belum bisa (dibuktikan, bukan normatif):**
   - **Menelusuri tiap angka ke evidence mentah:** ledger mentah B **tidak ada** (G4), 4 laporan
     **tanpa generator** (G6), run asli B **tidak terekam** (M10) → sebagian klaim berhenti di
     report, bukan di data (`NOT TRACEABLE` di §19).
   - **Menghasilkan "angka tesis final":** canonical snapshot, benchmark, treatment gap, urutan
     aset, exit/stop semantics, VaRSR, koreksi t-test **semua belum diputuskan** (§17) — ada
     nilai numerik yang bergerak besar tergantung keputusan (contoh terukur: return 152.00 ↔
     162.51 hanya dari urutan; DD −26.45 ↔ −18.08 dari treatment gap — keduanya `FORENSIC
     SENSITIVITY`, bukan hasil tesis).
   - **Regenerasi artefak statistik:** 3 generator crash (D9), scipy tak tercatat (G3),
     dataset tak bisa direfresh (G1) → laboratorium riset tidak bisa dijalankan ulang apa adanya.
   - **Environment & data freeze:** tanpa checksum/lockfile (G1/G3) → rekonstruksi lingkungan
     bersih `UNKNOWN`.
3. **Kesimpulan:** *current Snapshot B* = reproducible (`VERIFIED`); *pipeline bukti tesis final*
   = **belum siap** — diblokir oleh keputusan owner yang belum ada (OD-1…OD-6 + register §28)
   dan bukti yang belum dihasilkan (§23). Kesiapan akhir = **`OWNER DECISION REQUIRED`** di
   OD-7.12. **Audit ini tidak menilai apakah strategi tersebut efektif** — hanya apakah rantai
   buktinya tertutup, dan saat ini: **tertutup untuk baseline engineering, terbuka untuk klaim
   tesis.**

---

## 28. Owner Decision Register

Tidak ada keputusan yang diputuskan audit ini. `CARRIED` = pertanyaan identik sudah terdaftar di
register lain (owner menjawab di sana; tidak diduplikasi agar tak ada dua kebenaran).

| ID | Keputusan | Evidence (audit ini) | Cross-ref | Status |
|---|---|---|---|---|
| **OD-7.1** | **Canonical thesis result provenance** — snapshot mana (A/B/re-run baru) yang jadi hasil tesis, dengan record provenance-nya (commit+config+data+command) | §11, §12: keduanya reproducible; B hand-transcribed; ledger B hilang | `ARCHITECTURE.md` §16, OD-5.10, Phase 2G §9 | `OWNER DECISION REQUIRED` |
| **OD-7.2** | **Authoritative backtest command** — tetapkan SATU command resmi (non-destruktif) yang meregenerasi hasil tesis | §13: dua kandidat + `REPORT_SUBDIR`; default menimpa tracked file; research cmds crash | README:120, `cli.py`, PHASE2 SoT:183 | `OWNER DECISION REQUIRED` |
| **OD-7.3** | **Dataset manifest/checksum requirement** — wajib manifest+checksum+log fetch saat freeze | §6, G1: 0 manifest/checksum; refetch terblokir | **= OD-5.9** (sudah terdaftar) | `CARRIED` (OD-5.9) |
| **OD-7.4** | **Environment reproducibility requirement** — lockfile/versi Python/pencatatan deps research (scipy, yfinance) | §14: range-pin, drift 3.14.6→3.14.7, deps tak tercatat | `requirements.txt` (jangan diubah tanpa keputusan) | `OWNER DECISION REQUIRED` |
| **OD-7.5** | **Configuration single-source requirement** — sumber tunggal untuk SEMUA parameter thesis-kritis (termasuk konstanta statistik kini hardcoded) + matikan/klarifikasi `lookback_years` | §7: duplikat sepakat utk strategy; rf/√365/threshold/α hardcoded; `lookback_years` 0 pembacaan | `ARCHITECTURE.md` §16 baris 1 (SoT parsial) | `OWNER DECISION REQUIRED` |
| **OD-7.6** | **Result artifact single-source requirement** — satu file sumber angka; semua kutipan digenerate/di-regenerate darinya | §10, §18: A/B + json 9/14 field + report hardcoded | **= ARCH §16** prosedur "tulis ulang SEMUA kutipan dari satu sumber" | `CARRIED` (ARCH §16) |
| **OD-7.7** | **Thesis table/figure provenance requirement** — tiap tabel/figure tesis wajib menyebut generator+commit+config+data | §10: 4 report tanpa generator; figur gitignored; dokumen tesis belum ada (G13) | Phase 2H OD-12 (presentasi sensitivitas) | `OWNER DECISION REQUIRED` |
| **OD-7.8** | **Handling of historical/stale numeric claims** — anotasi vs regenerasi vs penghapusan untuk 15+ kutipan stale | §24 (S1–S15), §25 (C1–C10) | **= Phase 2H OD-11** (errata) + ARCH §16 procedure | `CARRIED` (Phase 2H OD-11) |
| **OD-7.9** | **Deterministic asset ordering** — tetapkan (atau tolak) urutan iterasi aset sebagai bagian metodologi | §15: 152.00/159.17/162.51 (10.51pp) pada data sama; PPT tak meresepkan | **= OD-4.8** (+ OD-3.9 same-day ordering) | `CARRIED` (OD-4.8) |
| **OD-7.10** | **Raw trade/equity ledger retention** — simpan ledger mentah per run (atau putuskan tidak) | §6/§11/§12: csv/png top-level di-gitignore; ledger B tak ada (G4) | `.gitignore` "Data & reports output" | `OWNER DECISION REQUIRED` |
| **OD-7.11** | **Statistical output provenance** — artefak mana yang sah untuk tiap statistik; siapa generator yang diperbaiki/di-resign | §9, §16: 3 generator crash; report frozen; 2 report hardcoded values | OD-6.1/6.8/6.12 | `OWNER DECISION REQUIRED` |
| **OD-7.12** | **Final thesis evidence-chain freeze** — freeze rantai §26 secara keseluruhan setelah node 1–12 beres | §26, §27 | urutan: setelah OD-1…OD-6 + OD-7.1…7.11 | `OWNER DECISION REQUIRED` |

**Rekap status:** `OWNER DECISION REQUIRED` = **8** (OD-7.1, 7.2, 7.4, 7.5, 7.7, 7.10, 7.11, 7.12);
`CARRIED` = **4** (OD-7.3→OD-5.9, OD-7.6→ARCH §16, OD-7.8→Phase 2H OD-11, OD-7.9→OD-4.8);
`NOT APPLICABLE` = **0**. Tidak ada OD-7.13+.

---

## 29. Limitations

- **Verifikasi eksternal terblokir** — filter ISP mengarahkan domain exchange ke halaman blokir
  (OD-5 §26): klaim "data Bitget 2020–2026" tak bisa dicek ke venue; regenerasi dataset tak
  bisa diuji; tidak ada data eksternal disubstitusi.
- **Audit ini tidak memperbaiki apa pun** — crash `load_ohlcv` (D9), mislabel, komentar stale,
  gitignore ledger: semuanya dibiarkan (larangan §R: `UNKNOWN ≠ DEAD`); 4 laporan tanpa generator
  tidak dihapus/direfactor.
- **Uji korupsi tree dihindari dengan disiplin** — semua run memakai `REPORT_SUBDIR=/tmp`;
  clone historis di `/tmp/od7_clone`; `pytest` dengan `-p no:cacheprovider` (tanpa cache write).
  Konsekuensi: perilaku "run default menimpa `metrics.md`" disimpulkan dari code path
  (`save_report` → `reports_dir()` tanpa env = `backtest/reports/`, file tracked) — **`VERIFIED`**
  lewat pembacaan kode + status tracking, **bukan** dengan mengeksekusinya di repo utama.
- **`correlation_mitigation.py` full-run tidak diuji** (hanya pembacaan kode/loader) → status
  run penuhnya `UNKNOWN`.
- **Reproduksi Snapshot A** dilakukan pada clone `e6188de` dengan data pada commit tersebut;
  kesamaan data A↔B diverifikasi terpisah lewat `git diff` (D8) — dua jalur bukti, tanpa
  eksekusi di repo utama.
- **Klasifikasi tier (§19) bergantung pada keadaan repo saat HEAD `d728ec8`** — bergerak jika
  commit berikutnya mengubah runner/ignore/config.
- **Angka sensitivitas** (159.17/162.51, −18.08, 0.8787, dst.) dikutip dari OD-4/OD-6 dengan
  label `FORENSIC SENSITIVITY` — **bukan hasil tesis** dan tidak boleh dipakai memilih metodologi.
- **Tidak ada verdict strategi** — tidak ada angka Sharpe/return yang diinterpretasikan sebagai
  lolos/gagal; canonical A/B tidak dipilih; treatment missing-data, benchmark, dan formula
  statistik tidak dipilih.
- **Dokumen tesis belum ada di repo** (G13) → traceability "tabel/grafik tesis" dinilai terhadap
  artefak thesis-facing yang ada (reports/web/PPT); ketika naskah tesis masuk repo, register ini
  perlu diulang untuk tabel finalnya.
- Semua diagnostic sesi ini tercatat di §2 (D1–D15); script/diagnostic ada di `/tmp`
  (`od7_data.py`, folder `od7_repro_*`, `od7_clone`) — bukan di repository.

---

## 30. Final Answers

**1. Can Snapshot B currently be reproduced?**
**`VERIFIED` — YA.** Tiga run `backtest/run_backtest.py` ke `/tmp` (2× identik + 1× dengan cwd
berbeda) menghasilkan 4 output **byte-identical** (sha256 sama) dan **14/14 metrik** identik
dengan `backtest-reference.json` (9 field) dan catatan PHASE2 SoT:183 (152.0/17.24/0.82/0.85/
−26.45/94/36.17/1.03/4.35/−0.85/2.27/155.03/2520.02/2123). Data & config identik dengan saat
snapshot dibuat (`git diff e6188de HEAD -- data/historical/` hanya menambah 3 CSV riset).

**2. Can Snapshot B be reproduced without undocumented manual choices?**
**`PARTIAL`.** Untuk *angka*: praktis tanpa pilihan (config default + data bawaan). Untuk
*reproduksi yang tidak merusak & verifikasi*: butuh pengetahuan tak terdokumentasi di runner —
`REPORT_SUBDIR` (tanpa itu menimpa `metrics.md` tracked, §13/M1), tahu bahwa json (bukan
`metrics.md`) berisi B (M2), dan tahu json = transcribed, bukan output (M3). Untuk *statistik
tesis*: butuh perbaikan bug yang dilarang (M6) → blocker.

**3. Is there one authoritative thesis backtest command?**
**`NOT IMPLEMENTED` (ketiadaan penetapan) — `OWNER DECISION REQUIRED` (OD-7.2).** Dua kandidat
resmi (`README:120` langsung vs `cli.py backtest`) keduanya menimpa artefak tracked; varian
`REPORT_SUBDIR` hanya terdokumentasi di audit docs; command riset/statistik **crash di HEAD**
(D9); tidak ada command yang menghasilkan seluruh artefak tesis.

**4. Is there one authoritative thesis dataset?**
**`PARTIAL` — ya secara fisik (`data/historical/` 10-pair CSV committed, stabil, 1 sumber),**
**tidak secara keputusan**: sumber primer (Bitget vs lain) = OD-5.1, rebuild = OD-5.2, kalender
= OD-5.4, periode = OD-5.5, universe/HYPE = OD-5.6/5.7 belum diputuskan; plus 3 CSV pair riset
(BCH/LTC/PAXG) berdampingan di folder yang sama (di luar universe config).

**5. Is the dataset fully provenance-traceable?**
**TIDAK — `PARTIAL`.** `VERIFIED` ketiadaan: 0 manifest/checksum/metadata sidecar; timestamp
mentah dibuang (`fetch_bitget_data.py:98`); log fetch tak disimpan; 1.635 missing bar tanpa
treatment (D7 == OD-5); refetch terblokir jaringan (OD-5 §26); versi endpoint/ccxt tak dipin
per-run. Yang ada: script fetch + file committed (reproducible *membaca*, tidak *regenerasi*).

**6. Is the environment fully reproducible?**
**TIDAK — `PARTIAL`.** Range-pin saja tanpa lockfile/pyproject/`.python-version`; drift Python
3.14.6 (venv) vs 3.14.7 (runtime); `scipy`/`yfinance` dipakai tapi tak tercatat di requirements;
`vectorbt` tercatat tapi 0 import; `pip check` bersih & 70 test pass (positif). Rebuild
lingkungan bersih yang deterministik = `UNKNOWN` → OD-7.4.

**7. Is the Donchian implementation uniquely identifiable?**
**`VERIFIED` — YA.** Satu implementasi aktif: `backtest/strategy.py` (donchian high/low
`rolling().shift(1)`, ATR Wilder seed-SMA, `position_size`) + loop `run_backtest.py:71–176`;
dipakai bersama `paper_trading/live_signal.py` (`product-shared`); versi historical = git
(`e6188de`); loader riset mandiri = `research-only` (diklasifikasi, tidak dikonsolidasi);
0 duplikasi formula lain (D11). Kualifikasi `PARTIAL`: semantik loop (stop anchor OD-2.1,
exit timing OD-2.8/OD-3.1, urutan OD-4.8) masih diperdebatkan → sitasi "satu implementasi"
sah untuk kode, belum untuk metodologi final.

**8. Are thesis-critical metrics uniquely defined?**
**TIDAK — `PARTIAL` (banyak definisi kompetitif, §18).** Return/MDD/avgR/PF = dua hasil (A/B);
B&H return/Sharpe/MDD = ≥6 konstruksi; period = 3 label; −58.49 = dua konteks; expectancy &
diversification metrics = `NOT IMPLEMENTED`; fee rates, universe, cluster/risk params = tunggal
& setuju (`VERIFIED`). Penyatuan = ARCH §16 + OD-6.1–6.5 (**tidak dipilih di sini**).

**9. Are thesis statistical tests reproducible?**
**`PARTIAL`.** Sharpe & MDD: **`VERIFIED` reproducible** (ikut run utama). t-test, correlation,
regime: angkanya ada sebagai frozen report dan sebagian bisa direkonstruksi fungsional (OD-6),
tetapi **generator crash di HEAD** (D9), koreksi cash-day wajib-PPT `NOT IMPLEMENTED`, angka
strategy di report t-test **hardcoded**, window/threshold tak diputuskan. VaR/VaRSR:
**`NOT IMPLEMENTED`** (0 hit). Koreksi multiple testing & uji asumsi: `NOT IMPLEMENTED`.

**10. Are thesis tables/figures traceable to generated outputs?**
**`PARTIAL`.** Yang tertelusuri: `metrics.md`/preset reports (runner), web numbers (json ← ==
run HEAD), figure per-run (matplotlib, byte-identical). Yang **`NOT TRACEABLE`**: 4 report tanpa
generator (`bh_max_drawdown`, `bh_drawdown_and_btc_eth_corr`, `sharpe_discrepancy_report`,
`decision_log`), figure top-level di-gitignore (tak diretas), dan dokumen tesis itu sendiri
belum ada di repo (G13) → requirement provenance per tabel = OD-7.7.

**11. Are stale/historical numbers clearly separated from current evidence?**
**`PARTIAL`.** Terpisah baik: ARCH §16 (tabel A/B + status pending), README:98 (menampilkan
keduanya), PHASE2 SoT (peta kutipan per file). Masih bercampur: `disclaimer:18` (A) vs `:25` (B)
dalam satu halaman; kutipan A di `config.yaml:23`, preset, `RULES.md:56`, `DESIGN §6.1` tanpa
label stale di lokasi tersebut; `decision_log:99` mislabel B&H (C2); label period json salah
(C3). Penanganan resmi = **OD-7.8 (CARRIED → Phase 2H OD-11 + ARCH §16)**.

**12. What evidence blockers remain before thesis baseline can be frozen?**
Dari bukti §23/§27: (1) keputusan **OD-1…OD-6 belum ada** (canonical snapshot, treatment gap,
benchmark, exit/stop semantics, urutan aset, VaRSR); (2) dataset belum frozen + **tanpa
manifest/checksum** (OD-5.9/G1); (3) **ledger mentah Snapshot B tidak disimpan** (G4/OD-7.10);
(4) **generator statistik rusak di HEAD** (G9) + `scipy` tak tercatat (G3); (5) **VaRSR absen**
(G7) sementara RQ1 memintanya; (6) **4 laporan tanpa generator** (G6); (7) **environment tanpa
lockfile** (G3/OD-7.4); (8) label & kutipan stale belum diselesaikan (S1–S15/C1–C10).
Status kesiapan freeze: **`OWNER DECISION REQUIRED` (OD-7.12)**.

**13. Which owner decisions are required?**
Register §28: **OD-7.1, OD-7.2, OD-7.4, OD-7.5, OD-7.7, OD-7.10, OD-7.11, OD-7.12** =
`OWNER DECISION REQUIRED` (8); **OD-7.3 (→OD-5.9), OD-7.6 (→ARCH §16), OD-7.8 (→Phase 2H
OD-11), OD-7.9 (→OD-4.8)** = `CARRIED` (4); `NOT APPLICABLE` = 0. Ditambah seluruh register
pendahulu yang tetap binding dan tak diduplikasi: Phase 2H OD-1…OD-12, OD-2.1…2.9,
OD-3.1…3.11, OD-4.1…4.11, OD-5.1…5.10, OD-6.1…6.12.

**14. Is the thesis evidence pipeline ready for final simulation?**
**`OWNER DECISION REQUIRED` — belum (`PARTIAL` dari sisi teknis, terbukti §27).** Yang sudah siap
& terverifikasi: engine deterministik, reproduksi Snapshot A & B byte-identical, implementasi
strategi unik, test 70 pass, config-utama sepakat. Yang belum: seluruh node bukti di §26 ada
yang **kurang** (manifest, ledger B, generator statistik, VaRSR, dokumen tesis) atau **stale**
(kutipan A, label period) atau **ambigu** (canonical, benchmark, treatment, urutan). Keputusan
akhir ada di **OD-7.12** setelah OD-1…OD-6 dan OD-7.1…7.11 selesai. **Audit ini tidak memilih
metodologi canonical, tidak memilih Snapshot A/B, dan tidak menilai strategi.**

---

*Tidak ada commit, tidak ada push, tidak ada perubahan source/data/config/report dalam audit
ini. File baru: `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md` saja. OD-8 tidak
dibuka.*
