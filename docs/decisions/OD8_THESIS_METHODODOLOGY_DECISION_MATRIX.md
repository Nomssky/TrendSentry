# OD-8 — Thesis Methodology Decision Matrix & Freeze Dependency Audit

> **Mode:** AUDIT / KONSOLIDASI ONLY — dokumen ini TIDAK memilih opsi metodologi apa pun,
> TIDAK memilih Snapshot A/B, TIDAK memilih benchmark berdasarkan performa, TIDAK mengubah
> source/data/config/report/test. Satu-satunya file baru di repo = dokumen ini.
> Semua angka sensitivitas yang dikutip = `FORENSIC SENSITIVITY — NOT CANONICAL`.
>
> **Snapshot status (tidak berubah):** Snapshot B (152.00% / 0.82 / −26.45% / 94 trade /
> equity 2520.02 / 2020-11-09..2026-09-02) dan Snapshot A (149.59% / −26.19%) =
> **ENGINEERING SNAPSHOTS, BUKAN THESIS-CANONICAL RESULT.**
>
> **HEAD saat audit:** `d728ec891036a62f142d98ade8913a0e86176370` (== origin/main, in sync).

---

## 1. Executive Summary

**Pertanyaan utama — "setelah Phase 2G/2H + OD-2…OD-7, apa yang masih harus diputuskan
owner sebelum Thesis Baseline dapat dibekukan?" — jawabannya:**

Dari **78 ID keputusan** yang terdaftar di 9 sumber (Phase 2H OD-1..OD-12, OD-2.1..2.9,
OD-3.1..3.11, OD-4.1..4.11, OD-5.1..5.10, OD-6.1..6.12, OD-7.1..7.12, `ARCHITECTURE.md` §16),
terdapat **57 keputusan unik** setelah penggabungan 21 duplikat (§6). Status:

| Status | Jumlah |
| --- | --- |
| `OWNER DECISION REQUIRED` (murni, belum bergantung input lain) | 37 |
| `CONDITIONAL` (tetap milik owner, tapi jawabannya ditentukan keputusan lain dulu) | 19 |
| **Total unresolved unik** | **56** |
| `DECIDED` (diselesaikan sumber, dalam sistem ID) | 1 (OD-3.5) |
| `CARRIED`/merged (ID duplikat, dialihkan ke canonical ID) | 21 |
| `UNKNOWN` / `NOT APPLICABLE` (status keputusan) | 0 |

**Jenis keputusan (Part B):** **46 metodologi/owner** (data 9 + strategy 12 + portfolio 9 +
benchmark 4 + statistics 11 + canonical-result provenance 1) dan **10
engineering/reproducibility** (OD-5.9, OD-7.2, OD-7.4, OD-7.5, OD-7.7, OD-7.10, OD-7.11,
OD-7.12, Phase 2H OD-11, Phase 2H OD-12). Tidak ada keputusan metodologi yang dipindahkan ke
ranah engineering (§5).

**Severity (Part F):** **33 BLOCKER** (harus selesai sebelum final backtest) · **15
PRE-FREEZE** (harus selesai sebelum methodology freeze, tidak mempengaruhi analisis
eksploratif) · **8 DOCUMENTATION** (tidak mempengaruhi metodologi/angka, wajib untuk
reproducibility) · **0 OPTIONAL** (tidak ada keputusan unresolved yang benar-benar opsional
bagi baseline).

**Dependency order minimum (Part E):** rantai kritis =
`strategy/portfolio semantics (OD-2→OD-3→OD-4) → data chain (OD-5.1→5.2→5.3∥5.4→5.5→5.6→5.7,
dengan OD-3.7 menyusul OD-5.3) → acceptance/provenance (5.8/5.9/5.10) → benchmark
(6.2∥6.3∥6.5→6.1) → statistik (6.4; 3.11→6.6/6.7; 6.8/6.9/6.10→6.12) → kriterion/gates/OOS
(Phase 2H OD-5→OD-4→OD-9) → artefak reproduksi (7.2/7.4/7.5/7.10 bebas paralel) →
pilihan canonical (ARCH §16) → alignment kode → canonical re-run → statistik dari run itu →
tabel/figure (7.7/7.11/Phase 2H OD-12) → final evidence-chain freeze (OD-7.12).`
Rantai ini **menghormati** tiga "Recommended Freeze Sequence" yang sudah dipublikasikan audit
sebelumnya (OD-3 §23, OD-5 §29, OD-6 §28) — ketiganya sepakat: `OD-2 → OD-3 → OD-4` dulu,
lalu `OD-5` (data), lalu `OD-6` (benchmark/statistik), lalu re-run kanonik.

**Jawaban singkat kedua — "apa dependency order minimum agar satu keputusan tidak dibuat
sebelum inputnya selesai?"** →19 keputusan `CONDITIONAL` (§13) wajib menunggu upstream-nya;
33 BLOCKER membentuk jalur kritis; jalur data dan jalur strategy/portofolio berpotensi paralel
hanya untuk item yang tidak punya silang dependensi (grafik penuh §7).

**Readiness (Part N):** Gate A `BLOCKED` · Gate B `BLOCKED` · Gate C `PARTIAL` · Gate D
`PARTIAL` · Gate E `BLOCKED` · **Gate F (Final Simulation) `BLOCKED` — simulasi final
DIHALANGI, tidak boleh dimulai.**

**Snapshot A/B (Part L):** keduanya = `historical evidence` + `engineering reproducibility
reference` (+ `sensitivity reference` saat dikutip di perbandingan); status `thesis candidate` =
`UNKNOWN` untuk keduanya (menunggu ARCH §16); `rejected` = tidak ada. **Tidak ada yang boleh
dideklarasikan thesis-canonical sekarang (q9).**

**Keputusan yang dilarang dipilih dari hasil (Part K):** 12 keputusan terdaftar di §14 —
dilarang memilih berdasarkan return/DD/Sharpe/p-value yang lebih baik.

---

## 2. Audit Scope

**Yang dilakukan OD-8:** konsolidasi forensic seluruh temuan Phase 2G, Phase 2H, OD-2, OD-3,
OD-4, OD-5, OD-6, OD-7, `ARCHITECTURE.md` §16, `decision_log.md`, dan keputusan owner yang
sudah benar-benar diberikan → satu decision matrix eksplisit (dependency, severity, impact,
register, checklist).

**Yang TIDAK dilakukan (sesuai hard constraint):**
- Tidak mengubah source code, strategy, config, presets, dataset, CSV, database, reports,
  research scripts, tests, package files, workflows, thesis artifacts, PPT/PDF.
- Tidak refactor, tidak memperbaiki bug, tidak menjalankan code yang menimpa output repo.
- Tidak ada eksperimen backtest baru — audit ini **murni analisis dokumen** (tidak ada yang
  perlu dijalankan di `/tmp`; seluruh sensitivitas dikutip dari audit sebelumnya yang sudah
  menjalankannya di `/tmp`).
- Tidak memilih Snapshot A/B, tidak memilih benchmark, tidak memilih interpretasi stop,
  tidak menyelesaikan kontradiksi sendiri.
- Tidak commit, tidak push, tidak membuka OD-9.

**Verifikasi minimum (12 langkah, semua dijalankan read-only):**

| # | Langkah | Hasil |
| --- | --- | --- |
| 1 | Semua dokumen OD ada | ✓ OD-2 (49.706 B), OD-3 (56.555 B), OD-4 (61.704 B), OD-5 (64.277 B), OD-6 (59.618 B), OD-7 (93.303 B) |
| 2 | Dokumen Phase 2G/2H ada | ✓ PHASE2G (41.329 B), PHASE2H (57.553 B) |
| 3 | Inspeksi `ARCHITECTURE.md` §16 | ✓ "METRIC SOURCE OF TRUTH — **PENDING (keputusan canonical belum diambil)**" |
| 4 | Inspeksi `decision_log.md` | ✓ kronologi berisi keputusan L2 (mis. 2026-08-14 gate "LOLOS" berbasis Sharpe ≥1.0, kini tahap koreksi P2H OD-4/OD-5) |
| 5 | Ekstraksi semua decision ID | ✓ 78 ID (§4); Phase 2G = findings saja (tanpa ID OD) |
| 6 | Identifikasi duplikat/carry | ✓ 21 ID merged/carry (§6) |
| 7 | Bangun dependency graph | ✓ §7, kritis-path §8 |
| 8 | Cari kontradiksi thesis-critical | ✓ §23 (13 topik) |
| 9 | Verifikasi git HEAD | ✓ `d728ec891036a62f142d98ade8913a0e86176370` |
| 10 | Verifikasi `git status --porcelain` | ✓ sebelum penulisan: hanya 5 untracked (OD-3..OD-7) + file ini setelahnya; 0 tracked changes |
| 11 | Verifikasi `git diff --check` | ✓ exit 0 |
| 12 | Konfirmasi tidak ada perubahan tracked source/data/config | ✓ `git diff HEAD` kosong |

---

## 3. Source Hierarchy

Urutan precedence dipakai persis seperti mandate OD-8; kalau dua sumber bertentangan,
**tidak diselesaikan sendiri** — dicatat sebagai contradiction + precedence + owner decision
required (daftar lengkap di §23).

1. Approved PPT: `Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf` (ekstrak:
   `/tmp/opencode/od2_ppt.txt`)
2. Explicit owner decisions yang sudah diberikan (§12: penarikan kriteria Sharpe ≥1.0
   "owner, current conversation"; mandate proses audit OD-7/OD-8; aturan `PLAN.md` §5)
3. `PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md` (findings; tanpa ID keputusan)
4. `PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md` (OD-1..OD-12)
5. `OD2_ENTRY_EXECUTION_STOP_DECISION.md` (OD-2.1..2.9)
6. `OD3_EXIT_POSITION_LIFECYCLE_ACCOUNTING_DECISION.md` (OD-3.1..3.11)
7. `OD4_RISK_SIZING_PORTFOLIO_ALLOCATION_DECISION.md` (OD-4.1..4.11)
8. `OD5_DATA_INTEGRITY_REBUILD_DECISION.md` (OD-5.1..5.10)
9. `OD6_BENCHMARK_METRICS_STATISTICAL_VALIDITY_DECISION.md` (OD-6.1..6.12)
10. `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md` (OD-7.1..7.12)
11. Current implementation (kode saat ini — **bukan** sumber keputusan; implementasi tidak
    dianggap keputusan, lihat §12 aturan "Do not infer a decision from implementation alone")
12. General methodological knowledge (hanya bila perlu; bukan untuk memilih opsi)

Catatan: kalimat "recommended sequence"/"recommended by process" dalam audit sebelumnya =
rekomendasi proses (bukan keputusan owner) — dihormati sebagai evidence untuk urutan (§8),
bukan sebagai jawaban atas keputusan yang masih terbuka.

---

## 4. Master Decision Inventory

Legenda Status: `DECIDED` · `OWNER DECISION REQUIRED` · `CARRIED` · `CONDITIONAL` ·
`UNKNOWN` · `NOT APPLICABLE`. Freeze Blocking: `BLOCKER` · `PRE-FREEZE` · `DOCUMENTATION`
· `via canonical` (untuk baris CARRIED — severity mengikuti ID kanoniknya).
Affects: DATA / STRATEGY / PORTFOLIO / BENCHMARK / STATISTICS / REPRO.

### 4.1 Phase 2H (12 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2H OD-1 | Pilih snapshot canonical: A, B, atau re-run pasca-keputusan lain | Phase 2H §28:523 | `CARRIED` (→ ARCH §16) | seluruh keputusan metodologi | REPRO | via canonical | teks eksplisit "following `ARCHITECTURE.md` §16" |
| P2H OD-2 | Kebijakan data-gap (series **dan** benchmark): refetch/ffill/drop/leave | Phase 2H §28:524 | `CARRIED` (→ OD-5.3) | — | DATA | via canonical | OD-6:831 "dibawa dari OD-5.3 (+ Phase 2H OD-2)" |
| P2H OD-3 | SATU konstruksi B&H untuk kedua gate | Phase 2H §28:525 | `CARRIED` (→ OD-6.1) | OD-5.3, OD-5.7 | BENCHMARK | via canonical | OD-6:739 "konsolidasi **Phase 2H OD-3** (tidak menggantikannya)" |
| P2H OD-4 | Gate honesty: restate gate Sharpe "not met, waived (−0.16)" atau re-run ke kriteria pre-registered; perbaiki `TASKS.md:18`, `PLAN.md:211`, preset | Phase 2H §28:526 | `CONDITIONAL` | OD-6.1, P2H OD-5 | STATISTICS | PRE-FREEZE | Phase 2H AR-04 (gate vs aritmetika); tidak diduplikasi audit berikutnya |
| P2H OD-5 | Kriteria: pertahankan "> B&H (revised 2026-09-05)", restore "≥1.0", atau kriteria baru — **sebelum melihat output re-run** | Phase 2H §28:527 | `CONDITIONAL` | OD-6.1 (untuk opsi relatif-B&H) | STATISTICS | BLOCKER | Phase 2H AR-05 (revisi post-hoc, best-of-9) |
| P2H OD-6 | Label periode "6 tahun" vs jendela sejati 2020-11-09→2026-09-02 (5.81y) | Phase 2H §28:528 | `CARRIED` (→ OD-5.5) | — | DATA | via canonical | substansi identik dengan OD-5.5 (`INFERRED` — tanpa pernyataan eksplisit) |
| P2H OD-7 | Stop-loss text vs code | Phase 2H §28:529 | `CARRIED` (→ OD-2.1) | — | STRATEGY | via canonical | OD-2:297 "OD-2.1 *is* Phase 2H OD-7" |
| P2H OD-8 | Gap-stop precedence: samakan kode ke dokumen ("exit at open") atau dokumen ke kode (close-first) | Phase 2H §28:530 | `CARRIED` (→ OD-2.6) | — | STRATEGY | via canonical | substansi identik dengan OD-2.6 (`INFERRED` — tanpa pernyataan eksplisit) |
| P2H OD-9 | Postur OOS: walk-forward/holdout vs "in-sample only + sampaikan keterbatasan" | Phase 2H §28:531 | `CONDITIONAL` | OD-5.2, OD-5.5 | STATISTICS | BLOCKER | Phase 2H AR-05 (zero OOS); OD-6:529,589 merujuk tanpa mengabsorpsi |
| P2H OD-10 | Definisi metrik: rf=0, √365, sortino non-standar, entry-fee omission, n closed-only, 3 posisi akhir | Phase 2H §28:532 | `CARRIED` (→ OD-6.4 + facet OD-3.4) | — | STATISTICS | via canonical | OD-6.4 "konsolidasi Phase 2H OD-10"; OD-3.4 "(carries OD-2.7/Phase 2H OD-10)" |
| P2H OD-11 | Errata decision-record (`decision_log:24,99,120`, `:12`, 5-vs-10-pair, "B&H −58.49") — annotate, jangan rewrite diam-diam | Phase 2H §28:533 | `OWNER DECISION REQUIRED` | — | REPRO | DOCUMENTATION | OD-7.8 "= Phase 2H OD-11"; OD-6:752,890 "binding dan tidak diduplikasi" |
| P2H OD-12 | Presentasi sensitivitas forward-fill di tesis (sebagai robustness table, bukan headline) | Phase 2H §28:534 | `OWNER DECISION REQUIRED` | ARCH §16 | REPRO | DOCUMENTATION | OD-6:730 "**Phase 2H OD-12** — tidak diduplikasi" |

### 4.2 OD-2 (9 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OD-2.1 | Stop formula of record: `Entry−2×ATR(14)` (PPT/PLAN:34/DESIGN:37/config:20) vs `signal_close−2×signal_day_ATR` (run:133) | OD-2 §16:324 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | mismatch anchor `VERIFIED` (OD-2 finding 2); menyeret re-run (OD-2:297) |
| OD-2.2 | Kalau entry-anchored: "Entry" = open mentah atau open×1.0005? | OD-2 §16:325 | `CONDITIONAL` | OD-2.1 (hanya bila entry-anchored) | STRATEGY | BLOCKER | materialitas ≤1.6% stop-distance / ≤1.5pp return (OD-2) |
| OD-2.3 | ATR timestamp: signal-day (kode), day-before-signal, atau definisi lain? | OD-2 §16:326 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | variant +152.0% → +158–159%, DD −26.45→−27.7% = `FORENSIC SENSITIVITY — NOT CANONICAL` (OD-2 finding 3) |
| OD-2.4 | Stop fixed atau dynamic (trailing)? | OD-2 §16:327 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | PPT "Stop loss dinamis" vs kode fixed; PLAN:35 "trailing berbasis ATR" |
| OD-2.5 | Same-bar priority saat channel exit dan stop trigger bersamaan | OD-2 §16:328 | `CARRIED` (→ OD-3.3) | — | STRATEGY | via canonical | OD-3.3 "(carries OD-2.5)" |
| OD-2.6 | Gap-through behavior saat open gap di bawah stop: exit-at-open vs close-confirmed | OD-2 §16:329 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | gap_stop 0/94; 2 exit CASE2 akan fill lebih buruk di bawah aturan dokumen (−2.73%, −8.80%) |
| OD-2.7 | Cost treatment pada eksekusi stop (fee 0.1% + slippage 0.05%) | OD-2 §16:330 | `CARRIED` (→ OD-3.4) | — | STRATEGY | via canonical | OD-3.4 "(carries OD-2.7/Phase 2H OD-10)"; nuance OD-3.5 → OD-2.7 |
| OD-2.8 | Exit fill timing (found by OD-2): same-day close vs eksekusi berikutnya | OD-2 §16:331 | `CARRIED` (→ OD-3.1) | — | STRATEGY | via canonical | OD-3.1 "(carries OD-2.8)" |
| OD-2.9 | Stop trigger semantics: "menyentuh stop loss" (touch) vs close-confirmation | OD-2 §16:332 | `CARRIED` (→ OD-3.2) | — | STRATEGY | via canonical | OD-3.2 "(carries OD-2.9)"; 29/2.236 intraday touch diabaikan |

