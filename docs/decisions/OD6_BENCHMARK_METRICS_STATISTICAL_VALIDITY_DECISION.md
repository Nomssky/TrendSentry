# OD-6 — Benchmark, Performance Metrics & Statistical Validity Decision Audit

> **Repo:** `Nomssky/TrendSentry` · **HEAD:** `d728ec891036a62f142d98ade8913a0e86176370` (main)
> **Tesis:** *Analisis Efektivitas Strategi Long-Only Donchian Channel Breakout pada Portofolio
> Cryptocurrency Multi-Aset* (approved PPT: `Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf`)
> **Mode:** FORENSIC AUDIT ONLY — tidak ada perubahan kode/dataset/config/metric resmi, tidak ada
> rebuild, tidak ada pemilihan treatment missing bars, tidak ada pemilihan metodologi statistik
> atas nama owner, tidak ada commit/push.
> **Output repo tunggal:** file ini. Semua diagnostic dijalankan dari `/tmp` (read-only import engine).
> **Dataset status:** keputusan OD-5.1–OD-5.10 **belum ada** → dataset current **BUKAN**
> thesis-frozen dataset; tidak ada hasil di dokumen ini yang boleh dijadikan angka resmi tesis.
> **Register:** OD-6.1 – OD-6.12 (§27). Audit ini tidak memberi verdict strategi (§34).

---

## 1. Executive Summary

Temuan utama (semua direproduksi sendiri sesi ini, kecuali disebut frozen artifact):

1. **Strategy Sharpe 0.82 direproduksi `VERIFIED`** dari data & config saat ini: mean=0.00050380,
   std=0.01168954, n=2119, mean/std=0.043098, ×√365 = **0.8234 → 0.82**; seluruh Snapshot B
   identik (152.00/17.24/0.82/0.85/−26.45/94/36.17/1.03/4.35/−0.85/2.27/155.03/2520.02/2123d).
2. **B&H sleeve Sharpe 0.9809 direproduksi `VERIFIED`** — mean 0.008286 & std 0.161390 cocok
   6 desimal dengan `sharpe_benchmark_comparison.md`; BTC 0.8288, 2-pair 0.8310, 418.32%,
   401.07% juga cocok persis. Tanpa 13 artifact-obs → **0.8787** (cocok Phase 2H F2).
3. **Tetapi keduanya terkontaminasi gap arah berlawanan** (`VERIFIED` aritmetika):
   13 artifact-obs sleeve = **+13.20 dari total +17.56 (75% total return-mass)** → menaikkan
   Sharpe B&H (0.879→0.981); 4 artifact-obs strategy menaikkan std 26% → menekan Sharpe
   strategy (1.045→0.82). **Urutan perbandingan berbalik** tergantung treatment
   (kanonik 0.82 < 0.98; tanpa artefak 1.04 > 0.88 — keduanya `FORENSIC SENSITIVITY`).
   Ini **bukan** vonis strategi; ini berarti perbandingannya sendiri belum metodologis-stabil
   sampai OD-5.3/OD-6.1/OD-6.4/OD-6.5 diputuskan (§34).
