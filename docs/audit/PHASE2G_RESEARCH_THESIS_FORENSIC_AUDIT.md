# PHASE 2G — Research & Thesis Pipeline Forensic Audit

> **Status:** COMPLETE — AUDIT-ONLY, no repository file other than this report was created, modified, renamed, or deleted.
> **Date:** 2026-09-24
> **Baseline commit:** `b9b61fb` (`b9b61fbec63e3c013abeff6eebf7cbd8e046487d`, post-Phase 2F)
> **Thesis in scope:** "Analisis Efektivitas Strategi Long-Only Donchian Channel Breakout pada Portofolio Cryptocurrency Multi-Aset"
> **Working tree before and after audit:** clean except two pre-existing untracked files (`backtest/reports/bh_max_drawdown.md`, `backtest/reports/bh_drawdown_and_btc_eth_corr.md`) which were left untouched and are NOT part of this phase.

---

## 1. Scope, Method & Evidence Labels

**In scope:** inventory of the research/backtest pipeline, dependency graph, dataset/config/strategy forensics, the +149.59% vs +152.0% metric discrepancy, isolated reproduction, artifact classification, shared-code risks, source-of-truth findings, and the thesis/product boundary.

**Rules observed:**

- Read-only audit. The only write actions were (a) this file and (b) one reproduction run redirected to `/tmp/opencode/phase2g_repro` via the runner's `REPORT_SUBDIR` env hook (`backtest/run_backtest.py:232`). No code, config, dataset, report, notebook, SQL, migration, or package file was touched; no report was regenerated in place; nothing pushed.
- Reproduction was performed only because it required **no** code/config/data change. Snapshot A was **not** re-run because reproducing it requires checking out pre-`029a311` code — a code change — which is forbidden in this phase (recorded as a limitation, §11).
- UNKNOWN ≠ DEAD. No file is declared dead for looking old, messy, or unimported. Vocabulary used exactly as prescribed: THESIS-CRITICAL / RESEARCH-ACTIVE / PRODUCT-ACTIVE / SHARED / REPRODUCIBILITY / UNKNOWN / DEAD-CANDIDATE / CONFIRMED-DEAD. **No artifact reached CONFIRMED-DEAD in this audit.**
- The better-looking metric snapshot was NOT chosen. Canonical determination in §12 is derived from provenance + reproducibility evidence only.

**Evidence labels:** `VERIFIED` = directly observed in file/commit/command output this phase · `STRONGLY SUPPORTED` = converging direct evidence, mechanism partly inferred · `INFERRED` = reasoned from context, no direct artifact · `UNKNOWN` = no sufficient evidence found.

**Key commands run this phase (all read-only except the isolated repro):**

```bash
git status --short ; git rev-parse HEAD
git show 029a311 -- backtest/strategy.py          # P2-7 indicator rewrite diff
git show 029a311 --stat ; git show 9769a0c        # json creation / sharpeRatio addition
git diff e6188de HEAD -- config.yaml              # full diff: comments only
git diff --stat e6188de HEAD -- data/             # only BCH/LTC/PAXG added (c42a478)
git log --oneline --diff-filter=A -- data/historical/{BCH,LTC,PAXG}_USDT_1d.csv
grep -rn "149.59|152.0|26.19|26.45" ...           # citation sweep (md/ts/tsx/yaml)
find/grep for *skripsi* *thesis* *.ipynb *.tex *efektivitas*  → no matches
wc -l / head / tail on data/historical/*.csv, data/funding/*.csv
REPORT_SUBDIR=/tmp/opencode/phase2g_repro ./venv/bin/python backtest/run_backtest.py
git status --short                                # identical after repro
```

---

## 2. Required Context Reading (status)

| Document | Read | Role in this audit |
|---|---|---|
| `ARCHITECTURE.md` | ✅ | §16 metric SoT **PENDING** confirmed; § line 367-368 dual-snapshot table |
| `REPO_MAP.md` | ✅ | §10 inventory, §11/§13 classifications; rows 33-34, 508, 783-784 dual-snapshot notes |
| `PHASE2_SOURCE_OF_TRUTH.md` | ✅ | §7.1 prior provenance + Phase 2A repro of Snapshot B — **re-verified independently this phase, not taken on trust** |
| `PHASE2D_PRODUCT_REALITY_AUDIT.md` | ✅ | context only |
| `PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md` | ✅ | context only (rows 126, 758: marketing numbers = json, canonical pending) |
| `PHASE2F_TARGET_ARCHITECTURE.md` | ✅ | context only (row 927: canonical-metric decision assigned to owner) |

Per-phase research conclusions in those documents are treated as **claims to verify**, not as final findings. Everything asserted below carries its own evidence.

---

## 3. Research Pipeline Inventory

**Code — engine (7 files):**

| File | Role |
|---|---|
| `backtest/run_backtest.py` | Main engine: loads `config.yaml`, computes metrics (`compute_metrics` :182), writes `metrics.md`/`equity_curve.csv`/`trades.csv` (`save_report` :248-277), honours `REPORT_SUBDIR` (:232) and `PRESET` (:39-42) env hooks |
| `backtest/strategy.py` | Shared indicators & position sizing: `atr`, `rsi`, Donchian, supertrend, `position_size`, cluster limits |
| `backtest/research/correlation_mitigation.py` | DD-mitigation experiment matrix (produces the Cluster-A2 decision) |
| `backtest/research/portfolio_size_experiment.py` | 2→10 pair / max-concurrent scaling experiment |
| `backtest/research/regime_segmentation.py` | Bull/bear regime breakdown |
| `backtest/research/sharpe_benchmark.py` | Strategy vs buy-and-hold Sharpe, identical formula |
| `backtest/research/run_capital_efficiency.py` | 5-pair deployment-efficiency run |
| `backtest/research/run_longshort_backtest.py` | Long vs long-short comparison |
| `backtest/research/fetch_funding.py` | Funding-rate fetch from `data.binance.vision` → `data/funding/*.csv` |
| `scripts/fetch_bitget_data.py` | Bitget OHLCV fetch for all `config.yaml` pairs → `data/historical/` (docstring :1-6, VERIFIED provenance) |
| `scripts/compare_live_vs_backtest.py` | Paper-vs-backtest gate evaluation; reads `backtest-reference.json` (:22-25) |
| `backtest/DESIGN.md` | Design doc; §6.1 metric table + dual-snapshot banner (:178-196) |