### 4.3 OD-3 (11 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OD-3.1 | Exit signal execution timing | OD-3 §22 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | "exit timing forces every exit price to move" (OD-3 §23) |
| OD-3.2 | Stop trigger semantics (touch vs close) — berdampak pada exit price & statistik | OD-3 §22 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | 29/2.236 intraday touches diabaikan; Case A |
| OD-3.3 | Same-bar exit priority (stop vs channel) | OD-3 §22 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | 2/30 stop exit = CASE2 |
| OD-3.4 | Entry fee dalam trade PnL (avgR/PF) + cost treatment stop | OD-3 §22 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | avgR 1.0334→1.0233; PF 2.2669→2.2342; membawa OD-2.7 + facet P2H OD-10 |
| OD-3.5 | Rate/placement fee & slippage | OD-3 §22 | `DECIDED` (oleh sumber: L1 PPT `VERIFIED` match; nuance → OD-2.7/OD-3.4) | — | STRATEGY | — (tidak memblokir) | OD-3: "No new decision required (rate/placement `VERIFIED` match)" |
| OD-3.6 | Period-end open position treatment (MTM vs forced-close vs both) | OD-3 §22 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | MTM menyuntik **23.53pp** unrealized ke headline return |
| OD-3.7 | Data-gap open-position treatment (carry+zero-MTM vs ffill vs rebuild dulu) + stop enforcement saat hole | OD-3 §22 | `CONDITIONAL` | OD-5.3 (data treatment harus lebih dulu) | STRATEGY | BLOCKER | Sharpe 0.82→1.10, DD −26.45→−18.08 (ffill) = `FORENSIC SENSITIVITY — NOT CANONICAL`; opsi C eksplisit "data rebuild/fill decided first" |
| OD-3.8 | Same-day capacity reuse setelah exit | OD-3 §22 | `OWNER DECISION REQUIRED` | — | STRATEGY | BLOCKER | Case I; 498 hari terblokir cluster; membawa OD-4.7 |
| OD-3.9 | Multi-asset same-day entry ordering (tie-break) | OD-3 §22 | `CARRIED` (→ OD-4.8) | — | PORTFOLIO | via canonical | substansi identik dengan OD-4.8 (`INFERRED`) |
| OD-3.10 | Cash-shortfall handling (clamp vs skip) | OD-3 §22 | `CARRIED` (→ OD-4.9) | — | PORTFOLIO | via canonical | substansi identik dengan OD-4.9 (`INFERRED`); 0 historical binds di keduanya |
| OD-3.11 | VaRSR: implement sesuai PPT vs amend RQ2/RQ3 dengan rationale | OD-3 §22 | `OWNER DECISION REQUIRED` | — | STATISTICS | PRE-FREEZE | PPT menjanjikan VaRSR; implementasi `NOT IMPLEMENTED` |

### 4.4 OD-4 (11 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OD-4.1 | Definisi "1% risk": peristiwa kerugian mana yang dianggap budget | OD-4 §25 | `OWNER DECISION REQUIRED` | — | PORTFOLIO | BLOCKER | PPT `NOT SPECIFIED` (gross vs net, fill vs close) |
| OD-4.2 | Equity snapshot mana yang mensize posisi berikutnya | OD-4 §25 | `OWNER DECISION REQUIRED` | — (joint OD-4.11) | PORTFOLIO | BLOCKER | prev-curve-day 94/94; same-day 0/94; Case F basis 1008.29 vs cash 664.73 |
| OD-4.3 | Harga anchor stop distance untuk sizing | OD-4 §25 | `OWNER DECISION REQUIRED` | OD-2.1/OD-2.3 (anchor & ATR yang sama) | PORTFOLIO | BLOCKER | units −0.19%..−1.32% (median −0.46%) vs open mentah |
| OD-4.4 | Stop anchor + ATR timestamp yang memberi makan setiap size | OD-4 §25:701 | `CARRIED` (→ OD-2.1 + OD-2.3) | — | PORTFOLIO | via canonical | "Status: `CARRIED FROM OD-2`" eksplisit |
| OD-4.5 | Fee/slippage di dalam budget 1%? | OD-4 §25 | `CONDITIONAL` | OD-4.1 (definisi budget) | PORTFOLIO | BLOCKER | Case M +0.0159pp; PPT `NOT SPECIFIED` |
| OD-4.6 | Pembulatan qty / lot-step exchange | OD-4 §25 | `OWNER DECISION REQUIRED` | — | PORTFOLIO | PRE-FREEZE | delta 8.67e-08 units (bukti: nyaris nol pada presisi laporan); lot/step code `NOT IMPLEMENTED` |
| OD-4.7 | Same-day capacity reuse & re-entry semantics | OD-4 §25:731 | `CARRIED` (→ OD-3.8) | — | STRATEGY | via canonical | "Status: `CARRIED FROM OD-3`" eksplisit |
| OD-4.8 | Iteration order multi-asset (urutan pemrosesan = urutan entry) | OD-4 §25 | `OWNER DECISION REQUIRED` | — | PORTFOLIO | BLOCKER | ORDER-DEPENDENT spread **10.51pp** (152.00/159.17/162.51), trades 94/93/92 = `FORENSIC SENSITIVITY — NOT CANONICAL`; membawa OD-3.9 + OD-7.9 |
| OD-4.9 | Cash-shortfall behavior (clamp vs reject vs clamp+min-notional) | OD-4 §25 | `OWNER DECISION REQUIRED` | — | PORTFOLIO | PRE-FREEZE | **0** clamp/spot-cap historis; reject-variant identik konstruktif pada history |
| OD-4.10 | Portfolio-level aggregate risk cap & concentration rule | OD-4 §25 | `OWNER DECISION REQUIRED` | — | PORTFOLIO | PRE-FREEZE | global cap 5 tidak pernah bind; max nyata 3 (OD-4 evidence) |
| OD-4.11 | Unrealized PnL di dalam sizing basis | OD-4 §25:787 | `CONDITIONAL` | OD-4.2 (joint) | PORTFOLIO | BLOCKER | status eksplisit "(Decide jointly with OD-4.2.)" |

### 4.5 OD-5 (10 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OD-5.1 | Sumber data primer: tetap Bitget spot (PPT:181) atau sumber lain | OD-5 §27 | `OWNER DECISION REQUIRED` | — | DATA | BLOCKER | kelayakan venue `UNKNOWN` (ISP DNS hijack → 2020.3.218.139); PPT:181 menyebut Bitget |
| OD-5.2 | Rebuild dataset (fetch ulang) atau pertahankan 10 CSV worktree | OD-5 §27 | `OWNER DECISION REQUIRED` | OD-5.1 | DATA | BLOCKER | raw ts sudah di-drop (`fetch_bitget_data.py`); 0 checksum/manifest |
| OD-5.3 | Treatment 1.635 missing bar + 4 hari all-absent (refetch/eksklusi/halt/…) — **dilarang memilih dari angka Sharpe/DD** | OD-5 §27 | `OWNER DECISION REQUIRED` | — | DATA | BLOCKER | inventory terverifikasi ulang: 1.635 bar (BTC/ETH/XRP/LINK/DOGE 204, SOL/BNB 203, AVAX/ADA 104, HYPE 1); membawa P2H OD-2 + OD-6.11 |
| OD-5.4 | Definisi kalender & timestamp: boundary UTC, hari 7-minggu, hari tanpa bar | OD-5 §27 | `OWNER DECISION REQUIRED` | — | DATA | BLOCKER | 4 hari all-absent 2021-05-28..31; 2.120 hari-nol (OD-6) |
| OD-5.5 | Periode studi final: koreksi label `2020-08..2026-08` vs data aktual `2020-11-09..2026-09-02` (atau ganti periode via re-fetch) | OD-5 §27 | `OWNER DECISION REQUIRED` | — | DATA | BLOCKER | label vs data `VERIFIED`; membawa P2H OD-6 |
| OD-5.6 | Seleksi universe & kontrol survivorship (kriteria PPT:294 tak pernah ada) | OD-5 §27 | `OWNER DECISION REQUIRED` | — | DATA | BLOCKER | PPT:294 menanyakan kriteria ke dosen; anggota 10-pair PPT:181 |
| OD-5.7 | Penanganan HYPE (staggered, absensi 1.500 hari): shared calendar vs window + konsekuensi benchmark | OD-5 §27 | `OWNER DECISION REQUIRED` | — | DATA | BLOCKER | input OD-6.1/OD-6.9 |
| OD-5.8 | Kriteria acceptance dataset: sahkan T01–T12 (+ kandidat T13/T14) sebagai gate freeze | OD-5 §27 | `OWNER DECISION REQUIRED` | — | DATA | PRE-FREEZE | OD-5 §24 |
| OD-5.9 | Provenance & checksum: sidecar + manifest + retensi log fetch | OD-5 §27 | `OWNER DECISION REQUIRED` | — | REPRO | DOCUMENTATION | 0 checksum/manifest di repo (`NOT IMPLEMENTED`); membawa OD-7.3 |
| OD-5.10 | Status freeze baseline: bolehkah Snapshot B difreeze **sebelum** OD-5.1–5.9 selesai? | OD-5 §27 | `CONDITIONAL` | OD-5.1..5.9 + ARCH §16 | DATA | PRE-FREEZE | OD-5 §29 sequence; B tanpa ledger tersimpan (`PROVENANCE UNKNOWN`) |

### 4.6 OD-6 (12 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OD-6.1 | Canonical B&H definition: pilih SATU konstruksi (§24 #1–#6) untuk Sharpe/t-test/gate | OD-6 §27 | `CONDITIONAL` | OD-5.3, OD-5.7, OD-6.2, OD-6.3, OD-6.5 | BENCHMARK | BLOCKER | ≥7 konstruksi tak kompatibel; return-gate gagal di SEMUA konstruksi; membawa P2H OD-3 |
| OD-6.2 | Benchmark asset weighting: 100/pair idle-cash vs equal-weight awal vs fully-deployed | OD-6 §27 | `OWNER DECISION REQUIRED` | — | BENCHMARK | BLOCKER | listing-step + denominator 1000 vs 300; varian 155.03 vs 767/570.78/401/418/154.85 |
| OD-6.3 | B&H rebalancing policy: tanpa rebalancing vs rebalance-on-listing vs periodik | OD-6 §27 | `OWNER DECISION REQUIRED` | — | BENCHMARK | BLOCKER | OD-6 §24 |
| OD-6.4 | Konvensi Sharpe: rf=0 vs RF, annualization, ddof, hari-nol 35.9%; konsolidasi P2H OD-10 | OD-6 §27 | `OWNER DECISION REQUIRED` | — (facet hari-nol mengikuti OD-5.3) | STATISTICS | BLOCKER | nilai ada di dalam `compute_metrics` runner → ikut run final |
| OD-6.5 | Date alignment benchmark (window, first/last bar, listing) | OD-6 §27 | `CONDITIONAL` | OD-5.4, OD-5.5 | BENCHMARK | BLOCKER | OD-6 §28 butir 3 |
| OD-6.6 | Formula VaRSR (CVD/DLV variant, edge correction) | OD-6 §27 | `CONDITIONAL` | OD-3.11 (pilih implementasi), OD-6.4 | STATISTICS | PRE-FREEZE | VaR/VaRSR `NOT IMPLEMENTED` |
| OD-6.7 | Parameter VaRSR: confidence level & horizon (PPT tidak menyebut) | OD-6 §27 | `CONDITIONAL` | OD-6.6 | STATISTICS | PRE-FREEZE | PPT hanya menyebut nama VaRSR |
| OD-6.8 | t-test: cash-day correction & multiple-testing policy | OD-6 §27 | `CONDITIONAL` | OD-5.3, OD-5.4, OD-6.12 | STATISTICS | PRE-FREEZE | p=0.0743/0.0193 vs cash-day 0.0430/0.0391 = `FORENSIC SENSITIVITY — NOT CANONICAL` |
| OD-6.9 | Korelasi: window/detrend/estimator (pairwise vs listwise, Pearson vs Spearman) | OD-6 §27 | `CONDITIONAL` | OD-5.5, OD-5.7 | STATISTICS | PRE-FREEZE | 615 vs 2.120 observasi mengubah matriks |
| OD-6.10 | Regime definition: threshold pre-registered vs post-hoc, segment data, multiple-testing | OD-6 §27 | `CONDITIONAL` | OD-5.5 | STATISTICS | PRE-FREEZE | threshold sempat diubah post-hoc 0.50→0.33/0.66 |
| OD-6.11 | Kebijakan missing bars untuk statistik | OD-6 §27:747 | `CARRIED` (→ OD-5.3) | — | DATA | via canonical | "Status `CARRIED FROM OD-5`"; "otomatis terjawab bersama OD-5.3" |
| OD-6.12 | Multiple-testing policy untuk himpunan uji final | OD-6 §27 | `CONDITIONAL` | OD-6.6/6.8/6.9/6.10 (uji final) | STATISTICS | PRE-FREEZE | OD-6 §28 butir 7 |

### 4.7 OD-7 (12 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OD-7.1 | Canonical thesis result provenance: snapshot mana (A/B/re-run) + record provenance | OD-7 §28 | `CARRIED` (→ ARCH §16) | keputusan metodologi lain | REPRO | via canonical | pertanyaan identik dengan P2H OD-1/ARCH §16 (`INFERRED` merge; cross-ref ARCH §16 di register OD-7) |
| OD-7.2 | Command of record yang otoritatif (default menimpa `metrics.md` tracked) | OD-7 §28 | `OWNER DECISION REQUIRED` | — | REPRO | DOCUMENTATION | README:120, `cli.py`, `REPORT_SUBDIR` mechanism |
| OD-7.3 | Retensi ledger hasil | OD-7 §28 | `CARRIED` (→ OD-5.9) | — | REPRO | via canonical | "= OD-5.9 (sudah terdaftar)"; ledger B tidak tersimpan = `PROVENANCE UNKNOWN` |
| OD-7.4 | Environment freeze (`requirements.txt` unpinned) | OD-7 §28 | `OWNER DECISION REQUIRED` | — | REPRO | DOCUMENTATION | `pip check` bersih, tetapi versi tak terkunci → drift lintas-env `UNKNOWN` |
| OD-7.5 | Config single-source (konstanta statistik hardcoded di kode) | OD-7 §28 | `OWNER DECISION REQUIRED` | — | REPRO | DOCUMENTATION | ARCH §16 baris 1 = SoT parsial |
| OD-7.6 | Result artifact single-source (satu file sumber angka) | OD-7 §28 | `CARRIED` (→ ARCH §16) | — | REPRO | via canonical | "= ARCH §16 prosedur 'tulis ulang SEMUA kutipan dari satu sumber'" |
| OD-7.7 | Provenance requirement tiap tabel/figure tesis (generator, input, config, commit) | OD-7 §28 | `OWNER DECISION REQUIRED` | ARCH §16 | REPRO | DOCUMENTATION | 4 report tanpa generator = `NOT TRACEABLE` |
| OD-7.8 | Errata untuk kesalahan decision-record | OD-7 §28 | `CARRIED` (→ Phase 2H OD-11) | — | REPRO | via canonical | "= Phase 2H OD-11 (errata)" |
| OD-7.9 | Asset-order decision record | OD-7 §28 | `CARRIED` (→ OD-4.8) | — | PORTFOLIO | via canonical | "= OD-4.8 (+ OD-3.9 same-day ordering)" |
| OD-7.10 | Ledger retention policy (`.gitignore` "Data & reports output") | OD-7 §28 | `OWNER DECISION REQUIRED` | — | REPRO | DOCUMENTATION | research files ditahan mandat (`UNKNOWN ≠ DEAD`) |
| OD-7.11 | Statistical output provenance: artefak mana yang otoritatif | OD-7 §28 | `CONDITIONAL` | OD-6.4..6.12 (stat pipeline) | REPRO | PRE-FREEZE | cross-ref OD-6.1/6.8/6.12 |
| OD-7.12 | Final evidence-chain freeze checklist | OD-7 §28 | `CONDITIONAL` | semua OD-7.1..7.11 + OD-1..OD-6 | REPRO | PRE-FREEZE | urutan eksplisit "setelah OD-1…OD-6 + OD-7.1…7.11" |

### 4.8 ARCHITECTURE.md §16 (1 ID)

| Decision ID | Decision | Source | Status | Depends On | Affects | Freeze Blocking? | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH §16 (METRIC SOURCE OF TRUTH) | Keputusan canonical metric: pilih Snapshot A, B, atau re-run → tulis ulang SEMUA kutipan dari satu sumber → catat keputusan | `ARCHITECTURE.md` §16:356+ | `CONDITIONAL` | rantai metodologi (OD-2→OD-6) — pilihan "re-run" hanya bermakna setelah metodologi final | REPRO | BLOCKER | header: "PENDING (keputusan canonical belum diambil)"; menyeret P2H OD-1, OD-7.1, OD-7.6 |

**Total baris inventory = 78 ID (12+9+11+11+10+12+12+1).**

---

## 5. Owner vs Engineering Decisions

Pemisahan ketat: keputusan metodologi **tidak boleh dipindahkan** ke ranah engineering.
Engineering hanya boleh memutuskan *format/mekanisme*; *kebutuhan & nilai* tetap owner bila
nilainya menentukan metodologi/angka.

