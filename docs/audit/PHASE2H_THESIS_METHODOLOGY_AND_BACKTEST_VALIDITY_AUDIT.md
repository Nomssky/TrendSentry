# Phase 2H — Thesis Methodology & Backtest Validity Audit

**Analisis Efektivitas Strategi Long-Only Donchian Channel Breakout pada Portofolio Cryptocurrency Multi-Aset**

Audit type: **forensic, read-only**. No strategy/backtest/research code, data, config, reports, thesis artifacts, Supabase, product code, dependencies, workflows, or git history were modified. No commit, no push. This file is the only repository change.

| Item | Value |
|---|---|
| Repo HEAD | `73856fa` (`73856fa74ee5f2a5a50d6d01a266e18d7aef6ff2`) |
| Audit date | 2026-09-24 |
| Pre-existing untracked files | `backtest/reports/bh_drawdown_and_btc_eth_corr.md`, `backtest/reports/bh_max_drawdown.md` (preserved, untouched) |
| Temp artifacts (outside repo) | `/tmp/phase2h_repro/`, `/tmp/phase2h_verify.py` + `_out.txt`, `/tmp/phase2h_ab_diff.py` + `_out.txt`, `/tmp/phase2h_stops.py` + `_out.txt`, `/tmp/phase2h_sens/` (incl. `metrics_raw.md`, `metrics_sensitivity.md`, `sensitivity_out.txt`), `/tmp/phase2h_searches.txt` |
| Test suite | 70 passed (`./venv/bin/python -m pytest tests/ -q`, run this session) |

---

## 1. Executive Summary

This audit establishes exactly what methodology the repository implements for the Donchian/ATR long-only backtest, which parts are academically defensible, which are ambiguous or contradicted by their own documentation, and what the owner must decide before any number can be frozen as *the* thesis result.

**Bottom line: `THESIS BASELINE NOT YET FROZEN.`** Two metric snapshots (A: +149.59%/−26.19%, B: +152.0%/−26.45%) coexist; the repo's own source-of-truth map declares the canonical choice `PENDING` (`ARCHITECTURE.md:358`); the headline numbers depend on an unresolved data-gap policy (Finding F1); and the decision-gate claims in `RULES.md`/`PLAN.md`/`TASKS.md`/`presets/` contradict their own arithmetic (Finding F4). This audit does **not** designate Snapshot A or B as the thesis result and does **not** propose corrected numbers as results.

**Headline findings (all evidence-labeled in later sections):**

- **F1 — Data-gap artifacts in the headline drawdown (VERIFIED).** Every non-HYPE pair dataset contains ~100-day synchronized intra-series holes plus rotating single-day holes (1,635 missing bars total) present since the first data commit. The engine zeroes a held position's marked-to-market value on days its pair has no candle (`run_backtest.py:171–175`), producing 4 artifact return days (|r| > 10%), and the reported max drawdown **−26.45% trough lands exactly on artifact day 2023-01-22**. A forward-fill sensitivity run (in `/tmp`, engine unmodified) moves Sharpe 0.82→1.10 and max DD −26.45→−18.10 — evidence that gap handling materially drives the headline metrics, **not** a corrected result.
- **F2 — The B&H benchmark Sharpe 0.98 is inflated by the same gaps (VERIFIED).** The staggered sleeve construction replicates exactly (Sharpe 0.9809, mean/std match `sharpe_benchmark_comparison.md` to 6 decimals) but its daily series contains 13 artifact days |r| > 50% (stub-collapse when assets are missing); excluding them gives 0.8787. The benchmark family also spans ≥7 incompatible constructions (155.03 idle-cash scalar / 154.85 / 418.32 / 401.07 / 570.78 / +767% fully-rebalanced / −58.44 period-limited).
- **F3 — Stop-loss: documentation contradicts code, and DESIGN contradicts itself (VERIFIED).** `DESIGN.md:37` and `config.yaml:20` document "stop = Entry − 2×ATR"; code implements `stop = prev_close − 2×prev_ATR` (`run_backtest.py:133`), which `DESIGN.md:64,221` also states. Gap-stop precedence: the documented "gap down → exit at open" only fires when the close recovers above the stop; a close-below-stop gap exits at **close**, labeled `stop_loss` (synthetic CASE1/CASE2 tests VERIFIED; 2 historical exits on 2025-03-04 match CASE2 and would have filled *worse* at the open under doc-faithful behavior; 0 trades ever took the `gap_stop` branch).
- **F4 — Gate claims contradict arithmetic (VERIFIED).** `RULES.md:55` requires Sharpe > B&H and `:57` requires Return > B&H. Actual: 0.82 < 0.98 and 149.59/152.0 < 155.03 — both fail, yet `TASKS.md:18` says "terpenuhi", `presets/donchian_cluster_a2.yaml:31` says `sharpe_vs_bnh: above`, while `decision_log.md:95` honestly records "selisih −0.16, diterima". The criterion itself was revised (≥1.0 → >B&H) *after* seeing that no config reached 1.0.
- **F5 — Data snooping, no out-of-sample anywhere (VERIFIED).** Cluster-A2 is the best of 9 variants chosen on the same data used to report its metrics; PAXG/LTC/BCH were rejected on backtest grounds; zero hits for walk-forward/out-of-sample/holdout/purged CV anywhere in the repo.
- **F6 — Sample-period label mismatch (VERIFIED).** Actual curve: 2020-11-09 → 2026-09-02 = 2,123 days = **5.81 years**. Labels claim "2020-08 .. 2026-08 (6 tahun)" in `backtest-reference.json`, `decision_log.md:120`, `config.yaml:37`, disclaimer and marketing (`ProofStrip.tsx:37`) — a label inherited from a pre-Bitget dataset.
- **F7 — A→B attribution completed beyond Phase 2G (VERIFIED).** Two behavioral commits sit between A (`e6188de`, 2026-09-06) and B (`029a311`, 2026-09-12): the cash-clamp fix `c22ad1c` *and* the Wilder rewrite. Trade-level diff: sequence, entry/exit prices identical; **units differ in 94/94 trades**; an instrumented `/tmp` copy shows the cash-clamp branch **never fires** (`CLAMP_BINDS = 0`), so the Wilder rewrite is the operative mechanism.
- **F8 — Metric-definition caveats (VERIFIED).** Sortino uses the std of negative days only (non-standard); Sharpe uses rf=0; trade-level PnL omits entry fees; `n_trades=94` counts closed trades only — **3 positions were still open at period end** (in equity, not in win rate/PF/avg-R).

Academically defensible as implemented: anti-look-ahead structure (prev-bar signals, next-open execution, prev-bar stop), fee+slip charged both sides, spot no-leverage sizing cap, √365 annualization for 365-day crypto data, honest internal admissions (survivorship, concentration, wide CI). Not defensible without owner decisions: the gate claims (F4), the period label (F6), the benchmark ambiguity (F2), the stop-loss documentation (F3), and the absence of any holdout/OOS framing (F5).

---

## 2. Audit Scope, Method & Evidence Classification

**Scope.** Everything that defines what number would become a thesis result: data → indicators → signals → execution → sizing → metrics → benchmark → gates → documentation/publication surfaces. Out of scope for change (in scope for reading): strategy/backtest code modifications, refetching data, re-running Snapshot A (requires checking out pre-fix code), Supabase, product code.

**Evidence classes used throughout:**

- `VERIFIED` — directly observed this session: file content, git history, executed code, independently recomputed arithmetic.
- `STRONGLY SUPPORTED` — multiple consistent observations plus formula-level deduction; not directly observed end-to-end.
- `INFERRED` — reasonable interpretation of evidence, alternative explanations not fully excluded.
- `UNKNOWN` — not determinable from the repository; explicitly **not** converted into an assumption.

**Reproduction protocol (all outputs under `/tmp`, repo untouched):**