**Configuration:** `config.yaml` (engine+product runtime params) · `presets/donchian_cluster_a2.yaml`, `presets/sma_crossover.yaml`, `presets/rsi_mean_reversion.yaml` (frozen overlay packs, consumed via `PRESET` env in `run_backtest.py:39-42`).

**Data:** `data/historical/` 13 CSVs (10 config pairs + BCH/LTC/PAXG research candidates) · `data/funding/` 2 CSVs (BTC/ETH). See §5.

**Reports (tracked unless noted):** `backtest/reports/metrics.md` (Snapshot A) · `decision_log.md` · `correlation_mitigation_experiment.md` · `portfolio_size_experiment.md` · `regime_segmentation_analysis.md` · `sharpe_benchmark_comparison.md` · `sharpe_discrepancy_report.md` · `presets/{rsi,sma}/metrics.md` · `research/capital_efficiency/**` (md+csv+png, tracked) · `research/longshort/**` (md+csv+png, tracked) · `regime_segmentation.png` · **untracked/ignored runtime outputs:** `equity_curve.csv`, `trades.csv`, `equity_drawdown.png` (gitignored via `backtest/reports/*.csv|*.png`) · **untracked, pre-existing:** `bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md`.

**Product-consumed research artifacts:** `monitoring/web/lib/backtest-reference.json` (Snapshot B) + `lib/reference.ts` · web pages link `decision_log.md` (`proof/page.tsx`, `Methodology.tsx`, `lib/site.ts`).

**Tests:** `tests/test_strategy.py` (ATR/RSI/Donchian anti-lookahead + sizing), `tests/test_backtest_cash.py` (cash-invariant regression P0-3), `tests/test_presets.py` (frozen preset params + preset↔config consistency), `tests/test_strategy_templates_seed.py`, `tests/test_risk.py`.

**Notebooks:** **none** (`*.ipynb` search: zero matches, VERIFIED). **Thesis documents:** **none** (§12).

---

## 4. Dependency & Data-Flow Graph

```
Bitget API ──scripts/fetch_bitget_data.py──► data/historical/{10 config pairs}.csv ─┐
Yahoo Finance ──correlation_mitigation.fetch_yf (PAXG:157)──► data/historical/{BCH,LTC,PAXG}.csv ─┤ (research only)
data.binance.vision ──backtest/research/fetch_funding.py──► data/funding/{BTC,ETH}USDT_daily.csv ─┤ (funding research only)
                                                                                                  │
config.yaml ──┬──► backtest/run_backtest.py ──imports──► backtest/strategy.py ◄── tests/test_{strategy,backtest_cash}.py
presets/*.yaml ─┘ (PRESET env overlay)      │                 ▲
                                            ├──► backtest/reports/metrics.md          [Snapshot A, frozen @ e6188de]
                                            ├──► backtest/reports/equity_curve.csv    [untracked, on-disk = A-era: final_equity 2495.92]
                                            └──► backtest/reports/trades.csv          [untracked, 94 trades]
backtest/strategy.py ◄──imports── backtest/research/*.py (sys.path.insert; 4 scripts hardcode their own BASE_CFG)
backtest/strategy.py ◄──imports── paper_trading/live_signal.py:34   [LIVE SIGNAL PATH — shared]
config.yaml         ◄──────────── paper_trading/live_signal.py      [risk/strategy params shared]

Frozen Snapshot B: monitoring/web/lib/backtest-reference.json (created 029a311, sharpe added 9769a0c)
   ├──► monitoring/web/lib/reference.ts ──► web UI (proof page, methodology, disclaimer copy)
   └──► scripts/compare_live_vs_backtest.py ──► Fase 2 paper-vs-backtest gate evaluation

backtest/reports/decision_log.md ◄── narrative from research reports ──► PLAN.md / TASKS.md / RULES.md gates
backtest/reports/decision_log.md ──linked from──► web (proof/page.tsx, Methodology.tsx, lib/site.ts)
```

Indirect chains confirmed (research dep ≠ only direct imports): research scripts → research `.md` reports → `decision_log.md` gate history → `PLAN.md`/`TASKS.md`/`RULES.md` decisions; `metrics.md` → `DESIGN.md` §6.1 / README / disclaimer quotes → thesis-facing copy. **No file was classified dead on the basis of missing direct imports.**

---

## 5. Dataset Forensics

**Config universe (`config.yaml:5-15`):** BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA, HYPE (all `/USDT`). Provenance: `scripts/fetch_bitget_data.py` (Bitget OHLCV) — VERIFIED.