| Decision | Type | Can Engineer Decide? | Requires Owner? | Why |
| --- | --- | --- | --- | --- |
| OD-5.1/5.2/5.3/5.5/5.6/5.7 (sumber, rebuild, gap, periode, universe, HYPE) | Methodology | Tidak | **Ya** | menentukan dataset mentah & seluruh klaim tesis |
| OD-5.4 (kalender/timestamp) | Methodology | Implementasi boundary UTC = engineer **setelah** aturan dipilih | **Ya (aturannya)** | "hari tanpa bar" = definisi metodologis |
| OD-5.8 (kriteria acceptance T01–T12) | Methodology gate | Menyusun kandidat T13/T14 = engineer | **Ya (persetujuan gate)** | gate freeze menentukan dataset mana yang sah |
| OD-5.9 (manifest/checksum **format**) | Engineering | **Ya** (format sidecar/manifest) | Requirement & retensi = ya | format murni mekanis; kebutuhan provenance sudah jelas |
| OD-2.1–2.6 (stop anchor/ATR/fixed/gap), OD-3.1–3.4, 3.6–3.8 (exit/touch/priority/fee/lifecycle) | Methodology | Tidak | **Ya** | konflik PPT-vs-kode = pertanyaan metodologi, bukan bug |
| OD-4.1/4.2/4.3/4.5/4.11 (risk basis, equity snapshot, anchor) | Methodology | Tidak | **Ya** | definisi "1%" & sizing = metodologi |
| OD-4.6 (rounding) | Methodology-technical | Mekanika lot-step = engineer (butuh data exchange) | **Ya (pilihannya)** | live-tradability vs internal simulation |
| OD-4.8 (ordering) | Methodology | Tidak | **Ya** | memilih urutan = memilih hasil (spread 10.51pp) |
| OD-4.9/OD-4.10 (clamp, portfolio cap) | Methodology | Tidak (historis identik, tetap definisional) | **Ya** | tetap metodologi meski 0 bind di history |
| OD-6.1/6.2/6.3/6.5 (benchmark) | Methodology | Tidak | **Ya** | pembanding tesis menentukan verdict gate |
| OD-6.4/6.6–6.12, OD-3.11 (formula statistik, VaRSR, uji) | Methodology | Tidak | **Ya** | formula = metodologi; dilarang dipilih dari hasil (§14) |
| Phase 2H OD-4/OD-5/OD-9 (gate, kriteria, OOS) | Methodology | Tidak | **Ya** | pre-registration — harus sebelum melihat output run |
| Phase 2H OD-11 (errata) | Documentation | Pelaksanaan anotasi teknis = engineer | Acknowledgement = ya | mencatat ≠ menulis ulang |
| Phase 2H OD-12 (presentasi sensitivitas) | Documentation / isi tesis | Tidak | **Ya** | keputusan isi tesis |
| OD-7.2 (command interface) | Engineering | **Ya** (mekanisme `REPORT_SUBDIR`, sintaks) | Penetapan "otoritatif" = ya | mekanis; default menimpa file tracked = disiplin run |
| OD-7.4 (environment lock) | Engineering | **Ya** (format pinning) | Ratifikasi pinning = ya | teknis; drift lintas-env `UNKNOWN` |
| OD-7.5 (config single-source) | Engineering | **Ya** (pindahkan konstanta ke config) | Nilai konstanta = ikut keputusan statistik | lokasi vs nilai terpisah |
| OD-7.7 / OD-7.10 / OD-7.11 (provenance format, ledger retention, artefak stat) | Engineering | **Ya** (format & penyimpanan) | Requirement & "artefak mana yang dikutip" = ya | mekanis + keputusan kutipan |
| OD-7.12 (final evidence-chain freeze) | Gate | Tidak | **Ya** | gerbang akhir |
| ARCH §16 (canonical result) | Methodology + provenance | Tidak | **Ya** | menentukan angka mana yang menjadi klaim tesis |

**Catatan:** di antara 10 keputusan engineering/reproducibility (§1), hanya *format* yang boleh
engineer putuskan; *requirement* (apa yang harus dibekukan, artefak mana yang dikutip,
ledger disimpan atau tidak) tetap di tangan owner.

---

## 6. Duplicate and Merged Decisions

21 ID duplikat dialihkan ke **satu canonical ID**. Historical audit text **tidak dihapus**
(semua dokumen lama tetap utuh — konsolidasi hanya menunjuk). Fusion ditandai
`explicit` (pernyataan eksplisit di sumber) vs `INFERRED` (substansi identik, tanpa
pernyataan eksplisit).

| # | ID duplikat (absorbed) | Canonical ID | Identical? | Bukti fusion |
| --- | --- | --- | --- | --- |
| 1 | P2H OD-1 | ARCH §16 | Ya (pertanyaan sama: pilih A/B/re-run + catat) | `explicit` — Phase 2H:523 "following `ARCHITECTURE.md` §16" |
| 2 | P2H OD-2 | OD-5.3 | Ya (kebijakan gap data) | `explicit` — OD-6:831 "dibawa dari OD-5.3 (+ Phase 2H OD-2)" |
| 3 | P2H OD-3 | OD-6.1 | Ya (satu konstruksi B&H) | `explicit` — OD-6:739 "konsolidasi **Phase 2H OD-3**" |
| 4 | P2H OD-6 | OD-5.5 | Ya (label/periode) | `INFERRED` — substansi identik (label vs jendela sejati) |
| 5 | P2H OD-7 | OD-2.1 | Ya | `explicit` — OD-2:297 "OD-2.1 *is* Phase 2H OD-7" |
| 6 | P2H OD-8 | OD-2.6 | Ya (aturan gap-stop mana yang kanonik) | `INFERRED` — substansi identik (exit-at-open vs close-first) |
| 7 | P2H OD-10 | OD-6.4 (+ facet OD-3.4) | Sebagian — definisi metrik → OD-6.4; item entry-fee → OD-3.4 | `explicit` — OD-6.4 "konsolidasi Phase 2H OD-10"; OD-3.4 "(carries … Phase 2H OD-10)" — **split-merge** |
| 8 | OD-2.5 | OD-3.3 | Ya (same-bar priority) | `explicit` — OD-3.3 "(carries OD-2.5)" |
| 9 | OD-2.7 | OD-3.4 | Ya (cost accounting) | `explicit` — OD-3.4 "(carries OD-2.7/Phase 2H OD-10)" |
| 10 | OD-2.8 | OD-3.1 | Ya (exit fill timing) | `explicit` — OD-3.1 "(carries OD-2.8)" |
| 11 | OD-2.9 | OD-3.2 | Ya (stop trigger semantics) | `explicit` — OD-3.2 "(carries OD-2.9)" |
| 12 | OD-3.9 | OD-4.8 | Ya pada implementasi saat ini (loop order == urutan entry same-day) | `INFERRED` — OD-4.8 tidak menyebut OD-3.9 dan sebaliknya; catatan: bila owner memilih tie-break terpisah dari loop order, keduanya bisa berpisah lagi |
| 13 | OD-3.10 | OD-4.9 | Ya (clamp vs reject) | `INFERRED` — kedua registrasi identik (opsi A/B; 0 historical binds) |
| 14 | OD-4.4 | OD-2.1 + OD-2.3 | Ya (facet sizing dari anchor & ATR timestamp) | `explicit` — "Status: `CARRIED FROM OD-2`" |
| 15 | OD-4.7 | OD-3.8 | Ya (same-day reuse) | `explicit` — "Status: `CARRIED FROM OD-3`" |
| 16 | OD-6.11 | OD-5.3 | Ya (missing bars utk statistik) | `explicit` — "Status `CARRIED FROM OD-5`" |
| 17 | OD-7.1 | ARCH §16 | Ya (snapshot canonical + record keputusan) | `INFERRED` — pertanyaan sama; register OD-7 sendiri cross-ref ARCH §16 |
| 18 | OD-7.3 | OD-5.9 | Ya (retensi ledger = provenance) | `explicit` — "= OD-5.9 (sudah terdaftar)" |
| 19 | OD-7.6 | ARCH §16 | Ya (satu sumber angka) | `explicit` — "= ARCH §16 prosedur" |
| 20 | OD-7.8 | Phase 2H OD-11 | Ya (errata) | `explicit` — "= Phase 2H OD-11 (errata)" |
| 21 | OD-7.9 | OD-4.8 (+ OD-3.9) | Ya (ordering) | `explicit` — "= OD-4.8 (+ OD-3.9)" |

**Bukan duplicate (diperiksa, TIDAK digabung):**
- OD-3.7 (posisi terbuka saat hole) vs OD-5.3 (treatment bar hilang) — objek berbeda
  (posisi vs seri data); digabung hanya sebagai dependensi (OD-3.7 `CONDITIONAL` OD-5.3).
- OD-6.1 (konstruksi) vs OD-6.2 (weighting) vs OD-6.3 (rebalancing) vs OD-6.5 (alignment) —
  atribut yang bisa dinyatakan independen; tetap 4 keputusan, saling bergantung.
- OD-6.1 vs OD-6.4 — definisi pembanding ≠ konvensi Sharpe strategi.
- OD-5.10 (bolehkah B difreeze lebih dulu) vs ARCH §16 (snapshot mana) — pertanyaan berbeda
  (sequencing gate vs pemilihan hasil).
- Phase 2H OD-4 (jujuritas gate) vs OD-5 (kriteria) — restate dokumen ≠ memilih kriteria.
- OD-2.6 (aturan gap) vs OD-3.3 (prioritas stop vs channel) — kejadian berbeda (open gap vs
  same-bar trigger); keduanya tetap terpisah.
- OD-4.9 vs OD-4.6 — shortfall vs rounding.

---

## 7. Decision Dependency Graph

Kelas dependensi wajib: DATA · STRATEGY · PORTFOLIO · BENCHMARK · STATISTICS ·
REPRODUCIBILITY. Arah panah = keputusan di ujung panah baru boleh dijawab setelah yang
di belakangnya selesai (untuk item `CONDITIONAL`; item tanpa panah masuk = paralel).

```text
STRATEGY (semantic entry/stop/exit)         DATA
────────────────────────────────            ────────────────────────────────────
OD-2.1 (anchor stop) ──→ OD-2.2            OD-5.1 (sumber venue)
OD-2.3 (ATR timestamp) ──→ OD-4.3          │      ↓
OD-2.4 (fixed/trailing)                    OD-5.2 (rebuild)
OD-2.6 (gap-through)                       │      ↓
OD-3.1 (exit timing)                       OD-5.3 (gap treatment) ──→ OD-3.7
OD-3.2 (touch vs close)                    OD-5.4 (kalender)        │      ↓
OD-3.3 (same-bar priority)                 │      ↓ (5.3 ∥ 5.4 paralel)
OD-3.4 (fee dalam PnL)                     OD-5.5 (periode)
OD-3.6 (period-end MTM)                    │      ↓
OD-3.8 (reuse same-day)                    OD-5.6 (universe) ──→ OD-5.7 (HYPE)
      │                                     │      ↓
      ↓                                     OD-5.8 (acceptance) ∥ OD-5.9 (manifest)
PORTFOLIO (sizing/alokasi)                  │      ↓
────────────────────────────                OD-5.10 (freeze status) ← juga ARCH §16
OD-4.1 ──→ OD-4.5                             │
OD-4.2 ←──joint──→ OD-4.11                   │
OD-4.6 (rounding)                            │
OD-4.8 (ordering; bawa OD-3.9 + OD-7.9)      │
OD-4.9 (clamp) ∥ OD-4.10 (cap)               │
OD-4.3 ←── OD-2.1 + OD-2.3                   │
      │                                      │
      └──────────────┬───────────────────────┘
                     ↓
BENCHMARK
OD-6.2 (weighting) ∥ OD-6.3 (rebalancing) ∥ OD-6.5 (alignment ← 5.4, 5.5)
                     ↓
OD-6.1 (konstruksi kanonik ← 6.2, 6.3, 6.5, 5.3, 5.7)
                     ↓
STATISTICS
OD-6.4 (konvensi Sharpe)
OD-3.11 (VaRSR implement/amend) ──→ OD-6.6 ──→ OD-6.7
OD-6.8 (t-test) ∥ OD-6.9 (korelasi) ∥ OD-6.10 (regime) ──→ OD-6.12 (multiple testing)
Phase 2H OD-5 (kriteria) ──→ Phase 2H OD-4 (restate gate)
Phase 2H OD-9 (OOS ← 5.2, 5.5)
                     ↓
REPRODUCIBILITY (paralel bebas terhadap keputusan lain)
OD-7.2 (command) ∥ OD-7.4 (env) ∥ OD-7.5 (config single-source) ∥ OD-7.10 (ledger)
Phase 2H OD-11 (errata)
                     ↓
ARCH §16 (canonical result ← rantai metodologi di atas)
   ├──→ OD-7.7 (provenance tabel/figure — butuh output final)
   └──→ OD-7.11 (provenance output statistik ← 6.4..6.12)
                     ↓
OD-7.12 (final evidence-chain freeze ← semua)
                     ↓
            FINAL BASELINE  →  Gate F
```

**Paralel yang sah (bukti: tidak ada silang dependensi):**
- `OD-7.2 ∥ OD-7.4 ∥ OD-7.5 ∥ OD-7.10 ∥ Phase 2H OD-11` — murni artefak, bebas dari
  keputusan metodologi (syarat: selesai sebelum run kanonik).
- `OD-5.3 ∥ OD-5.4` — treatment bar hilang dan definisi kalender keduanya input ke
  OD-5.5/OD-6.8/OD-6.9, tidak saling menunggu (OD-5 §29 butir 4 menaruhnya paralel).
- `OD-6.2 ∥ OD-6.3 ∥ OD-6.5` sebelum OD-6.1 (OD-6 §28 butir 3).
- `OD-4.9 ∥ OD-4.10 ∥ OD-4.6` (tidak punya upstream) — tetap harus selesai sebelum run
  final, tapi bisa dijawab kapan saja di antara fase.
- Jalur STRATEGY+PORTFOLIO vs jalur DATA: **tidak ada dependensi kaku kecuali OD-3.7**
  (menunggu OD-5.3) dan OD-4.3 (menunggu OD-2.1/2.3). Namun tiga sequence yang
  dipublikasikan audit sebelumnya (OD-3 §23, OD-5 §29, OD-6 §28) **merekomendasikan urutan
  serial** `OD-2 → OD-3 → OD-4` **dulu, baru data** — dicatat di sini sebagai batasan
  proses (owner boleh mengizinkan paralel; bukan keputusan yang boleh diambil audit ini).

---

## 8. Critical Path to Thesis Freeze

Urutan minimum yang **diturun dari evidence**, bukan disalin dari contoh:

```text
1. Strategy semantics (BLOCKER: OD-2.1 → OD-2.2; OD-2.3; OD-2.4; OD-2.6)
   OD-3.1 · OD-3.2 · OD-3.3 · OD-3.4 · OD-3.6
        ↓                          [publikasi: OD-3 §23 butir 1]
2. Portfolio/sizing semantics (BLOCKER: OD-4.1 → OD-4.5; OD-4.2 ↔ OD-4.11;
   OD-4.3 (butuh 1+2.3); OD-4.8; [PRE-FREEZE: OD-4.6, OD-4.9, OD-4.10])
        ↓                          [publikasi: OD-5 §29 butir 1, OD-6 §28 butir 1]
3. Data chain (BLOCKER): OD-5.1 → OD-5.2 → { OD-5.3 ∥ OD-5.4 } → OD-5.5
   → OD-5.6 → OD-5.7
        OD-3.7 baru terjawab DI SINI (mengikuti OD-5.3)
        ↓
4. Data acceptance: OD-5.8 (PRE-FREEZE) + OD-5.9 (DOCUMENTATION) + OD-5.10
        ↓                          [publikasi: OD-5 §29 butir 2–7]
5. Benchmark (BLOCKER): { OD-6.2 ∥ OD-6.3 ∥ OD-6.5 } → OD-6.1
        ↓                          [publikasi: OD-6 §28 butir 3]
6. Statistical definitions: OD-6.4 (BLOCKER); OD-3.11 → {OD-6.6 → OD-6.7};
   { OD-6.8 ∥ OD-6.9 ∥ OD-6.10 } → OD-6.12   [semua PRE-FREEZE kecuali 6.4]
        ↓                          [publikasi: OD-6 §28 butir 4–7]
7. Kriteria & desain run (pre-registration SEBELUM melihat output):
   Phase 2H OD-5 (BLOCKER) → Phase 2H OD-4 (PRE-FREEZE); Phase 2H OD-9 (BLOCKER)
        ↓
8. Artefak reproduksi (bisa paralel dari tahap 1): OD-7.2 · OD-7.4 · OD-7.5 ·
   OD-7.10 (DOCUMENTATION) — plus dokumentasi OD-7.7 menyusul output final
        ↓
9. Pilihan canonical: ARCH §16 (BLOCKER — menyeret P2H OD-1 / OD-7.1 / OD-7.6;
   opsi "re-run" baru bermakna setelah 1–8 final)
        ↓
10. Alignment implementasi ke metodologi yang baru dibekukan (perubahan kode HANYA
    setelah freeze — OD-3 §23 butir 4) + dokumentasi alignment (DESIGN:37 vs :64,
    comment config, Phase 2H OD-11 errata)
        ↓
11. Canonical re-run TUNGGAL dengan data terfreeze + command/env terfreeze
    (OD-5 §29 butir 8; OD-6 §28 butir 8) + ledger diretensi (OD-7.10)
        ↓
12. Statistik dihitung sekali dari run itu (OD-6.4, 6.6–6.12, t-test, korelasi, regime)
    → OD-7.11 (artefak statistik mana yang otoritatif)
        ↓
13. Tabel/figure tesis dari artefak itu (OD-7.7) + presentasi sensitivitas
    (Phase 2H OD-12) + gate restatement (Phase 2H OD-4)
        ↓
14. Methodology + evidence-chain freeze (OD-7.12) → BASELINE TERBEKUKAN → Gate F
```

**Catatan penting (bukan rekomendasi opsi):** posisi ARCH §16 di tahap 9 mengikuti bukti
bahwa pilihan "A", "B", atau "re-run" baru bisa dinilai setelah keputusan metodologi
diketahui (P2H OD-1: opsi "re-run after OD-2"; OD-5.10 `CONDITIONAL`). OD-8 **tidak**
memilih di antara opsi tersebut.

---

## 9. Blocker Severity

Klasifikasi per definisi Part F (bukan untuk meminimalkan ketidakpastian metodologis —
item yang nilainya tidak terukur di klasifikasi tetap `BLOCKER`/`PRE-FREEZE` sesuai sifat
keputusannya).

**Ringkasan: 33 BLOCKER · 15 PRE-FREEZE · 8 DOCUMENTATION · 0 OPTIONAL = 56.**

### BLOCKER (33) — harus selesai sebelum final backtest

- **DATA (7):** OD-5.1, OD-5.2, OD-5.3, OD-5.4, OD-5.5, OD-5.6, OD-5.7
  → mengubah dataset mentah / hari sinyal / semua turunan angka.