```bash
git rev-parse --short HEAD                                    # 73856fa
# Independent Snapshot B re-run (no repo writes):
REPORT_SUBDIR=/tmp/phase2h_repro ./venv/bin/python backtest/run_backtest.py
# Independent recomputation / synthetic engine tests:
./venv/bin/python /tmp/phase2h_verify.py | tee /tmp/phase2h_verify_out.txt
# Snapshot A vs B trade-level diff (A = gitignored on-disk runner output of e6188de era):
./venv/bin/python /tmp/phase2h_ab_diff.py
# Stop-anchor reconstruction (CASE2 frequency, wick-throughs, crash precondition):
./venv/bin/python /tmp/phase2h_stops.py
# Sensitivity: /tmp/phase2h_sens copy of engine (only CLAMP_BINDS/OPEN_AT_END counters added),
# raw CSVs -> metrics_raw.md; reindex+ffill CSVs -> metrics_sensitivity.md
# Required search battery (19 patterns), full list:
#   /tmp/phase2h_searches.txt
./venv/bin/python -m pytest tests/ -q                         # 70 passed
```

Independently recomputed results are always labeled as such and never mixed with repo-generated outputs.

---

## 3. Repository Artifact Inventory & Thesis-Artifact Search

**Thesis artifacts: none exist (VERIFIED).** Filename/content searches for `skripsi`, `thesis`, `*.tex`, `*.ipynb`, `*.xlsx`, `*.docx`, `*.pdf` (thesis-shaped) return no real matches: the `skripsi` hits are substring artifacts of the Indonesian word "deskripsi"; `thesis` hits are limited to `PHASE2G_...md` and `.next` build source-map noise. Phase 2G recorded the same result.

**What does exist (VERIFIED):**

| Artifact | Role | Status |
|---|---|---|
| `backtest/reports/metrics.md` (+ gitignored `equity_curve.csv`, `trades.csv` on disk) | Snapshot A, frozen at `e6188de` (final equity 2495.92 matches A) | tracked (CSVs ignored) |
| `monitoring/web/lib/backtest-reference.json` | Snapshot B, born `029a311`, `sharpeRatio` added `9769a0c` | tracked |
| `backtest/reports/decision_log.md` | decision chronology incl. gate revisions | tracked |
| `backtest/reports/sharpe_discrepancy_report.md`, `sharpe_benchmark_comparison.md` | B&H benchmark studies | tracked |
| `backtest/reports/research/{longshort,capital_efficiency}/` | pre-Bitget-swap studies (different data vintage) | tracked |
| `backtest/reports/{correlation_mitigation,portfolio_size,regime_segmentation}_*.md` | variant experiments (best-of-9 selection source) | tracked |
| `backtest/reports/bh_max_drawdown.md`, `bh_drawdown_and_btc_eth_corr.md` | additional B&H constructions | **untracked, preserved untouched** |
| `presets/donchian_cluster_a2.yaml` | frozen params + gate block (contains `sharpe_vs_bnh: above`) | tracked |
| `ARCHITECTURE.md` §16, `README.md:95–103`, `TASKS.md:33` | canonical-metric decision `PENDING` | tracked |
| `monitoring/web/app/(public)/disclaimer/page.tsx`, `ProofStrip.tsx` | public figures (mix A/B; period label) | tracked |

**Required search battery** (19 patterns, full output `/tmp/phase2h_searches.txt`, each pattern capped at 40 hits): `149.59` → `metrics.md:5`, `decision_log.md:112`, `ARCHITECTURE.md:367`, `README.md:98`, `REPO_MAP.md:33`, `TASKS.md:33`, `correlation_mitigation_experiment.md:29`; `152.0` → `backtest-reference.json`, `ARCHITECTURE.md:368`, `README.md:98`, `TASKS.md:33`; `0.82` → `config.yaml:23`, `RULES.md:136`, `decision_log.md:66,95,110`, `PLAN.md:64,211,223`, `TASKS.md:18,33`, `disclaimer/page.tsx:25`, presets; `0.98` → `RULES.md:55`, `decision_log.md:80,95`, `sharpe_benchmark_comparison.md:26,49,52`; `26.19` → `config.yaml:23`, `metrics.md:9`, `RULES.md:56`, `decision_log.md:69,99`, `disclaimer/page.tsx:18`, `ARCHITECTURE.md:368`; `26.45` → `backtest-reference.json`, `ARCHITECTURE.md:368`; `Cluster-A2` → `config.yaml:22`, `presets/donchian_cluster_a2.yaml`, `compare_live_vs_backtest.py:4`, tests; `2020-08` → `config.yaml:37`, `scripts/fetch_bitget_data.py:37`, `compare_live_vs_backtest.py:5`, `ProofStrip.tsx:37`; `2020-11` → `bh_max_drawdown.md:3`, `sharpe_benchmark_comparison.md:62`, `regime_segmentation_analysis.md:98`; `buy and hold`/`B&H`/`benchmark`/`Sharpe`/`Sortino`/`Donchian` → ubiquitous across `RULES/PLAN/TASKS/decision_log/research/presets`; `skripsi`/`thesis` → no genuine hits (above). No file was altered by searching.

---

## 4. Research Pipeline Graph

```
scripts/fetch_bitget_data.py ──(fetch from 2020-08-01 attempt; venue earliest = 2020-11-09)
        │  gap-WARN block added b96decc 2026-09-12 — never acted on
        ▼
data/historical/*.csv ────────────────────── frozen since first data commit 90886b7 (2026-09-02)
        │                                     (~100-day holes + rotating 1-day holes, F1)
        ▼
strategy.py: atr (Wilder), rsi, donchian (shift(1)), position_size, CLUSTERS
        ▼
run_backtest.py: next-open entry → close-based exit (donchian|stop) → open-gap stop
        │          MTM: only marks a pair on days it has a candle (:171-175)  ← F1 mechanism
        ▼
compute_metrics (:182-228) ──► Sharpe rf0√365, Sortino(non-std), DD, CAGR, B&H scalar
        │
        ├─► backtest/reports/metrics.md + equity_curve/trades   [Snapshot A, era e6188de]
        ├─► monitoring/web/lib/backtest-reference.json          [Snapshot B, 029a311/9769a0c]
        │
        ▼
research scripts (portfolio_size, correlation_mitigation, regime, sharpe_benchmark,
        longshort, capital_efficiency — the last two use a PRE-SWAP dataset, F-caveat)
        ▼
decision_log.md / RULES.md / PLAN.md / TASKS.md  ── gates (F4: claims ≠ arithmetic)
        ▼
presets/*.yaml + web (reference.ts, ProofStrip, disclaimer) + compare_live_vs_backtest.py
        ▼
paper trading (live_signal) compares live vs Snapshot B
```

Two datasets have flowed through this graph at different times (Bitget-era 2020-11-09.. for the main pipeline; a pre-swap 2020-08-27.. series for `research/longshort` + `capital_efficiency` and the original 6-year label). The graph labels and gate text do not consistently distinguish them (F6, §17).

---

## 5. Strategy Definition (As Implemented)

VERIFIED from `run_backtest.py`, `strategy.py`, `config.yaml`, `presets/donchian_cluster_a2.yaml`:

| Element | Implementation |
|---|---|
| Entry signal | `prev close > highest(high, 20)` (Donchian upper, `shift(1)`), evaluated on day *t−1*, executed at day *t* **open** × (1 + 0.05% slippage) |
| Exit signal | `close < lowest(low, 10)` evaluated at the same day's close → exit at that close × (1 − 0.1% fee − 0.05% slippage), **or** `close ≤ stop` (same-day close check first), **or** open-gap stop (§9) |
| Stop anchor | `prev_close − 2.0 × prev_ATR(14)` (`run_backtest.py:133`) |
| Direction | long-only spot (`config.yaml:21`), no leverage, no shorting (short research rejected 2026-08-25) |
| Sizing | `units = (equity × 1%) / (entry − stop)`, capped at `equity/entry` (`strategy.py:71–83`); `risk_amount = units×(entry−stop)` = exactly 1% when unclamped |
| Concurrency | `max_concurrent_positions: 5` plafon; Cluster-A2 `max_positions_per_cluster: 2` over cluster A (9 high-corr) + cluster B (HYPE) → **effective max 3** (`config.yaml:22–29`) |
| Universe | 10 pairs, 1d, initial $1,000, fee 0.1%, slip 0.05% |
| Circuit breaker 15% | paper-trading/risk-manager feature; **not referenced by the backtest engine** |