| File | Rows | Span | Header |
|---|---|---|---|
| BTC_USDT_1d | 1920 | 2020-11-09 → 2026-09-02 | `open,high,low,close,volume,date` |
| ETH_USDT_1d | 1920 | 2020-11-09 → 2026-09-02 | same |
| XRP_USDT_1d | 1920 | 2020-11-09 → 2026-09-02 | same |
| BNB_USDT_1d | 1717 | 2021-06-01 → 2026-09-02 | same |
| SOL_USDT_1d | 1696 | 2021-06-22 → 2026-09-02 | same |
| LINK_USDT_1d | 1763 | 2021-04-15 → 2026-09-02 | same |
| DOGE_USDT_1d | 1753 | 2021-04-25 → 2026-09-02 | same |
| AVAX_USDT_1d | 1646 | 2021-11-18 → 2026-09-02 | same |
| ADA_USDT_1d | 1521 | 2022-03-23 → 2026-09-02 | same |
| HYPE_USDT_1d | 623 | 2024-12-18 → 2026-09-02 | same |
| BCH_USDT_1d | 2134 | 2020-11-01 → 2026-09-04 | `date,close,high,low,open,volume` |
| LTC_USDT_1d | 2134 | 2020-11-01 → 2026-09-04 | `date,close,high,low,open,volume` |
| PAXG_USDT_1d | 2134 | 2020-11-01 → 2026-09-04 | `date,close,high,low,open,volume` |
| funding/BTCUSDT_daily | 2191 | 2020-08-01 → 2026-07-31 | `date,daily_rate` |
| funding/ETHUSDT_daily | 2191 | 2020-08-01 → 2026-07-31 | `date,daily_rate` |

**Findings (all VERIFIED from file content this phase):**

- **D1 — Staggered pair history:** pairs have unequal windows (oldest 2020-11-09, newest HYPE 2024-12-18, only 623 bars ≈ 1.7 y vs the ~5.8 y portfolio window). The "6-year 10-pair" label overstates per-pair history; early years are effectively a 3-6 pair portfolio. Survivorship bias is already acknowledged in `TASKS.md:33`.
- **D2 — BCH/LTC/PAXG are not config pairs:** different column order, added in `c42a478` (2026-09-07), used only by `correlation_mitigation.py` (PAXG fetch :157; swap experiments :190-211; candidate screen :250-274 → conclusion "PAXG tidak cocok", :356). Not in `config.yaml`. Class RESEARCH-ACTIVE inputs.
- **D3 — Funding data pre-dates price data** (2020-08-01 vs 2020-11-09) and ends 2026-07-31 (one month before price end). Only BTC/ETH; funding research does not cover the 10-pair universe.
- **D4 — Data frozen for both snapshots:** `git diff --stat e6188de..HEAD -- data/` shows **only** the three research CSVs added; the 10 config-pair CSVs are byte-identical between Snapshot A's commit (2026-09-06) and HEAD. Same data for A and B — VERIFIED.
- **D5 — Period label vs actual window:** equity curve (`backtest/reports/equity_curve.csv`, first/last rows) spans **2020-11-09 → 2026-09-02** = `period_days 2123` (5.81 y), yet `backtest-reference.json:3` labels the period `"2020-08 .. 2026-08 (6 tahun, …)"` and copy says "6-year". The label starts ~3 months before any data exists and ends before the data end. Material for a thesis that must state an exact sample window.

---

## 6. Config & Preset Forensics

- **C1 — Strategy params (`config.yaml:17-18,26-27,39-40`):** Donchian entry 20 / exit 10, `risk_per_trade_pct 1.0`, `max_concurrent_positions 5`, fee 0.1%, slippage 0.05%, initial capital 1000.
- **C2 — Config numerically unchanged between snapshots:** full `git diff e6188de HEAD -- config.yaml` = 4 insertions / 2 deletions, **comments only** (`max_concurrent` comment expansion at :27-29; `data_source` comment at :33). No numeric value line changed. VERIFIED — so config is NOT the cause of A≠B.
- **C3 — Presets are frozen and mechanically locked:** `tests/test_presets.py` `FROZEN` dict (:16-33) asserts preset params equal literal values (20/10/14/2.0/cluster 2, SMA 20/50, RSI 14/30/55); `test_donchian_preset_matches_config` (:51-57) asserts `config.yaml` strategy params, pairs and risk equal the preset's. Strategy/risk numerics are therefore test-pinned. VERIFIED.
- **C4 — Snapshot-A quotes inside config/preset comments:** `config.yaml:23` ("DD -26.19%") and `presets/donchian_cluster_a2.yaml:2` ("DD -26.19%, 94 trade") quote **Snapshot A** while runtime SoT (§16) quotes B — mixed citations inside configuration files themselves. VERIFIED.
- **C5 — Research scripts duplicate config:** `correlation_mitigation.py:28-32`, `sharpe_benchmark.py:115-132`, `portfolio_size_experiment.py`, `regime_segmentation.py` hardcode their own `BASE_CFG`. Current values match `config.yaml` (20/10/14, risk 1.0, max 5, capital 1000, fee 0.1, slip 0.05 — VERIFIED for correlation/sharpe), but the duplication is an unreferenced copy: **a future `config.yaml` edit will not propagate to these experiment scripts** (drift risk, not a current mismatch). `run_capital_efficiency.py` and `run_longshort_backtest.py` use `load_config()` instead — two conventions coexist.
- **C6 — `decision_log.md:12` "+152%" trap:** that `+152%` belongs to the old **2-pair Binance** run (Sharpe 1.06, DD −15.4%, 62 trades), explicitly "TIDAK reproducible" per `PLAN.md:211` — it is a **numerical coincidence** with Snapshot B, not a citation of it. Same caution applies to `PLAN.md:42` ("+152%→+862%", pair-scaling experiment baseline): AMBIGUOUS, likely the old baseline, not Snapshot B. INFERRED from adjacent context.

---

## 7. Strategy / Engine Forensics