- **STRATEGY (12):** OD-2.1, OD-2.2, OD-2.3, OD-2.4, OD-2.6, OD-3.1, OD-3.2, OD-3.3,
  OD-3.4, OD-3.6, OD-3.7, OD-3.8
  → mengubah stop/fill/size/PnL/equity — setiap butir menyeret re-run.
- **PORTFOLIO (6):** OD-4.1, OD-4.2, OD-4.3, OD-4.5, OD-4.8, OD-4.11
  → mengubah posisi size atau urutan entry (OD-4.8: spread 10.51pp pada data yang sama).
- **BENCHMARK (4):** OD-6.1, OD-6.2, OD-6.3, OD-6.5
  → kolom B&H, Sharpe pembanding, verdict gate, dan sampel t-test ikut di artefak run
  (`compute_metrics` memproduksinya bersama metrik lain).
- **STATISTICS (3):** OD-6.4 (konvensi Sharpe di dalam runner), Phase 2H OD-5 (kriteria
  harus pre-registered sebelum melihat output run — bukti: revisi post-hoc AR-05),
  Phase 2H OD-9 (postur OOS menentukan desain run & pembagian data).
- **REPRO/CANONICAL (1):** ARCH §16 (pilihan "re-run" menghasilkan angka run final; pilihan
  A/B menentukan artefak mana yang dikutip).

### PRE-FREEZE (15) — harus selesai sebelum methodology freeze; tidak mempengaruhi eksplorasi

- DATA (2): OD-5.8 (acceptance), OD-5.10 (freeze status).
- PORTFOLIO (3): OD-4.6 (rounding — delta 8.67e-08 unit, nyaris nol pada presisi laporan),
  OD-4.9 (0 clamp historis, identik konstruktif), OD-4.10 (cap 5 tidak pernah bind).
- STATISTICS (8): OD-3.11, OD-6.6, OD-6.7, OD-6.8, OD-6.9, OD-6.10, OD-6.12, Phase 2H OD-4.
- REPRO (2): OD-7.11, OD-7.12.

### DOCUMENTATION (8) — tidak mempengaruhi metodologi/angka; wajib untuk reproducibility

- OD-5.9 (manifest/checksum), OD-7.2 (command), OD-7.4 (env lock), OD-7.5 (config
  single-source), OD-7.7 (provenance tabel/figure), OD-7.10 (retensi ledger),
  Phase 2H OD-11 (errata), Phase 2H OD-12 (presentasi sensitivitas).

### OPTIONAL (0)

Tidak ada keputusan unresolved yang bersifat opsional terhadap baseline — setidak-tidaknya
semua 56 butir menyentuh metodologi, gate, atau syarat reproducibility freeze. (Mengosongkan
kategori ini ≠ meminimalkan ketidakpastian: 15 item PRE-FREEZE dan 8 DOCUMENTATION tetap
wajib selesai sebelum freeze, hanya tidak menunda eksplorasi.)

---

## 10. Numerical Impact Matrix

Legenda: `DIRECT` = mengubah nilai langsung · `INDIRECT` = mengubah nilai lewat rantai ·
`NONE` = tidak mengubah nilai (pada data historis yang terpasang) · `UNKNOWN` = efek belum
terukur. Sensitivitas forensic dikutip sebagai **`FORENSIC SENSITIVITY — NOT CANONICAL`** —
bukan hasil tesis, bukan dasar memilih opsi.

### 10.1 Cluster DATA

| Decision | Raw dataset | Signal dates | Exec price | Stop | Position size | Trade PnL | Equity curve | Return | Sharpe | MDD | B&H | t-test | Corr | Regime | Thesis conclusion | Sensitivitas / catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OD-5.1 | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | ganti venue = seluruh seri berbeda; verifikasi eksternal `UNKNOWN` (ISP hijack) |
| OD-5.2 | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | refetch vs CSV worktree; raw ts sudah di-drop |
| OD-5.3 | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | DIRECT | ffill: DD −26.45→−18.08, Sharpe 0.82→1.10, B&H Sharpe 0.98→0.8787 — `FORENSIC SENSITIVITY — NOT CANONICAL` |
| OD-5.4 | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | 2.120 hari-nol menentukan window uji/korelasi |
| OD-5.5 | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | jendela aktual 2020-11-09..2026-09-02 (5.81y) vs label "6 tahun" |
| OD-5.6 | DIRECT | DIRECT | DIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | DIRECT | kriteria seleksi tak pernah ada (PPT:294); 3 koin ditolak pasca-hasil |
| OD-5.7 | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | DIRECT | INDIRECT | DIRECT | INDIRECT | INDIRECT | HYPE absen 1.500 hari; sleeve vs scalar B&H |
| OD-5.8 | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | gate T01–T12 menentukan dataset "sah", bukan mengubah nilainya |
| OD-5.9 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | provenance murni (`NOT IMPLEMENTED` saat ini) |
| OD-5.10 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | menentukan ANGKA mana yang diklaim (152.00 vs hasil lain), bukan nilainya |

### 10.2 Cluster STRATEGY

| Decision | Raw dataset | Signal dates | Exec price | Stop | Position size | Trade PnL | Equity curve | Return | Sharpe | MDD | B&H | t-test | Corr | Regime | Thesis conclusion | Sensitivitas / catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OD-2.1 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | materialitas anchor ≤1.6% stop-distance, size median +0.47%, ≤1.5pp return (OD-2) |
| OD-2.2 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | hanya bila OD-2.1 = entry-anchored; ≤1.6% |
| OD-2.3 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | NONE | INDIRECT | NONE | NONE | DIRECT | +152.0% → +158–159%, DD −26.45→−27.7% — `FORENSIC SENSITIVITY — NOT CANONICAL` |
| OD-2.4 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | fixed (kode) vs "dinamis"/trailing (PPT/PLAN:35) |
| OD-2.6 | NONE | INDIRECT | INDIRECT | DIRECT | NONE | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | NONE | NONE | INDIRECT | gap_stop 0/94; 2 exit CASE2: −2.73%/−8.80% di bawah aturan dokumen |
| OD-3.1 | NONE | NONE | DIRECT | DIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | DIRECT | "exit timing forces every exit price to move" |
| OD-3.2 | NONE | NONE | DIRECT | DIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | DIRECT | 29/2.236 intraday touch diabaikan saat ini |
| OD-3.3 | NONE | NONE | INDIRECT | DIRECT | NONE | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | 2/30 stop exit = CASE2 |
| OD-3.4 | NONE | NONE | NONE | NONE | NONE | DIRECT | NONE | NONE | NONE | NONE | NONE | DIRECT | NONE | NONE | INDIRECT | avgR 1.0334→1.0233; PF 2.2669→2.2342 (fee di trade PnL) |
| OD-3.6 | NONE | NONE | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | DIRECT | MTM akhir menyuntik 23.53pp unrealized ke headline |
| OD-3.7 | INDIRECT | INDIRECT | INDIRECT | DIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | DIRECT | carry/zero-MTM vs ffill: 0.82→1.10 & −26.45→−18.08 — `FORENSIC SENSITIVITY — NOT CANONICAL`; DD trough = artefak day 2023-01-22 |
| OD-3.8 | NONE | DIRECT | INDIRECT | NONE | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | Case I; 498 hari terblokir cluster |

### 10.3 Cluster PORTFOLIO

| Decision | Raw dataset | Signal dates | Exec price | Stop | Position size | Trade PnL | Equity curve | Return | Sharpe | MDD | B&H | t-test | Corr | Regime | Thesis conclusion | Sensitivitas / catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OD-4.1 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | definisi "1%" (gross/net, fill/close) belum ditetapkan PPT |
| OD-4.2 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | prev-day 94/94 vs same-day 0/94 |
| OD-4.3 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | INDIRECT | units −0.19%..−1.32% (median −0.46%) |
| OD-4.5 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | NONE | INDIRECT | Case M +0.0159pp |
| OD-4.6 | NONE | NONE | NONE | INDIRECT | NONE | INDIRECT | INDIRECT | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | delta 8.67e-08 unit (nyaris nol); lot/step `NOT IMPLEMENTED` |
| OD-4.8 | DIRECT | INDIRECT | INDIRECT | NONE | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | NONE | DIRECT | 152.00 / 159.17 / 162.51 (spread 10.51pp), trades 94/93/92 — `FORENSIC SENSITIVITY — NOT CANONICAL` |
| OD-4.9 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | 0 clamp historis; reject-variant identik konstruktif pada data ini |
| OD-4.10 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | cap 5 tidak pernah bind; max nyata 3 |
| OD-4.11 | NONE | NONE | NONE | DIRECT | DIRECT | DIRECT | DIRECT | INDIRECT | INDIRECT | NONE | INDIRECT | NONE | NONE | NONE | INDIRECT | basis equity vs cash (Case F: 1008.29 vs 664.73) |

### 10.4 Cluster BENCHMARK

| Decision | Raw dataset | Signal dates | Exec price | Stop | Position size | Trade PnL | Equity curve | Return | Sharpe | MDD | B&H | t-test | Corr | Regime | Thesis conclusion | Sensitivitas / catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OD-6.1 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | NONE | NONE | DIRECT | ≥7 konstruksi; gate flip 0.82<0.98 vs 1.04>0.88; return-gate gagal di semua konstruksi — `FORENSIC SENSITIVITY — NOT CANONICAL` |
| OD-6.2 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | NONE | NONE | DIRECT | B&H 155.03 vs 767 / 570.78 / 401 / 418 / 154.85 tergantung weighting — `FORENSIC SENSITIVITY — NOT CANONICAL` |
| OD-6.3 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | NONE | NONE | DIRECT | rebalance-on-listing vs tanpa rebalancing |
| OD-6.5 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | NONE | NONE | DIRECT | date-set benchmark mengikuti OD-5.4/OD-5.5 |

### 10.5 Cluster STATISTICS

| Decision | Raw dataset | Signal dates | Exec price | Stop | Position size | Trade PnL | Equity curve | Return | Sharpe | MDD | B&H | t-test | Corr | Regime | Thesis conclusion | Sensitivitas / catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OD-3.11 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | VaRSR dijanjikan PPT, `NOT IMPLEMENTED` — memengkapi RQ2/RQ3 |
| OD-6.4 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | NONE | NONE | INDIRECT | NONE | NONE | DIRECT | rf=0, √365, ddof, hari-nol 35.9% — nilai dihasilkan di dalam runner |
| OD-6.6 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | formula VaRSR (CVD/DLV, edge correction) |
| OD-6.7 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | confidence & horizon tidak disebut PPT |
| OD-6.8 | INDIRECT | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | NONE | NONE | DIRECT | p=0.0743/0.0193 vs cash-day 0.0430/0.0391 — `FORENSIC SENSITIVITY — NOT CANONICAL` |
| OD-6.9 | INDIRECT | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | NONE | DIRECT | 615 vs 2.120 observasi mengubah matriks korelasi |
| OD-6.10 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | DIRECT | threshold regime pernah diubah post-hoc 0.50→0.33/0.66 |
| OD-6.12 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | INDIRECT | INDIRECT | DIRECT | koreksi multipel uji menurunkan/menaikkan signifikansi |
| Phase 2H OD-4 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | restate gate "terpenuhi" vs aritmetika (TASKS:18/PLAN:211) — tidak mengubah angka |
| Phase 2H OD-5 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | kriteria menentukan verdict lulus/tidak, bukan nilai; revisi post-hoc = AR-05 |
| Phase 2H OD-9 | DIRECT | DIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | INDIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | DIRECT | holdout/walk-forward mengubah cakupan run yang dilaporkan; zero OOS saat ini |

### 10.6 Cluster REPRODUCIBILITY

| Decision | Raw dataset | Signal dates | Exec price | Stop | Position size | Trade PnL | Equity curve | Return | Sharpe | MDD | B&H | t-test | Corr | Regime | Thesis conclusion | Sensitivitas / catatan |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OD-7.2 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | pilihan command tidak mengubah nilai bila deterministik; default menimpa `metrics.md` tracked |
| OD-7.4 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | byte-identik di env ini (`VERIFIED`); drift lintas-env karena pinning kosong = `UNKNOWN` |
| OD-7.5 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | memindahkan konstanta ke config tidak mengubah nilainya |
| OD-7.7 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | provenance tabel/figure; 4 report `NOT TRACEABLE` |
| OD-7.10 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | retensi ledger; ledger B `PROVENANCE UNKNOWN` |
| OD-7.11 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | menentukan artefak statistik mana yang dikutip tesis |
| OD-7.12 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | gerbang freeze akhir |
| OD-5.9 | (lihat §10.1 — manifest) | | | | | | | | | | | | | | | | |
| Phase 2H OD-11 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | errata label/miskonklusi; tidak mengubah angka |
| Phase 2H OD-12 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | INDIRECT | menentukan apakah tabel sensitivitas muncul di tesis |
| ARCH §16 | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | NONE | DIRECT | memilih artefak mana yang menjadi klaim; bila opsi re-run dipilih, nilai BARU berasal dari keputusan metodologi §10.1–10.5, bukan dari keputusan canonical itu sendiri |

---

## 11. Consolidated Owner Decision Register

56 keputusan unresolved. **Opsi dinyatakan netral — tanpa rekomendasi, tanpa peringkat,
tanpa skor, tanpa indikasi opsi mana yang lebih baik.** "Apa yang mengubah keputusan" =
bukti yang relevan bila muncul — bukan dorongan ke arah opsi tertentu.

### 11.1 DATA (9)

| ID | Pertanyaan keputusan | Mengapa penting | Output terdampak | Dependensi | Opsi terdokumentasi | Apa yang mengubah keputusan |
| --- | --- | --- | --- | --- | --- | --- |
| OD-5.1 | Sumber data primer: tetap Bitget spot atau sumber lain? | menentukan seluruh dataset tesis | semua angka | — | OD-5 §17 (venue saat ini vs alternatif; PPT:181 menyebut Bitget) | bukti kelayakan venue (refetch berhasil/gagal; verifikasi eksternal — saat ini `UNKNOWN` karena blokir DNS) |
| OD-5.2 | Fetch ulang (rebuild A–D) atau pertahankan 10 CSV worktree? | mentah vs hasil kerja tersimpan; raw ts sudah di-drop | dataset, semua angka | OD-5.1 | OD-5 §18–19 (opsi rebuild) | hasil uji refetch (bila diizinkan) + kesesuaian dengan OD-5.8 |
| OD-5.3 | Treatment 1.635 missing bar + 4 hari all-absent (refetch / eksklusi / halt / forward-fill / leave-as-is + keterbatasan)? | mengubah DD/Sharpe/B&H sekaligus; **dilarang memilih dari angka** | dataset, DD, Sharpe, t-test, korelasi | — | OD-5 §10, Phase 2H OD-2, OD-6.11 (daftar opsi + konsekuensi masing-masing) | ketersediaan refetch dari venue; alasan metodologis (bukan angka hasil) |
| OD-5.4 | Definisi kalender: boundary UTC, hari tanpa bar di 7 hari/minggu, status hari all-absent? | menentukan window uji & korelasi (2.120 hari-nol) | hari-nol, t-test, korelasi | — | OD-5 §7–8, §14 | — (keputusan definisi murni; bukti kalender sudah lengkap) |
| OD-5.5 | Periode studi final: koreksi label ke jendela aktual, atau ganti periode (re-fetch/lookback berbeda)? | label "6 tahun" vs data 5.81y; menentukan jendela semua analisis | periode semua metrik, korelasi, regime | — | OD-5 §18; Phase 2H OD-6 | keputusan OD-5.1/5.2 bila memilih ganti periode via data baru |
| OD-5.6 | Kriteria seleksi universe & kontrol survivorship (PPT:294 tak pernah dijawab)? | mencegah tuduhan survivorship/selection bias | universe, semua angka | — | OD-5 §20; PPT:181 (daftar), PPT:294 (pertanyaan terbuka) | jawaban dosen/pembimbing atas kriteria seleksi |
| OD-5.7 | HYPE (staggered, absen 1.500 hari): shared calendar vs window sendiri + konsekuensi benchmark? | menentukan jendela korelasi & bentuk B&H | HYPE signals, sleeve B&H, korelasi | OD-5.3, OD-5.5 | OD-5 §16, §19; Phase 2H F2 (dirujuk) | konsistensi dengan keputusan OD-5.3/5.5 |
| OD-5.8 | Sahkan T01–T12 (+ kandidat T13/T14) sebagai gate acceptance dataset? | menentukan dataset mana yang layak difreeze | gate freeze | OD-5.2 | OD-5 §24 (T01–T12 + kandidat) | evaluasi hasil rebuild terhadap T-criteria |
| OD-5.10 | Bolehkah Snapshot B difreeze sebelum OD-5.1–5.9 selesai? | menentukan apakah baseline data sudah sah vs menunggu | status freeze baseline | OD-5.1..5.9 + ARCH §16 | OD-5 §27 (dan sequence OD-5 §29) | selesainya OD-5.1..5.9 + keputusan ARCH §16 |

### 11.2 STRATEGY (12)