The risk-per-trade construction (sizing off *actual* entry-to-stop distance) is academically clean: realized risk is 1% of equity by construction when the clamp does not bind (§10).

---

## 6. Documentation vs Code Discrepancies

**Stop-loss text (VERIFIED):**

| Source | States | Matches code? |
|---|---|---|
| `DESIGN.md:37` (metrics/spec table) | "Stop loss: Entry − 2× ATR(14)" | **No** |
| `config.yaml:20` (comment) | "stop loss = entry - (multiplier * ATR)" | **No** |
| `DESIGN.md:64` (code block), `DESIGN.md:221` | "Close kemarin − 2×ATR … Sama" | Yes |
| `run_backtest.py:133` (code) | `prev["close"] − mult × prev["atr"]` | — (reference) |

`DESIGN.md` therefore **contradicts itself** (:37 vs :64/:221). The implemented anchor is the previous close, not the entry price. Consequences: (a) when entry gaps above/below the previous close, the actual stop distance ≠ 2×ATR (position sizing still enforces 1% risk on the realized distance); (b) any thesis passage quoting "Entry − 2×ATR" would misdescribe the tested system. Same defect exists in the `research/longshort` docstring for its short leg ("stop di entry + 2xATR") while code uses prev-close ± .

**Other doc-vs-reality mismatches:** gap-stop prose (`DESIGN.md:80,96,104`, `regime_segmentation_analysis.md:81` "Open ≤ Stop → Gap down langsung exit di open") vs precedence (§9); period label (§22); gate claims (§24); `decision_log.md:120` period row; `n_trades`/win-rate vs 3 open positions (§18).

---

## 7. Indicator Implementation (ATR / Donchian / RSI)

- **ATR (VERIFIED, code + `git show 029a311`):** current = explicit Wilder recursion, SMA seed at index `period−1`. Pre-`029a311` (Snapshot A era) = `tr.ewm(alpha=1/period, adjust=False, min_periods=period).mean()` with an in-code comment claiming that this *was* Wilder. The two differ in seeding/transient behavior → ATR values differ → stops differ → sizes differ (§23). This is a genuine methodology change between two coexisting published snapshots.
- **RSI:** same rewrite (seed `mean(gain[1:period+1])`); not used by the canonical Donchian preset.
- **Donchian (VERIFIED):** `shift(1)` on rolling high/low — causal, no look-ahead.
- Both are standard, academically citable constructions once the Wilder seeding variant is named precisely in methodology text (which variant is "the" ATR(14) matters for reproducibility: A and B differ).

---

## 8. Execution & Cost Model

VERIFIED: signals on close *t−1*; fill at open *t* with +0.05% slippage; exits (and both stop variants) charged 0.1% fee + 0.05% slippage; entry fee charged via `cost = units×entry×(1+fee)`; long-only spot → no funding rate, no borrow (funding modeled only in the rejected long-short research); no idle-cash yield in the backtest (yield exists only in `capital_efficiency` research and paper-trading simulation).

Academic assessment: charging fee+slip on **both** sides at daily granularity is a defensible, conservative-in-direction choice. Unmodeled: orderbook spread/impact, maker-vs-taker mix, intraday path (stop checked on close/open only, §9), and cross-exchange price differences. Exit-at-close-of-signal-day is a mild idealization (you cannot always transact exactly at the close that generated the signal) — standard in daily backtests, direction small, `INFERRED` minor.

---

## 9. Stop-Loss Precedence & Gap-Stop Behavior

Engine order per symbol-day (`run_backtest.py:100–167`): close-based exit (`stop_loss` / `donchian_exit`) → entry → open-gap stop check (only if a position still exists).

Synthetic tests against the real engine (`/tmp/phase2h_verify.py §7`, VERIFIED):

| Case | Setup | Result |
|---|---|---|
| CASE1 | open ≤ stop, close > stop | exit **at open**, labeled `gap_stop` ✓ matches docs |
| CASE2 | open ≤ stop, close ≤ stop | close-check fires first → exit **at close**, labeled `stop_loss`; gap branch **never reached** |
| Entry-day gap-down | entry open gapped below prev-bar stop | `ValueError: invalid stop: entry=…, stop=…` raised at `run_backtest.py:134`, unhandled → whole run would crash |

Consequences:

1. **Docs promise "gap down → exit at open"; code only does that when the close recovers above the stop (VERIFIED).** Historically `gap_stop` fired **0/94** times; `stop_loss` fired 30×. Reconstructing stop anchors for every trade (`/tmp/phase2h_stops.py`): **2 of 30** stop exits are CASE2 — XRP/USDT and ADA/USDT on 2025-03-04, where open (2.3876 / 0.8578) was below stop (2.455 / 0.9448) but close recovered near/above stop (2.4547 / 0.9406). Under doc-faithful open-exit those two legs would have realized *worse* prices than the engine produced → current numbers are, on these two days, optimistic relative to the documented rule.
2. **Close-only stop modeling:** 29 of 2,236 held days had `low < stop ≤ close` (intraday touch, no exit taken) — 1.3% of held days; a fill-at-touch stop would exit earlier. `VERIFIED`, low-frequency.
3. **Robustness ceiling (VERIFIED synthetically, not historically):** an entry-day gap-down crashes the run with an unhandled `ValueError`. Historical occurrence: **0/94** (slipped open ≤ stop never occurred; engine completed all runs). Not reachable on current data; a live/extended dataset could hit it.

---

## 10. Position Sizing & Cash Accounting

- Sizing formula and 1% risk cap: §5. Cap `units ≤ equity/entry` keeps the book unlevered spot (`VERIFIED`).
- **Cash-clamp history:** pre-`c22ad1c` (2026-09-12 21:06) the clamp recomputed `units` but not `cost` → stale cost deducted → cash could go negative. Fixed in one line (`git show c22ad1c`), regression test `tests/test_backtest_cash.py` added (proven to fail pre-fix per commit message).
- **Clamp binding frequency (VERIFIED this session):** instrumented `/tmp` copy of the engine (only a counter added) reports **`CLAMP_BINDS = 0`** on the Cluster-A2 configuration, both raw and forward-filled data → the clamp branch never executes in published runs. Therefore the cash fix is inert for Snapshot A/B numbers (§23).
- Sizing uses **total equity** (cash + MTM), so deployment can exceed free cash in principle; the clamp is the guard, and it never binds here (`VERIFIED`).

---

## 11. Portfolio Construction & Cluster Limits

`CLUSTERS` (`strategy.py:14–18`): cluster A = the 9 older/higher-corr pairs, cluster B = HYPE; `max_positions_per_cluster: 2` → effective concurrency ≤ 3, deliberately below the `max_concurrent_positions: 5` plafon (`config.yaml:27–29` documents this). Cross-pair correlation context (from repo research): BTC–ETH daily ≈ 0.84, average cross-corr ≈ 0.75 — concentration risk is real and acknowledged.

**Selection provenance (VERIFIED):** Cluster-A2 is row 3 of a 9-variant table (`correlation_mitigation_experiment.md`), all evaluated on the full sample; A2 had the best Sharpe (0.82) among variants; selected 2026-09-06 (day after the experiments). `sharpe_benchmark.py:32–33` additionally hardcodes STRAT Sharpes (0.94, 0.53) as constants for comparison. Both are best-of-sample choices feeding directly into the reported baseline (§21).

---

## 12. Data Provenance & Vintage

VERIFIED via `git log`/`git show`:

- Config-pair CSVs entered the repo **only** in the 2026-09-02 batch (`90886b7` "[data] update historical OHLCV dari Bitget" and same-day follow-ups); no later commit modifies them (only PAXG/LTC/BCH Yahoo CSVs added `c42a478`, 2026-09-07, date-first schema). **Data frozen at 2026-09-02**, i.e., before Snapshot A was even frozen (`e6188de`, 2026-09-06) — both snapshots ran on identical data (consistent with Phase 2G D4).
- Fetch script requests from **2020-08-01** (`scripts/fetch_bitget_data.py:37`); Bitget's earliest returned candle is **2020-11-09** — hence the start date (venue history limit, not a research choice).
- **Venue swap:** the pipeline used Binance data until 2026-08-25 (decision log/PLAN record "Binance → Bitget"); the pre-swap dataset (start 2020-08-27, contiguous 2,190 rows) was **never committed** (no data-path commits exist before `90886b7`). Consequences (VERIFIED absence):
  - `8cc0012` metrics (2026-08-14: 141.17% / Sharpe 1.06 / 62 trades / B&H 383.72 / period 2189d) and `research/longshort`, `research/capital_efficiency` (curves 2020-08-27 → 2026-08-25, B&H 570.78%) are **not reproducible from the repository**.
  - The repo says so itself: `portfolio_size_experiment.md` — "Sharpe 1.06 (commit 8cc0012, Binance) tidak reproducible dengan data Bitget."
- Gap-warning code was added `b96decc` (2026-09-12 23:25, "hygiene" commit) — ten days *after* the data landed, and the data was never refilled or re-fetched; `AUDIT.md:100` (P3-10) covers **detection only**. `UNKNOWN`: whether the original fetch logged Bitget-side gaps (fetch log output not stored anywhere).

---

## 13. Data Continuity: Intra-Series Gaps — ★HEADLINE FINDING

`VERIFIED` (`/tmp/phase2h_verify_out.txt §1`, recomputed directly from `data/historical/*.csv`):

| Pair | Bars | Span | Missing | Hole ranges (contiguous missing calendar days) |
|---|---|---|---|---|
| BTC, ETH, XRP | 1920 | 2020-11-09..2026-09-02 | 204 | 2021-05-28..09-04 (100), 2022-03-24..07-01 (100), + singles 2023-01-18, 2023-11-15, 2024-09-11, 2025-07-09 |
| LINK, DOGE | 1763 / 1753 | 2021-04-15 / 04-25.. | 204 | same two 100-day holes + same 4 singles |
| SOL, BNB | 1696 / 1717 | 2021-06-22 / 06-01.. | 203 | 2021-10-28..2022-02-04 (100), 2022-08-24..12-01 (100), + singles 2023-06-20, 2024-04-16, 2025-02-11 |
| AVAX, ADA | 1646 / 1521 | 2021-11-18 / 2022-03-23.. | 104 | 2022-03-28..07-05 (100), + singles 2023-01-22, 2023-11-19, 2024-09-15, 2025-07-13 |
| HYPE | 623 | 2024-12-18.. | 1 | single (2025-03-29) |

- **1,635 missing bars total.** The 100-day holes are *synchronized* across pairs (5 pairs share one hole pair, 2 pairs share another, 2 pairs share a third).
- On 2021-05-28..31 **all existing pairs are missing** → those 4 days have no equity-curve row at all (2,124-day span → 2,120 rows).
- Presence since first data commit `90886b7` (2026-09-02); gap-WARN code arrived later (`b96decc`, 2026-09-12) and was never acted on; data never refetched.
- `UNKNOWN` root cause: venue-side gaps vs fetch pagination/retry bug (would require a refetch comparison — out of audit scope).

This is the structural defect that contaminates both headline equity (§14) and the benchmark series (§15).

---

## 14. Gap Impact: Strategy Equity & Max Drawdown

**Mechanism (VERIFIED, `run_backtest.py:171–175`):** equity = cash + Σ positions, where a position contributes `units × close` **only `if d in dfs[symbol].index`** — otherwise contributes **0** for that day. A held position therefore vanishes from equity on its pair's missing days and reappears next candle → two large artifact moves per hole.

**Measured (VERIFIED, `/tmp/phase2h_verify_out.txt §§2–4`):**

- 4 artifact return days (|r| > 10%): **2023-01-22 −15.85%, 2023-01-23 +19.62%** (AVAX+ADA missing; position in ADA held, entry 2023-01-07); **2023-11-15 −16.79%, 2023-11-16 +20.42%** (5-pair group missing; position in LINK held).
- **Reported max drawdown −26.4454% has its trough exactly on artifact day 2023-01-22.** The headline drawdown number is thus, at its deepest point, measuring a data artifact, not a market loss.
- Trades exposed to live hole-days while held: **3/94** (ADA 2023-01-07..2023-02-09 over 2023-01-22; LINK 2023-09-19..2024-01-03 over 2023-11-15; AVAX 2025-07-10..2025-08-01 over 2025-07-13).
- Signal/execution integrity is **not** contaminated: 0/94 entries with a stale previous bar, 0 entries/exits on hole-resume days, 0 same-day round trips. The damage is confined to the MTM path (returns, Sharpe, Sortino, drawdown).

**Classification: VERIFIED.** This finding does not by itself dictate a fix (§16, §28).

---

## 15. Gap Impact: Buy-and-Hold Benchmark

The B&H sleeve (`sharpe_benchmark.py:44–73`) sums per-pair contributions; on a pair's missing days its contribution is `NaN` and the row-sum skips it → during synchronized holes the "portfolio" collapses to a stub of the few pairs that still have candles (e.g., BNB-only ≈ $100 in June 2021 vs ~$1,400 the day before), then jumps back on resume.

`VERIFIED` (`/tmp/phase2h_verify_out.txt §5`, exact mirror of the repo script):

- 10-pair sleeve: endpoint 2,550.28 (**+155.03%** — identical to the scalar by construction, both = Σ 100×(last/first)), **Sharpe 0.9809**, mean 0.008286, std 0.161390 → matches `sharpe_benchmark_comparison.md` exactly.
- **13 artifact days |r| > 50%** (e.g., 2021-06-01 −93.2% → 2021-06-22 +130.6%; 2021-09-05 +300.8%; 2022-03-24 −66.5% → 2022-07-02 +294.5%; 2023-01-18 −77.8% → 2023-01-19 +345.6%; 2023-11-15 −72.1% → +259.5%; 2024-09-11 −63.5% → +176.0%; 2025-07-09 −69.2% → +255.4%).
- Excluding those 13 days: **Sharpe 0.98 → 0.8787.**
- 2-pair sleeve: +418.32%, Sharpe 0.8310; BTC-only: +401.07%, Sharpe 0.8288 — both match the repo report (0.83 / 418.32 / 401.07).

So the canonical benchmark statement "strategy 0.82 vs B&H 0.98" compares a gap-contaminated strategy series against a gap-**more**-contaminated benchmark series; the −0.16 gap narrows to ≈ −0.06 on the artifact-excluded benchmark (both numbers reported as evidence; neither proposed as the thesis figure).

---

## 16. Gap-Handling Sensitivity (Exploratory, /tmp Only)

One arbitrary policy — forward-fill interior holes (reindex daily + ffill; engine copy in `/tmp/phase2h_sens`, only diagnostic counters added, **repo engine untouched**) — gives (`metrics_sensitivity.md` / `sensitivity_out.txt`):

| Metric | Raw (repo data) | Forward-filled | Δ |
|---|---|---|---|
| Sharpe | 0.82 | **1.10** | +0.28 |
| Sortino | 0.85 | **1.29** | +0.44 |
| Max drawdown | −26.45% | **−18.10%** | +8.35pp |
| Total return | 152.0% | 151.52% | −0.5 |
| Final equity | 2,520.02 | 2,515.16 | −4.86 |
| n trades / win rate | 94 / 36.17% | 95 / 35.79% | +1 / −0.38 |
| Profit factor | 2.27 | 2.24 | −0.03 |
| B&H scalar | 155.03% | 155.03% | 0 (endpoints unchanged) |
| CLAMP_BINDS / OPEN_AT_END | 0 / 3 | 0 / 3 | — |