4. **Angka −58.49% di PPT adalah MDD strategi baseline 10-pair tanpa mitigasi, BUKAN B&H**
   (`VERIFIED` kutipan PPT:78–80: *"baseline strategi aktif 10-pair tanpa mitigasi korelasi
   mengalami MDD −58,49%"*; PPT menatribusikan B&H rentang *"> −75% s.d. −85%"*).
   `decision_log.md:99` mengaitkan "B&H −58.49" — mislabel yang sudah ditandai Phase 2H
   (AR-03/OD-11). Config vanilla 10p/max_conc=5: frozen artifact −58.49; re-run HEAD =
   **−58.64** (`PARTIAL` — engine berubah pasca-report: cash-fix `c22ad1c`, Wilder seed
   `029a311`, `0ad6cc6`). Klaim PPT B&H (−75..−85) **konsisten** dengan `bh_max_drawdown.md`
   −77.63% (rekonstruksi audit ini −77.54%).
5. **VaRSR: `NOT IMPLEMENTED / VERIFIED ABSENCE`** — 0 hit `VaR`/`VaRSR`/`value_at_risk` di
   seluruh kode, laporan, dan web (hanya muncul di dokumen audit + PPT). PPT mewajibkannya
   (Deng 2013, :62/:115/:269–273). Spesifikasi formula belum pernah ditentukan → OD-6.6/OD-6.7
   (melengkapi OD-3.11 yang sudah terdaftar).
6. **Paired t-test: `VERIFIED` implemented** (`sharpe_benchmark.py:149–150`, `scipy.stats.ttest_rel`)
   dan angkanya direproduksi (n=1919/2119; t/p: −1.783/0.0747 dan −2.340/0.0194 vs frozen
   −1.785/0.0743 dan −2.342/0.0193). **Tapi**: (a) dijalankan pada config **bukan baseline kini**
   (max_conc 1/5, tanpa cluster) dengan Sharpe strategy **hardcoded** 0.94/0.53; (b) **koreksi
   cash-day yang diminta PPT `NOT IMPLEMENTED`** (hanya catatan caveat); (c) script **crash di
   HEAD** (KeyError `donchian_entry_period` sejak `0ad6cc6`).
7. **Correlation matrix: `VERIFIED` implemented & direproduksi sel-sel persis** — tetapi
   `pct_change().dropna()` memangkas sampel ke **615 baris [2024-12-19..2026-09-02]** (jendela
   HYPE), bukan periode studi penuh; BTC–ETH = 0.843 (jendela) vs 0.838 (penuh, n=1919); 9 hari
   (4 hole + 4 resume + baris pertama) dibuang senyap oleh `dropna`.
8. **Regime segmentation: `VERIFIED` implemented** (BTC rolling 90d; BEAR ≤ −20%, BULL ≥ +40%),
   label **trailing → tidak ada look-ahead harga** (`VERIFIED`); tetapi window/threshold tidak
   ada di PPT, script ter-commit `c42a478` (2026-09-07) setelah data penuh terlihat → pemilihan
   parameter `INFERRED` post-hoc; laporan per-regime (termasuk perbandingan MDD bear — test
   spesifik PPT) frozen; script crash di HEAD.
9. **Assumptions: tidak dicek di mana pun** (`VERIFIED` absence — 0 hit shapiro/jarque/durbin/
   ljung/autocorr/stationar); **multiple comparisons tanpa koreksi** (2 t-test + matriks regime
   multi-config + 9-ekperimen + 3 gate) → OD-6.12.
10. **Perbandingan Sharpe: date-set strategy ≡ sleeve identik (2120 tanggal, `VERIFIED`)**,
    frequency/rf/annualization/arithmetic identik — tetapi dampak missing-bar berbeda-beda dan
    mekanik kas/fee/weighting berbeda (§6, §10). **Tidak ada kesimpulan lolos/gagal** (§34;
    Sharpe ≥1 bukan kriteria tunggal — riwayat revisi gate di `RULES.md:55`, sesuai arahan owner).

**Register:** OD-6.1–OD-6.12 (§27), semuanya `OWNER DECISION REQUIRED` kecuali OD-6.11
(`CARRIED FROM OD-5`). Keputusan Phase 2H OD-1..OD-12, OD-3.11, OD-5.1–5.10, dan
`ARCHITECTURE.md` §16 **tidak diduplikasi** — hanya dirujuk.

---

## 2. Scope

**BOLEH (dipakai sesi ini):** membaca source/PPT/laporan/audit sebelumnya; menjalankan existing
script & engine secara read-only import; membuat diagnostic di `/tmp`; merekonstruksi metric;
membandingkan formula; statistical diagnostics; synthetic/controlled tests; membuat SATU dokumen
baru (file ini).

**DILANGGAR = gagal audit:** mengubah kode/dataset/config/benchmark/metrics/thesis result;
rebuild; ffill/interpolate data resmi; memilih statistical methodology atas nama owner; memperbaiki
B&H atau VaRSR; commit; push.

**Posisi terhadap OD-5:** keputusan OD-5.1–OD-5.10 **belum ada** → audit ini **tidak** memperlakukan
dataset sebagai thesis-frozen, **tidak** memilih treatment missing bars, **tidak** melakukan rebuild.
Seluruh angka bersifat audit-forensik atas *state* saat ini. Catatan: `OD5 §29` poin 9 menyarankan
"OD-6 layak dibuka" setelah freeze OD-5 — instruksi owner membuka OD-6 sekarang sebagai audit
statistik read-only **mengabaikan saran urutan itu tanpa menggantikan keputusan OD-2..OD-5 yang
tetap binding** (owner instruction = sumber hierarki #2, §3).

**Satu-satunya file repo baru:** `OD6_BENCHMARK_METRICS_STATISTICAL_VALIDITY_DECISION.md`.

---

## 3. Source Hierarchy

1. Approved PPT `Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf` (ekstrak:
   `/tmp/opencode/od2_ppt.txt`, dipakai sebagai kutipan linear — `:xx` = baris ekstrak).
2. Explicit owner decisions (termasuk pembukaan OD-6 ini; arahan bahwa Sharpe ≥1 bukan kriteria
   tunggal lagi).
3. `PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md`
4. `PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md`
5. `OD2_ENTRY_EXECUTION_STOP_DECISION.md`
6. `OD3_EXIT_POSITION_LIFECYCLE_ACCOUNTING_DECISION.md`
7. `OD4_RISK_SIZING_PORTFOLIO_ALLOCATION_DECISION.md`
8. `OD5_DATA_INTEGRITY_REBUILD_DECISION.md`
9. Current implementation/research scripts (HEAD).
10. Pengetahuan statistik umum — **hanya untuk penjelasan**, tidak pernah menggantikan
    metodologi yang didefinisikan sumber di atas.

Konvensi: methodology defined by source tidak boleh ditulis "diperbaiki" ke konvensi umum;
penyimpangan dicatat sebagai temuan, bukan direkonsiliasi diam-diam.

---

## 4. Approved PPT Statistical Requirements

Semua baris dari ekstrak PPT (label status terhadap repo — detail di §25):

| # | Requirement PPT (kutipan) | Lokasi | Status repo |
|---|---|---|---|
| P1 | "B&H pasif menanggung drawdown katastrofik **> −75% s.d. −85%** saat crypto winter; **baseline strategi aktif 10-pair tanpa mitigasi korelasi mengalami MDD −58,49%**" | :78–80 | B&H: `PARTIAL` (−77.63 report-only); strategi-vanilla: `PARTIAL` (−58.49 frozen / −58.64 HEAD) |
| P2 | "Sharpe B&H pasif **BTC 0,83 & 10-pair 0,98**" (eksplorasi Bitget 2020–2026) | :88–91 | `VERIFIED` (0.8288 / 0.9809) |
| P3 | RQ1: risk-adjusted return "**Sharpe Ratio / VaRSR**" vs B&H portofolio 10 aset | :114–116 | Sharpe `VERIFIED`; VaRSR `NOT IMPLEMENTED` |
| P4 | RQ2: performa bervariasi bull/bear/sideways | :115–116 | `VERIFIED` implemented (§18) |
| P5 | RQ3: jumlah aset & korelasi (diversifikasi) | :116 | `PARTIAL` (§17) |
| P6 | VaR-adjusted Sharpe Ratio (**Deng, 2013**) untuk koreksi skew/kurtosis | :62, :269–273 | `NOT IMPLEMENTED` |
| P7 | **Paired t-test**: "Membandingkan return harian strategi terhadap buy-and-hold, **dengan koreksi metodologis untuk hari-hari posisi tunai (cash days) agar tidak bias**" | :236–242 | t-test `VERIFIED`; koreksi cash-day `NOT IMPLEMENTED` |
| P8 | **Cross-Correlation Matrix**: "Memetakan korelasi return antar 10 aset untuk menentukan sejauh mana diversifikasi jumlah pair benar-benar mengurangi risiko portofolio" | :243–245 | `PARTIAL` (§16–§17) |
| P9 | **Regime**: "Membagi periode sampel menjadi rezim bull, bear, sideways **berdasarkan distribusi imbal hasil bergulir**" + "membandingkan **MDD** antara strategi aktif dan pasif pada segmen **bear/crash**" | :246–256 | `VERIFIED` implemented (parameternya tidak ada di PPT → §18) |
| P10 | Diskusi terbuka: "teknik pengujian validitas statistik tambahan untuk distribusi return yang tidak normal" (mohon arahan dosen) | :294 | Masih terbuka — **belum ada keputusan advisor** |

Catatan untuk P1: kutipan PPT **tidak** menyebut −58,49% sebagai MDD B&H; ia menyebutnya MDD
*baseline strategi*. Premis "B&H MDD ≈ −58.49% pada PPT" berasal dari mislabel
`decision_log.md:99` (sudah ditandai Phase 2H AR-03). Angka itu jangan dianggap canonical
untuk definisi apa pun (§7, §11).

---

## 5. Benchmark Definition

Empat konstruksi B&H yang benar-benar ada di repo (bukan asumsi):

**B1 — Engine scalar** (`run_backtest.py:206–211`, dipakai `compute_metrics`):
```python
for symbol, df in dfs.items():
    bench += (init / len(dfs)) * (df["close"].iloc[-1] / df["close"].iloc[0])
bh_return = bench / init - 1
```
- Universe: 10 pair config (CSV `data/historical` yang sama dengan strategy).
- Start: **tanggal pertama tiap pair sendiri-sendiri** (staggered; BTC/ETH/XRP 2020-11-09 …
  HYPE 2024-12-18) — bukan satu tanggal seragam.
- Modal: `initial_capital_usd` 1000 (config.yaml:38) → alokasi 100/pair; **yang belum listing
  idle 100 (return 0)**.
- Rebalancing: **tidak ada** (beli sekali di first close, hold ke last close).
- Fees/slippage: **tidak ada**. Dividen/staking/funding: **tidak dimodelkan** (loader hanya OHLCV).
- Missing bar: **hanya endpoint** (`iloc[0]`/`iloc[-1]`) — hole interior tidak memengaruhi angka.
- HYPE: `100 × (last/first)` atas jendela 623 bar-nya sendiri.
- Output: **satu angka return** — tidak ada equity series → MDD/Sharpe/t-test **tidak terdefinisi**.
- Reproduksi: **155.03%** `VERIFIED`.

**B2 — Staggered sleeve** (`research/sharpe_benchmark.py:44–73`, report 2026-09-05):
- `units[s] = 100 / first_close[s]`; `contrib = close × units`; equity = `concat(contribs).sum(axis=1)`
  — **NaN (belum listing / bar hilang) di-skip oleh `sum`**; docstring: *"Cash sebelum pair
  tersedia = 0 kontribusi"*.
- Equity hari-1 = **300** (3 pair aktif) — kas idle 700 **tidak ada di series**; tetapi return
  endpoint dihitung terhadap **nominal 1000** (`:91`) → dua perlakuan kas berbeda dalam satu
  artefak (§8). Tanpa rebalancing (drift dari equal-weight).
- Fees/slippage: tidak ada. Output: series (2120 baris) → Sharpe/MDD/t-test.

**B3 — Staggered + rebalance-on-listing** (`backtest/reports/bh_max_drawdown.md`, committed
`d728ec8`; **tidak ada script generasi di repo**):
- Metode terdokumentasi: staggered entry, rebalance penuh ke equal-weight tiap listing baru,
  tanpa fee; pair belum listing tidak dihitung; $10,000 modal; MDD −77.63% (trough 2022-12-30),
  final $86,714.42 (+767%), peak $95,417.32 (2021-10-25).
- Reconstruksi audit ini **tidak mereproduksi endpoint** (lihat §24 V5) → mekanik persis
  `UNKNOWN` (no script).

**B4 — Period-limited 10-pair** (`bh_drawdown_and_btc_eth_corr.md`): window 2024-12-18..2026-09-02
(620 hari, semua pair tersedia), MDD −58.44%. Report-only.

**Definitional drift (VERIFIED):** `DESIGN.md:174` menyatakan benchmark = *"Equal-weight
allocation, same pairs, **same period**"* — pada kenyataannya: equal-weight hanya di t0 (sleeve
drift, tanpa rebalancing), dan **periode berbeda per pair** (staggered). Kalimat itu bukan
deskripsi akurasi implementasi mana pun.

---

## 6. Benchmark Fairness

Dokumentasi perbedaan — **tidak** menilai mana yang lebih fair:

| Dimensi | Strategy (Cluster-A2) | B&H B1 (scalar) | B&H B2 (sleeve) |
|---|---|---|---|
| Initial capital | 1000 (config:38) | 1000 nominal | 1000 nominal (harian-1: **300 terinvestasi**) |
| Asset universe | 10 pair (cluster A 9 + B 1) | 10 pair sama | 10 pair sama |
| Start date | curve 2020-11-09; **trade pertama 2020-12-01** | staggered per pair | 2020-11-09 (3 pair; 700 idle) |
| End date | 2026-09-02 | per pair (semua 2026-09-02) | 2026-09-02 |
| Fees | **0.1% + slippage 0.05% dua sisi** (config:39–40, `run_backtest:75–76`) | **tidak ada** | **tidak ada** |
| Slippage | ya (sisi beli & jual) | tidak | tidak |
| Missing data | skip + MTM-exclude (OD-5 §14) | hanya endpoint | kontribusi di-skip → **stub-collapse** (13 obs >50%) |
| Rebalancing | dinamis (position sizing risk%, cluster cap) | tidak ada | tidak ada (drift) |
| Cash | idle 0% saat out-of-market (760 hari 0-return = 35.9%) | idle 100/pair 0% | kas idle tidak ada di series; listing step masuk return |
| Leverage | tidak ada (spot long-only) | tidak ada | tidak ada |
| Dividen/funding | tidak dimodelkan | tidak dimodelkan | tidak dimodelkan |
| HYPE | Cluster B, masuk 2024-12-18 | kontribusi dari 2024-12-18 | sama |
| Aritmetika return | `pct_change` sederhana (arithmetic) | n/a (endpoint) | `pct_change` sederhana |

**Asimetri yang tercatat (`VERIFIED`):** (a) fee+slippage **hanya** di strategy — B&H bersih;
(b) sleeve memasukkan **listing-step mekanis** sebagai "return" (+5.26% 2021-04-15 LINK,
+8.52% 2021-04-25 DOGE, +7.53% 2022-03-23 ADA) sementara strategy tidak punya eksposur seperti
ini; (c) sleeve menghitung return endpoint terhadap 1000 padahal hanya 300 di hari-pertama;
(d) strategy out-of-market 35.9% hari (return nol) — B&H selalu "terpasang" kecuali kas listing.
Ini **methodological difference**, bukan penilaian keadilan; penyelesaiannya ada di OD-6.1–OD-6.5.

---

## 7. B&H Return

**Trace formula (B1, `run_backtest:206–211`):** init 1000 → alokasi 100/pair di first close
masing-masing → harga bergerak tanpa rebalancing → fee 0 → nilai akhir Σ100×(last/first) →
`return = bench/1000 − 1`. B2 identik secara ekonomi pada endpoint: `equity_last/1000 − 1`
(`sharpe_benchmark:91`).

**Reproduksi:** B1 = **155.03%** `VERIFIED`; B2 endpoint = **2550.28 → +155.03%** `VERIFIED`
(identik per konstruksi, Phase 2H §17 row 1–2).

**Verifikasi angka PPT (jangan dianggap canonical):**

- Klaim P1a — *"B&H > −75% s.d. −85%"*: `bh_max_drawdown.md` 10-pair **−77.63%**, BTC −76.63%,
  2-pair −76.89% — **dalam rentang PPT** (`PARTIAL` karena report-only untuk B3; V3/V4 direproduksi
  `VERIFIED`). B2 (sleeve) MDD = **−96.69%** — di luar rentang, karena stub-collapse (§11).
- Klaim P1b — *"-58,49%"*: **PPT menempatkannya pada baseline strategi, bukan B&H** (kutipan
  P4/P1 §4). Reproduksi: config 10-pair/max_conc=5 → frozen `sharpe_discrepancy_report.md` table
  (commit `45c42f3`: 0.53/155.56/172t/−58.49; fresh-run 2026-09-05: 0.53/155.82/171t/−58.49) dan
  `DESIGN.md:132` *"DD turun dari −58.49% (vanilla) ke −26.19% (Cluster-A2)"*. Re-run HEAD oleh
  audit ini: **−58.64** (trough 2023-01-18, 171 trades, return 158.46) → **`PARTIAL`** — angka
  eksak −58.49 tidak lagi keluar dari HEAD; divergensi 0.15pp/2.6pp kelasnya = engine berubah
  setelah tanggal report (cash-fix `c22ad1c`, Wilder seed `029a311`, `0ad6cc6`) — kelas sebab
  `INFERRED`, bisect per-commit tidak dilakukan (§29).
- Jika owner pernah memahami "-58.49 = B&H": sumbernya `decision_log.md:99`
  *"DD −26.19% vs B&H −58.49%"* — **mislabel**, sudah tercatat Phase 2H (AR-03; perbaikan =
  Phase 2H OD-11, tidak diduplikasi di sini).
- Angka **154.85%** (`sharpe_discrepancy_report.md:98`): provenance `UNKNOWN` — tidak direproduksi.
- Angka **570.78%** (pre-swap era): data Binance-era tidak ada di repo → `UNKNOWN`/not reproducible.

Tidak ada angka B&H yang dipilih sebagai canonical di audit ini (→ OD-6.1, konsolidasi
Phase 2H OD-3).

---

## 8. B&H Sharpe

**Trace lengkap (B2, `sharpe_benchmark.py`):**

| Dimensi | Nilai | Evidence |
|---|---|---|
| Return series | equity sleeve `.pct_change()` — **arithmetic, bukan log** | `:38` |
| Frequency | harian | :27 `TIMEFRAME="1d"` |
| Risk-free | **0** (tidak dikurangkan) | `:38–41` |
| Annualization | **√365** (bukan √252) | `:41` |
| Std | pandas default (ddof=1) | `:41` |
| Weighting | 100/pair di first date sendiri; tanpa rebalancing; kas idle tidak ada di series | `:44–73` |
| Missing bar | kontribusi NaN → di-skip `sum` → stub-collapse + listing-step | `:70` |
| Periode | 2020-11-09..2026-09-02 (2120 baris, sama dengan strategy) | D4 `identical_sets=True` |

**Reproduksi (`VERIFIED`):** mean=0.008286, std=0.161390, n=2119, non-annualized 0.0513,
annualized **0.9809** — cocok 6 desimal dengan `sharpe_benchmark_comparison.md` §2. BTC-only:
mean 0.001417/std 0.032668 → **0.8288**; 2-pair: 0.001647/0.037855 → **0.8310** — semua cocok.

**Struktur artefak (`VERIFIED` aritmetika, D2/E1/extra2):**
- 13 obs |r|>50% (tanggal): 2021-06-01, 06-22, 09-05, 2022-03-24, 07-02, 2023-01-18/19,
  2023-11-15/16, 2024-09-11/12, 2025-07-09/10 (collapse −93%..−64% dan bounce +131%..+346%).
- **13 obs itu berjumlah +13.20 vs total seluruh return +17.56 → 75% total return-mass berasal
  dari 0.62% observasi artefak.** Threshold 50% juga menyembunyikan: |r|>10% = 95 hari,
  |r|>5% = 340 hari.
- Listing-step mekanis: +5.26% (LINK 2021-04-15), +8.52% (DOGE 2021-04-25), +7.53% (ADA 2022-03-23)
  — di bawah threshold 50% tetapi bukan pergerakan pasar.
- Effect: artefak **menaikkan** Sharpe — tanpa 13 obs: mean 0.002068, std 0.044972 → **0.8787**
  (persis Phase 2H F2) [label §26]; versi drop-baris (rebuild pct_change) → 0.8289.

Tidak ada formula baru yang dipilih; formula di atas adalah milik source. Angka 0.98 adalah
**satu** konstruksi dari family (§24) → mana yang kanonik = OD-6.1/OD-6.2/OD-6.3.

---

## 9. Strategy Sharpe

**Trace (`run_backtest.py:189–190`, `compute_metrics`):** equity curve (MTM `cash + Σ units×close`,
`:176`) → `.pct_change().dropna()` → arithmetic daily → rf=0 → `mean/std × √365` → bulat 2 desimal.
Sortino `:191–192` memakai std dari subset `daily<0` (**non-standard downside deviation** — sudah
terdaftar Phase 2H OD-10, tidak diduplikasi).

**Reproduksi baseline kini (`VERIFIED`, D1):**

| Komponen | Nilai |
|---|---|
| mean | 0.00050380 |
| std | 0.01168954 |
| n (return) | 2119 (curve 2120 baris, 2020-11-09..2026-09-02) |
| mean/std | 0.043098 |
| ×√365 (19.1049) | **0.8234 → 0.82** |
| median / zero-return days | 0.000000 / **760 dari 2119 (35.9%)** |
| min / max hari | −16.79% / +20.42% (4 hari artefak ±16–20%, OD-5 §14.3) |
| MDD | −26.45%, trough **2023-01-22 = hari artefak** |
| CAGR | 17.24%; total 152.00; final 2520.02; 94 trade (pertama 2020-12-01, terakhir 2026-08-03) |

**Penjelasan matematis kenapa dataset kini menghasilkan 0.82 (`VERIFIED`):** angka itu persis
(0.00050380/0.01168954)×19.1049; 35.9% hari return-nol (out-of-market) menekan mean ke ~5.04e-4,
sementara std didominasi hari-hari terbuka + **4 hari artefak**. Tanpa 4 artefak-obs: std turun
26% (0.01169→0.00859) sementara mean nyaris tetap (0.000470) → Sharpe **1.0448**
[FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT, §26]. **Hasil resmi tidak diubah** —
0.82 tetap baseline yang direproduksi.

**Keputusan definisi yang tersisa:** rf=0 & √365 sudah terdokumentasi (`DESIGN.md:169`, header
report, `RULES.md`) — konfirmasi final termasuk perlakuan hari-nol/annualization = OD-6.4
(konsolidasi Phase 2H OD-10, tidak menggantikannya).

---

## 10. Sharpe Comparability

Apakah 0.82 dan 0.98 dihitung dari series yang comparable?

| Dimensi | Strategy | B&H sleeve | Comparable? |
|---|---|---|---|
| Date set | 2120 tanggal | 2120 tanggal | **Ya — identik** (`VERIFIED`: `identical_sets=True`, common=2120) |
| Frequency | harian | harian | Ya |
| Aritmetika | `pct_change` arithmetic | sama | Ya |
| rf | 0 | 0 | Ya |
| Annualization | √365 | √365 | Ya |
| Initial capital | 1000 | 1000 nominal (scale-invariant untuk Sharpe) | Ya (skala) |
| Missing dates | 4 hari all-absent absen dari keduanya | sama | Ya |
| Universe | posisi dinamis + kas | 10 sleeve statis | **Tidak — methodological** |
| Cash days | 35.9% hari 0-return | selalu terpasang (kecuali idle listing) | **Tidak** |
| Dampak artefak | 4 obs ±16–20% → **std naik, Sharpe turun** (0.82 vs 1.045) | 13 obs ±50–346% → **mean naik, Sharpe naik** (0.981 vs 0.879) | **Tidak — arah berlawanan** |
| Fee/slippage | 0.1%+0.05% dua sisi | 0 | **Tidak** |

**Temuan kunci (`VERIFIED` aritmetika):** karena dampak gap berlawanan arah, **urutan perbandingan
berbalik** tergantung treatment missing-bar: kanonik-saat-ini 0.82 < 0.98; tanpa artefak
1.0448 > 0.8787 (dua-duanya `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT` untuk sisi
yang dikecualikan). Konsekuensinya **bukan** "strategi gagal" dan **bukan** "strategi lolos"
(§34) — melainkan: **perbandingan 0.82 vs 0.98 belum metodologis-stabil** sampai
OD-5.3 (treatment gap) + OD-6.1 (definisi benchmark) + OD-6.4/OD-6.5 (definisi & date-set)
diputuskan. Koreksi cash-day untuk uji rata-rata (P7) belum pernah dijalankan (§15).

---

## 11. Maximum Drawdown

**Trace strategy (`run_backtest:194–196`):** `roll_max = equity.cummax()`; `dd = equity/roll_max − 1`;
`max_dd = dd.min()` — harian, berbasis equity-curve (close MTM), puncak global sepanjang curve
(termasuk posisi terbuka), tanpa smoothing/intraday.

**Angka (`VERIFIED`):**

| Objek | MDD | Catatan |
|---|---|---|
| Strategy Cluster-A2 (kanonik-saat-ini) | **−26.45%** | trough **2023-01-22 = hari artefak** |
| Strategy vanilla 10p/max_conc5 (frozen) | −58.49% | `sharpe_discrepancy_report` — **asal angka PPT** |
| Strategy vanilla (re-run HEAD) | **−58.64%** | trough 2023-01-18; `PARTIAL` repro |
| B&H sleeve B2 | **−96.69%** | terkontaminasi stub-collapse (Mei–Jun 2021) |
| B&H B3 rebalance (report) | −77.63% | report-only; recon audit −77.54% (§24) |
| B&H BTC-only / 2-pair | −76.63% / −76.89% | `VERIFIED` |
| B&H period-limited B4 | −58.44% | 620 hari, report-only |
| PPT B&H range | "> −75% .. −85%" | konsisten dengan B3/−76.6..−77.6 |

**Fakta metodologis (`VERIFIED`):** (a) MDD strategy memakai **puncak global** sedangkan MDD
per-regime (`regime_segmentation:73–75`) memakai `cummax` **lokal dalam segmen** — dua definisi
berbeda dalam satu laporan; (b) MDD strategy **duduk persis di hari artefak** dan membawa 3 posisi
terbuka (MTM-include, OD-3.6); (c) MDD B&H sangat bergantung konstruksi (−58.44 s.d. −96.69).
Tidak ada "angka koreksi" yang dipilih di sini — pilihan = OD-6.1 (+ OD-5.3 untuk gap).

---

## 12. Return Metrics

Audit definisi yang dipakai (`compute_metrics:185–187` + forensic diagnostics):

| Metrik | Definisi kode | Nilai | Klasifikasi |
|---|---|---|---|
| Total return | `equity_last / init − 1` — **cumulative** | **152.00%** (B) / 149.59% (A) | Equity-based |
| CAGR | `(last/init)^(1/years) − 1`, years=(days/365.25) — annualized geometric | 17.24% | Equity-based |
| Avg daily return | **tidak dilaporkan repo**; forensic: `mean(pct_change)` | 0.000504 (0.0504%/hari) | Equity-based |
| Median daily return | tidak dilaporkan | 0.000000 | Equity-based |
| Log return | **tidak ada** di mana pun (`VERIFIED` absence — semua `pct_change` arithmetic) | — | — |
| Unrealized component | tidak dipisahkan oleh engine | **+235.30 USD = +23.53pp** dari 152.00pp (OD-3; realized-only ≈ +128.48pp) | Equity-based |

**Kesimpulan Audit H:** angka **152% adalah cumulative total return equity-curve**, termasuk
(a) unrealized +23.53pp dari 3 posisi terbuka (keputusan treatment → OD-3.6), (b) fee+slippage,
(c) 4 hari artefak. Bukan annualized, bukan realized-only. Snapshot A (149.59, `metrics.md`,
tracked/stale) vs B (152.0, `backtest-reference.json`) — **canonical belum dipilih**
(`ARCHITECTURE.md` §16, sudah terdaftar; tidak diduplikasi). Return B&H 155.03 = endpoint scalar
(§7); keduanya beda bahan (MTM-path vs endpoint) — dibandingkan sebagai return kumulatif memang
konvensi repo, tetapi perlakuan kas & fee berbeda (§6).

---

## 13. Trade Metrics

**Dari `compute_metrics:198–204` + run audit ini (`VERIFIED`):**

| Metrik | Nilai | Basis |
|---|---|---|
| Total trades (closed) | **94** (3 posisi terbuka dikecualikan — OD-3.6) | Trade-based |
| Wins / losses | 34 / 60 | Trade-based |
| Win rate | 36.17% | Trade-based |
| Avg win R / avg loss R | +4.35 / −0.85 | Trade-based |
| Avg R (semua) | +1.033 | Trade-based |
| Profit factor | 2.27 (Σwin 2334.20 / \|Σloss\| 1029.70 = 2.267) | Trade-based |
| Exit reasons | donchian_exit 64, stop_loss 30, gap_stop 0 | Trade-based |
| **Expectancy** | **`NOT IMPLEMENTED`** — 0 hit `expectancy`/`calmar` di `run_backtest` & `metrics.md`; [FORENSIC SENSITIVITY] $13.878 per trade closed (= mean pnl); dalam R ≡ avg_r 1.03 | Trade-based (absen) |
| Return/CAGR/Sharpe/Sortino/MDD | dari curve (§9, §11, §12) | Equity-based |

**Konsistensi dengan OD-3 (`VERIFIED`):** trade `pnl` **tidak memasukkan entry fee**
($18.79 dari $18,790.08 notional — OD-3; equity path memakainya) → metrik berbasis-PnL (PF,
win rate, avg-R) sedikit lebih optimis daripada kenyataan kas; 3 posisi terbuka (+235.30 unrealized)
**tidak ada** di n/win/PF tetapi **ada** di return/DD. **Trade-based ≠ equity-based — tidak boleh
dicampur** (state ini dipertahankan; treatment = OD-3.6/OD-3.11 lintas-tema, tidak diganti di sini).

---

## 14. VaR / VaRSR

**Audit J — search seluruh repo:**

| Target | Pola | Hasil |
|---|---|---|
| Kode (*.py/*.ts/*.tsx/*.ipynb) | `VaR`, `VaRSR`, `value_at_risk`, `valueAtRisk` | **0 hit** |
| Laporan/research/web/scripts (*.md di backtest/reports, lib, app) | `VaR\b`, `VaRSR`, `adjusted Sharpe` | **0 hit** |
| Dokumen audit/PPT | — | muncul sebagai *requirement* (PPT :62/:115/:269–273; OD-3.11; Phase 2H) |

**Status: `NOT IMPLEMENTED / VERIFIED ABSENCE`** — tidak ada implementasi VaR (historical/
parametric/apa pun), tidak ada confidence level, horizon, return series, denominator, atau
annualization yang terdefinisi di repo; tidak pernah dipakai di laporan mana pun.
**Audit ini tidak mengarang implementasi.**

**Audit K — spesifikasi yang masih butuh persetujuan owner (tidak dipilih di sini):**
formula VaRSR mana: (a) `Sharpe/VaR`, (b) `(excess return)/VaR`, (c) modified Sharpe
(Cornish-Fisher), (d) denominator Expected Shortfall, (e) VaR absolut vs persentase;
confidence (95%/99%); horizon (1-day); series (equity strategy vs B&H vs return trade);
method (historical vs parametric — PPT menunjuk **Deng 2013** tapi tidak mengutip definisinya);
annualization. → **OD-6.6 (formula) + OD-6.7 (confidence/horizon)**, melengkapi **OD-3.11**
(sudah terdaftar: implement vs amend pertanyaan tesis — tidak diduplikasi) dan diskusi terbuka
PPT:294 (arahan dosen untuk uji non-normal).

---

## 15. Paired t-Test

**Audit L — implementasi ditemukan (`VERIFIED`):** `backtest/research/sharpe_benchmark.py:149–150`
`scipy.stats.ttest_rel(...)`; satu-satunya file di repo yang memakai `ttest`/`scipy` (report:
`sharpe_benchmark_comparison.md`, 2026-09-05).

| Field | Nilai |
|---|---|
| Input series | daily equity `pct_change().dropna()` strategy vs sleeve (re-run per config) |
| Pairing unit | **pasangan return harian pada tanggal sama** — index `intersection` |
| Sample size | n2 = **1919**, n10 = **2119** (per tanggal ∈ kedua series) |
| Missing handling | `dropna` per series + intersection |
| H0 / Ha | mean diff = 0 / ≠ 0 (two-sided default) |
| p-value (reproduksi audit ini) | **0.0747** (t=−1.783, diff −0.001470) dan **0.0194** (t=−2.340, diff −0.007246) |
| p-value (frozen report) | 0.0743 (t=−1.785) dan 0.0193 (t=−2.342) — drift kecil dari evolusi engine |
| Confidence level | p<0.05 (dipakai report) |
| Koreksi cash-day (wajib PPT P7) | **`NOT IMPLEMENTED`** — report hanya menulis caveat + menyarankan dua alternatif; tidak ada uji alternatif yang dijalankan |
| Config yang diuji | **bukan baseline kini**: 2-pair max_conc=1; 10-pair max_conc=5, tanpa cluster, risk 1% |
| Angka strategy di tabel report | **hardcoded** `STRAT_2PAIR_SHARPE=0.94`, `STRAT_10PAIR_SHARPE=0.53` (`:32–33`) + return hardcoded `38.05%`/`155.82%` (`:171–172`) — bukan hasil run |
| Reprod. script di HEAD | **crash** — `load_ohlcv(s, TIMEFRAME)` tanpa cfg → `KeyError 'donchian_entry_period'` sejak `0ad6cc6` (2026-09-12); angka direproduksi audit ini via rekonstruksi dengan cfg fix |

**Audit M — pairing unit:** PPT **sudah menentukan**: *"return harian strategi terhadap
buy-and-hold"* → pairing unit = daily return **`VERIFIED`** (bukan keputusan yang perlu
didaftarkan). Yang **tidak** ditentukan PPT = metode **koreksi cash-day** (P7 hanya mewajibkan
"ada koreksi", tidak mendefinisikannya) → keputusan metodologis nyata → **OD-6.8**
(pairing-unit yang sudah pasti + koreksi cash-day yang belum). Koreksi juga penting karena
35.9% hari strategy bernilai nol menekan mean harian (−0.007246) secara struktural —
ini sudah ditulis sendiri oleh caveat report, tetapi tidak pernah diperbaiki.

---

## 16. Correlation Matrix

**Audit N — implementasi ditemukan (`VERIFIED`):**
- `research/portfolio_size_experiment.py:32–49` — `DataFrame(closes)` outer-join →
  `pct_change().dropna()` → `.corr()` (**Pearson**, default pandas), daily, universe 10 pair;
  dipakai di report `portfolio_size_experiment.md` (2026-09-05).
- `research/correlation_mitigation.py:263–272` — varian untuk kandidat low-corr (PAXG/LTC/BCH),
  loader sendiri (aman di HEAD).

**Reproduksi (`VERIFIED` sel persis):** audit ini menghitung ulang → matriks identik dengan report
(BTC–ETH 0.843, LINK–ETH 0.867, avg cross-corr LINK 0.780, dst.).

**Metodologi & jendela (temuan):**

| Field | Nilai |
|---|---|
| Method | Pearson, daily, arithmetic pct_change |
| Sampel | outer 2120 → `dropna()` (**any**) → **615 baris [2024-12-19..2026-09-02]** |
| Baris dibuang pra-HYPE | 1496 (semua baris sebelum listing HYPE — `dropna` memotong window ke common-start) |
| Baris dibuang pasca-HYPE | **9**: 2024-12-18 (baris pertama), 4 hari hole (2025-02-11, 03-29, 07-09, 07-13), **4 hari resume** (02-12, 03-30, 07-10, 07-14) |
| Gap-resume di sampel | **tidak ada** — baris resume ber-NaN ikut terbuang oleh `dropna` (artefak tak masuk, tetapi 9 hari hilang senyap) |
| BTC–ETH full-period | **0.838** (n=1919) vs matriks jendela **0.843** — `bh_drawdown_and_btc_eth_corr.md` sendiri mencatat keduanya, memilih 0.843 sbg "single source of truth" sambil **melabeli periodenya "data harian penuh"** (label konflik dengan sumbernya) |
| Reprod. script di HEAD | `run_single` (`:73`) **crash** (loader tanpa cfg); **fungsi matriks aman** (baca CSV langsung) — diverifikasi langsung |

**Status:** matrix `VERIFIED` & reproducible; **periodenya bukan periode studi penuh** (615 dari
2120 hari) — PPT tidak menentukan window → keputusan = **OD-6.9**.

---

## 17. Diversification Analysis

**Audit O — apakah repo benar-benar mengukur efek diversifikasi?**

Ada (`VERIFIED`):
- Matriks korelasi 10 aset + average cross-corr (§16) — sesuai bentuk yang diminta P8;
- `portfolio_size_experiment` — jumlah pair (2/4/6/8/10) vs Sharpe/DD → **efek ukuran**;
- `correlation_mitigation` — percobaan cluster-limit (A vs B, avg cross-corr 0.75 vs 0.52)
  → efek mitigasi korelasi;
- laporan regime membandingkan strategi vs B&H per segmen (proteksi vs korelasi jatuh bersama).

Tidak ada (`VERIFIED` absence — 0 hit): **diversification ratio, risk contribution,
portfolio volatility, concentration metric, information ratio/Treynor/Omega**. Tidak ada
metrik baru yang dibuat di audit ini (diagnostic baru pun tidak diperlukan untuk menentukan
keberadaan/keabsahan).

**Status: `PARTIAL`** — bentuk matrix ada, tetapi klaim P8 (*"sejauh mana diversifikasi jumlah
pair benar-benar mengurangi risiko portofolio"*) dijawab hanya lewat Sharpe/DD eksperimen
yang backtest-nya frozen (script crash; Phase 2H: bagian dari best-of-9 selection → lihat
Phase 2H OD-9). Tidak ada analisis kontribusi-risiko portofolio. Perlu/tidaknya metrik lanjut
= bagian dari scope tesis → tidak ditambahkan di sini.

---

## 18. Regime Segmentation

**Audit P — implementasi ditemukan (`VERIFIED`):** `research/regime_segmentation.py` +
report `regime_segmentation_analysis.md` (2026-09-05).

| Field | Nilai |
|---|---|
| Definition of regime | **BTC** rolling 90-day return (`:38–40, :43–51`) |
| Window | `ROLLING_WINDOW = 90` hari |
| Thresholds | BEAR ≤ **−20%**, BULL ≥ **+40%**, sisanya SIDEWAYS |
| Trend/volatility criteria | return-based (bukan vol); label default SIDEWAYS untuk 90 baris warm-up (`ret` NaN) |
| Predetermined di PPT? | **Tidak** — PPT hanya: *"berdasarkan distribusi imbal hasil bergulir"* (`:246–250`); window/aset/threshold tidak pernah disebut |
| Provenance threshold | script ter-commit sekali di `c42a478` (2026-09-07) — **setelah seluruh data terlihat**; report berlabel 2026-09-05; tidak ada artefak pre-registration → pemilihan parameter **`INFERRED` post-hoc** (bukan bukti tuning; bukti eks-ante tidak ada → status eks-ante `UNKNOWN`) |
| Labels terhitung | SIDEWAYS 1231 / BULL 375 / BEAR 314 (n=1920 hari BTC) |
| Blok (split >2 hari gap) | BEAR 23 · BULL 15 · SIDEWAYS 37 (BTC hole = 200/200 hari **tanpa label**) |
| Reprod. script di HEAD | **crash** (`:148/:163/:168/:173/:175` loader tanpa cfg) |
| Metric per segmen | `compute_metrics_in_period (:58–88)`: ret = seg last/first; Sharpe √365 lokal; **MDD = `cummax` lokal segmen** (bukan puncak global); trade dihitung hanya bila `entry≥start AND exit≤end` (trade lintas-batas tidak dihitung di segmen) |

**Status:** implemented `VERIFIED`; definisi-resmi = `OWNER DECISION REQUIRED` (**OD-6.10**).

---

## 19. Regime Look-Ahead

**Audit Q — dapatkah label pada waktu t memakai informasi setelah t?**

- **Label pada t:** `btc_close.pct_change(90)` pada t = `close(t)/close(t−90) − 1` → memakai
  **hanya close ≤ t** → **`VERIFIED`: tidak ada look-ahead harga** pada label.
- `regimes.ffill().fillna("SIDEWAYS")` (`:50`) — **no-op empiris** (0 baris berbeda; setiap baris
  sudah berlabel dari default) → tidak ada pengaruh masa lalu/masa depan tambahan.
- Warm-up 90 baris pertama = SIDEWAYS by default — keputusan definisi (bukan leak).
- **Risiko hindsight (bukan leak harga):** window 90d & threshold −20/+40 tidak terdaftar di PPT
  dan ditulis setelah data penuh terlihat (`INFERRED` §18) → **threshold dapat saja dipilih dengan
  pengetahuan penuh sampel** — status eks-ante `UNKNOWN`; ini keputusan metodologis → OD-6.10.
- Segmentasi blok dipotong pada gap >2 hari (`:93`) → BTC hole memecah blok (200 hari tanpa
  label) — artifact OD-5 terbawa, tidak diperbaiki.
- Tidak ada centered window, normalisasi full-sample, atau future return dalam kode label
  (`VERIFIED` dari pembacaan `:43–51`). Perbandingan performa per-regime tetap **analisis
  eks-post** (partisi sampel baru diketahui di akhir segmen) — inherent pada regime analysis,
  wajib di-disclose, bukan kebocoran data.

---

## 20. Regime Performance

**Audit R — implementasi perbandingan: `VERIFIED` (frozen report, 2026-09-05).**
`regime_segmentation_analysis.md` memuat, per segmen signifikan (>5 hari, 24 baris §1):
BTC return %, BH2/BH10 return/DD/Sharpe, dan 3 konfigurasi strategy (2-pair, 10p-vanilla,
Cluster-A2) return/DD — termasuk **§4 Bear/Crash: strategi vs B&H MDD** → **test spesifik PPT P9
("MDD aktif vs pasif pada segmen bear/crash") terimplementasi**.

Kaveat (`VERIFIED`): (a) DD per segmen = puncak-lokal segmen, bukan puncak global (§11);
(b) `n_trades` segmen mengabaikan trade lintas-batas; (c) Sharpe per segmen dihitung pada
sampel kecil (mis. 4.81 pada ~90 hari, 0.37 pada 64 hari) — fragil, tanpa CI; (d) segmen <5 hari
dibuang dari tabel (sebagian besar dari 75 blok); (e) report frozen, script crash di HEAD;
(f) tiga konfig strategy dibandingkan per segmen → terkait best-of-9 (Phase 2H OD-9).

Tidak ada hasil regime kanonik yang dibuat/dipilih audit ini.

---

## 21. Data-Gap Statistical Impact

**Audit S — date set persis per metrik (semua `VERIFIED`; dataset TIDAK diperbaiki):**

| Metrik | Date set | Perlakuan gap |
|---|---|---|
| Strategy return/CAGR/Sharpe/MDD | curve 2120 baris 2020-11-09..2026-09-02 (4 hari all-absent absen) | **4 hari artefak disertakan** (±16–20%; MDD trough 2023-01-22 di dalamnya) |
| B&H scalar return | endpoint per-pair (own first..last) | hole interior tidak berpengaruh (0 efek) |
| B&H sleeve Sharpe/MDD | 2120 baris (set tanggal identik dgn strategy) | **13 obs artefak >50% + 340 hari >5% + listing-step** disertakan; collapse-stretch Mei–Jun 2021 mendominasi MDD (−96.69) |
| Paired t-test | intersection 1919 / 2119 | mewarisi artefak kedua series; **koreksi cash-day absen** (§15) |
| Correlation matrix | **615 baris** 2024-12-19..2026-09-02 | 4 hole + 4 resume + 1 baris pertama **dibuang senyap** oleh `dropna` (artefak tak bocor; 9 hari hilang) |
| Regime labels/metrics | indeks BTC 1920 (200 hari hole BTC tanpa label); segmen = blok split >2 hari | label & segmen terpecah oleh hole |
| Trade metrics | 94 trade (tanggal entry 2020-12-01..2026-08-03) | stop tak dievaluasi saat hole (OD-5/OD-3) |
| B&H period-limited | 620 baris 2024-12-18.. | window dipotong ke listing HYPE |

**Arah distorsi per metrik (aritmetika, bukan pilihan):** artefak **menaikkan** Sharpe B&H
(+0.10) dan **menekan** Sharpe strategy (−0.22) → perbandingan treatment-dependent (§10).
Treatment missing-bar final = **OD-5.3** (dibawa sebagai OD-6.11); tidak ada ffill/eksklusi
yang diterapkan pada data resmi di audit ini.

---

## 22. Sample Size and Multiple Comparisons

**Audit T — ukuran sampel aktual (`VERIFIED`):**

| Jenis | n |
|---|---|
| Daily returns strategy / B&H10 | **2119** / **2119** |
| Daily returns B&H2 / BTC | **1919** / **1919** |
| Paired observations (t-test) | **1919** (2-pair) · **2119** (10-pair) |
| Trades (closed) | **94** (+3 terbuka) |
| Regime: label hari / blok / segmen signifikan di report | 1920 / 75 (23·15·37) / 24 |
| Correlation sampel | **615** |

**Multiple comparisons yang berjalan/terencana (tanpa koreksi di mana pun — 0 hit):**
2 t-test (p<0.05) · matriks regime: 3 konfig strategy × 2 B&H × ~24 segmen × 3 metrik
(ret/DD/Sharpe) · `portfolio_size_experiment` 9 konfig · matriks korelasi 45 pasang ·
3 decision gate (`RULES.md:55–57`). Metode koreksi (Bonferroni/dst.) **tidak dipilih di sini** —
jika tesis menampilkan lebih dari satu uji formal → **OD-6.12** (`OWNER DECISION REQUIRED`
only if applicable — PPT hanya berjanji 1 t-test + matriks korelasi + segmen; banyaknya uji
eksplorasi di repo melebihi rencana PPT).

---

## 23. Statistical Assumptions

**Audit U — status asumsi untuk apa yang benar-benar diimplementasi repo:**

| Asumsi | Untuk | Status di repo |
|---|---|---|
| Normalitas (diff return) | paired t-test (P7) | **`NOT CHECKED`** — 0 hit shapiro/jarque/normaltest |
| Independensi (autokorelasi diff) | paired t-test | **`NOT CHECKED`** — 0 hit durbin/ljung/autocorr |
| Stationarity | Sharpe & t-test atas daily returns | **`NOT CHECKED`** — 0 hit stationar |
| Heteroskedasticity | Sharpe/t-test | **`NOT CHECKED`** — 0 hit heterosk |
| Finite variance / non-normal | Sharpe (crypto fat-tail) | **Diakui PPT sendiri** (:60–62, :269–273: heavy-tails & excess kurtosis → motivasi VaRSR) — **koreksinya (VaRSR) `NOT IMPLEMENTED`** (§14) |
| Asumsi untuk Sharpe itu sendih | Sharpe | implisit (mean/std) — tidak diperiksa; 35.9% mass return-nol + fat-tail tidak ditangani |

Kondisi nyata: **uji yang mengasumsikan normalitas ada (t-test), koreksi non-normal yang dijanjikan
PPT tidak ada (VaRSR), pemeriksaan asumsi tidak ada** — semuanya `VERIFIED` dari keberadaan/
ketiadaan kode. Ini **bukan** vonis metodologi tesis; keputusan perbaikan termasuk diskusi terbuka
PPT:294 (arahan dosen) + OD-6.6/OD-6.7. Audit ini tidak menjalankan uji normalitas substitusi
yang diposisikan kanonik.

---

## 24. Benchmark Variant Forensics

**Audit V — kenapa banyak angka B&H ada** (semua `VERIFIED` sebagai isi file; konstruksi berbeda;
**tidak diranking, tidak dipilih canonical**):

| # | Variant | Definisi | Return | MDD | Sharpe | Source |
|---|---|---|---:|---:|---:|---|
| 1 | Engine scalar | Σ100×(last/first), idle-cash, tanpa fee | **155.03%** | n/a | n/a | `run_backtest:206–211` · metrics.md · reference · DESIGN:198 |
| 2 | Staggered sleeve | $100/pair di first date sendiri, tanpa rebalancing, kas idle di luar series | 155.03% (endpoint) | **−96.69%** | **0.9809** | `sharpe_benchmark:44–73` |
| 3 | 2-pair sleeve | BTC+ETH | 418.32% | −76.89% | 0.8310 | `sharpe_benchmark_comparison.md` |
| 4 | BTC-only | 1 aset | 401.07% | −76.63% | 0.8288 | sama |
| 5 | Staggered + rebalance-on-listing | full deploy, rebalance tiap listing, tanpa fee | **+767%** ($10k→86,714) | **−77.63%** | n/a | `bh_max_drawdown.md` (**no script**; recon audit ffill: +847.99% / −77.54% / final 94,799 — endpoint **`UNKNOWN`** mekanik, deviasi +9.3% muncul 2023–2024) |
| 6 | Period-limited (HYPE window) | 2024-12-18..2026-09-02 (620 hari) | n/a | **−58.44%** | n/a | `bh_drawdown_and_btc_eth_corr.md` |
| 7 | Pre-swap scalar (Binance-era) | data mulai 2020-08-27 | **570.78%** | n/a | n/a | `research/longshort/comparison.md` — data absen, `UNKNOWN` |
| 8 | Threshold figure | — | **154.85%** | — | — | `sharpe_discrepancy_report.md:98` — provenance `UNKNOWN` |
| 9 | Binance-era 2-pair | 8cc0012 vintage | 383.72% | −15.36% (strategy era) | 1.06 era | `git show 8cc0012` (frozen) |

**Taxonomy kenapa angka berbeda (`STRONGLY SUPPORTED`):** (a) konstruksi (idle-cash vs
fully-deployed vs period-limited); (b) vintage data (Binance pre-swap vs Bitget); (c) jendela
periode (staggered vs common-start vs label "2020-08"); (d) evolusi engine (cash-fix `c22ad1c`,
Wilder seed `029a311`) — lihat −58.49→−58.64 dan 155.82→158.46 (§7); (e) denominator (nominal
1000 vs benar-benar terinvestasi). Pemilihan canonical = **OD-6.1** (konsolidasi Phase 2H OD-3
+ input OD-5.7) — **audit ini tidak memilih**.

---

## 25. Thesis Claim Traceability

| PPT Claim / Requirement | Repository Evidence | Implemented? | Reproducible? | Status |
|---|---|---|---|---|
| 10-asset B&H benchmark | `run_backtest:206–211` (scalar) + `sharpe_benchmark:44–73` (sleeve) | Ya | Ya (155.03 · 0.9809 · 0.8288 · 0.8310 semua cocok) | `VERIFIED` |
| B&H MDD (PPT "> −75..−85") | `bh_max_drawdown.md` −77.63 / −76.63 / −76.89 | Ya | Parsial — **tanpa script**; recon MDD −77.54 tapi endpoint +9.3% deviasi | `PARTIAL` |
| "−58.49%" (PPT: baseline **strategi**) | `sharpe_discrepancy_report` table · `DESIGN:132` · re-run HEAD −58.64 | Ya (asalnya strategi-vanilla, bukan B&H) | Frozen ya / HEAD `PARTIAL` (0.15pp drift); `decision_log:99` mengaitkan ke B&H = mislabel | `PARTIAL` |
| Sharpe strategy 0.82 | `compute_metrics:189–190` | Ya | Ya — 0.8234 → 0.82, Snapshot B eksak | `VERIFIED` |
| Sharpe B&H 0.83 / 0.98 | `sharpe_benchmark` + report | Ya | Ya — 0.8288 / 0.9809; tanpa artefak 0.8787 | `VERIFIED` |
| VaRSR (Deng 2013) | — | **Tidak** | — | `NOT IMPLEMENTED` (0 hit; OD-3.11) |
| Paired t-test (+ koreksi cash-day) | `sharpe_benchmark:149–150` | **Parsial** — uji ya, **koreksi cash-day tidak** | Angka ya (0.0747/0.0194 vs frozen 0.0743/0.0193) via rekonstruksi; **script crash di HEAD**; config non-baseline; tabel strategy hardcoded | `PARTIAL` |
| Correlation matrix (10 aset) | `portfolio_size_experiment:32–49` + report | Ya | Ya — sel persis; **jendela 615 hari ≠ periode studi**; backtest-bagian script crash | `PARTIAL` |
| Regime analysis (rolling) | `regime_segmentation.py` + report | Ya | Script crash di HEAD; report frozen; parameter tak ada di PPT | `PARTIAL` |
| Regime MDD bear: aktif vs pasif | report §4 | Ya | Frozen report | `PARTIAL` |
| Diversification analysis | matrix + size/cluster experiment saja; tanpa risk-contribution/vol metric | Parsial | Parsial | `PARTIAL` |
| BTC–ETH 0.843 (latar belakang) | `bh_drawdown_and_btc_eth_corr.md` + matrix | Ya | 0.843 (jendela) / 0.838 (penuh n=1919) — kedua angka terdokumentasi | `VERIFIED` (label periodenya konflik) |
| Asumsi non-normal ditangani | — | Tidak (VaRSR absen; pemeriksaan 0 hit) | — | `UNKNOWN`/terbuka (PPT:294) |

`UNKNOWN`: provenance 154.85 · mekanik persis variant #5 · status eks-ante threshold regime ·
kenapa `decision_log`/`RULES:56` "45–58%" (Phase 2H: "45" tak terlacak — tidak diduplikasi).
**Ketiadaan = `NOT IMPLEMENTED IN CURRENT REPOSITORY`** — bukan "metodologi tesis invalid"
(§28 aturan).

---

## 26. Historical Sensitivity

**Semua baris: `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`** — dipakai untuk memahami
struktur angka, **bukan** untuk memilih metodologi/angka terbaik (larangan §29 & §34):

| # | Eksperimen | Kanonik-saat-ini | Sensitivitas | Label |
|---|---|---|---|---|
| S1 | Strategy Sharpe tanpa 4 hari artefak (drop-obs) | **0.82** | 1.0448 (std −26%) | SENSITIVITY |
| S2 | Strategy Sharpe tanpa 4 baris artefak (drop-baris) | 0.82 | 1.0541 | SENSITIVITY |
| S3 | Strategy MDD tanpa 4 baris artefak | **−26.45%** | −18.08% (konsisten dgn Mode B OD-5 −18.10%, treatment berbeda) | SENSITIVITY |
| S4 | B&H sleeve Sharpe tanpa 13 artefak-obs | **0.9809** | 0.8787 (≡ Phase 2H F2) | SENSITIVITY |
| S5 | B&H sleeve Sharpe tanpa 13 baris | 0.9809 | 0.8289 | SENSITIVITY |
| S6 | B&H MDD antar-konstruksi | −96.69 (sleeve) | −77.63 report / −77.54 recon / −58.44 period-limited | SENSITIVITY |
| S7 | t-test pada baseline kini vs sleeve | (pada config lama: p 0.0194) | p **0.0238** (t=−2.262, n=2119) | SENSITIVITY |
| S8 | Urutan perbandingan | 0.82 < 0.98 | 1.0448 > 0.8787 (**berbalik**) | SENSITIVITY |

**S8 adalah temuan metodologis inti** — dan secara eksplisit **TIDAK** berarti strategi lolos
atau gagal (§34). Presentasi sensitivitas di tesis (robustness table vs tidak) sudah terdaftar di
**Phase 2H OD-12** — tidak diduplikasi.

---

## 27. Owner Decision Register — OD-6.1 … OD-6.12

| ID | Keputusan | Evidence | Status |
|---|---|---|---|
| **OD-6.1** | **Canonical B&H definition** — pilih SATU konstruksi (§24 #1–#6) sebagai pembanding Sharpe/t-test/gate; konsolidasi **Phase 2H OD-3** (tidak menggantikannya) + masukan OD-5.7 | §5, §7, §24; Phase 2H OD-3; return-gate gagal di semua konstruksi (Phase 2H F4) | `OWNER DECISION REQUIRED` |
| **OD-6.2** | **Benchmark asset weighting** — 100/pair idle-cash (drift) vs equal-weight awal vs fully-deployed; apakah kas listing masuk return series | §5 B1/B2, §6, §8 (listing-step + denom 1000 vs 300) | `OWNER DECISION REQUIRED` |
| **OD-6.3** | **B&H rebalancing policy** — tanpa rebalancing vs rebalance-on-listing vs periodik (variant #5 report-only, tak reproduksi persis) | §5 B3, §24 #5 | `OWNER DECISION REQUIRED` |
| **OD-6.4** | **Sharpe definition/annualization** — konfirmasi rf=0 · √365 (vs √252) · arithmetic · ddof · perlakuan 35.9% hari-nol; **konsolidasi Phase 2H OD-10** (rf=0/Sortino/entry-fee sudah terdaftar — tidak diduplikasi) | §9, §10; `run_backtest:189–190`; `DESIGN:169` | `OWNER DECISION REQUIRED` |
| **OD-6.5** | **Return-series date alignment** — date set kanonik pembanding (union 2120 identik ✓ vs common-start 620 vs window per-tes); interaksi OD-5.4 kalender + OD-5.5 periode | §10, §21 (tabel date set) | `OWNER DECISION REQUIRED` |
| **OD-6.6** | **VaRSR formula** — varian (Sharpe/VaR · excess/VaR · modified · ES-denominator · abs vs % VaR) & sumber Deng 2013; **melengkapi OD-3.11** (implement-vs-amend, tidak diduplikasi) | §14; PPT :62/:115/:269 | `OWNER DECISION REQUIRED` |
| **OD-6.7** | **VaR confidence/horizon** — 95%/99%, horizon 1-day, method (historical/parametric/CF), series yang dipakai, annualization | §14 | `OWNER DECISION REQUIRED` |
| **OD-6.8** | **Paired t-test: koreksi cash-day** — pairing unit SUDAH ditetapkan PPT (daily return, `VERIFIED`); metode koreksi hari-nol yang diminta PPT belum terdefinisi/diimplementasi | §15; PPT :236–242; report caveat | `OWNER DECISION REQUIRED` |
| **OD-6.9** | **Correlation methodology** — window (615-hari HYPE-limited vs full 2120), frekuensi, Pearson vs lain, perlakuan missing (9 hari terbuang senyap) | §16 | `OWNER DECISION REQUIRED` |
| **OD-6.10** | **Regime definition** — aset (BTC vs portofolio), window 90d, threshold −20/+40, pendaftaran eks-ante (parametertidak ada di PPT; pemilihan `INFERRED` post-hoc) | §18, §19 | `OWNER DECISION REQUIRED` |
| **OD-6.11** | **Statistical treatment of missing observations** untuk seluruh metrik §21 — **tidak diputuskan di sini** | dibawa dari **OD-5.3** (+ Phase 2H OD-2) | `CARRIED FROM OD-5` |
| **OD-6.12** | **Multiple-testing treatment if applicable** — apakah tesis menampilkan >1 uji formal; koreksi (metode TIDAK dipilih di sini) | §22 (2 t-test + matriks regime + 9-ekperimen + 3 gate; 0 hit koreksi) | `OWNER DECISION REQUIRED` |

Catatan register: **tidak ada OD-6.13+**. Keputusan yang sudah terdaftar di tempat lain tetap
binding dan **tidak diduplikasi**: Phase 2H OD-1..OD-12 (snapshot, gap-policy, benchmark, gate,
criterion-history, label periode, stop-text, gap-stop, OOS, metric-defs, errata, presentasi
sensitivitas) · **OD-3.11** (VaRSR implement-vs-amend) · **OD-5.1–OD-5.10** ·
`ARCHITECTURE.md` §16 (canonical snapshot A/B).

---

## 28. Recommended Freeze Sequence

Menghormati decision gate & keputusan sebelumnya (tidak ada lompatan; OD-6 tidak menggantikan
OD-2..OD-5):

1. **OD-2 → OD-3 → OD-4** diselesaikan lebih dulu (urutan tetap seperti OD-5 §29).
2. **OD-5.1–OD-5.10** (sumber → rebuild A–D → treatment gap → kalender → periode → universe/HYPE
   → provenance → freeze status) — termasuk **OD-5.3** yang menjadi root OD-6.11.
3. Setelah dataset & treatment final: putuskan **OD-6.1 + OD-6.2 + OD-6.3** (definisi benchmark —
   bergantung OD-5.7/OD-5.3), lalu **OD-6.5** (date-set — bergantung OD-5.4/OD-5.5), lalu
   **OD-6.4** (konvensi Sharpe; selaraskan dengan Phase 2H OD-10).
4. **OD-6.11** otomatis terjawab bersama OD-5.3 (status carried).
5. **OD-6.6 + OD-6.7** (VaRSR) hanya jika **OD-3.11** memilih implementasi (jika amend → tutup
   dengan catatan rationale di PLAN.md).
6. **OD-6.8 + OD-6.9 + OD-6.10** (definisi uji) — sebelum menjalankan uji apapun secara resmi.
7. **OD-6.12** — setelah himpunan uji final diketahui.
8. **Full re-run kanonik sekali** (OD-5 §29 poin 8; `ARCHITECTURE.md` §16) → semua statistik §4
   dihitung sekali dari run itu → bab metodologi ditulis dari angka itu.
9. Phase 2H **OD-11/OD-12** (errata mislabel "B&H −58.49" & presentasi sensitivitas) dieksekusi
   saat penyelarasan dokumen.

---

## 29. Limitations

- **Verifikasi eksternal mustahil dari lingkungan ini** — filter ISP memblokir domain exchange
  (OD-5 §26): klaim PPT "data Bitget 2020–2026" tidak dapat dicek terhadap venue; tidak ada data
  eksternal yang disubstitusi ke repo.
- **Tiga script research crash di HEAD** (`sharpe_benchmark:121/134`, `regime_segmentation:148/…`,
  `portfolio_size_experiment:73` — KeyError sejak `0ad6cc6`); angka report = frozen artifact;
  audit ini mereproduksi angkanya via rekonstruksi read-only, **bukan** dengan menjalankan script
  asli (jalannya akan menulis ke `backtest/reports/` — dilarang mode ini).
- **`scipy` tidak tercatat di `requirements.txt`** (REPO_MAP #6) → install bersih tidak bisa
  menjalankan t-test research dari repo (reproducibility gap).
- **Variant #5 (rebalance-on-listing) tidak punya script** — reconstruksi audit ini mencocokkan
  MDD/trough (−77.54 vs −77.63; trough 2022-12-30 identik) tetapi **endpoint deviasi +9.3%**
  (94,799 vs 86,714) → mekanik persis `UNKNOWN`; +767% tidak reproduksi.
- **Divergensi −58.49 → −58.64 dan 155.82 → 158.46** hanya dikarakterisasi pada kelas-sebab
  (commit engine pasca-report `c22ad1c`/`029a311`/`0ad6cc6`, `INFERRED`) — tanpa bisect per-commit.
- **Status eks-ante threshold regime `UNKNOWN`** — tidak ada artefak pre-registration; tidak ada
  akses ke riwayat pikiran pemilihan parameter.
- **Sensitivitas §26 bukan hasil tesis** — tidak boleh dipakai memilih metodologi/angka; angka
  resmi tetap Snapshot B sampai sequence §28 selesai; canonical A/B tetap `ARCHITECTURE.md` §16.
- **Tidak ada verdict strategi** (§34); tidak ada uji normalitas substitusi yang dijalankan
  (audit menentukan *status pemeriksaan di repo*, bukan menggantikan metodologi).
- Diskusi terbuka PPT:294 (teknik uji non-normal — arahan dosen) **belum terjawab** di repo.
- Semua diagnostic di `/tmp` (`od6_diag.py` + output 71 baris, `od6_extra*.py`); import engine
  read-only; **tidak ada file repo yang dimodifikasi** selain pembuatan dokumen ini (cek
  `git status`/`git diff` di laporan akhir).

---

### Final Answers

**1. What exactly is the current B&H benchmark?**
Dua hal berbeda dipakai bersamaan: (a) **angka return resmi** = engine scalar
`Σ100×(last/first)` per pair staggered, idle-cash, tanpa fee (**155.03%**, `run_backtest:206–211`);
(b) **series untuk Sharpe/t-test** = staggered sleeve `$100/pair` di tanggal listing sendiri,
tanpa rebalancing, kas idle di luar series (**0.9809**). Ditambah empat varian lain yang beredar
di report (§24) tanpa satu pun yang ditetapkan kanonik → **OD-6.1**.

**2. Can the PPT B&H MDD be reproduced?**
PPT **tidak** mengklaim B&H MDD = −58.49% — ia mengklaim B&H **"> −75%..−85%"** dan
**−58.49% untuk baseline strategi**. Yang direproduksi: klaim B&H → `PARTIAL` (report −77.63;
rekonstruksi −77.54; BTC/2-pair −76.63/−76.89 `VERIFIED`; variant #5 tanpa script);
−58.49 strategi → `PARTIAL` (frozen ya; HEAD −58.64 karena engine berubah). "B&H −58.49"
adalah mislabel `decision_log:99` (Phase 2H AR-03/OD-11).

**3. Why do multiple B&H numbers exist?**
Lima kelas sebab (`STRONGLY SUPPORTED`, §24): konstruksi (idle-cash/full-deploy/period-limited),
vintage data (Binance pre-swap vs Bitget), jendela periode (staggered vs common-start vs label
"2020-08"), evolusi engine (cash-fix/Wilder seed), dan denominator (nominal vs terinvestasi).
154.85 dan 570.78 punya provenance `UNKNOWN`.

**4. Is strategy Sharpe reproducible?**
**Ya — `VERIFIED`.** (0.00050380/0.01168954)×√365 = 0.8234 → **0.82**, Snapshot B eksak
(152.00/−26.45/94/2520.02). Penjelasan struktural: mean ditekan 35.9% hari-nol; std membawa
4 hari artefak (tanpanya 1.0448 — `FORENSIC SENSITIVITY`).

**5. Is B&H Sharpe reproducible?**
**Ya — `VERIFIED`** untuk sleeve (0.9809; mean/std 6 desimal persis), BTC (0.8288), 2-pair
(0.8310); tanpa 13 artefak-obs → 0.8787. **Catatan `PARTIAL`:** script aslinya crash di HEAD,
dan 75% total return-mass sleeve berasal dari 13 artefak-obs.

**6. Are strategy and B&H Sharpe directly comparable under current implementation?**
**Secara mekanis ya** (date set identik 2120, harian, rf=0, √365, arithmetic — `VERIFIED`);
**secara metodologis belum** — universe/kas/fee berbeda dan **dampak gap arah berlawanan**
membuat urutan perbandingan berbalik saat artefak dikecualikan (0.82<0.98 vs 1.04>0.88, dua-duanya
sensitivitas). Perbandingan belum metodologis-stabil sampai OD-5.3/OD-6.1/OD-6.4/OD-6.5
diputuskan — **bukan** vonis lolos/gagal (§34).

**7. Is VaRSR implemented?**
**`NOT IMPLEMENTED / VERIFIED ABSENCE`** — 0 hit di seluruh kode/laporan/web; PPT mewajibkannya;
formula/confidence/horizon belum pernah didefinisikan → OD-6.6/OD-6.7 (OD-3.11 tetap terdaftar).

**8. Is paired t-test implemented?**
**Ya — `VERIFIED`** (`sharpe_benchmark.py:149–150`), n=1919/2119, p=0.0747/0.0194 (frozen:
0.0743/0.0193). **Parsial** karena: koreksi cash-day wajib-PPT `NOT IMPLEMENTED`; dijalankan di
config non-baseline dengan angka strategy hardcoded; script crash di HEAD.

**9. Is correlation analysis implemented?**
**Ya — `VERIFIED`** (Pearson daily; matriks direproduksi sel persis; BTC–ETH 0.843/0.838).
**`PARTIAL`** pada metodologi: `dropna` memangkas sampel ke 615 hari (jendela HYPE) dan membuang
9 hari senyap; window tidak pernah disetujui → OD-6.9.

**10. Is regime segmentation implemented?**
**Ya — `VERIFIED`** (BTC 90d, BEAR ≤−20%/BULL ≥+40%, laporan per-regime termasuk MDD bear
aktif-vs-pasif = test PPT). Label trailing **tanpa look-ahead harga**; tetapi parameter tak ada
di PPT dan dipilih setelah data penuh (`INFERRED` post-hoc; eks-ante `UNKNOWN`); script crash
di HEAD → OD-6.10.

**11. Is diversification analysis implemented?**
**`PARTIAL`** — ada matriks korelasi + eksperimen ukuran/cluster (Sharpe/DD vs jumlah pair);
**tidak ada** diversification ratio, risk contribution, portfolio volatility, concentration
(`VERIFIED` absence).

**12. Which statistical outputs are affected by missing-bar artifacts?**
- Strategy Sharpe & MDD (4 obs ±16–20%; **trough MDD = hari artefak**);
- B&H sleeve Sharpe (13 obs = 75% total return-mass → 0.981 vs 0.879), MDD (−96.69 collapse);
- Paired t-test (mewarisi artefak kedua series; koreksi cash-day absen);
- Correlation (9 hari hole+resume **dibuang senyap** oleh `dropna`);
- Regime (200 hari hole BTC tanpa label; blok terpecah);
- B&H scalar/endpoint **tidak terpengaruh** hole interior.

**13. What sample sizes are actually available?**
Daily: **2119** (strategy & B&H10), **1919** (B&H2/BTC) · paired: 1919 & 2119 · trades: **94**
closed (+3 open) · regime: 1920 label-hari (75 blok; 24 segmen signifikan di report) ·
correlation: **615**.

**14. Which methodology choices still require owner decisions?**
**OD-6.1–OD-6.10 & OD-6.12** (`OWNER DECISION REQUIRED`) + **OD-6.11** (`CARRIED FROM OD-5`),
bersama dengan yang sudah terdaftar sebelumnya dan tetap binding: Phase 2H OD-1..OD-12,
OD-3.11 (VaRSR), OD-5.1–OD-5.10, `ARCHITECTURE.md` §16 (snapshot kanonik).

---

*Audit ini tidak memberikan verdict strategi. Angka Sharpe mana pun — 0.82, 0.98, 1.04, 0.88 —
tidak boleh dibaca sebagai "lolos/gagal", dan sensitivitas §26 tidak boleh dipakai memilih
metodologi. Yang diputuskan di sini hanyalah: apakah perbandingannya terdefinisi dengan jelas,
diimplementasikan, direproduksi, dan sekarang keputusannya terdaftar di OD-6.1–OD-6.12.*