- **E1 — Engine entry:** `cli.py:29-30` wraps `backtest/run_backtest.py`; runner overlays frozen presets (`PRESET` env, `run_backtest.py:39-42`), computes metrics (:182), writes reports (:248-277) and can redirect all output (`REPORT_SUBDIR`, :232) — the sanctioned isolation hook used for §10.
- **E2 — Indicators shared with live:** `paper_trading/live_signal.py:34` imports `atr, donchian_high, donchian_low, position_size, cluster_position_count` from `backtest/strategy.py`; docstring :10 declares "sinyal identik dengan backtest … satu source of truth". VERIFIED.
- **E3 — The P2-7 change (`029a311`, 2026-09-12 23:00 +0700):** `git show 029a311 -- backtest/strategy.py` shows `atr()` rewritten from pandas `ewm(alpha=1/period)` seeding to explicit Wilder recursion (SMA seed at index `period-1`, manual loop), and `rsi()` rewritten from `ewm` to explicit gain/loss recursion with seed at index `period`. Same commit created `monitoring/web/lib/backtest-reference.json` ("angka referensi di-update" + "P2-8 satu sumber backtest-reference.json" in commit message). VERIFIED.
- **E4 — Sharpe added later:** `9769a0c` (2026-09-13) adds `"sharpeRatio": 0.82` to the json (diff observed). VERIFIED.
- **E5 — Engine guardrails:** `tests/test_strategy.py` covers position sizing, ATR, Donchian anti-lookahead, RSI (added with P2-7); `tests/test_backtest_cash.py` pins the cash-invariant. These are the existing reproducibility guards for the engine core. VERIFIED.
- **E6 — Prior metric-drift precedent:** `backtest/reports/sharpe_discrepancy_report.md` (2026-09-05, status Selesai) documents an earlier Sharpe discrepancy (historical 1.06 claim vs reproducible 0.53 on then-current code) — the repository has a **repeated pattern** of quoted numbers lagging code. VERIFIED (file exists, header read).

---

## 8. Metric Discrepancy — Snapshot A vs Snapshot B (full comparison)

| Metric | Snapshot A — `backtest/reports/metrics.md` | Snapshot B — `monitoring/web/lib/backtest-reference.json` | Δ |
|---|---|---|---|
| total return | **+149.59%** (:5) | **+152.0%** (:11) | +2.41 pp |
| max drawdown | **−26.19%** (:9) | **−26.45%** (:10) | −0.26 pp |
| CAGR | 17.04 (:6) | (not in json; repro 17.24) | +0.20 |
| final equity | 2495.92 (:13) | (not in json; repro 2520.02) | +24.10 |
| avg win R | **4.31** (:10) | **4.35** (:6) | +0.04 |
| avg loss R | **−0.84** (:11) | **−0.85** (:7) | −0.01 |
| avg R | **1.02** (:8) | **1.03** (:8) | +0.01 |
| profit factor | **2.26** (:12) | **2.27** (:9) | +0.01 |
| sortino | 0.84 (:7) | (not in json; repro 0.85) | +0.01 |
| Sharpe | 0.82 (:7) | 0.82 (:11 of json) | — |
| win rate | 36.17 (:8) | 36.17 (:5) | — |
| trades | 94 (:9) | 94 (:13) | — |
| trades/year | (implied ~15.7) | 15.7 (:15) | — |
| buy & hold | 155.03 (:12) | (not in json; repro 155.03) | — |
| period_days | 2123 (:14) | (label "2020-08..2026-08", :3) | label vs value mismatch |

Common ground: Sharpe 0.82, 94 trades, win rate 36.17%, B&H +155.03%, period 2123 days — identical across both snapshots and both reproduction runs. The divergence is confined to return/DD/R-multiple/PF/CAGR-level quantities (VERIFIED by direct file reads this phase).

---

## 9. Provenance & Root Cause of +149.59% vs +152.0%

**Timeline (all VERIFIED from git):**

| When | Commit | Event |
|---|---|---|
| 2026-09-06 | `e6188de` | `backtest/reports/metrics.md` last written → **Snapshot A frozen** (runner output of pre-P2-7 engine) |
| 2026-09-07 | `c42a478` | research scripts + BCH/LTC/PAXG CSVs + funding data committed (no config-pair data touched) |
| 2026-09-12 23:00 | `029a311` | **P2-7:** `atr()`/`rsi()` rewritten to explicit Wilder recursion in `backtest/strategy.py`; same commit **creates `backtest-reference.json` with updated reference numbers** → **Snapshot B born** |
| 2026-09-13 | `9769a0c` | `sharpeRatio: 0.82` added to Snapshot B |
| 2026-09-06 → HEAD | — | `config.yaml` changed **comments only**; 10 config-pair CSVs **unchanged** (D4/C2) |

**Root cause (STRONGLY SUPPORTED):** same data (D4) + same numeric config (C2) + **different indicator implementation** (E3). The Wilder-seed rewrite changed ATR trajectories (feeding supertrend trailing stops / stop distances) and RSI values; entries are Donchian-driven (unchanged), which is consistent with the observed signature: **trade count stays 94 and win rate stays 36.17%, while exit prices, R denominators and the equity path shift slightly** → +149.59% → +152.0%, −26.19% → −26.45%. The exact per-trade mechanism was not line-traced (would require diffing A-era `trades.csv` against a forbidden pre-fix re-run) — that residual step is labeled INFERRED; the commit-level attribution is VERIFIED.

**Corroborating A-era artifact:** the untracked on-disk `backtest/reports/equity_curve.csv` ends at `2495.92` — exactly Snapshot A's `final_equity` — showing the repo-dir outputs were never regenerated after P2-7 (the runner was later invoked only with `REPORT_SUBDIR`, cf. Phase 2A). STRONGLY SUPPORTED.

**Why both survive:** `metrics.md` is written by the runner but **read by no code** (`grep -l "metrics.md" --include=*.py --include=*.ts*` → only `run_backtest.py`, the writer). Snapshot B, by contrast, is consumed at runtime (§16). Snapshot A persists as human/thesis-facing quotation material. VERIFIED.

---

## 10. Reproduction (this phase, isolated)

**Command (exact):**

```bash
REPORT_SUBDIR=/tmp/opencode/phase2g_repro ./venv/bin/python backtest/run_backtest.py
```