**Interpretation (labeled, not a result):** return-level metrics are robust to gap policy; **risk-level metrics (Sharpe, Sortino, max DD) are not** — they move by 8–50% relative under one simple policy. Because DD gates (≤30%) and Sharpe gates (§24) are decided on these very metrics, the gap policy is a *thesis-defining* choice, not a hygiene detail. This run is evidence of materiality only; forward-fill is one of several defensible policies (others: refetch/repair from venue, drop-and-disclose, interpolation) and no policy is endorsed here (`UNKNOWN` what the owner will choose).

---

## 17. Benchmark (B&H) Constructions & Staggered Inception

**Inception table (VERIFIED, CSV first dates + `bh_max_drawdown.md §0`):** BTC/ETH/XRP 2020-11-09; LINK 2021-04-15; DOGE 2021-04-25; BNB 2021-06-01; SOL 2021-06-22; AVAX 2021-11-18; ADA 2022-03-23; HYPE 2024-12-18 (623 bars only); all end 2026-09-02. The universe is therefore a staggered, partially-overlapping panel — "10-pair, 6-year" is not a literal description of any single observed window.

**The benchmark family (all VERIFIED as file contents; constructions differ):**

| # | Construction | Return | Path metric | Where |
|---|---|---|---|---|
| 1 | Engine scalar Σ100×(last/first) | **155.03%** | none (single number) | `run_backtest.py:206–211`, metrics.md A, reference.json B, presets |
| 2 | Staggered sleeve, $100/pair at own start, **unlisted allocation idles at 0 contribution** | 155.03% (endpoint ≡ #1) | Sharpe **0.98**, 13 artifact days | `sharpe_benchmark.py:44–73` |
| 3 | 2-pair sleeve | 418.32% | Sharpe 0.83 | `sharpe_benchmark_comparison.md` |
| 4 | BTC-only sleeve | 401.07% | Sharpe 0.83 | same |
| 5 | Pre-swap scalar (data from 2020-08-27) | **570.78%** | — | `research/longshort/comparison.md` (Binance-era vintage, not reproducible) |
| 6 | Fully-deployed staggered + **rebalance on each listing** | **+767%** ($10k→86,714) | MDD **−77.63%** | `bh_max_drawdown.md` (untracked) |
| 7 | Period-limited to common start (2024-12-18..) | — | MDD **−58.44%** | `bh_drawdown_and_btc_eth_corr.md` (untracked) |
| 8 | Threshold figure "154.85%" | **154.85%** | — | `sharpe_discrepancy_report.md:98` only; provenance **UNKNOWN** |
| — | Historical 2-pair Binance-era scalar | 383.72% | Sharpe 1.06 era | `git show 8cc0012:…metrics.md` |

Key structural facts:

- **The scalar/sleeve benchmarks permanently idle the allocation of not-yet-listed pairs** (up to 70% of notional idle while only 3/10 pairs exist in 2020–21; $100-per-pair sleeve never invests the remainder). A fully-invested rebalance-on-listing benchmark did **+767%** (row 6) — vs the strategy's +152%. The **sign** of the Return-gate verdict (strategy < B&H: 149.59/152.0 < 155.03 **and** < 767) is robust across constructions; the **magnitude** is not (`VERIFIED` arithmetic; benchmark-definition choice is an owner decision §28).
- **Mislabel (STRONGLY SUPPORTED):** `decision_log.md:99` "DD −26.19% vs B&H −58.49% → proteksi 32.3pp". The value −58.49% appears **only** as the 10-pair **vanilla-strategy** drawdown (`correlation_mitigation_experiment.md:27,40`, `portfolio_size`, `sharpe_discrepancy_report`, `DESIGN.md:132`); every located *B&H* drawdown computation is −58.44 / −76.63 / −76.89 / −77.63. The comparison's label does not match any B&H computation.
- **`RULES.md:56` "B&H (45–58%)"**: the 58 bound fits row 7 (−58.44); the 45 bound has no located computation — `UNKNOWN`.
- The two untracked `bh_*.md` files also document that an earlier B&H DD of −96.69% was an artifact of wrong normalization — independent confirmation that B&H construction choices in this repo have been error-prone.

---

## 18. Metric Formulas & Definitions

VERIFIED at `run_backtest.py:182–228`:

| Metric | Formula | Assessment |
|---|---|---|
| Sharpe | `mean(daily_ret)/std(daily_ret)×√365`, **rf = 0** | √365 annualization correct for 365-day crypto; rf=0 is a definitional choice — vs ~4–5% T-bill 2020–26 it *overstates* Sharpe relative to conventional reporting. State rf explicitly in the thesis (`INFERRED` material to cross-paper comparison). |
| Sortino | `mean(daily_ret)/std(daily_ret<0 days)×√365` | **Non-standard.** Standard downside deviation uses √(mean(min(r−target,0)²)) over *all* days. Current form uses std of the negative-day subset — not comparable to literature Sortinos. |
| Max DD | `equity/cummax(equity)−1` on close equity | Formula standard; **values contaminated** by F1 (trough = artifact day). |
| CAGR | `(final/init)^(365.25/span_days)−1` | Standard; span 5.81y (§22). |
| Win rate / PF / avg R | trade-level, from `trades.csv` | (a) `pnl = exit proceeds − units×entry` **omits the entry fee** (exit fee/slippage are inside proceeds; entry slippage inside entry price) → PF/R slightly optimistic (`INFERRED` small: ~0.1% notional per leg vs 1%-equity risk); (b) **only closed trades** — `n_trades=94` while **3 positions were open at period end** (BTC, LINK, HYPE; `deployed_usd` 1,195.65 at 2026-09-02, `OPEN_AT_END=3`); those legs are in final equity/return but excluded from win rate, PF, avg-R (standard practice, but the thesis must say so). |
| period_days | `(last−first).days` = 2123 | calendar days, not trading days — consistent with √365. |
| B&H return | scalar #1 of §17 | construction-dependent family. |

---

## 19. Look-Ahead Bias Assessment

`VERIFIED` — the execution skeleton is clean:

- Donchian uses `shift(1)` (prev-bar high/low); entry signal = prev close vs prev Donchian; execution at **next** open; stop anchored on **prev** bar; all causal.
- Hole-induced staleness: **0/94** entries whose previous calendar day is a missing bar (§14) — the gap problem does not create stale-signal look-ahead or stale-stop entries in this sample.
- Same-day exit at the close of the signal day (both donchian and close-stop): the exit price *is* the price that generated the signal — zero-lag fill idealization, standard in daily studies, minor (`INFERRED`).
- The *selection-level* look-ahead (parameters/cluster/gate chosen after seeing the full sample) is a distinct problem — §21, not code look-ahead.

---

## 20. Survivorship & Universe Selection

`VERIFIED`: the 10 pairs were chosen as today's liquid survivors (repo itself: `PLAN.md:42` "SOL/BNB/XRP dipilih sebagai survivor hari ini… angka adalah ekspektasi atas, bukan janji"; `TASKS.md:33` "SOL/BNB/XRP dipilih sebagai survivor… catatan survivorship"; `decision_log.md:24` "survivorship bias tercatat"; disclaimers repeat it). HYPE (listed 2024-12) adds a short, regime-specific history. Additionally, PAXG/LTC/BCH were fetched, tested, and **rejected on backtest grounds** — selection on the same sample used for reporting (§21). Acknowledgment in docs is good practice; it does not remove the bias from any performance claim.

---

## 21. Data Snooping & Absence of Out-of-Sample Testing

`VERIFIED`:

1. **Best-of-9 selection:** Cluster-A2 = the best row of the 9-config `correlation_mitigation_experiment.md` table (all FAIL against the then-current gate; A2 best at 0.82/−26.19), selected 2026-09-06 after 2026-09-05 experiments; PAXG/LTC/BCH rejected on results; SMA/RSI presets run once and published as failures (good transparency, still in-sample).
2. **Criterion revised after seeing results:** original gate Sharpe ≥ 1.0 (`decision_log.md:73–84`) was unmet by every config (best 10-pair 0.82; best 2-pair 0.94) with B&H max 0.98 → decision `decision_log.md:84` rewrites the gate to "> B&H counterpart", with `RULES.md` recording the revision history (`RULES.md:55` "Dinaikkan dari ≥1.0 (2026-09-05), ketika tidak ada config 10-pair yang mencapai 1.0…"). Then A2 was selected with an explicit waiver (`decision_log.md:95`: "selisih −0.16, diterima").
3. **Zero out-of-sample machinery:** repo-wide grep for `walk-forward|out-of-sample|holdout|purged|k-fold|expanding window` → **no hits** anywhere (research, docs, tests). All reported metrics are full-sample, same-sample-as-selection.
4. **The repo's own significance test points the other way:** `sharpe_benchmark_comparison.md` reports strategy-vs-B&H mean-daily-difference t-test **p = 0.0193 (strategy worse)** alongside its caveat about sleeve cash-days.
5. Parameters were then "frozen" (`presets`, `AGENTS.md` rule 2) — freezing after selection is good discipline but is *not* an out-of-sample test.

Academic framing required for a thesis: these are **in-sample research results**, and the strongest defensible claim needs either a holdout/period-split re-run or an explicit in-sample-only limitation with the post-hoc gate history disclosed (owner decision §28).

---

## 22. Sample Period & Labeling

`VERIFIED` arithmetic vs labels:

| | Value |
|---|---|
| Actual equity span | **2020-11-09 → 2026-09-02**, `(end−start).days = 2123` (= `period_days`) = **5.812 years** (2,120 curve rows; 4 all-missing days) |
| Label in `backtest-reference.json` | `"2020-08 .. 2026-08 (6 tahun, 10 pair Bitget, Cluster-A2)"` |
| `decision_log.md:120` | "2020-08 — 2026-08 (6 tahun)" |
| `config.yaml:37` | `lookback_years: 6 # diperluas 3->6 (2020-08..2026-08)…2026-08-14` |
| `disclaimer/page.tsx` / `ProofStrip.tsx:37` | "over 6 years" / "Backtest 2020-08 → 2026-08" (public) |
| Presets / research tables | "6 thn" / "6 tahun" labels |
| Origin of "2020-08" | the **pre-swap** window (commit `8cc0012` "perpanjang data ke 6 tahun (2020-08..2026-08)") + fetch attempt start (`fetch_bitget_data.py:37`); the Bitget-era data never starts before 2020-11-09 |
| `research/longshort`, `capital_efficiency` actual period | **2020-08-27 → 2026-08-25** (different dataset entirely) |

The published label overstates the window by ~0.19 years and misstates both endpoints; it is also *correct* only for the unreproducible pre-swap studies. Public-facing surfaces (`ProofStrip`, disclaimer) repeat it.

---

## 23. Snapshot A vs Snapshot B: Version Attribution

Timeline (`git log`, VERIFIED):

| Date | Commit | Event |
|---|---|---|
| 2026-09-02 | `90886b7`… | Bitget data lands (with holes, §13); `45c42f3` makes config 10-pair/max5 |
| 2026-09-06 | `e6188de` | **Snapshot A** frozen: Cluster-A2, `metrics.md` + on-disk curve/trades (2495.92) |
| 2026-09-12 21:06 | `c22ad1c` | **behavioral #1:** cash-clamp cost fix (`cost = units×entry×(1+fee)` after clamp) + regression test |
| 2026-09-12 23:00 | `029a311` | **behavioral #2:** ATR/RSI → explicit Wilder seeding; `backtest-reference.json` created → **Snapshot B** born |
| 2026-09-12 23:25 | `b96decc` | fetch gap-WARN added (never acted on) |
| 2026-09-13 | `9769a0c` | `sharpeRatio` added to B |
| now | `73856fa` | HEAD reproduces B exactly |

**Trade-level A↔B diff (`/tmp/phase2h_ab_diff_out.txt`, VERIFIED):**

| Property | Result |
|---|---|
| Trade sequence (symbol, entry_date, exit_date, exit_reason) | **identical** (94 = 94) |
| Entry prices / exit prices | 0 / 0 rows differ |
| **Units** | **94/94 rows differ**, rel. −0.21% … **+19.61%** (B larger in almost all) |
| pnl | 93/94 differ; Σpnl A 1,282.37 → B 1,304.50 (+22.13) |
| r_multiple | 6/94 differ (denominator scales with units) |
| Final equity | 2,495.92 → 2,520.02 (+24.10) |

**Mechanism (STRONGLY SUPPORTED, formula-deductive):** `units = 1%×equity/(entry−stop)` with identical `entry` and identical sequence ⇒ differing units ⇒ differing `stop = prev_close − 2×prev_ATR` ⇒ **ATR values changed** ⇒ the Wilder rewrite (`029a311`) is the operative cause of A≠B.

**Cash fix (`c22ad1c`) contribution: ~zero (STRONGLY SUPPORTED).** The instrumented engine reports `CLAMP_BINDS = 0` — the buggy branch never executes in this configuration; A-side binding is not directly measured (checking out pre-fix code is forbidden here) but is inferred ~0 because A's raw units are equal-or-smaller in 94/94 trades. Phase 2G's single-cause attribution (Wilder) is therefore *correct in conclusion but incomplete in record*: two behavioral commits sit between A and B, one of which is provably inert.

**Canonical status (VERIFIED):** `ARCHITECTURE.md:358–377` §16 — "METRIC SOURCE OF TRUTH — PENDING", both snapshots "tidak boleh diubah/dipilih sepihak sebelum keputusan owner"; `README.md:95–103` and `TASKS.md:33` say the same; consumers (`reference.ts`, `compare_live_vs_backtest.py`) already read **B**; `disclaimer/page.tsx` **mixes** them (−26.19% from A at :18 with "+152%" and 0.82/94 spanning A+B at :25).

**Additional record mismatches (VERIFIED / STRONGLY SUPPORTED):**

- Config timeline vs decision records: git shows 2-pair config through `3d99b97` (2026-08-25) and 10-pair only from `45c42f3` (**2026-09-02**), while `decision_log.md:20`/`PLAN.md:31` date "10-pair" to **2026-08-25** and `TASKS.md:22` says "2→5 pair" for the same decision — three mutually inconsistent records of one change.
- `decision_log.md:12` (founding entry) cites "+152%" for the 2026-08-14 run whose committed metrics are **141.17** (`git show 8cc0012`); 152.42 matches the later long-short `long_only` row — `STRONGLY SUPPORTED` conflation.
- `decision_log.md:24` / `PLAN.md:42`: "+862%, Sharpe 1.44, TAPI DD −58.49%" fuses the **5-pair** capital-efficiency row (862.42/1.44, DD −27.34) with the **10-pair vanilla** DD (−58.49) — no surviving table contains "10-pair +862/1.44/−58.49" together.

---

## 24. Decision Gate Evaluation & Contradictions

**Written gates (VERIFIED):** `RULES.md:55` Sharpe > same B&H (+ t-test justification clause); `:56` DD ≤ 30%; `:57` Return > buy-and-hold; n_trades ≥ 30 (preset verdicts); preset gate block `presets/donchian_cluster_a2.yaml:29–32`.

**Arithmetic vs claims:**

| Gate | Snapshot A | Snapshot B | Verdict | Claimed in repo |
|---|---|---|---|---|
| Sharpe > B&H (0.98 sleeve) | 0.82 < 0.98 **FAIL** | 0.82 < 0.98 **FAIL** | fails arithmetically; explicitly **waived** with justification (−0.16, DD protection) at `decision_log.md:95` | `TASKS.md:18` "terpenuhi"; `PLAN.md:211` "terpenuhi"; preset `sharpe_vs_bnh: above` (**false as stated**) |
| Return > B&H (155.03) | 149.59 < 155.03 **FAIL** | 152.0 < 155.03 **FAIL** | fails under every located construction (also vs +767%) | **never addressed** in decision log or preset gate block |
| Max DD ≤ 30% | −26.19 pass | −26.45 pass | passes — but trough is a data artifact (§14) | cited as passing |
| n_trades ≥ 30 | 94 | 94 | passes (closed trades) | passing |

So: one gate **fails and is honestly waived in the decision log but then re-narrated as "met/above"** in downstream docs/preset; a second gate **fails and is silently skipped**. The gate itself was also redefined post-results (§21). Additionally the benchmark behind both failing gates is itself construction- and gap-dependent (§15, §17), and `RULES.md:136`/`PLAN.md:223` already concede the statistical fragility (Sharpe CI ~0.5–1.1; top-5 trades ≈ 100% of net PnL; trade #1 ≈ 45%).

For a thesis this must be restated as: *"Sharpe gate: not met, waived with documented justification"* or re-run to a pre-registered criterion — never as "above/terpenuhi".

---

## 25. Independent Reproduction & Verification Results

**Snapshot B — independent re-run (`REPORT_SUBDIR=/tmp/phase2h_repro`, HEAD code/data/config) vs `backtest-reference.json`:**

| Metric | reference.json (B) | Independent re-run | Independent recomputation (own formulas) | Match |
|---|---|---|---|---|
| total_return_pct | 152.0 | 152.0 | 152.00 | ✓ |
| cagr_pct | 17.24 | 17.24 | 17.24 | ✓ |
| sharpe | 0.82 | 0.82 | 0.8234 | ✓ |
| sortino | 0.85 | 0.85 | 0.8458 | ✓ |
| max_drawdown_pct | −26.45 | −26.45 | −26.4454 (trough 2023-01-22) | ✓ |
| n_trades / win_rate_pct | 94 / 36.17 | 94 / 36.17 | 94 / 34 wins = 36.17% | ✓ |
| avgR / avgWin / avgLoss / PF | 1.03 / 4.35 / −0.85 / 2.27 | same | — | ✓ |
| buy_hold_return_pct | 155.03 | 155.03 | scalar 155.03; sleeve endpoint 155.03 | ✓ |
| final_equity | 2520.02 | 2520.02 | 2520.02 | ✓ |
| period_days | 2123 | 2123 | 2123 (5.812y) | ✓ |

Also VERIFIED: exit reasons 64 `donchian_exit` + 30 `stop_loss` + 0 `gap_stop`; 0 same-day round trips; 3 positions open at end; sleeve Sharpe 0.9809 / 2-pair 0.8310 / BTC 0.8288 with exact mean/std replication; scalar 155.03; A↔B diff (§23); stop reconstruction (0 entry-breach, 2 CASE2, 29 wick-throughs); synthetic gap-stop CASE1/CASE2 and entry-gap `ValueError`; clamp binds 0; sensitivity run (§16); **70/70 tests pass**.

Snapshot A was **not** re-executed (that requires checking out pre-fix code = code change, forbidden in this audit) — it rests on its frozen git artifacts (metrics.md + on-disk curve/trades matching 2495.92), which is sufficient for the A↔B diff but not a full A re-run.

**Repository state after this audit:** unchanged except this new file (final `git status`/`git diff` block, §29-end).

---

## 26. Thesis Baseline Status

# THESIS BASELINE NOT YET FROZEN

Reasons (all VERIFIED):

1. Two published metric snapshots coexist and the repo's own source-of-truth map marks canonical choice `PENDING` (`ARCHITECTURE.md:358`), mirrored in `README.md:95–103` and `TASKS.md:33`; the public disclaimer already mixes both.
2. Headline risk metrics depend on an unresolved data-gap policy (§13–§16): DD trough sits on an artifact day; benchmark Sharpe 0.98 is artifact-inflated; one simple fill policy moves Sharpe 0.82→1.10 and DD −26.45→−18.10.
3. Two decision gates are mis-narrated vs arithmetic (§24), one of them waived post-hoc after the criterion itself was revised (§21).
4. The sample-period label does not match the data (§22) and appears on public surfaces.
5. The stop-loss methodology text contradicts the code and itself (§6), and gap-stop prose contradicts behavior (§9).
6. The reported baseline is best-of-9, full-sample, with zero out-of-sample machinery (§21).

**Freezing requires the owner decisions in §28 to be made and recorded** (per the repo's own `ARCHITECTURE.md` §16 procedure: owner decision → re-run frozen config → rewrite all quoted figures from one source → record in `PLAN.md`). Until then, both snapshots remain *candidate* artifacts, not the thesis result. This audit neither endorses nor corrects either.

---

## 27. Academic Risk Register

| ID | Finding | Evidence | Class | Severity | Thesis impact |
|---|---|---|---|---|---|
| AR-01 | Strategy MTM zeroes held positions on hole-days; **DD −26.45% trough = artifact day 2023-01-22**; 4 artifact return days | `run_backtest.py:171–175`; `/tmp/phase2h_verify_out.txt §§1,3,4` | VERIFIED | **High** | Central risk statistic partly measures missing data; DD gate verdict inherits it |
| AR-02 | B&H sleeve Sharpe **0.98 inflated by 13 |r|>50% gap artifacts** (0.8787 excl.) | mirror of `sharpe_benchmark.py`; verify §5 | VERIFIED | **High** | The benchmark of the headline gate is itself contaminated |
| AR-03 | ≥7 incompatible B&H constructions; scalar/sleeve **idle unlisted allocation** (fully-rebalanced variant = +767% vs scalar 155.03); `decision_log:99` "B&H −58.49" mislabels a strategy DD; `RULES:56` "45–58%" partly untraceable; `154.85` provenance unknown | §17 table; grep `58.49` | VERIFIED / STRONGLY SUPPORTED | **High** | "Return > B&H" gate has no canonical benchmark; sign robust, magnitude not |
| AR-04 | Gate claims contradict arithmetic: `TASKS:18`/`PLAN:211` "terpenuhi", preset `sharpe_vs_bnh: above` vs 0.82<0.98; Return gate 149.59/152.0<155.03 fails and is never addressed; decision log waives honestly (−0.16) | §24; exact lines quoted | VERIFIED | **High** | Integrity: thesis cannot repeat "above/terpenuhi"; must state waived or re-run |
| AR-05 | Post-hoc criterion revision (≥1.0 → >B&H after results), best-of-9 selection, PAXG/LTC/BCH rejected on results, **zero OOS/walk-forward/holdout**; repo's own t-test says strategy worse (p=0.0193) | §21; decision_log:73–95; grep | VERIFIED | **High** | All metrics in-sample; without holdout/limitation framing the claims are selection-biased |
| AR-06 | Period label "2020-08..2026-08 (6 tahun)" vs actual **2020-11-09..2026-09-02 = 5.81y**; label inherited from pre-swap dataset; repeated in reference.json, decision_log:120, config:37, disclaimer, ProofStrip | §22 | VERIFIED | Medium | Methodology/abstract would state a false window |
| AR-07 | Two live snapshots mixed on public page; canonical `PENDING` | §23; ARCHITECTURE:358–377 | VERIFIED | Medium | Two different "results" quotable from one source |
| AR-08 | Stop doc-vs-code: "Entry − 2×ATR" (`DESIGN:37`, `config.yaml:20`) vs implemented `prev_close − 2×prev_ATR`; DESIGN self-contradicts (:37 vs :64/:221) | §6 | VERIFIED | Medium | Thesis methodology section would misdescribe the tested rule |
| AR-09 | Gap-stop prose ("exit at open") vs precedence (close-first): `gap_stop` fired 0×; 2/30 stop exits are CASE2 and would fill *worse* under doc-faithful behavior | §9; synthetic CASE1/2; stops.py | VERIFIED | Medium | Documented rule ≠ implemented rule; direction favors current numbers |
| AR-10 | Entry-day gap-down → unhandled `ValueError` crashes the run (synthetic); 0/94 historical occurrence | §9; verify §7 | VERIFIED | Medium | Robustness ceiling for any extension/refetch; silent in-sample, fatal out-of-sample |
| AR-11 | Sortino non-standard (std of negative subset); Sharpe rf=0; trade PnL omits entry fee; `n_trades`=closed-only, **3 open positions at end** excluded from win/PF/R | §18; code :189–192; OPEN_AT_END=3 | VERIFIED | Medium | Metric definitions must be stated; cross-paper comparisons invalid for Sortino as-is |
| AR-12 | Survivorship (acknowledged), HYPE 623 bars, staggered inception → heterogeneous effective windows | §20; §17 inception table | VERIFIED | Medium/High | Claims limited to "this survivor set, this window" |
| AR-13 | Pre-swap research non-reproducible (dataset never committed: `8cc0012` 141.17/1.06/383.72; longshort/capital_efficiency 2020-08-27..2026-08-25, B&H 570.78); decision-record conflations (+862/1.44 with −58.49; "+152%" vs committed 141.17; 5-vs-10-pair and 2026-08-25-vs-09-02 date drift) | §12; §23; git show/log | VERIFIED / STRONGLY SUPPORTED | Medium | Foundational narrative decisions rest on numbers that cannot be re-derived from the repo |
| AR-14 | n=94 closed trades; top-5 trades ≈ 100% of net PnL; trade #1 ≈ 45%; repo's own CI ~0.5–1.1 | PLAN:223; RULES:136; disclaimer:25 | VERIFIED | Medium | Statistical power of any Sharpe/return claim is low |
| AR-15 | Data frozen at 2026-09-02 with known holes; gap-WARN added later (`b96decc`) never acted; `AUDIT.md` P3-10 detection-only; root cause UNKNOWN | §12; §13 | VERIFIED | Medium | Dataset of record is knowingly incomplete |
| AR-16 | Close-only stop: 29/2,236 held days intraday-touch-without-exit (1.3%) | stops.py | VERIFIED | Low | Execution realism caveat; small but one-sided |

---

## 28. Required Owner Decisions

None of these is decided by this audit; each must be made (and recorded in `PLAN.md` per the repo's own rules) before a baseline can be frozen:

1. **OD-1 — Canonical snapshot:** choose A, B, or (recommended by process, not by this audit) a **re-run after OD-2**, following `ARCHITECTURE.md` §16: one source, rewrite all quoted figures, record decision.
2. **OD-2 — Data-gap policy:** refetch/repair from venue, forward-fill, drop-and-disclose, or leave-as-is with limitation text — for both the strategy series **and** the benchmark. This single choice moves DD (−26.45 vs −18.10 under one policy) and B&H Sharpe (0.98 vs 0.8787); decide before any re-run. Also decide whether the holes' root cause is investigated (refetch comparison) or documented as venue-side (`UNKNOWN` today).
3. **OD-3 — Benchmark definition:** pick exactly one B&H construction for *both* gates (idle-cash scalar / staggered sleeve / rebalance-on-listing / period-limited), name it precisely in the thesis, and recompute the gates against it. Note the Return gate fails under every located construction; the Sharpe gate verdict changes with construction + OD-2.
4. **OD-4 — Gate honesty:** restate the Sharpe gate as **"not met, waived with justification (−0.16)"** or re-run to a pre-registered criterion; fix `TASKS.md:18`, `PLAN.md:211`, preset `sharpe_vs_bnh: above`; decide explicitly about the never-addressed Return gate.
5. **OD-5 — Criterion history:** keep "> B&H (revised 2026-09-05)" or restore "≥1.0" (which nothing passes) or define a new thesis criterion **before** seeing any re-run output — and disclose the post-hoc revision either way.
6. **OD-6 — Sample-period label:** adopt the true window **2020-11-09 → 2026-09-02 (5.81y)** everywhere (reference.json, decision_log errata, config comment, disclaimer, ProofStrip) — or keep "6 tahun" only as the *config intent* (`lookback_years: 6`) with the actual window stated alongside.
7. **OD-7 — Stop-loss text:** canonicalize the documentation to the code (`prev_close − 2×prev_ATR`) — *or* change the code to entry-anchored (changes every stop, size, and number → requires full re-run + new snapshot). Must also resolve `DESIGN.md:37` vs `:64/:221`.
8. **OD-8 — Gap-stop semantics:** fix precedence to match docs (exit at open whenever open ≤ stop — historically affects 2 exits, both *worse* fills) **or** fix the docs to describe close-first precedence with the open-check only as recovery-case. Either way a named re-run or an explicit "no numeric impact beyond 2 legs" statement.
9. **OD-9 — Out-of-sample posture:** for the thesis, either run a genuine holdout/walk-forward split or declare in-sample-only with the best-of-9 + gate-revision history disclosed. Decide whether `research/*` pre-swap numbers (862%, long-only 1.12 decision inputs) are cited at all given they are not reproducible, or re-run those experiments on the Bitget data.
10. **OD-10 — Metric definitions:** confirm rf=0 Sharpe, the non-standard Sortino (or switch to standard downside deviation → re-run), entry-fee exclusion in trade stats, closed-only trade counts with `OPEN_AT_END=3` disclosed — each named in the methodology chapter.
11. **OD-11 — Decision-record corrections:** annotate (not silently rewrite) the conflations/mislabels (`decision_log:24,99,120`, `:12`, 5-vs-10-pair date drift, "B&H −58.49") as errata, consistent with the repo's do-not-fabricate rules.
12. **OD-12 — Presentation of sensitivity:** decide whether the forward-fill sensitivity (§16) appears in the thesis as a robustness table — explicitly as *sensitivity evidence*, never as the corrected headline (this audit offers no corrected number).

---

## 29. Limitations & Unknowns

Explicitly not determined by this audit (never converted into assumptions):

- **Snapshot A not re-executed** (requires checkout of pre-fix code = code change, forbidden). A rests on frozen git artifacts; A-side `CLAMP_BINDS` not measured — inferred ~0 from unit comparison (STRONGLY SUPPORTED, not VERIFIED).
- **Pre-swap dataset absent from git** → `8cc0012`-era and `research/longshort|capital_efficiency` numbers not reproducible (`UNKNOWN` data).
- **Provenance of "154.85%"** (`sharpe_discrepancy_report.md:98`) — `UNKNOWN`.
- **The "45" bound of RULES.md:56's "45–58%"** — no located computation — `UNKNOWN`.
- **Root cause of the 100-day holes** (venue outage vs fetch bug) — `UNKNOWN`; original fetch logs not stored.
- **Exact per-trade stop deltas A→B** — not line-traced (`trades.csv` has no stop column); units deltas are the verified proxy.
- **Paper trading's actual traded pair-set 2026-08-25..09-02** (docs say 10-pair from 08-25, git config says 2-pair until 09-02) — not traced into the SQLite/Supabase store — `UNKNOWN` (adjacent to, not central for, the backtest methodology).
- **Alternative gap policies** (refetch, interpolation, drop) — not run; only forward-fill was tested as one materiality probe; no policy endorsed.
- **Execution realism beyond configured fee/slip** (maker/taker mix, spread, impact, intraday stop fills) — out of scope; §9 wick/CASE2 stats are the only quantification.
- **Provenance of the two untracked `bh_*.md` analyses** — no generating script exists in the repo; methods are self-described inside the files (contents VERIFIED, generation history `UNKNOWN`). Files left untouched.
- **No new bootstrap/CIs computed** for Sharpe/DD (repo's own qualitative CI admissions cited instead); no attempt to re-derive any number with modified parameters.

---

*Phase 2H audit, HEAD `73856fa`, 2026-09-24. Evidence artifacts under `/tmp/phase2h_*`. Repository modified only by this file; no commit, no push.*