| ID | Pertanyaan keputusan | Mengapa penting | Output terdampak | Dependensi | Opsi terdokumentasi | Apa yang mengubah keputusan |
| --- | --- | --- | --- | --- | --- | --- |
| OD-2.1 | Formula stop of record: `Entry−2×ATR(14)` (PPT) atau anchor yang diimplementasikan (`signal_close−2×prevATR`)? | konflik dokumen-vs-kode; menyeret re-run penuh | stop, size, PnL, equity | — | OD-2 §16 (adopsi PPT L1 + implikasi perubahan kode, vs deskripsi kode saat ini) | — (pertanyaan metodologi murni; materialitas historis sudah diukur ≤1.6%/≤1.5pp) |
| OD-2.2 | Kalau entry-anchored: "Entry" = open mentah atau open×(1+slippage)? | menentukan jarak stop & size | stop, size | OD-2.1 (hanya bila entry-anchored) | OD-2 §16 | selesainya OD-2.1 |
| OD-2.3 | ATR timestamp: signal-day (kode), day-before-signal, atau definisi lain (batas kausalitas: hanya info ≤ hari sinyal)? | materialitas BESAR pada return/DD | stop, size, equity, DD | — | OD-2 §16 (daftar varian + terikat kausalitas) | — (alasan metodologis, BUKAN angka variant +158–159%) |
| OD-2.4 | Stop fixed saat entry atau dynamic/trailing? | PPT "Stop loss dinamis" vs kode fixed vs PLAN:35 trailing | stop path, exit dates | — | OD-2 §16 | — (pertanyaan definisi) |
| OD-2.6 | Saat open gap di bawah stop: exit-at-open (dokumen), close-confirmed (kode), atau aturan lain? | aturan dokumen tak terjangkau saat ini | exit price, PnL | — | OD-2 §16 (termasuk precondition gap_open<entry) | — (pilihan aturan; angka 2 exit CASE2 hanya mengukur materialitas) |
| OD-3.1 | Exit fill timing: same-day close (kode) atau eksekusi mengikuti sinyal (PPT umumnya "signal after close → execute")? | setiap exit price bergerak | exit price, PnL, equity | — | OD-3 §22 (opsi + konsekuensi) | — |
| OD-3.2 | Stop trigger: "menyentuh stop loss" (touch) vs close-confirmation? | 29/2.236 intraday touch diabaikan; menentukan isi exit | exit dates, PnL | — | OD-3 §22 (opsi + dampak historis) | — |
| OD-3.3 | Same-bar priority (stop vs channel exit) saat keduanya trigger? | 2/30 stop exit CASE2; menentukan label exit | exit price, exit reason | OD-2.6 (aturan gap terkait), OD-3.2 | OD-3 §22 + OD-2 §16 (OD-2.5) | — |
| OD-3.4 | Apakah entry fee dihitung dalam trade PnL (avgR/PF) + cost treatment pada eksekusi stop? | mengubah statistik trade yang dikutip tesis | avgR, PF, t-test berbasis R | OD-2.7 (dibawa), P2H OD-10 (facet) | OD-3 §22 (opsi A/B/C) + OD-2 §16 | — |
| OD-3.6 | Posisi terbuka akhir periode: MTM di close terakhir (kode), forced close, atau lapor keduanya? | MTM menyuntik 23.53pp unrealized ke headline | return akhir, equity curve | OD-5.5 (akhir periode) | OD-3 §22 (opsi A/B/C) | selesainya OD-5.5 (titik "akhir" menentukan jumlah unrealized) |
| OD-3.7 | Posisi terbuka saat hole data: carry+zero-MTM (kode), forward-fill MTM, atau rebuild dulu? + evaluasi stop selama hole? | DD/Sharpe bergerak besar; DD trough = hari artefak | DD, Sharpe, stop enforcement | OD-5.3 | OD-3 §22 (opsi A/B/C — C eksplisit menunggu data) | selesainya OD-5.3 |
| OD-3.8 | Same-day capacity reuse setelah exit (kode: simbol yang sama tak bisa re-entry; simbol lain tergantung urutan loop)? | menentukan siapa yang dapat slot | entries, size | — | OD-3 §22 (opsi A/B) | — |

### 11.3 PORTFOLIO (9)

| ID | Pertanyaan keputusan | Mengapa penting | Output terdampak | Dependensi | Opsi terdokumentasi | Apa yang mengubah keputusan |
| --- | --- | --- | --- | --- | --- | --- |
| OD-4.1 | Peristiwa kerugian mana yang dianggap "budget 1%" (gross stop-distance, net all-in, atau realized PnL)? | dasar semua sizing | size, PnL, equity | — | OD-4 §25 (opsi A/B/C) | — |
| OD-4.2 | Equity snapshot mana yang mensize posisi berikutnya (prev-curve-day, same-day, initial, prev-cash)? | 94/94 memakai prev-day; menentukan pertumbuhan size | size, equity | OD-4.1? (pertanyaan terpisah; joint OD-4.11) | OD-4 §25 (opsi A/B/C/D) | — |
| OD-4.3 | Harga anchor stop distance sizing (slipped next-open, open mentah, signal-close)? | units −0.19%..−1.32% | size, PnL | OD-2.1 + OD-2.3 | OD-4 §25 (opsi A/B/C) | selesainya OD-2.1/OD-2.3 |
| OD-4.5 | Apakah fee/slippage masuk ke dalam budget 1%? | definisi net vs gross | size | OD-4.1 | OD-4 §25 (opsi A/B/C) | selesainya OD-4.1 |
| OD-4.6 | Pembulatan qty: raw float (kode), round-down ke lot/step, atau fixed decimal? | kelayakan live vs simulasi internal | size (presisi) | — | OD-4 §25 (opsi A/B/C) | data lot/step/min-qty exchange (`NOT IMPLEMENTED`) |
| OD-4.8 | Urutan iterasi multi-asset = urutan entry same-day: config-order (kode), priority rule eksplisit, atau seeded random? | spread 10.51pp pada data yang sama; dokumen reproducibility | entries, size, semua angka | — | OD-4 §25 (opsi A/B/C) + OD-3 §22 (OD-3.9) | — (dilarang memilih dari return — §14) |
| OD-4.9 | Cash-shortfall: clamp partial (kode), reject, atau clamp + minimum notional? | 0 bind historis; keputusan definisional | size (pada data lain) | — | OD-4 §25 (opsi A/B/C) + OD-3 §22 (OD-3.10) | data exchange minimum-notional (untuk opsi C) |
| OD-4.10 | Portfolio aggregate risk cap & concentration rule (global cap 5 vs alternatif)? | cap tidak pernah bind; definisional | size (pada desain lain) | — | OD-4 §25 | — |
| OD-4.11 | Apakah unrealized PnL masuk ke sizing basis? | basis vs cash (Case F 1008.29 vs 664.73) | size | OD-4.2 (joint) | OD-4 §25 | selesainya OD-4.2 |

### 11.4 BENCHMARK (4)