- Tree: HEAD `b9b61fb`, unmodified `config.yaml`, unmodified `data/historical/*.csv` — **no code/config/data change was needed or made**.
- Outputs landed in `/tmp/opencode/phase2g_repro/` (`metrics.md`, `equity_curve.csv`, `trades.csv`, `equity_drawdown.png`); the repo was untouched: `git status --short` identical before and after (only the two pre-existing untracked `bh_*.md`).

**Result (VERIFIED, timestamp 2026-09-24 02:51):**

| metric | reproduced | Snapshot B | match |
|---|---|---|---|
| total_return_pct | 152.0 | 152.0 | ✅ |
| max_drawdown_pct | −26.45 | −26.45 | ✅ |
| avg_win_r | 4.35 | 4.35 | ✅ |
| avg_loss_r | −0.85 | −0.85 | ✅ |
| avg_r_multiple | 1.03 | 1.03 | ✅ |
| profit_factor | 2.27 | 2.27 | ✅ |
| sharpe | 0.82 | 0.82 | ✅ |
| win_rate_pct | 36.17 | 36.17 | ✅ |
| n_trades | 94 | 94 | ✅ |
| trades/yr (15.7 implied) | 94/2123·365 = 15.75 | 15.7 | ✅ |
| cagr_pct 17.24 / sortino 0.85 / bh 155.03 / final_equity 2520.02 / period_days 2123 | — | not in json; match Phase 2A §7.1 record | ✅ |

**Conclusion (VERIFIED):** current HEAD reproduces **Snapshot B, all 14 engine metrics, exactly** — an independent second reproduction (first was Phase 2A, `PHASE2_SOURCE_OF_TRUTH.md:183`, whose recorded numbers match this run field-for-field).

---

## 11. Reproducibility Limitations (what was deliberately NOT done)

1. **Snapshot A was not re-run.** Reproducing it requires checking out pre-`029a311` code — i.e. changing code — which this audit forbids (temp `REPORT_SUBDIR` output is allowed; code checkout is not). Its provenance therefore rests on git evidence: frozen runner output at `e6188de` + the A-era on-disk `equity_curve.csv` (final equity 2495.92) + identical data/config since. STRONGLY SUPPORTED, not re-executed.
2. **No report was regenerated in place**, no metrics file "cleaned up", no quote harmonized — canonical choice is an owner decision (§12), explicitly out of scope.
3. **No in-place testing of research scripts** (`correlation_mitigation.py`, etc.): they were read, not executed — running them writes reports into `backtest/reports/`, which would modify tracked outputs. Their current executability is UNKNOWN.
4. **No push, no branch, no file renames/deletions.**

---

## 12. Canonical Assessment & Thesis-Facing Source Status

**Thesis-facing source: NOT PRESENT IN THE REPO — NOT ESTABLISHED (UNKNOWN).**
Searches VERIFIED this phase: filenames `*skripsi*`, `*thesis*`, `*tugas*`, `*efektivitas*`, `*.ipynb`, `*.tex` → **zero matches**; content search for the thesis title phrases ("Analisis Efektivitas Strategi…", "efektivitas strategi", "long-only donchian channel breakout pada") in md/ts/tsx/py → **zero matches**. There is no thesis document, notebook, or thesis-facing export in this repository, and therefore **no in-repo evidence of which snapshot the thesis quotes.**

**Canonical determination from provenance + reproducibility only (not from which looks better):**

1. **Snapshot B is the only snapshot reproducible from the current tree** — VERIFIED twice (Phase 2A + this phase, §10).
2. **Snapshot A is a genuine historical runner output** of the pre-P2-7 engine on the same data/config (§9, STRONGLY SUPPORTED) but is reproducible only by reverting code — not attempted (§11).
3. `metrics.md` has no code consumer; `backtest-reference.json` is runtime-consumed (§16).
4. The repository itself explicitly records that **the canonical decision is pending and belongs to the owner**: `ARCHITECTURE.md` §16 (:367-368), `README.md:94-100`, `TASKS.md:33`, `PHASE2F_TARGET_ARCHITECTURE.md:927`.

**Finding:** the *engineering-reproducible reference today* is **Snapshot B**; the *canonical-for-thesis* value is **UNKNOWN/NOT ESTABLISHED** because the thesis-facing artifact is absent and the owner decision is open. This report does **not** pick one — it records both, exactly as the audit rules require.

---

## 13. Citation Map — where each snapshot is quoted

**Snapshot A (+149.59 / −26.19 / 4.31 / −0.84 / 1.02 / 2.26):**

| Location | Line(s) | Note |
|---|---|---|
| `backtest/reports/metrics.md` | 5, 9 | file itself (runner output) |
| `backtest/DESIGN.md` | 132, 193-194 | §6.1 final table + DD narrative |
| `backtest/reports/decision_log.md` | 66, 69, 95, 99, 111-112 | gate decisions + final table |
| `backtest/reports/correlation_mitigation_experiment.md` | 29, 47, 77, 90 | Exp A2 result row |
| `config.yaml` | 23 | comment: DD −26.19% |
| `presets/donchian_cluster_a2.yaml` | 2 | comment: DD −26.19%, 94 trade |
| `PLAN.md` | 211 | gate record (historical) |
| `RULES.md` | 56 | DD acceptance rationale |
| `TASKS.md` | 18 | historical gate quote (annotated at :33) |

**Snapshot B (+152.0 / −26.45 / 4.35 / −0.85 / 1.03 / 2.27):**

| Location | Line(s) | Note |
|---|---|---|
| `monitoring/web/lib/backtest-reference.json` | 3, 5-16 | file itself (runtime SoT) |
| `monitoring/web/lib/reference.ts` | 1-24 | imports json, exports `BACKTEST_REFERENCE` + eval thresholds |
| `monitoring/web/app/disclaimer/page.tsx` | 25 | "+152%" |
| `TASKS.md` | 27, 33 | Fase 2 eval reference + dual-snapshot annotation |
| `scripts/compare_live_vs_backtest.py` | 22-25 | gate evaluator reads json |
| `AUDIT.md` | 169 | W-6 finding |

**Mixed / paired / ambiguous:**

| Location | Lines | Note |
|---|---|---|
| `monitoring/web/app/disclaimer/page.tsx` | **18 (A: −26.19) + 25 (B: +152)** | **both snapshots on one page** — VERIFIED |
| `README.md` | 94-100 | explicitly presents both + "canonical pending" |
| `ARCHITECTURE.md` | 367-368 | §16 A-vs-B table, decision pending |
| `REPO_MAP.md` | 33-34, 508, 783-784 | inventory notes; :508 labels A "output backtest resmi" |
| `backtest/DESIGN.md` | 178-185 | dual-snapshot banner |
| `backtest/reports/decision_log.md` | **12** | "+152%" = **old 2-pair Binance run, coincidence, NOT Snapshot B** (C6) |
| `PLAN.md` | **42** | "+152%→+862%" pair-scaling baseline — AMBIGUOUS, likely old baseline (C6) |
| `PHASE2_SOURCE_OF_TRUTH.md` | 38-40, 178-183, 199 | provenance analysis |
| `PHASE2B2_AUDIT.md` :259 · `PHASE2E` :126, 758 · `PHASE2F` :927 · `AUDIT.md` :169 | — | prior-phase governance notes |

---

## 14. Artifact Classification Matrix