| ID | Pertanyaan keputusan | Mengapa penting | Output terdampak | Dependensi | Opsi terdokumentasi | Apa yang mengubah keputusan |
| --- | --- | --- | --- | --- | --- | --- |
| OD-6.1 | Konstruksi B&H kanonik SATU untuk Sharpe/t-test/gate? | ≥7 konstruksi; verdict gate berubah | B&H, gate, t-test | OD-5.3, OD-5.7, OD-6.2, OD-6.3, OD-6.5 | OD-6 §24 (#1–#6) + Phase 2H OD-3 | selesainya dependensi + alasan metodologis (BUKAN agar gate lulus) |
| OD-6.2 | Weighting benchmark: 100/pair idle-cash, equal-weight awal, atau fully-deployed? | B&H 155.03 vs 767/570.78/401/418/154.85 | B&H return/Sharpe/MDD | — | OD-6 §5 (B1/B2), §6, §8 | — |
| OD-6.3 | Rebalancing: tanpa, rebalance-on-listing, periodik? | memengaruhi B&H | B&H | — | OD-6 §24 | — |
| OD-6.5 | Date alignment benchmark (window, first/last bar, listing)? | menentukan sampel pembanding & t-test | B&H, t-test | OD-5.4, OD-5.5 | OD-6 §28 butir 3 | selesainya OD-5.4/OD-5.5 |

### 11.5 STATISTICS (11)

| ID | Pertanyaan keputusan | Mengapa penting | Output terdampak | Dependensi | Opsi terdokumentasi | Apa yang mengubah keputusan |
| --- | --- | --- | --- | --- | --- | --- |
| OD-6.4 | Konvensi Sharpe: rf (0 vs RF), annualization (√365 vs lain), ddof, perlakuan hari-nol? | dihasilkan di dalam runner → ikut run final | Sharpe, verdict gate | facet hari-nol → OD-5.3 | OD-6 §11 (konvensi), Phase 2H OD-10 | selesainya OD-5.3 (facet hari-nol) |
| OD-3.11 | VaRSR: implement sesuai PPT atau amend RQ2/RQ3 dengan rationale? | PPT menjanjikan; `NOT IMPLEMENTED` | kelengkapan RQ | — | OD-3 §22 (opsi implement vs amend) | — |
| OD-6.6 | Formula VaRSR (CVD/DLV, edge correction)? | menentukan angka VaRSR | VaRSR | OD-3.11 (pilih implementasi), OD-6.4 | OD-6 §14 | selesainya OD-3.11 |
| OD-6.7 | Parameter VaRSR: confidence level & horizon? | PPT tidak menyebut | VaRSR | OD-6.6 | OD-6 §14 | selesainya OD-6.6 |
| OD-6.8 | t-test: cash-day correction & policy terkait? | p=0.0743/0.0193 vs 0.0430/0.0391 | p-value | OD-5.3, OD-5.4, OD-6.12 | OD-6 §16 (opsi koreksi) | selesainya OD-5.3/5.4 (BUKAN nilai p yang diinginkan) |
| OD-6.9 | Korelasi: window, detrend, pairwise vs listwise, Pearson vs Spearman? | 615 vs 2.120 observasi mengubah matriks | korelasi, klaim diversifikasi | OD-5.5, OD-5.7 | OD-6 §18 | selesainya OD-5.5/5.7 |
| OD-6.10 | Regime: threshold pre-registered vs post-hoc, segmen data, multiple-testing? | threshold pernah diubah post-hoc | hasil regime | OD-5.5 | OD-6 §20 | selesainya OD-5.5 |
| OD-6.12 | Multiple-testing policy untuk himpunan uji final? | mengkoreksi p-value | semua p | OD-6.6/6.8/6.9/6.10 | OD-6 §22 | selesainya daftar uji final |
| Phase 2H OD-5 | Kriteria: pertahankan "> B&H (revised)", restore "≥1.0", atau kriteria baru — sebelum melihat output re-run? | pre-registration; pernah direvisi post-hoc | verdict gate tesis | OD-6.1 (untuk opsi relatif-B&H) | Phase 2H §28 butir 5 | selesainya OD-6.1; harus dijawab SEBELUM run final |
| Phase 2H OD-4 | Gate honesty: restate "not met, waived (−0.16)" atau re-run ke kriteria pre-registered; perbaiki TASKS:18/PLAN:211/preset? | klaim gate vs aritmetika | dokumen klaim | OD-6.1, Phase 2H OD-5 | Phase 2H §28 butir 4 | selesainya OD-6.1 + Phase 2H OD-5 |
| Phase 2H OD-9 | OOS: walk-forward/holdout atau "in-sample only + keterbatasan disampaikan"? | menentukan desain run & pembagian data | cakupan run, semua statistik | OD-5.2, OD-5.5 | Phase 2H §28 butir 6 | selesainya OD-5.2/5.5 |

### 11.6 REPRODUCIBILITY / CANONICAL (10)

| ID | Pertanyaan keputusan | Mengapa penting | Output terdampak | Dependensi | Opsi terdokumentasi | Apa yang mengubah keputusan |
| --- | --- | --- | --- | --- | --- | --- |
| ARCH §16 | Snapshot A, B, atau re-run kanonik sebagai hasil tesis (satu sumber, tulis ulang semua kutipan, catat keputusan)? | menentukan ANGKA mana yang jadi klaim tesis | seluruh kutipan hasil | rantai metodologi (OD-2→OD-6) | ARCH §16 (prosedur), Phase 2H OD-1 (A/B/re-run), OD-7 §28 (OD-7.1) | selesainya keputusan metodologi — baru opsi "re-run" bisa dinilai |
| OD-7.2 | Command of record otoritatif (mana yang menghasilkan artefak resmi; default menimpa `metrics.md`)? | reproduksi run final | disiplin run | — | OD-7 §28 (mekanisme `REPORT_SUBDIR`, `cli.py`) | — |
| OD-7.4 | Environment freeze: pin versi atau tidak? | drift lintas-env `UNKNOWN` | nilai lintas mesin | — | OD-7 §28 (`requirements.txt`) | — |
| OD-7.5 | Config single-source: konstanta statistik dipindah ke config? | lokasi definisi tunggal | konsistensi dokumentasi | nilai konstatanya mengikuti keputusan statistik | OD-7 §28 + ARCH §16 baris 1 | selesainya keputusan nilai (§11.5) |
| OD-7.7 | Provenance requirement per tabel/figure tesis (generator, input, config, commit)? | 4 report `NOT TRACEABLE` | tabel/figure tesis | ARCH §16, output final | OD-7 §28 | — |
| OD-7.10 | Retensi ledger (raw run output disimpan/di-commit/di-gitignore)? | ledger Snapshot B `PROVENANCE UNKNOWN` | reproduksi hasil | — | OD-7 §28 (`.gitignore` policy) | — |
| OD-7.11 | Artefak statistik mana yang otoritatif saat beberapa file menyebut angka berbeda? | mencegah campur angka stat | kutipan statistik | OD-6.4..6.12 | OD-7 §28 (cross-ref OD-6.1/6.8/6.12) | selesainya stat pipeline |
| OD-7.12 | Final evidence-chain freeze checklist (kapan seluruh rantai dinyatakan beku)? | gerbang akhir sebelum Gate F | status freeze | semua OD | OD-7 §28 (urutan eksplisit) | selesainya semua keputusan lain |
| Phase 2H OD-11 | Errata untuk kesalahan record (`decision_log:24,99,120`, "B&H −58.49", 5-vs-10-pair) — annotate, tanpa rewrite diam-diam? | kejujuran record | dokumen keputusan | — | Phase 2H §28 butir 11 | — |
| Phase 2H OD-12 | Apakah tabel sensitivitas forward-fill muncul di tesis (sebagai robustness, bukan headline)? | isi tesis | presentasi hasil | ARCH §16 | Phase 2H §28 butir 12 | — |

---

## 12. Already Decided Register

Hanya keputusan dengan **bukti eksplisit** — tidak menyimpulkan keputusan dari implementasi
satu-satuan (aturan Part I).

| # | Keputusan | Bukti (source precedence) | Catatan |
| --- | --- | --- | --- |
| 1 | Arah strategi: **long-only** | PPT (approved) | tidak ada opsi short di sumber mana pun |
| 2 | Timeframe: **1D candle harian** | PPT + OD-2 §17a "Timeframe `VERIFIED`" | — |
| 3 | Identitas strategi: **Donchian 20/10 + ATR(14)×2, trend-following** | judul & tabel PPT | nama/periode channel & kelipatan ATR = PPT |
| 4 | Entry rule: close menembus highest high **20 hari sebelum hari sinyal** (strict `>`, `shift(1)`) | PPT + OD-2 finding 1 (`VERIFIED`, 94/94) | — |
| 5 | Execution: **Open hari berikutnya × (1 + 0.05% slippage)** | PPT + OD-2 finding 1 (`VERIFIED`, 94/94) | — |
| 6 | Exit channel: close < lowest low **10 hari sebelumnya** | PPT | semantik fill (OD-3.1/3.2) tetap terbuka |
| 7 | Stop **ada** dengan faktor **2×ATR(14)** | PPT/PLAN:34/DESIGN:37/config:20 | **anchor & timestamp TIDAK decided** (OD-2.1/2.3) |
| 8 | Risk per posisi: **maksimum 1% equity** | PPT | definisi basis 1% terbuka (OD-4.1/4.2) |
| 9 | Cluster limit: **maksimum 2 per cluster** | PPT | global cap 5 = implementasi (OD-4.10 terbuka) |
| 10 | Biaya: **fee 0.1% (taker) + slippage 0.05% per eksekusi** | PPT | OD-3.5 `DECIDED` (rate/placement `VERIFIED`); cost treatment stat tetap OD-3.4 |
| 11 | Universe: **10 cryptocurrency: BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA, HYPE** | **PPT:181** | *anggota* decided; *kriteria seleksi* TIDAK (OD-5.6) |
| 12 | Sumber data primer: **Bitget** (spot) | PPT:181 | OD-5.1 hanya membuka ulang bila kelayakan venue gagal (saat ini `UNKNOWN`) |
| 13 | Pembanding tesis = **buy-and-hold** (konsep) | PPT (RQ/pertanyaan pembanding) | *konstruksi* TIDAK decided (OD-6.1–6.3, 6.5) |
| 14 | **Penarikan kriteria Sharpe ≥1.0** (owner, current conversation) | OD-2 §4 L2: "Sharpe ≥ 1 withdrawn as criterion (owner, current conversation)" | *penggantinya* terbuka = Phase 2H OD-5 |
| 15 | Research objectives RQ1–3 | PPT | — |
| 16 | Janji VaRSR di tesis (sebagai kewajiban) | PPT | *implement vs amend* terbuka = OD-3.11 |
| 17 | Aturan risk repo: stop-loss wajib, tidak ada martingale/averaging-down, tidak ada auto-increase risk streak | `PLAN.md` §5 / AGENTS.md (owner-authored) | governance tetap berlaku untuk semua opsi di register ini |
| 18 | Kebijakan audit: audit TIDAK memilih hasil/benchmark/snapshot; riset lama ditahan (`UNKNOWN ≠ DEAD`); tanpa commit/push; satu file baru | mandate owner (pembukaan OD-7/OD-8) | proses, bukan metodologi |
| 19 | Sejarah kriteria terekam: 2026-08-14 gate "LOLOS" berbasis Sharpe ≥1.0 → revisi 2026-09-05 "> B&H" | `decision_log.md` (fakta sejarah, `VERIFIED`) | *status legitimasi & kriteria lanjutan* = Phase 2H OD-5 |

**Tidak dimasukkan ke register ini:** keputusan yang hanya terlihat dari implementasi
(mis. urutan dict config, close-confirmation di kode, MTM akhir periode) — semuanya tetap
terbuka di §11 meski kode sudah memilih satu nilai.

---

## 13. Conditional Decision Register

19 keputusan `CONDITIONAL` — wajib menunggu inputnya. (Semua tetap keputusan owner; label
`CONDITIONAL` menandai bahwa jawabannya belum bisa dibuat sekarang.)

| # | Keputusan | Bergantung pada | Mengapa conditional |
| --- | --- | --- | --- |
| 1 | OD-2.2 (Entry mana) | OD-2.1 | hanya relevan bila OD-2.1 memilih entry-anchored |
| 2 | OD-3.7 (posisi saat hole) | OD-5.3 | opsi C eksplisit "data rebuild/fill decided first"; treatment gap menentukan bentuk keputusan |
| 3 | OD-4.5 (fee di budget) | OD-4.1 | definisi "peristiwa kerugian" lebih dulu menentukan apakah fee termasuk |
| 4 | OD-4.11 (unrealized di basis) | OD-4.2 | status eksplisit "Decide jointly with OD-4.2" |
| 5 | OD-5.10 (freeze B sekarang?) | OD-5.1..5.9 + ARCH §16 | menanyakan sisa sequence freeze |
| 6 | OD-6.1 (konstruksi B&H) | OD-5.3, OD-5.7, OD-6.2, OD-6.3, OD-6.5 | konstruksi = kombinasi atribut yang belum dipilih |
| 7 | OD-6.5 (date alignment) | OD-5.4, OD-5.5 | window benchmark mengikuti kalender & periode final |
| 8 | OD-6.6 (formula VaRSR) | OD-3.11, OD-6.4 | hanya bila OD-3.11 memilih implementasi; seri return mengikuti OD-6.4 |
| 9 | OD-6.7 (parameter VaRSR) | OD-6.6 | parameter menyusul formula |
| 10 | OD-6.8 (cash-day t-test) | OD-5.3, OD-5.4, OD-6.12 | arti "cash-day" bergantung treatment gap & kalender; policy bergantung himpunan uji |
| 11 | OD-6.9 (metode korelasi) | OD-5.5, OD-5.7 | window & kelompok aset mengikuti periode & HYPE |
| 12 | OD-6.10 (definisi regime) | OD-5.5 | segmen mengikuti periode final |
| 13 | OD-6.12 (multiple testing) | OD-6.6, OD-6.8, OD-6.9, OD-6.10 | kebijakan mengikuti himpunan uji final |
| 14 | Phase 2H OD-4 (restate gate) | OD-6.1, Phase 2H OD-5 | gate menunjuk pembanding & kriteria yang belum dipilih |
| 15 | Phase 2H OD-5 (kriteria) | OD-6.1 (untuk opsi relatif-B&H) | opsi "> B&H" tak terdefinisi tanpa definisi B&H |
| 16 | Phase 2H OD-9 (OOS) | OD-5.2, OD-5.5 | pembagian holdout mengikuti dataset & periode final |
| 17 | OD-7.11 (artefak stat otoritatif) | OD-6.4..6.12 | pipeline statistik harus ada dulu |
| 18 | OD-7.12 (final freeze) | seluruh OD | checklists akhir |
| 19 | ARCH §16 (canonical) | rantai metodologi OD-2→OD-6 | opsi "re-run" baru bisa dinilai setelah metodologi final; pilihan A/B relevan hanya bila tidak ada perubahan metodologi |

**Conditional facet yang tidak mengubah status utama:** OD-6.4 (facet hari-nol mengikuti
OD-5.3 — konvensi rf/annualization tetap bisa dijawab mandiri), OD-3.6 (jumlah unrealized
mengikuti OD-5.5), OD-6.4/OD-6.8 (final Sharpe & p-value mengikuti return-series treatment —
kutipan dependensi ini juga dinyatakan OD-6 sendiri).

---

## 14. Do-Not-Decide-from-Results Register

Keputusan yang **dilarang dipilih** dengan melihat opsi mana yang memberi return lebih
tinggi, DD lebih rendah, Sharpe lebih tinggi, p-value lebih rendah, atau signifikansi lebih
baik. Tujuan: mencegah pemilihan metodologi post-hoc.

| # | Keputusan | Sensitivitas terdokumentasi (bukti bahwa hasilnya berbeda per opsi) | Aturan |
| --- | --- | --- | --- |
| 1 | OD-5.3 (treatment missing bars) | DD −26.45↔−18.08, Sharpe 0.82↔1.10, B&H Sharpe 0.98↔0.8787 — `FORENSIC SENSITIVITY — NOT CANONICAL` | OD-5 register eksplisit: "**dilarang memilih berdasarkan angka Sharpe/DD**" |
| 2 | OD-5.5 (periode studi) | return bergerak bila window dipilih dari hasil | pilih dari tujuan riset/label, bukan dari return |
| 3 | OD-6.1/6.2/6.3 (definisi B&H) | ≥7 konstruksi; B&H 155.03 vs 767/570.78/401/418/154.85; gate flip 0.82<0.98 vs 1.04>0.88 — `FORENSIC SENSITIVITY — NOT CANONICAL` | pilih konstruksi karena kecocokan metodologis, BUKAN agar gate lulus |
| 4 | OD-4.8 (asset ordering) | 152.00 / 159.17 / 162.51 (spread 10.51pp) pada data yang sama — `FORENSIC SENSITIVITY — NOT CANONICAL` | urutan dipilih & dibekukan sebagai aturan, bukan dari return tertinggi |
| 5 | OD-2.1 / OD-2.3 (stop anchor & ATR timestamp) | anchor: ≤1.6% size; ATR: +152.0→+158–159%, DD −26.45→−27.7 — `FORENSIC SENSITIVITY — NOT CANONICAL` | OD-2 eksplisit: "must be frozen on methodology grounds, **not** on which produces better numbers" |
| 6 | OD-2.4 (fixed vs dynamic) | path exit berbeda → DD/return berbeda | pilih dari definisi PPT/PLAN, bukan dari DD |
| 7 | OD-3.7 (posisi saat hole) | 0.82↔1.10, −26.45↔−18.08 — `FORENSIC SENSITIVITY — NOT CANONICAL` | pilih dari keputusan OD-5.3 + prinsip akuntansi, bukan dari Sharpe |
| 8 | OD-6.10 (parameter regime) | threshold pernah diubah post-hoc 0.50→0.33/0.66 (Phase 2H) | threshold wajib pre-registered sebelum melihat segmen hasil |
| 9 | OD-6.8 (cash-day correction) | p=0.0743/0.0193 vs 0.0430/0.0391 (signifikansi berganti) — `FORENSIC SENSITIVITY — NOT CANONICAL` | metode dipilih dari kebenaran definisi, BUKAN dari p<0.05 |
| 10 | OD-6.6/OD-6.7 (formula & parameter VaRSR) | parameter menentukan keberhasilan ambang VaRSR | jangan tuning ke threshold |
| 11 | Phase 2H OD-5 (kriteria) | kriteria sudah sekali direvisi setelah hasil (AR-05: ≥1.0 → >B&H) | kriteria baru wajib didefinisikan SEBELUM melihat output run |
| 12 | OD-6.9 (metode korelasi) | window 615 vs 2.120 mengubah matriks → memengaruhi klaim diversifikasi | pilih dari desain statistik, bukan dari korelasi rendah yang "mendukung" klaim |

---

## 15. Snapshot A/B Role

Peran Snapshot A dan B **sesudah OD-8** — klasifikasi berbasis evidence saja; **tidak ada
yang dipilih sebagai hasil tesis**.

| Peran | Snapshot A (149.59% / −26.19%, `backtest/reports/metrics.md`, commit `e6188de`) | Snapshot B (152.00% / 0.82 / −26.45% / 94 / 2520.02, `monitoring/web/lib/backtest-reference.json`) |
| --- | --- | --- |
| historical evidence | **YA** — artefak tersimpan, provenance commit `e6188de` terketik (OD-7) | **YA** — artefak aktif di worktree, 9 dari 14 metrik di reference.json |
| engineering reproducibility reference | **YA** — reproduksi byte-identik via checkout `e6188de` di `/tmp/od7_clone` (OD-7 D2) | **YA** — 3× run byte-identik (sha256 sama), cwd-independent (OD-7 D1) |
| sensitivity reference | **YA** — hanya saat dikutip dalam perbandingan A/B = `FORENSIC SENSITIVITY — NOT CANONICAL` | **YA** — sama |
| thesis candidate | **`UNKNOWN`** — menunggu ARCH §16 (belum boleh dideklarasikan) | **`UNKNOWN`** — menunggu ARCH §16 |
| rejected | **TIDAK** — tidak ada bukti penolakan | **TIDAK** — tidak ada bukti penolakan |
| thesis-canonical | **TIDAK** | **TIDAK** |

Fakta pendukung (dari OD-7, tidak diulang-menghitung): dataset A↔B identik untuk 10 CSV
pasangan (selisih git hanya +BCH/LTC/PAXG di `data/historical/`); B **tidak punya ledger
raw tersimpan** (`PROVENANCE UNKNOWN`); B = hand-transcribed (tanpa writer script);
`backtest-reference.json` masih membawa label periode basi (→ OD-5.5). Keduanya tetap
**ENGINEERING SNAPSHOTS, BUKAN THESIS-CANONICAL RESULT.**

---

## 16. Thesis Claim Dependency

Pemetaan klaim tesis → keputusan metodologi + data + metrik yang dibutuhkan. **OD-8 tidak
memutuskan apakah klaim benar** — hanya menentukan apakah bukti kelak bisa mendukungnya.

| Claim | Required Methodology Decisions | Required Data | Required Metrics | Current Status |
| --- | --- | --- | --- | --- |
| **Claim 1 — Strategi menghasilkan cumulative return positif** | OD-2.1/2.3 (stop), OD-3.1 (exit timing), OD-3.6 (period-end MTM), OD-4.1/4.2/4.3 (sizing), OD-4.8 (ordering), ARCH §16 (angka mana) | OD-5.1–5.5 (freeze dataset & periode) + OD-5.3 (gap) | total return, equity curve | `PARTIAL` — dua snapshot menunjukkan +149.59%/+152.00% positif, tetapi metodologi belum dibekukan → **`OWNER DECISION REQUIRED`** untuk keputusan di kolom 1 |
| **Claim 2 — Kinerja risk-adjusted vs B&H** | OD-6.1/6.2/6.3/6.5 (benchmark), OD-6.4 (Sharpe), Phase 2H OD-5 (kriteria gate), Phase 2H OD-9 (OOS) | dataset terfreeze + B&H terdefinisi pada window yang sama | Sharpe strategy vs Sharpe B&H, verdict gate | `OWNER DECISION REQUIRED` — return-gate gagal di semua konstruksi terlokasi; Sharpe-gate berubah per konstruksi (`FORENSIC SENSITIVITY — NOT CANONICAL`); kebenaran klaim TIDAK dinilai di sini |
| **Claim 3 — Downside risk berbeda dari B&H** | OD-5.3 (gap — DD trough = hari artefak 2023-01-22), OD-6.4 (definisi MDD/metrik), OD-3.11/6.6/6.7 (VaRSR) | dataset terfreeze dengan keputusan gap final | max drawdown, VaR/VaRSR | `BLOCKED` — DD sangat sensitif ke treatment gap (`FORENSIC SENSITIVITY — NOT CANONICAL`); VaRSR `NOT IMPLEMENTED` |
| **Claim 4 — Performa bervariasi antar regime pasar** | OD-6.10 (definisi regime pre-registered), OD-6.12 (multiple testing), OD-5.5 (segmen periode) | periode final + seri return terfreeze | return per segmen, uji antar-segmen | `NOT IMPLEMENTED` sebagai analisis pre-registered (threshold pernah diubah post-hoc) → `OWNER DECISION REQUIRED` pada OD-6.10 |
| **Claim 5 — Portofolio multi-aset memberi efek diversifikasi** | OD-6.9 (metode korelasi), OD-4.8/OD-4.10 (ordering & cap), OD-5.7 (staggered), OD-6.1 (relevansi pembanding) | universe terfreeze (OD-5.6) + window korelasi | korelasi pairwise, kontribusi risiko (analisis kontribusi risiko portofolia `NOT IMPLEMENTED` — OD-6 catatan) | `BLOCKED` — matriks korelasi berubah dengan window (615 vs 2.120) dan HYPE window → `OWNER DECISION REQUIRED` |

---

## 17. Data Decision Cluster

**Isi:** 9 unresolved (OD-5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.10) + 1 provenance
(OD-5.9 dihitung di repro cluster). **Severity: 7 BLOCKER · 2 PRE-FREEZE.**

**Keputusan yang sudah decided di cluster ini:** keanggotaan 10-pair (PPT:181), sumber
Bitget (PPT:181, dengan contingency kelayakan OD-5.1), timeframe 1D (PPT).

**Bukti kunci (tidak dipilihkan treatment-nya):**
- 1.635 missing bar interior terverifikasi ulang persis (17 window; BTC/ETH/XRP/LINK/DOGE
  204, SOL/BNB 203, AVAX/ADA 104, HYPE 1); 4 hari all-absent 2021-05-28..31; 0 duplikat.
- Tidak ada checksum/manifest di seluruh repo (`NOT IMPLEMENTED`); raw timestamp sudah
  di-drop oleh `fetch_bitget_data.py` → refetch provenance historis hilang.
- Jendela aktual data: 2020-11-09..2026-09-02 (5.81y) ≠ label "2020-08..2026-08 (6 tahun)".
- Kriteria seleksi universe (PPT:294) tak pernah terjawab; 3 koin ditolak pasca-hasil.
- Verifikasi venue eksternal `UNKNOWN` (ISP DNS hijack → 2020.3.218.139) — tidak ada data
  eksternal yang disubstitusi.

**Dependensi keluar:** OD-5.3 → OD-3.7 & Phase 2H OD-2 (merged) & OD-6.11 (merged);
OD-5.4/5.5 → OD-6.5, OD-6.8, OD-6.9, OD-6.10; OD-5.5 → Phase 2H OD-9; seluruh cluster →
Gate B.

---

## 18. Strategy Decision Cluster

**Isi:** 13 keputusan unik (OD-2.1–2.6 [5], OD-3.1–3.8 + OD-3.11 [9] − OD-3.5 decided =
12 unresolved) + facet sizing OD-4.4/OD-4.7 (merged ke cluster lain). **Severity: 12
BLOCKER · 1 PRE-FREEZE (OD-3.11).**

**Keputusan yang sudah decided:** entry rule & timing, execution next-open + slippage,
exit-channel predicate, exit fee rates/placement (OD-3.5 `DECIDED`), sifat stop (faktor
2×ATR(14), stop wajib ada).

**Bukti kunci:**
- Mismatch anchor stop PPT-vs-kode `VERIFIED` (run:133 `signal_close−2×prevATR`); DESIGN.md
  kontradiksi-diri (:37 vs :64/:221).
- ATR timestamp = materialitas terbesar di cluster: +152.0% → +158–159%, DD −26.45→−27.7
  (`FORENSIC SENSITIVITY — NOT CANONICAL`).
- Gap-stop: `gap_stop` 0/94; aturan dokumen "exit at open" tak terjangkau (close-first
  precedence); 2 exit CASE2 akan fill lebih buruk di bawah aturan dokumen.
- Stop touch: 29/2.236 intraday touch diabaikan close-confirmation.
- Period-end MTM: +23.53pp unrealized di headline return.
- Exit timing/menyeret re-run penuh ("forces every exit price to move", OD-3 §23).

**Dependensi keluar:** OD-2.1/2.3 → OD-4.3 + OD-4.4 (merged); OD-3.4 menyeret OD-2.7 +
facet P2H OD-10; OD-3.7 menunggu OD-5.3; OD-3.11 → OD-6.6/6.7.

---

## 19. Portfolio Decision Cluster

**Isi:** 9 unresolved (OD-4.1, 4.2, 4.3, 4.5, 4.6, 4.8, 4.9, 4.10, 4.11) + absorbed
OD-3.9→4.8, OD-3.10→4.9, OD-4.4→OD-2.1/2.3, OD-4.7→OD-3.8, OD-7.9→OD-4.8.
**Severity: 6 BLOCKER · 3 PRE-FREEZE.**

**Keputusan yang sudah decided:** limit 2/cluster (PPT), risiko maks 1% per posisi (PPT —
basisnya tetap terbuka di OD-4.1/4.2), fee/slippage rates (PPT).

**Bukti kunci:**
- Ordering: ORDER-DEPENDENT spread **10.51pp** (152.00/159.17/162.51), trades 94/93/92,
  skips 498/509/503 pada data identik — `FORENSIC SENSITIVITY — NOT CANONICAL`.
- OD-4.9 (0 clamp historis) & OD-4.10 (cap 5 tak pernah bind; max nyata 3) → number-neutral
  pada data ini → PRE-FREEZE, bukan BLOCKER.
- OD-4.6 rounding delta 8.67e-08 unit → nyaris nol pada presisi laporan; lot/step code
  `NOT IMPLEMENTED`.
- Equity snapshot: prev-curve-day 94/94, same-day 0/94; Case F basis 1008.29 vs cash 664.73.

**Dependensi keluar:** OD-4.8 adalah canonical untuk ordering (menyeret OD-3.9 + OD-7.9);
OD-4.3/OD-4.4 menunggu OD-2.1/2.3; OD-4.5 menunggu OD-4.1; OD-4.11 joint OD-4.2.

---

## 20. Benchmark Decision Cluster

**Isi:** 4 unresolved (OD-6.1, 6.2, 6.3, 6.5) + absorbed P2H OD-3→6.1.
**Severity: 4 BLOCKER.**

**Keputusan yang sudah decided:** konsep pembanding = buy-and-hold (PPT) — tetapi tidak ada
satu pun konstruksi B&H yang dipilih.

**Bukti kunci:**
- ≥7 konstruksi B&H tak kompatibel terlokasi (Phase 2H AR-03); variasi return B&H
  154.85..767% tergantung weighting/rebalancing/denominator (1000 vs 300).
- Return-gate (149.59/152.0 < 155.03) **gagal di semua** konstruksi terlokasi; Sharpe-gate
  berubah per konstruksi (0.82<0.98 vs 1.04>0.88) — `FORENSIC SENSITIVITY — NOT CANONICAL`.
- B&H sleeve Sharpe 0.98 terinflasi oleh 13 gap-artifact |r|>50% (0.8787 excl.) → terikat
  OD-5.3.
- HYPE staggered (OD-5.7) menentukan bentuk sleeve vs scalar.

**Dependensi masuk:** OD-5.3, OD-5.7, OD-5.4, OD-5.5 + sibling OD-6.2/6.3/6.5.
**Dependensi keluar:** OD-6.1 → Phase 2H OD-4, Phase 2H OD-5, OD-6.9? (tidak — OD-6.9
bergantung data, bukan konstruksi), gate restatement, Claim 2.

---

## 21. Statistical Decision Cluster

**Isi:** 11 unresolved (OD-6.4, 6.6, 6.7, 6.8, 6.9, 6.10, 6.12, OD-3.11, Phase 2H OD-4,
OD-5, OD-9). **Severity: 3 BLOCKER (OD-6.4, P2H OD-5, P2H OD-9) · 8 PRE-FREEZE.**

**Keputusan yang sudah decided:** tidak ada — bahkan rf/annualization pun hardcoded
(tanpa keputusan tertulis; nilai ada di `compute_metrics`).

**Bukti kunci:**
- Sharpe rf=0, annualization √365, sortino non-standar (std dari subset negatif), n_trades
  closed-only (3 posisi terbuka dikecualikan) — ditemukan Phase 2H AR-11.
- t-test: cash-day correction `NOT IMPLEMENTED`; p=0.0743 (paired)/0.0193 (Welch) vs
  cash-day 0.0430/0.0391 — `FORENSIC SENSITIVITY — NOT CANONICAL`.
- Korelasi: window 615 (staggered) vs 2.120 (semua) observasi mengubah matriks.
- Regime: threshold pernah diubah post-hoc (0.50→0.33/0.66); best-of-9 config per segmen.
- VaRSR: dijanjikan PPT, `NOT IMPLEMENTED` di repo.
- Kriteria: pernah direvisi post-hoc (≥1.0 → >B&H 2026-09-05) — AR-05.
- Pipeline stat rusak di HEAD: `sharpe_benchmark.py` + `regime_segmentation.py` →
  `KeyError: 'donchian_entry_period'` (re-verified; `pytest -q` 70 passed).

**Dependensi masuk:** data (5.3/5.4/5.5/5.7), benchmark (6.1), OD-3.11.
**Dependensi keluar:** OD-6.12 (setelah uji final), Phase 2H OD-4 (setelah 6.1 + OD-5),
OD-7.11, Gate E, Claim 2–5.

---

## 22. Reproducibility Decision Cluster

**Isi:** 11 keputusan (OD-5.9, 7.2, 7.4, 7.5, 7.7, 7.10, 7.11, 7.12, Phase 2H OD-11,
OD-12, ARCH §16). **Severity: 1 BLOCKER (ARCH §16) · 2 PRE-FREEZE (7.11, 7.12) · 8
DOCUMENTATION.** Dari sudut Part B: 10 = engineering/documentation + ARCH §16 =
methodology/provenance.

**Keputusan yang sudah decided:** SoT parsial di `ARCHITECTURE.md` §16 baris 1 (config.yaml
= SoT parameter, decision_log = kronologi) — tetapi METRIC SoT = **PENDING**.

**Bukti kunci:**
- Snapshot B: byte-identik 3× (sha256 sama), cwd-independent (`VERIFIED`) — tetapi **tidak
  ada ledger raw tersimpan** (`PROVENANCE UNKNOWN`) dan reference.json = hand-transcribed.
- Snapshot A: byte-identik via checkout `e6188de` (`VERIFIED`).
- Command of record tidak ada: perintah default menimpa `backtest/reports/metrics.md`
  (tracked); README:120 vs `cli.py` tidak selaras.
- `requirements.txt` unpinned (tetapi `pip check` bersih); drift lintas-env `UNKNOWN`.
- 4 report tanpa generator: `bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md`,
  `sharpe_discrepancy_report.md`, `decision_log.md` → `NOT TRACEABLE`.
- 3 generator statistik crash di HEAD (`KeyError` sejak `0ad6cc6`); VaR/VaRSR +
  cash-day correction `NOT IMPLEMENTED`.
- `git status`: file OD-3..OD-7 (dan kini OD-8) untracked; semua tracked file tak tersentuh.

**Dependensi keluar:** ARCH §16 adalah gerbang seluruh kutipan hasil; OD-7.12 = gerbang
akhir Gate F.

---

## 23. Contradiction Matrix

Kontradiksi yang **masih terbuka** — dicatat, tidak diselesaikan sendiri. Precedence mengikuti
§3; setiap baris berujung ke owner decision.

| # | Topic | Source A | Source B | Contradiction | Impact | Owner Decision? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Definisi B&H | PPT (konsep "beli-hold") + `decision_log:99` (angka "B&H −58.49") | Phase 2H AR-03 / OD-6 §24 (≥7 konstruksi eksplisit; 155.03 scalar vs 767/570.78/401/418/154.85) | tidak ada SATU konstruksi kanonik; gate memakai angka beda di dokumen beda | verdict gate, t-test, Claim 2 | **Ya** — OD-6.1/6.2/6.3 (membawa P2H OD-3) |
| 2 | Interpretasi "−58.49" | `decision_log:99`/`:120` mengutip "B&H −58.49" | OD-6: MDD B&H terlokasi −58.44 / −76.63 / −76.89 / −77.63 / −96.69; Snapshot A/B DD = −26.19/−26.45 | angka −58.49 tidak cocok ke definisi mana pun secara persis; miskonflasi metrik | dokumen klaim tesis | **Ya** — Phase 2H OD-11 (errata) |
| 3 | Snapshot A/B | `ARCHITECTURE.md` §16: "PENDING (keputusan canonical belum diambil)" + `metrics.md` (149.59/−26.19) | `backtest-reference.json` + `TASKS.md` (152.0/−26.45) | dua "hasil" hidup berdempetan di halaman publik | seluruh kutipan hasil | **Ya** — ARCH §16 (membawa P2H OD-1, OD-7.1, OD-7.6) |
| 4 | Semantik stop | PPT/PLAN:34/DESIGN:37/config:20: `Entry − 2×ATR(14)`; PLAN:35 "trailing berbasis ATR"; PPT "Stop loss dinamis" | `run_backtest.py:133`: `signal_close − 2×prevATR`, fixed; DESIGN:64/:221 (kontradiksi-diri internal DESIGN) | anchor kode ≠ anchor dokumen; fixed vs "dinamis" | stop, size, seluruh equity (`VERIFIED` mismatch) | **Ya** — OD-2.1, OD-2.4 (membawa P2H OD-7, OD-4.4) |
| 5 | Label periode | `reference.json`/decision_log/config comment/"6 tahun" (2020-08..2026-08) | data aktual 2020-11-09..2026-09-02 = 5.81y (`VERIFIED`) | label warisan dataset pra-swap | semua jendela analisis | **Ya** — OD-5.5 (membawa P2H OD-6) |
| 6 | Treatment missing-bar | keadaan sekarang: dibiarkan + MTM di-zero saat hole (DD trough = hari artefak 2023-01-22) | opsi refetch/ffill (DD −26.45↔−18.08; Sharpe 0.82↔1.10) | kebijakan default = pilihan tanpa keputusan; root cause hole `UNKNOWN` | DD, Sharpe, t-test, korelasi | **Ya** — OD-5.3 (+OD-3.7; membawa P2H OD-2, OD-6.11) |
| 7 | Asset ordering | implementasi: urutan loop config (BTC-first, "artifact of dict order") | OD-4.8/OD-3.9: tidak ada aturan tertulis yang mendokumentasikannya | aturan de-facto ≠ metodologi terdokumentasi | 10.51pp spread, reproducibility | **Ya** — OD-4.8 (membawa OD-3.9, OD-7.9) |
| 8 | VaRSR | PPT menjanjikan VaRSR (RQ) | repo: `NOT IMPLEMENTED` | janji metodologi tanpa pipeline | kelengkapan RQ2/RQ3 | **Ya** — OD-3.11 → OD-6.6/6.7 |
| 9 | Konfigurasi t-test | asumsi implicit: hari tanpa bar = hari return nol | OD-6.8: cash-day correction `NOT IMPLEMENTED`; p berganti 0.0743/0.0193 ↔ 0.0430/0.0391 | keputusan metodologi terselubung dalam kode yang belum ada | signifikansi Claim 1/2 | **Ya** — OD-6.8 (+OD-6.12) |
| 10 | Provenance hasil | `metrics.md` (Snapshot A, tracked) | `backtest-reference.json` (Snapshot B, hand-transcribed, label basi; ledger B hilang) | dua artefak klaim tanpa satu sumber; ledger B `PROVENANCE UNKNOWN` | seluruh kutipan + reproducibility | **Ya** — ARCH §16 + OD-7.2/7.10 |
| 11 | Klaim gate vs aritmetika | `TASKS.md:18`/`PLAN.md:211` "terpenuhi", preset `sharpe_vs_bnh: above` | OD-6: return-gate 149.59/152.0 < 155.03 gagal; Sharpe 0.82 < 0.98 | dokumen menyatakan lulus; angka tidak | integritas klaim tesis | **Ya** — Phase 2H OD-4 |
| 12 | Sejarah kriteria | `PLAN.md:211` awal: Sharpe ≥1.0; decision_log 2026-08-14 "LOLOS" | revisi 2026-09-05 "> B&H (revised)" setelah hasil + Phase 2H AR-05 | revisi post-hoc tanpa catatan resmi di register | legitimacy gate | **Ya** — Phase 2H OD-5 |
| 13 | Gap-stop precedence | DESIGN/dokumen: "exit at open saat gap" | kode: close-first → aturan dokumen tak terjangkau (`gap_stop` 0/94); entry-day gap synth crash `ValueError` (0/94 historis) | dokumen ≠ kode; robustness ceiling | exit price pada kejadian langka | **Ya** — OD-2.6 (membawa P2H OD-8) |

---

## 24. Final Simulation Readiness Gates

**Tidak ada gate yang dilangkahi; tidak ada simulasi final yang dijalankan.**

| Gate | Status | Evidence |
| --- | --- | --- |
| **Gate A — Methodology Frozen** | **`BLOCKED`** | 46 keputusan metodologi/owner belum dijawab (33 di antaranya BLOCKER); register terbuka di Phase 2H OD-4/5/9/11/12, OD-2, OD-3, OD-4, OD-5, OD-6, OD-7 §28 |
| **Gate B — Data Frozen** | **`BLOCKED`** | OD-5.1/5.2/5.3/5.5/5.8/5.10 terbuka; 0 checksum/manifest (`NOT IMPLEMENTED`); label periode basi; dataset belum "thesis-frozen" |
| **Gate C — Implementation Frozen** | **`PARTIAL`** | deterministik + 70 test passed (`VERIFIED`); entry/execution match PPT 94/94 (`VERIFIED`); TAPI stop anchor vs PPT masih mismatch (OD-2.1), ordering tak terdokumentasi (OD-4.8), gap precedence tak selaras — implementasi belum bisa di-klaim "match methodology" karena metodologinya belum dibekukan |
| **Gate D — Reproduction Frozen** | **`PARTIAL`** | Snapshot B byte-identik 3× + cwd-independent (`VERIFIED`); Snapshot A reproduksi via checkout (`VERIFIED`); TAPI command of record tidak ada (default menimpa file tracked), env unpinned, ledger B `PROVENANCE UNKNOWN`, 4 report `NOT TRACEABLE` |
| **Gate E — Statistical Pipeline Frozen** | **`BLOCKED`** | VaR/VaRSR + cash-day correction `NOT IMPLEMENTED`; 3 generator statistik crash (`KeyError: donchian_entry_period`); definisi statistik (OD-6.4, 6.6–6.12, P2H OD-5) belum diputuskan |
| **Gate F — Final Simulation** | **`BLOCKED`** | prasyarat A–E tidak terpenuhi; simulasi final **tidak boleh dimulai** |

---

## 25. Post-Decision Implementation Sequence

**Deskripsi only — TIDAK dieksekusi.** Urutan kerja SETELAH keputusan owner dibekukan,
dihormati sebagai urutan decision-gate (tidak ada lompatan fase):

### Phase 1 — Data rebuild/freeze
1. Jalankan keputusan OD-5.1 (sumber) → OD-5.2 (rebuild A–D atau pertahankan CSV).
2. Terapkan keputusan OD-5.3 (treatment gap) + OD-5.4 (kalender) → OD-5.5 (periode final).
3. Terapkan OD-5.6 (universe/kriteria) + OD-5.7 (HYPE window).
4. Buat manifest + checksum & retensi log fetch sesuai keputusan OD-5.9.
5. Jalankan gate acceptance OD-5.8 (T01–T12) → sahkan OD-5.10 → **freeze dataset +
   freeze date record**.

### Phase 2 — Implementation alignment
1. Ubah kode **hanya setelah methodology freeze** (OD-3 §23 butir 4): anchor stop
   (`run_backtest.py:133`) bila OD-2.1 memilih itu; ATR timestamp (OD-2.3); exit timing
   (OD-3.1); touch/close (OD-3.2); same-bar priority (OD-3.3); gap rule (OD-2.6);
   ordering rule (OD-4.8); sizing basis (OD-4.1/4.2/4.3/4.5); rounding/cash (OD-4.6/4.9);
   period-end (OD-3.6); reuse (OD-3.8).
2. Selaraskan dokumen: `DESIGN.md:37` vs `:64/:221`, comment `config.yaml:20`, label exit,
   sentence fee/gap/period-end, kriteria gate di `TASKS.md:18`/`PLAN.md:211`/preset
   (Phase 2H OD-4/OD-5), errata `decision_log` (Phase 2H OD-11 — annotate, jangan rewrite).
3. Unit test untuk formula sizing & stop yang baru (repo mensyaratkan test untuk position
   sizing & stop loss calculation) — pertahankan 70 test hijau + test baru.
4. (Bila OD-7.5 diputuskan) pindahkan konstanta statistik ke config.

### Phase 3 — Backtest
1. Bekukan command of record (OD-7.2) + environment (OD-7.4) + disiplin output
   (`REPORT_SUBDIR` — tanpa menimpa artefak tracked) + retensi ledger (OD-7.10).
2. **Satu kali** full canonical re-run dengan data terfreeze (OD-5 §29 butir 8; OD-6 §28
   butir 8; ARCH §16) — ledger raw disimpan.
3. Rekam provenance run: commit + config + dataset manifest + command + env.

### Phase 4 — Statistical analysis
1. Hitung semua metrik §4 sekali dari run kanonik dengan konvensi OD-6.4.
2. VaRSR bila OD-3.11 memilih implementasi (OD-6.6 → OD-6.7); uji t dengan perlakuan
   OD-6.8; korelasi OD-6.9; regime OD-6.10 (pre-registered); koreksi multipel OD-6.12.
3. OOS/holdout bila Phase 2H OD-9 memilih; tentukan artefak otoritatif (OD-7.11).
4. Bandingkan hasil vs eksplorasi awal (fase paper/backtest) — tanpa mengulang seleksi.

### Phase 5 — Thesis artifacts
1. Tabel/figure tesis — masing-masing dengan generator + input + config + commit
   (OD-7.7); jangan kutip 4 report `NOT TRACEABLE` tanpa regenerasi.
2. Tabel sensitivitas sesuai keputusan Phase 2H OD-12 (sebagai robustness, bukan headline).
3. Kutip SATU canonical result dari ARCH §16 (tulis ulang semua kutipan dari satu sumber).
4. Final evidence-chain freeze (OD-7.12) → siap Gate F.

---

## 26. Decision Debt

**Perhitungan dari evidence register (bukan estimasi):**

### 26.1 Per sumber

| Sumber | ID ditemukan | Canonical (unik) | Absorbed `CARRIED`/merged | `DECIDED` | `OWNER DECISION REQUIRED` | `CONDITIONAL` |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 2H OD-1..12 | 12 | 5 | 7 | 0 | 2 (OD-11, OD-12) | 3 (OD-4, OD-5, OD-9) |
| OD-2.1..2.9 | 9 | 5 | 4 | 0 | 4 (2.1, 2.3, 2.4, 2.6) | 1 (2.2) |
| OD-3.1..3.11 | 11 | 9 | 2 | 1 (OD-3.5) | 7 (3.1, 3.2, 3.3, 3.4, 3.6, 3.8, 3.11) | 1 (3.7) |
| OD-4.1..4.11 | 11 | 9 | 2 | 0 | 7 (4.1, 4.2, 4.3, 4.6, 4.8, 4.9, 4.10) | 2 (4.5, 4.11) |
| OD-5.1..5.10 | 10 | 10 | 0 | 0 | 9 (5.1–5.9) | 1 (5.10) |
| OD-6.1..6.12 | 12 | 11 | 1 | 0 | 3 (6.2, 6.3, 6.4) | 8 (6.1, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.12) |
| OD-7.1..7.12 | 12 | 7 | 5 | 0 | 5 (7.2, 7.4, 7.5, 7.7, 7.10) | 2 (7.11, 7.12) |
| ARCH §16 | 1 | 1 | 0 | 0 | 0 | 1 (ARCH §16) |
| **Total** | **78** | **57** | **21** | **1** | **37** | **19** |

### 26.2 Per cluster

| Cluster | Unik | Unresolved | `OWNER DECISION REQUIRED` | `CONDITIONAL` | BLOCKER | PRE-FREEZE | DOCUMENTATION | `DECIDED` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DATA | 9 | 9 | 8 | 1 | 7 | 2 | 0 | 0 |
| STRATEGY | 13 | 12 | 11 | 1 | 12 | 0 | 0 | 1 (OD-3.5) |
| PORTFOLIO | 9 | 9 | 7 | 2 | 6 | 3 | 0 | 0 |
| BENCHMARK | 4 | 4 | 2 | 2 | 4 | 0 | 0 | 0 |
| STATISTICS | 11 | 11 | 2 | 9 | 3 | 8 | 0 | 0 |
| REPRODUCIBILITY | 11 | 11 | 7 | 4 | 1 | 2 | 8 | 0 |
| **Total** | **57** | **56** | **37** | **19** | **33** | **15** | **8** | **1** |

- **Total keputusan ditemukan: 78 ID** (Phase 2G = findings, tanpa ID keputusan).
- **Unik setelah dedup: 57** · **unresolved: 56** · **decided (dalam sistem ID): 1** ·
  **carried/merged: 21** · **conditional: 19** · **unknown (status keputusan): 0** ·
  **not applicable: 0**.
- Metodologi/owner unresolved: **46** · engineering/reproducibility unresolved: **10**.
- Register terpisah (§12) menambah 19 keputusan yang sudah decided di luar sistem ID
  (PPT + owner conversation + `decision_log`) — tidak dihitung sebagai "ID debt".

---

## 27. Final Freeze Checklist

**0 dari 25 item boleh dicentang.** Sebuah kotak hanya dicentang bila metodologi DAN
provenance-nya sudah di-freeze secara eksplisit — keberadaan implementasi TIDAK cukup.

```text
[ ] Owner decisions complete                     — 56 keputusan terbuka (§11)
[ ] Universe frozen                              — keanggotaan PPT-decided, TAPI kriteria OD-5.6 terbuka
[ ] Period frozen                                — OD-5.5 terbuka (label vs data 5.81y)
[ ] Dataset frozen                               — OD-5.1/5.2 terbuka; 0 manifest/checksum
[ ] Missing-bar policy frozen                    — OD-5.3 terbuka
[ ] Entry frozen                                 — aturan PPT-decided (§12 #4), TAPI belum ada freeze record eksplisit
[ ] Execution frozen                             — next-open PPT-decided (§12 #5); exit timing OD-3.1 terbuka
[ ] Stop frozen                                  — OD-2.1/2.2/2.3/2.4 terbuka (anchor mismatch VERIFIED)
[ ] Exit frozen                                  — OD-2.6, OD-3.1, OD-3.2, OD-3.3 terbuka
[ ] Position lifecycle frozen                    — OD-3.6, OD-3.7, OD-3.8 terbuka
[ ] Risk sizing frozen                           — 1% PPT-decided; basis OD-4.1/4.2/4.3/4.5 terbuka
[ ] Portfolio ordering frozen                    — OD-4.8 terbuka (spread 10.51pp)
[ ] Benchmark frozen                             — OD-6.1/6.2/6.3/6.5 terbuka
[ ] Sharpe frozen                                — OD-6.4 terbuka
[ ] MDD frozen                                   — OD-5.3 (trough artefak) + definisi via OD-6.4/P2H OD-10 terbuka
[ ] VaR frozen                                   — OD-6.6/6.7 (menunggu OD-3.11) terbuka; NOT IMPLEMENTED
[ ] VaRSR frozen                                 — OD-3.11 terbuka; NOT IMPLEMENTED
[ ] t-test frozen                                — OD-6.8 terbuka; cash-day NOT IMPLEMENTED
[ ] correlation frozen                           — OD-6.9 terbuka
[ ] regime frozen                                — OD-6.10 terbuka
[ ] multiple-testing policy frozen               — OD-6.12 terbuka
[ ] environment frozen                           — OD-7.4 terbuka (unpinned)
[ ] command frozen                               — OD-7.2 terbuka (tidak ada command of record)
[ ] result provenance frozen                     — ARCH §16 PENDING
[ ] ledger retention frozen                      — OD-7.10 terbuka; ledger B PROVENANCE UNKNOWN
[ ] thesis table/figure provenance frozen        — OD-7.7 terbuka; 4 report NOT TRACEABLE
```

---

## 28. Remaining Evidence Gaps

Yang masih menjadi celah bukti SETELAH OD-8 (bukan keputusan — ini fakta yang belum
terpecahkan):

| # | Gap | Label |
| --- | --- | --- |
| 1 | Keaslian/kesesuaian data vs venue tak bisa diverifikasi dari lingkungan ini (ISP DNS hijack → 2020.3.218.139); tidak ada data eksternal disubstitusi | `UNKNOWN` |
| 2 | Ledger raw Snapshot B tidak tersimpan — tidak ada jejak run yang memproduksi 152.00/0.82/−26.45/94/2520.02 selain artefak agregat | `PROVENANCE UNKNOWN` |
| 3 | 4 report tanpa generator: `bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md`, `sharpe_discrepancy_report.md`, `decision_log.md` | `NOT TRACEABLE` |
| 4 | Root cause 1.635 hole belum diketahui (venue-side? fetch bug?) — refetch comparison belum pernah dilakukan | `UNKNOWN` |
| 5 | VaR/VaRSR + cash-day correction tidak ada di pipeline | `NOT IMPLEMENTED` |
| 6 | 3 generator statistik crash di HEAD (`KeyError: donchian_entry_period` sejak `0ad6cc6`) — angka report = frozen artifact, bukan output run ulang | `VERIFIED` (crash) + `NOT TRACEABLE` (regenerasi) |
| 7 | Dataset manifest/checksum tidak ada di repo | `NOT IMPLEMENTED` |
| 8 | Drift numerik lintas-environment (requirements unpinned) belum diukur lintas mesin | `UNKNOWN` |
| 9 | Konfigurasi kriteria/gate di `TASKS.md:18`/`PLAN.md:211`/preset masih menyatakan hal yang berbeda dari aritmetika | `VERIFIED` (selisih) + `OWNER DECISION REQUIRED` (perbaikannya) |
| 10 | Data A↔B identical hanya untuk 10 CSV — diff `data/historical/` e6188de..HEAD hanya +BCH/LTC/PAXG (aset yang tidak dipakai) | `VERIFIED` |

---

## 29. Limitations

1. **Audit konsolidasi murni** — OD-8 tidak menjalankan eksperimen baru; semua sensitivitas
   dikutip dari audit sebelumnya (OD-2..OD-7, Phase 2H) yang menjalankannya di `/tmp`.
   Angka sensitivitas = `FORENSIC SENSITIVITY — NOT CANONICAL`.
2. **Klasifikasi severity (§9) dan judgment merge untuk 6 fusion berlabel `INFERRED`**
   (P2H OD-6→OD-5.5, P2H OD-8→OD-2.6, OD-3.9→OD-4.8, OD-3.10→OD-4.9, OD-7.1→ARCH §16,
   split P2H OD-10) adalah derivasi OD-8 dari substansi teks — bukan pernyataan eksplisit
   sumber; owner boleh menolak fusion itu tanpa mengubah fakta lain.
3. **Tidak ada keputusan yang dijawab OD-8** — tidak ada opsi yang dipilih, diperingkat,
   atau diskor; tidak ada hasil terbaik yang dicari.
4. **Urutan kritis (§8) menghormati tiga sequence yang sudah dipublikasikan** (OD-3 §23,
   OD-5 §29, OD-6 §28) — kalau owner mengizinkan paralelisme lintas cabang (mis. strategy ∥
   data), urutan itu menjadi preferensi proses owner, bukan temuan OD-8.
5. **Verifikasi eksternal tetap terblokir** (poin 28.1) — klaim PPT "data Bitget 2020–2026"
   tak bisa dicek ke venue dari lingkungan ini.
6. **Status Snapshot tidak berubah** — OD-8 tidak memilih A/B/benchmark; keduanya tetap
   engineering snapshots.
7. Dokumen ini **bukan** thesis result, **bukan** rekomendasi metodologi, dan **bukan**
   pengganti jawaban owner atas §11.

---

## 30. Final Answers

**P1 — Berapa keputusan metodologi unik yang masih unresolved?**
**46** — DATA 9 + STRATEGY 12 + PORTFOLIO 9 + BENCHMARK 4 + STATISTICS 11 + canonical
result provenance (ARCH §16) 1, dari 57 keputusan unik (78 ID − 21 merged).
**Label: `VERIFIED`** (hitungan langsung dari register sumber; 19 di antaranya berstatus
`CONDITIONAL`).

**P2 — Berapa keputusan engineering/reproducibility yang masih unresolved?**
**10** — OD-5.9 (manifest/checksum), OD-7.2 (command), OD-7.4 (env), OD-7.5 (config
single-source), OD-7.7 (provenance tabel/figure), OD-7.10 (ledger), OD-7.11 (artefak stat
otoritatif), OD-7.12 (final freeze), Phase 2H OD-11 (errata), Phase 2H OD-12 (presentasi
sensitivitas). Format/mechanism = engineer boleh; requirement = owner.
**Label: `VERIFIED`**.

**P3 — Keputusan mana yang benar-benar blocker untuk methodology freeze?**
**33 BLOCKER** — DATA: OD-5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7 · STRATEGY: OD-2.1, 2.2, 2.3,
2.4, 2.6, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8 · PORTFOLIO: OD-4.1, 4.2, 4.3, 4.5, 4.8, 4.11 ·
BENCHMARK: OD-6.1, 6.2, 6.3, 6.5 · STATISTICS: OD-6.4, Phase 2H OD-5, Phase 2H OD-9 ·
CANONICAL: ARCH §16. (15 PRE-FREEZE + 8 DOCUMENTATION menyusul sebelum freeze, tanpa
menunda eksplorasi; 0 OPTIONAL.)
**Label: `INFERRED`** (klasifikasi severity = derivasi OD-8 dari bukti terdokumentasi per
definisi Part F).

**P4 — Keputusan mana yang conditional terhadap keputusan lain?**
**19** — OD-2.2 (←2.1), OD-3.7 (←5.3), OD-4.5 (←4.1), OD-4.11 (←4.2), OD-5.10
(←5.1..5.9+ARCH §16), OD-6.1 (←5.3, 5.7, 6.2, 6.3, 6.5), OD-6.5 (←5.4, 5.5), OD-6.6
(←3.11, 6.4), OD-6.7 (←6.6), OD-6.8 (←5.3, 5.4, 6.12), OD-6.9 (←5.5, 5.7), OD-6.10
(←5.5), OD-6.12 (←6.6/6.8/6.9/6.10), Phase 2H OD-4 (←6.1, P2H OD-5), Phase 2H OD-5
(←6.1), Phase 2H OD-9 (←5.2, 5.5), OD-7.11 (←6.4..6.12), OD-7.12 (←semua), ARCH §16
(←rantai metodologi).
**Label: `STRONGLY SUPPORTED`** (dependensi mayoritas dinyatakan eksplisit di OD-5 §29,
OD-6 §28, dan status register; sisanya turunan langsung).

**P5 — Keputusan mana yang sudah benar-benar diputuskan secara eksplisit?**
Dalam sistem ID: **OD-3.5** saja (`DECIDED` — rate/placement fee `VERIFIED` di L1). Di luar
ID (§12, 19 butir): long-only, timeframe 1D, identitas Donchian 20/10 + ATR(14)×2, entry
rule strict-`>` shift(1), execution next-open + 0.05%, exit-channel predicate, keberadaan
stop 2×ATR(14), limit 1%/2-per-cluster, fee 0.1%+0.05%, universe 10-pair (PPT:181), sumber
Bitget (PPT:181), konsep pembanding B&H, **penarikan kriteria Sharpe ≥1.0 (owner)**, RQ1–3,
janji VaRSR (bukan implementasinya), aturan risk repo, mandate proses audit, fakta sejarah
revisi kriteria di `decision_log`.
**Label: `VERIFIED`**.

**P6 — ID keputusan historis mana yang bisa di-merge/carry?**
**21 ID** (daftar lengkap §6): P2H OD-1, OD-2, OD-3, OD-6, OD-7, OD-8, OD-10 → ARCH §16 /
OD-5.3 / OD-6.1 / OD-5.5 / OD-2.1 / OD-2.6 / OD-6.4+OD-3.4; OD-2.5→OD-3.3, OD-2.7→OD-3.4,
OD-2.8→OD-3.1, OD-2.9→OD-3.2; OD-3.9→OD-4.8, OD-3.10→OD-4.9; OD-4.4→OD-2.1/2.3,
OD-4.7→OD-3.8; OD-6.11→OD-5.3; OD-7.1→ARCH §16, OD-7.3→OD-5.9, OD-7.6→ARCH §16,
OD-7.8→P2H OD-11, OD-7.9→OD-4.8. 15 fusion `explicit`, 6 `INFERRED`; teks audit historis
tidak dihapus.
**Label: `PARTIAL`** (fusion eksplisit = `VERIFIED`; sebagian substansi = `INFERRED`).

**P7 — Berapa dependency order minimum kritis menuju freeze metodologi tesis?**
Rantai 14 tahap (§8): strategy semantics (OD-2→OD-3) → portfolio (OD-4) → data chain
(OD-5.1→5.2→5.3∥5.4→5.5→5.6→5.7, OD-3.7 menyusul OD-5.3) → acceptance/provenance
(5.8/5.9/5.10) → benchmark (6.2∥6.3∥6.5→6.1) → statistik (6.4; 3.11→6.6→6.7; 6.8∥6.9∥6.10→6.12)
→ kriteria/OOS pre-registration (P2H OD-5→OD-4; P2H OD-9) → artefak reproduksi (7.2/7.4/7.5/7.10
paralel) → canonical (ARCH §16) → alignment kode → satu canonical re-run → statistik dari run itu
→ tabel/figure (7.7/7.11/P2H OD-12) → final freeze (7.12). Cabang paralel sah: data ∥
strategy/portofolio (kecuali OD-3.7 & OD-4.3), 5.3∥5.4, 6.2∥6.3∥6.5, seluruh repro docs.
**Label: `PARTIAL`** (rantai mengikuti tiga sequence yang dipublikasikan + dependensi
eksplisit; keputusan sendok-paralel lintas cabang = preferensi owner).

**P8 — Apakah simulasi final bisa dimulai sekarang?**
**TIDAK.** Gate A `BLOCKED` (46 keputusan metodologi), Gate B `BLOCKED` (dataset belum
frozen), Gate C `PARTIAL`, Gate D `PARTIAL`, Gate E `BLOCKED`, **Gate F `BLOCKED`**.
**Label: `OWNER DECISION REQUIRED`**.

**P9 — Apakah Snapshot A atau B bisa dideklarasikan thesis-canonical sekarang?**
**TIDAK** — keduanya tetap `ENGINEERING SNAPSHOTS`; peran `thesis candidate` = `UNKNOWN`
sampai ARCH §16 dijawab (membawa P2H OD-1, OD-7.1, OD-7.6). `rejected` = tidak ada untuk
keduanya. Klasifikasi yang boleh: `historical evidence` + `engineering reproducibility
reference` + `sensitivity reference`.
**Label: `OWNER DECISION REQUIRED`** (keputusan ARCH §16 tertunda; header §16: "PENDING").

**P10 — Bukti apa yang harus dibekukan sebelum simulasi final?**
Enam gerbang (§24): (A) 46 keputusan metodologi; (B) sumber+periode+missing-bar+timestamp+
manifest/checksum dataset; (C) implementasi yang match metodologi (stop anchor, ordering,
gap precedence); (D) command of record + environment lock + config single-source + ledger
retention + provenance canonical; (E) seluruh definisi statistik (Sharpe, MDD, VaR, VaRSR,
t-test, korelasi, regime, multiple-testing) + pipeline yang bisa regenerasi; (F) baru
kemudian run final + statistik + tabel/figure (OD-7.7/7.11) + evidence-chain freeze (7.12).
**Label: `NOT IMPLEMENTED`** (manifest, ledger B, env lock, command of record, VaR/VaRSR,
cash-day correction, generator 4 report — semuanya belum ada saat ini).

**P11 — Keputusan mana yang tidak boleh dipilih berdasarkan performa?**
12 butir §14: OD-5.3, OD-5.5, OD-6.1, OD-6.2, OD-6.3, OD-4.8, OD-2.1, OD-2.3, OD-2.4,
OD-3.7, OD-6.10, OD-6.8, OD-6.6, OD-6.7, Phase 2H OD-5, OD-6.9 — intinya: treatment gap,
definisi benchmark, urutan aset, semantik stop, timestamp ATR, parameter regime, perlakuan
statistik (t-test/korelasi), kriteria kelulusan.
**Label: `VERIFIED`** (sensitivitas terdokumentasi = bukti bahwa hasil berbeda per opsi;
beberapa aturan larangan juga tertulis eksplisit di OD-5 §27 dan OD-2 finding 3).

**P12 — Apa checklist pre-simulation final?**
25 butir §27 — **0/25 tercentang**; setiap butir terbuka disebutkan penyebabnya (ID
terbuka / ketiadaan freeze record). Kriteria centang: metodologi DAN provenance eksplisit
terfreeze — keberadaan implementasi tidak cukup.
**Label: `PARTIAL`**.

**P13 — Apa yang masih `UNKNOWN` setelah OD-8?**
(1) keaslian data vs venue (blokir DNS); (2) root cause 1.635 hole (belum diuji refetch);
(3) drift numerik lintas-environment (unpinned); (4) ledger B (`PROVENANCE UNKNOWN`); (5) 4
report generator-hilang (`NOT TRACEABLE`); (6) hasil pipeline statistik apapun
(`NOT IMPLEMENTED` — VaRSR, cash-day, generator crash); (7) isi jawaban owner atas 56
keputusan — tidak ada yang bisa ditebak dari bukti yang ada.
**Label: `UNKNOWN`** (untuk butir 1–3, 7) dengan bukti turunan `PROVENANCE UNKNOWN` /
`NOT TRACEABLE` / `NOT IMPLEMENTED` pada butir 4–6.

**P14 — Keputusan owner persis apa yang harus dijawab berikutnya?**
Urutan jawab minimum = 33 BLOCKER (P3), dimulai dari yang tidak punya upstream:
**batch 1 (tanpa dependensi):** OD-2.1, OD-2.3, OD-2.4, OD-2.6, OD-3.1, OD-3.2, OD-3.3,
OD-3.4, OD-3.6, OD-3.8, OD-4.1, OD-4.2, OD-4.8, OD-4.11(joint), OD-5.1, OD-5.3, OD-5.4,
OD-5.5, OD-5.6, OD-6.2, OD-6.3, OD-6.4, Phase 2H OD-5; **batch 2 (bergantung batch 1):**
OD-2.2 (←2.1), OD-4.3 (←2.1/2.3), OD-4.5 (←4.1), OD-3.7 (←5.3), OD-5.2 (←5.1), OD-5.7
(←5.6/5.5), Phase 2H OD-9 (←5.2/5.5), OD-6.1/6.5 (←data+6.2/6.3), Phase 2H OD-4
(←6.1+OD-5); **batch 3 (terakhir):** ARCH §16 (←semua); lalu 15 PRE-FREEZE + 8
DOCUMENTATION (§9) sebelum deklarasi freeze.
**Label: `OWNER DECISION REQUIRED`**.

---

*OD-8 selesai. File ini satu-satunya file baru; tidak ada tracked file yang diubah; tidak
ada commit/push; OD-9 tidak dibuka. Semua sensitivitas = `FORENSIC SENSITIVITY — NOT
CANONICAL`; Snapshot A/B tetap engineering snapshots; tidak ada metodologi yang dipilih
dokumen ini.*