Confidence column: how solid the classification itself is (not the artifact's quality).

| Artifact | Classification | Role | Inputs | Outputs | Thesis Relevance | Product Relevance | Evidence | Confidence |
|---|---|---|---|---|---|---|---|---|
| `backtest/run_backtest.py` | THESIS-CRITICAL | Engine producing both snapshots | config.yaml, presets, data/historical, strategy.py | metrics.md, equity_curve.csv, trades.csv | **the** result generator | none direct (cli wrapper only) | §7 E1, §10 | HIGH |
| `backtest/strategy.py` | SHARED | Indicators/sizing used by engine, research, live signal, tests | OHLCV frames | signal/stop/size series | result semantics | live signal correctness | :34 live_signal import, §7 E3 | HIGH |
| `config.yaml` | SHARED | Strategy/risk/backtest params for engine **and** paper/live | — | — | reproduction input | live/risk config | §6 C1-C2, live_signal cfg use | HIGH |
| `data/historical/{10 config pairs}.csv` | THESIS-CRITICAL | Backtest input dataset | Bitget via fetch_bitget_data.py | — | sample window | none (live uses venue data) | §5 D1/D4 | HIGH |
| `data/historical/{BCH,LTC,PAXG}.csv` | RESEARCH-ACTIVE | Correlation candidate screen | Yahoo (PAXG :157) / fetch at `c42a478` | candidate conclusions | methodology appendix at most | none | §5 D2, corr :250-274 | MED (fetch path for BCH/LTC not line-identified) |
| `data/funding/*.csv` + `fetch_funding.py` | RESEARCH-ACTIVE | Funding-rate research inputs | data.binance.vision | 2 CSVs | niche (funding cost discussion) | none | §5 D3, fetch_funding docstring | HIGH |
| `backtest/reports/metrics.md` | THESIS-CRITICAL | **Snapshot A** frozen runner output | engine run @ e6188de | quoted by DESIGN/decision_log/RULES/TASKS | historical gate numbers | none (no code reader) | §9, grep no readers | HIGH |
| `monitoring/web/lib/backtest-reference.json` | PRODUCT-ACTIVE *(also SHARED: eval gate)* | **Snapshot B** runtime reference + eval thresholds | frozen copy of repro @ 029a311 | reference.ts, compare_live_vs_backtest.py | reproducible reference numbers | marketing + gate config | §10, :22 compare, :5 reference.ts | HIGH |
| `monitoring/web/lib/reference.ts` | PRODUCT-ACTIVE | Exposes json to UI + eval constants | backtest-reference.json | `BACKTEST_REFERENCE`, thresholds | indirect | direct | :1-24 | HIGH |
| `scripts/compare_live_vs_backtest.py` | RESEARCH-ACTIVE | Fase 2 paper-vs-backtest gate | backtest-reference.json, paper state | gate verdicts | live-vs-BB expectation basis | paper monitoring | :22-25 | HIGH |
| `scripts/fetch_bitget_data.py` | RESEARCH-ACTIVE | Dataset fetcher | config pairs, Bitget API | data/historical CSVs | data provenance | none | docstring :1-6 | HIGH |
| `backtest/research/correlation_mitigation.py` | RESEARCH-ACTIVE | DD-mitigation experiment matrix → Cluster-A2 decision | CSVs, hardcoded BASE_CFG | `correlation_mitigation_experiment.md` | **methodology evidence** | none | §6 C5, report rows | HIGH |
| `backtest/research/portfolio_size_experiment.py` | RESEARCH-ACTIVE | Pair/concurrency scaling (incl. +862% survivorship run) | CSVs, BASE_CFG | `portfolio_size_experiment.md` | survivorship-bias evidence | cited caveat in copy | report exists, PLAN:42 | HIGH |
| `backtest/research/regime_segmentation.py` | RESEARCH-ACTIVE | Regime breakdown | CSVs, BASE_CFG | `regime_segmentation_analysis.md` + png | regime analysis section | none | report exists | HIGH |
| `backtest/research/sharpe_benchmark.py` | RESEARCH-ACTIVE | Sharpe comparison vs B&H | CSVs, own cfg variants | `sharpe_benchmark_comparison.md` | benchmark table | none | §6 C5 | HIGH |
| `backtest/research/run_capital_efficiency.py` | RESEARCH-ACTIVE | 5-pair deployment efficiency | load_config() | `research/capital_efficiency/**` (tracked) | efficiency evidence | none | outputs tracked (git ls-files) | HIGH |
| `backtest/research/run_longshort_backtest.py` | RESEARCH-ACTIVE | Long vs long-short comparison | load_config() | `research/longshort/**` (tracked) | scope boundary (long-only choice) | none | outputs tracked | HIGH |
| `presets/*.yaml` (3) | RESEARCH-ACTIVE *(frozen params, test-pinned)* | Parameter packs for reproducible runs | params literals | overlay onto engine run | exact reproduction config | guardrail mirror | §6 C3, PRESET env :39-42 | HIGH |
| `backtest/reports/decision_log.md` | SHARED | Gate history narrative | research reports | PLAN/TASKS/RULES decisions | methodology backbone | linked from proof/methodology pages | §4 graph, web links | HIGH |
| `backtest/DESIGN.md` | THESIS-CRITICAL | Design + §6.1 annotated metrics | — | — | methods description | links only | :178-196 | HIGH |
| `backtest/reports/correlation_mitigation_experiment.md` | RESEARCH-ACTIVE | Exp A2 row = Snapshot A numbers | corr script | decision_log | experiment evidence | none | :29,47,77,90 | HIGH |
| `backtest/reports/sharpe_discrepancy_report.md` | REPRODUCIBILITY | Prior metric-drift investigation (2026-09-05) | — | conclusion "0.53 reproducible then" | precedent for drift | none | header read | HIGH |
| `backtest/reports/sharpe_benchmark_comparison.md` | RESEARCH-ACTIVE | B&H benchmark table | sharpe_benchmark.py | — | benchmark | none | header read | HIGH |
| `backtest/reports/portfolio_size_experiment.md`, `regime_segmentation_analysis.md` | RESEARCH-ACTIVE | Experiment writeups | research scripts | decision evidence | methodology | none | files exist, tracked | HIGH |
| `backtest/reports/presets/{rsi,sma}/metrics.md` | REPRODUCIBILITY | Alternative-model preset runs | presets | metrics snapshots | robustness comparison | none | tracked (ls-files) | HIGH |
| `backtest/reports/equity_curve.csv`, `trades.csv`, `equity_drawdown.png` (on-disk, ignored) | REPRODUCIBILITY | A-era run artifacts (final_equity 2495.92) | engine run | — | trade-level evidence if preserved | none | §9 corroboration | MED-HIGH (era inferred from equity value) |
| `backtest/reports/research/{capital_efficiency,longshort}/**` (csv/png/md, tracked) | RESEARCH-ACTIVE | Raw experiment outputs | research scripts | curves/trades tables | appendix material | none | git ls-files | HIGH |
| `bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md` (untracked) | **UNKNOWN** | B&H side analyses, pre-date this phase | unknown (B&H metrics) | none found | possibly thesis B&H section | none found | untracked; no importer found; **not declared dead** | LOW by design |
| `tests/test_strategy.py` | REPRODUCIBILITY | Guards ATR/RSI/Donchian/sizing semantics | — | CI signal | protects result semantics | protects shared module | docstring, E5 | HIGH |
| `tests/test_backtest_cash.py` | REPRODUCIBILITY | Cash-invariant regression (P0-3) | — | CI signal | engine correctness | paper cash safety | docstring | HIGH |
| `tests/test_presets.py` | REPRODUCIBILITY | Freezes preset params + preset↔config consistency | presets, config.yaml | CI signal | prevents silent param drift | guardrail lock | :16-57 | HIGH |
| `cli.py` (`backtest` cmd) | PRODUCT-ACTIVE *(dev tooling)* | Runner wrapper | run_backtest.py | exit code | convenience only | operator UX | :29-30,155 | HIGH |
| `scripts/sync_paper_to_supabase.py` | PRODUCT-ACTIVE | Paper→Supabase sync | paper state | Postgres | none (live evidence only) | dashboard data | consumers in web | HIGH |
| Notebooks (`*.ipynb`), thesis docs (`*.tex`, `*skripsi*`) | — (do not exist) | — | — | — | **absent** | — | zero-match search, §12 | HIGH |

**CONFIRMED-DEAD: none. DEAD-CANDIDATE: none raised** — every inventoried artifact has a live, indirect, or UNKNOWN role.

---

## 15. Shared-Code & Cross-Boundary Risks

| # | Risk | Evidence | Severity |
|---|---|---|---|
| R1 | **`backtest/strategy.py` is imported by engine, all research scripts, `paper_trading/live_signal.py:34`, tests — and Phase 2F plans product-runtime reuse.** A product-side refactor/optimisation of indicators silently changes thesis results. This already happened once at commit level: a *hardening* commit (`029a311`) changed thesis metrics (+149.59→+152.0). | §7 E3, §9, §4 graph | **HIGH** |
| R2 | **`config.yaml` serves backtest AND live/risk.** Editing risk params for product operation changes thesis reproduction inputs. Currently only comment drift (C2), and strategy/risk values are test-pinned via preset consistency (C3) — but `fee_pct`, `slippage_pct`, `initial_capital_usd`, `data_source` have no observed pin. | C2, C3 | MED |
| R3 | **Four research scripts hardcode `BASE_CFG` copies of config values.** Config edits won't propagate → future experiment reports silently non-comparable with main backtest. | C5 | MED |
| R4 | **`backtest-reference.json` mixes marketing metrics with Fase-2 eval thresholds** (`evalMinTrades`, `winRateTolerancePp`, `avgRFloor`, slippage alerts). Copy edits and gate config live in one file. | json :13-17, reference.ts :20-24 | MED |
| R5 | **Product pages deep-link research record `decision_log.md`** (proof/methodology). Editing research history for product copy would falsify thesis methodology evidence. | §4 graph | MED |
| R6 | **Mixed snapshot quotes have already spread into config comments, presets, disclaimer (both on one page), PLAN/RULES/TASKS/README.** Any "harmonisation" without an owner decision would silently rewrite historical gate records. | §13 | MED |
| R7 | **Coincidental "+152%"** in `decision_log.md:12` / `PLAN.md:42` can be mis-cited as Snapshot B support in the thesis. | C6 | LOW-MED (documentation) |
| R8 | Research scripts execute only via `sys.path.insert` hacks; their current executability is untested (running them would overwrite tracked reports). | §11.3 | LOW (UNKNOWN) |

---

## 16. Source-of-Truth Findings

1. **Canonical backtest metric:** **PENDING owner decision** — `ARCHITECTURE.md` §16, `README.md:94-100`, `TASKS.md:33`, `PHASE2F:927` all say so explicitly. UNCHANGED by this audit; §12 adds reproducibility evidence but does not decide.
2. **Product runtime number SoT:** `monitoring/web/lib/backtest-reference.json` via `reference.ts` — VERIFIED (sole json import; mirrored by `compare_live_vs_backtest.py:22`).
3. **Engine reproduction SoT:** `(config.yaml, presets/, data/historical 10 pairs, backtest/*.py @ commit)` → currently reproduces Snapshot B exactly — VERIFIED (§10, twice total).
4. **Historical gate record SoT:** `backtest/reports/metrics.md` (Snapshot A) + `decision_log.md` — frozen at `e6188de`, quoted by RULES/PLAN/TASKS/DESIGN. STRONGLY SUPPORTED as intentional historical record.
5. **Data SoT:** `data/historical/*.csv` from `scripts/fetch_bitget_data.py` (Bitget) — VERIFIED; note D5 (period label vs actual window) must be corrected in any thesis sample-window statement.
6. **Thesis-facing SoT:** **ABSENT — NOT ESTABLISHED (UNKNOWN).** No thesis artifact exists in the repo to reconcile against (§12).
7. Prior-phase conclusions in `PHASE2_SOURCE_OF_TRUTH.md` §7.1 were re-derived independently this phase and **hold** (timeline, config/data invariance, B-reproduction).

---

## 17. Thesis ↔ Product Boundary, UNKNOWN Register & Recommendations

### 17.1 Boundary

| Concern | Belongs to | Current state |
|---|---|---|
| Engine + indicators + data + frozen params + metric definitions + gate history | **Thesis side** | In `backtest/`, `data/`, `presets/`, `config.yaml`, `backtest/reports/` — intact, reproducible (B), history frozen (A) |
| Display of reference numbers, marketing copy, eval thresholds shown to users | **Product side** | In `monitoring/web/lib/*` + pages — consumes Snapshot B only |
| Overlaps (violation pressure) | — | (a) `strategy.py` shared with live + future product runtime (R1); (b) `config.yaml` shared with live/risk (R2); (c) product pages link research `decision_log.md` (R5); (d) product's json differs from thesis-era `metrics.md` and both are quoted publicly (R6); (e) eval thresholds bundled with marketing json (R4) |

The boundary is **currently documented but not mechanised**: nothing stops a product refactor from changing thesis numbers, and no in-repo thesis artifact pins which snapshot the thesis used.

### 17.2 UNKNOWN register (explicitly not resolved, not guessed)

- **U1** Which snapshot the thesis quotes / where the thesis document lives — absent from repo (§12).
- **U2** Consumer of `metrics.md` beyond humans — no code reader found; probable human/thesis use only (§9).
- **U3** Exact fetch provenance of BCH/LTC CSVs (PAXG fetch line verified at `correlation_mitigation.py:157`; BCH/LTC fetch call not line-identified; committed `c42a478`).
- **U4** Whether on-disk `trades.csv` is byte-for-byte A-era (same-run inference from `equity_curve.csv` final equity only).
- **U5** Current executability of the 7 research scripts (not run; would overwrite tracked reports).
- **U6** Purpose/consumers of untracked `bh_*.md` (pre-existing, no importer found — NOT classified dead).
- **U7** Whether `fee_pct`/`slippage_pct`/`initial_capital_usd` are pinned by any test (strategy/risk are, via `test_presets.py`; backtest block not observed pinned).
- **U8** Whether the thesis's sample-window wording matches the actual 2020-11-09..2026-09-02 (D5) — unknowable without the thesis.

### 17.3 Recommendations (NO action taken — all require owner direction)

1. **Owner decides canonical snapshot** (already assigned in `PHASE2F:927`), then regenerate the *other* artifact and fix quotes **in one pass**; until then treat §13 as the quote-fix checklist. Do not "quietly equalise" numbers (TASKS:33 prohibition stands).
2. **Pin reproduction inputs for the thesis appendix:** engine commit hash, `config.yaml` hash, the 10 CSV hashes, and the exact window **2020-11-09 → 2026-09-02 (2123 days)** — not "2020-08..2026-08".
3. **Treat `backtest/strategy.py` as a thesis-critical API:** any product refactor must run `tests/test_strategy.py` + a Snapshot-B reference check before merge (R1).
4. Consider splitting eval thresholds out of the marketing json and moving Snapshot-A quotes in `config.yaml:23` / `presets/donchian_cluster_a2.yaml:2` to a marked historical-record form (owner decision; comments only).
5. Add the missing pins (U7) and a BASE_CFG→config loader for the four duplicating research scripts (C5) when research is next touched — not in this audit.

---

*Phase 2G complete. Verification: `git status --short` shows only the two pre-existing untracked `bh_*.md` plus this new file; `git diff --check` clean; no tracked file modified. This report is the only change.*
