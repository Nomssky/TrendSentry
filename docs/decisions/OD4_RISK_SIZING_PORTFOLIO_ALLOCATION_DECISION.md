# OD-4 — Risk Sizing, Position Sizing & Portfolio Allocation Decision Audit

> **Audit type: forensic, read-only (OD-4 only).** No strategy/backtest/research code, data, config,
> presets, datasets, reports, thesis artifacts, DB, Supabase, or product files were modified. No code
> was fixed, refactored, or optimized; no methodology was chosen on the owner's behalf; no OD-2 or
> OD-3 decision was quietly resolved. All instruments, counters, and synthetic cases ran against
> engine copies in `/tmp`. **This file is the only repository change; no commit, no push** (per
> mandate, unless the owner later says otherwise). This audit stops here — no OD-5 is opened.
> Evidence labels used throughout: `VERIFIED` / `STRONGLY SUPPORTED` / `INFERRED` /
> `UNKNOWN` / `OWNER DECISION REQUIRED`.

| Item | Value |
|---|---|
| Repo HEAD | `d728ec891036a62f142d98ade8913a0e86176370` (`d728ec8`) on `main` |
| Audit date | 2026-09-24 |
| Pre-existing untracked file (preserved, untouched) | `OD3_EXIT_POSITION_LIFECYCLE_ACCOUNTING_DECISION.md` |
| Temp artifacts (outside repo) | `/tmp/od4_instrument.py` (patcher + driver), `/tmp/od4_engine/rb_inst.py` (instrumented engine copy), `/tmp/od4_cases.py` (synthetic Cases A–N), `/tmp/od4_stats.py` (historical statistics), `/tmp/od4_repro/` (unmodified-engine re-run), `/tmp/od4_inst/`, `/tmp/od4_order_{config,rev,alpha}/`, `/tmp/od4_var_{cash,fixed,net}/` (evidence outputs) |
| Equivalence gate | instrumented copy == repo engine on trades/curve/metrics (`True/True/True`), pytest 70 passed |
| Evidence labels used | `VERIFIED` · `STRONGLY SUPPORTED` · `INFERRED` · `UNKNOWN` · `OWNER DECISION REQUIRED` |

---

## 1. Executive Summary

This audit answers one question: **exactly how does one position's risk become a quantity, how do
those quantities combine into a portfolio, and where does that construction deviate from — or go
beyond — the owner-approved PPT methodology?**

**Bottom line: THE PER-POSITION 1% RISK FORMULA IS IMPLEMENTED EXACTLY AND REPRODUCIBLY; THE
DEFINITIONS AROUND IT (which equity, which loss, which order, which cap binds) ARE NOT YET
FREEZABLE.**

Key findings (all `VERIFIED` unless stated):

1. **The1% is real, on its own terms.** `units = (equity_basis × 0.01) / (entry − stop)`
   (`run_backtest.py:134` → `strategy.py:79–81`) delivers **gross stop-distance risk exactly
   1.000000000% of the sizing basis for 94/94 historical trades** (OHLCV re-identification of the
   stop: 94/94, max abs diff 1.46e-11). A hand-computed synthetic (Case C) matches the engine to
   the last float digit (`0.6643414715163596`).
2. **"1%" is a gross number by construction.** Net all-in loss at the stop (entry fee + exit
   fee + exit slippage included) is **1.0078%–1.0645%** of basis (median 1.0216%, i.e. up to
   **+0.0645pp over budget**); slippage is nevertheless *inside* the sizing math via the
   slipped-open entry anchor (units −0.19% to −1.32% vs raw-open sizing, median −0.46%). Whether
   the PPT's "Risiko maksimal 1%" means gross or net is **NOT SPECIFIED IN APPROVED PPT** →
   **OD-4.1 / OD-4.5**.
3. **The sizing basis is previous-curve-day pooled total equity — cash + unrealized — for 94/94
   trades** (== prev-day cash only 51/94 by coincidence of flat days; == same-day equity 0/94;
   43/94 entries sized while other positions were open). The PPT says only "ekuitas" →
   **OD-4.2 / OD-4.11**.
4. **All three hard portfolio constraints are measurable, and none of them is the global cap.**
   Historical: cash clamps **0**, spot caps **0**, global-cap skips **0**, **cluster skips 498**
   (independently re-counted, matches OD-3's 498 exactly). Structural maximum is **3** concurrent
   positions (cluster A ≤ 2, cluster B = HYPE singleton), while `max_concurrent_positions: 5`
   (`config.yaml:27`) never binds (observed max 3) → **OD-4.10**.
5. **Results are order-dependent across assets (ORDER-DEPENDENT, `VERIFIED`).** Same data, three
   iteration orders: **152.00% / 159.17% / 162.51%** final return (spread **10.51pp**), 94/93/92
   trades, cluster skips 498/509/503. Synthetic Cases F and K reproduce the mechanism on a toy
   portfolio (identical data, different dict order → equity 983.90 vs 997.59 and 978.72 vs
   1002.06) → **OD-4.8**.
6. **Equity-basis composition materially moves the thesis numbers (measured, not judged):**
   cash-only basis → 139.62%; constant-initial basis → 106.41% (with lower drawdown −19.23% and
   higher Sharpe 0.87 as measured); net-risk budget → 147.20%. All labeled
   `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT` → **OD-4.5 / OD-4.11**.
7. **No rounding/lot logic exists**: accounting uses the raw float quantity; trade rows display
   `round(units, 6)` only (`run_backtest.py:112/:160`), delta 8.67e-08 units ($1.28e-07 risk).
   Exchange lot/step/min-qty is not modeled → **OD-4.6**.
8. **Cash handling never went negative historically** (curve cash min **826.19**) because the
   clamp path never fired (0 events); its behavior under shortfall (clamp-to-cash partial, then
   reject at ≤ 0) exists only in synthetic evidence (Cases G/H/I) → **OD-4.9**.
9. **Portfolio return construction is fully identified:** final equity 2520.02 = cash 1324.37 +
   open MV 1195.65 (residual −0.004); = 1000 + closed PnL 1304.50 − entry fees 19.75 +
   unrealized 235.30 (residual −0.031, trade-row display rounding); return = final/1000 − 1 =
   **152.00%**, of which **23.53pp is unrealized** (9.34% of final equity).
10. **Eleven decisions are registered: OD-4.1 – OD-4.11.** Nine are `OWNER DECISION REQUIRED`;
    OD-4.4 is `CARRIED FROM OD-2` (stop anchor / ATR timestamp) and OD-4.7 is
    `CARRIED FROM OD-3` (same-day re-entry / exit-lifecycle semantics). Options A/B/C are listed
    for each; **none is selected here.**

Baseline reproducibility (§21) confirms the canonical snapshot unchanged: **152.00% return,
Sharpe 0.82, max drawdown −26.45%, 94 trades, final equity 2520.02** at HEAD `d728ec8`.

---

## 2. Scope, Mode & Hard Constraints

- **Mode: FORENSIC AUDIT ONLY.** No changes to `strategy.py`, `run_backtest.py`, `config.yaml`,
  datasets, presets, or reports. No methodology chosen on the owner's behalf. Instruments,
  counters, and synthetic cases only in `/tmp`.
- **Exactly one new repository file:** `OD4_RISK_SIZING_PORTFOLIO_ALLOCATION_DECISION.md`
  (this file). Uncommitted and unpushed by mandate.
- **No OD-2/OD-3 resolution:** conflicts those audits own are carried, never settled here.
- **No strategy verdict:** this document states how the engine constructs risk, allocation, and
  portfolio results; it does not evaluate whether the strategy is good, profitable, or suitable.
- **Terminology discipline** — the following terms are never interchangeable in this document:
  - **Risk (per position):** `risk_amount = units × (entry − stop)` — the gross stop-distance
    loss (`run_backtest.py:145`). Expressed as % of the sizing basis unless stated.
  - **Notional:** `units × entry_price` — position value at entry.
  - **Capital% (Cap%):** notional ÷ sizing basis — how much of the equity base a position
    occupies.
  - **Equity:** end-of-day marked-to-market total = cash + open-position market value
    (`run_backtest.py:169–177`).
  - **Cash:** unspent balance; reduced by entry cost, increased by exit proceeds.
  - **Unrealized PnL:** open-position mark-to-market gain over position entry cost.
  - **Portfolio risk:** sum of `risk_amount` over open positions ("open_risk$") — distinct from
    deployed notional and from cash.
- **Evidence labels:** `VERIFIED` = re-derived from repo sources and/or reproducible runs in this
  audit; `STRONGLY SUPPORTED` = multiple consistent artifacts, direct re-derivation not performed;
  `INFERRED` = best-supported reading, alternative readings exist; `UNKNOWN` = sources do not
  determine it; `OWNER DECISION REQUIRED` = a register entry exists (§25).
- **Alternative historical runs:** every non-canonical run in §23 and every synthetic case in §22
  is labeled `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`.

---

## 3. Source Hierarchy & Evidence Labels

Applied exactly as mandated:

| Level | Source | Use here |
|---|---|---|
| **L1** | Approved first-guidance PPT (`/tmp/opencode/od2_ppt.txt`, extracted from `Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf`) | Decides approved methodology; quoted verbatim in §4 (lines 51, 185, 187, 189, 191, 193, 195, 197). |
| **L2** | Explicit owner decisions (incl. `PLAN.md` strategy table, `backtest/reports/decision_log.md`) | Where L2 conflicts with L1, L1 wins, conflict disclosed. |
| **L3** | `PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md` | Prior findings re-verified where they touch sizing/allocation. |
| **L4** | `OD2_ENTRY_EXECUTION_STOP_DECISION.md` (OD-2.1 – OD-2.9) | Carried stop/anchor decisions (→ OD-4.4). |
| **L5** | `OD3_EXIT_POSITION_LIFECYCLE_ACCOUNTING_DECISION.md` (OD-3.1 – OD-3.x) | Carried exit/lifecycle/accounting decisions (→ OD-4.7). |
| **L6** | Current implementation (`backtest/strategy.py`, `backtest/run_backtest.py`, `config.yaml`, presets) | Describes what actually runs; never overrules L1 silently. |
| **L7** | General knowledge | Not used to resolve any ambiguity. |

Conflict rule used throughout: if L1 is silent on a methodology point, the exact phrase
**`NOT SPECIFIED IN APPROVED PPT`** appears, and the point becomes
**`UNKNOWN / OWNER DECISION REQUIRED`** with a register entry in §25. Silence never defaults to
"implementation is correct by virtue of existing."

---

## 4. Approved PPT vs Implementation (L1 Comparison)

Verbatim L1 quotes vs what the code does:

| # | Approved PPT wording (L1, line) | Implementation | Verdict |
|---|---|---|---|
| 1 | **Position Sizing** — "Risiko maksimal 1% dari ekuitas per posisi" (`:191`) | `units = (equity_basis × 1%) / (entry − stop)`; gross risk == basis × 1% for **94/94** trades; basis = previous-curve-day total equity (§17) | **IMPLEMENTED (`VERIFIED`)** — but "ekuitas" (which equity snapshot/composition) and "risiko" (gross vs net loss) are **NOT SPECIFIED IN APPROVED PPT** → OD-4.1, OD-4.2, OD-4.11 |
| 2 | **Manajemen Risiko** — "Stop loss dinamis: Entry − 2 × ATR(14)" (`:189`) | `stop = signal-day Close − 2 × ATR(14)` (`run_backtest.py:133`); sizing/execution entry = next Open × (1+0.05%) (`:132`) | **CONFLICT with L1 formula (carried)** → OD-4.4 `CARRIED FROM OD-2` (OD-2.1 anchor, OD-2.3 ATR timestamp); this audit measures only its sizing elasticity (§7) |
| 3 | **Correlation Mitigation** — "Penerapan Clustering Limit (maksimal 2 posisi aktif per kluster korelasi harian)" (`:193`) | `max_positions_per_cluster: 2` (`config.yaml:22`), hardcoded `CLUSTERS` (`strategy.py:14–18`), count at the candidate's own loop turn (`run_backtest.py:130`), **498** skips historically | **CAP ENFORCED (`VERIFIED`)** — cluster *composition* (which pairs in A/B) is **NOT SPECIFIED IN APPROVED PPT** (implementation A=9 high-corr pairs, B=HYPE singleton) → evidence under OD-4.10 |
| 4 | Research-gap slide — "Gap: Uji simultan 10 pair + maks 5 posisi aktif + clustering limit (maks …)" (`:51`) | `max_concurrent_positions: 5` (`config.yaml:27–28`), gate at `run_backtest.py:128`; **observed max 3, global skips 0**; config comment itself notes "maksimum riil 3" | **CONFIGURED, NEVER BINDS (`VERIFIED`)**; the PPT states it as a *research gap to test*, not a portfolio risk rule; a **portfolio-level aggregate risk cap** is **NOT SPECIFIED IN APPROVED PPT** → OD-4.10 |
| 5 | **Biaya Transaksi** — "0,1% fee taker + 0,05% slippage per eksekusi" (`:197`) | Entry: price = Open × (1+slippage) (`:132`), cost = units × price × (1+fee) (`:135`); Exit: proceeds = units × price × (1 − fee − slippage) (accounting per OD-3, cash-path verified in Case F); rates `config.yaml:39–40` | **RATES & PLACEMENT IN EXECUTION IMPLEMENTED (`VERIFIED`)** — whether costs belong *inside the 1% budget* is **NOT SPECIFIED IN APPROVED PPT** → OD-4.5 |
| 6 | Entry/Exit signals, Long-only (`:185`, `:187`, `:195`) | (audited in OD-2/OD-3) | Out of OD-4 scope; cited only where they feed sizing inputs |

**PPT-silent items found in this audit (all `NOT SPECIFIED IN APPROVED PPT`):** rounding/lot
policy (OD-4.6), asset iteration order (OD-4.8), cash-shortfall policy (OD-4.9), same-day
capacity reuse (OD-4.7, carried from OD-3), aggregate portfolio risk cap (OD-4.10), equity
snapshot timing (OD-4.2) and unrealized-in-basis composition (OD-4.11).

---

## 5. Current Implementation Map (Code Path & Formulas)

Per-entry chain (one symbol, one day; `run_backtest.py` unless noted):

```text
equity_basis := equity variable, last written at end of previous loop day   :176
entry_price  := open(d_signal+1) × (1 + 0.0005)                             :132
stop         := close(d_signal) − 2 × ATR(14)(d_signal)                     :133
units_risk   := (equity_basis × 0.01) / (entry_price − stop)                :134 → strategy.py:79–81
units_spot   := min(units_risk, equity_basis / entry_price)                 strategy.py:82–83   [spot cap: notional ≤ equity]
cost         := units × entry_price × (1 + 0.001)                           :135
if cost > cash:  units := cash / (entry_price × (1 + 0.001))                :136–138   [cash clamp]
if units > 0:    cash −= cost ; open position                               :139–147
risk_amount  := units × (entry_price − stop)                                :145      [actual, post-constraint]
```

- **Gates before sizing:** global `len(pos) < 5` (`:128`), then cluster count `< 2`
  (`:130–131`, `cluster_position_count` `strategy.py:29`).
- **Single-variable stop:** the value computed at `:133` is the *same* variable used for sizing
  (`:134`), stored risk (`:145`), exit close-check (`:103`), and gap check (`:149`) — §7.
- **Equity rebuild (end of each day):** MTM over open positions (`:169–175`), `equity := mtm`
  (`:176`), curve append (`:177`) — the next day's sizing reads it (§17).
- **Constraint priority (verified synthetically):** cluster/global gates → risk formula → spot
  cap (`strategy.py:82–83`) → cash clamp (`:136–138`) → reject if `units ≤ 0` (`:139`).
- **Config:** `risk_per_trade_pct: 1.0` (`config.yaml:26`), `max_concurrent_positions: 5`
  (`:27–28`, comment notes effective max 3), `max_positions_per_cluster: 2` (`:22`),
  `atr_stop_multiplier: 2.0` (`:20`), `fee_pct: 0.1` / `slippage_pct: 0.05` (`:39–40`),
  `initial_capital_usd: 1000` (`:38`).

---

## 6. Audit A — Risk Sizing Formula & Unit Trace (`VERIFIED`)

**Formula:** `risk_amount = units × (entry − stop)` with `units = (basis × 0.01)/(entry − stop)`
⇒ for any entry where no constraint binds, `risk_amount ≡ basis × 0.01` identically.

**Historical proof:**

- Gross risk % of sizing basis: **min = median = max = 1.000000000%**, exactly 1.000000000% for
  **94/94** trades; `risk budget == equity_basis × 1%` for **94/94** (§11).
- Independent OHLCV re-derivation (not reading stored fields): stop == `prev_close − 2×ATR` for
  **94/94**, and recomputed gross risk % is again exactly **1.000000000%** across all 94.

**Unit trace (synthetic Case A, `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`):**
basis 1000.0000, entry 102.051000, stop 100.571429, dist 1.479571 →
`units = 6.758713913295403`, `risk = $10.000000 = 1.000000%` of basis, notional $689.7335
(Cap% 68.9734), entry cost $690.4232, cash 309.58, equity end 1005.72, zero constraint events.

**Exact-arithmetic proof (Case C, mandated numbers):** signal close 100, open 105 → entry
105.0525, stop 90, dist 15.0525, risk $10.000000 → engine `units = 0.6643414715163596`,
hand-calc `10 / 15.0525 = 0.6643414715163596`, **match = True** (bit-exact).

**Not interchangeable:** the same trade's Risk is always $10.00 on a $1000 basis, while Notional
ranges from $69.79 (Case C) to $689.73 (Case A) depending on stop distance — §11.

---

## 7. Audit B — Stop Value Used for Sizing (`VERIFIED`)

- **Single source:** stop is computed once (`:133`) and reused everywhere. Stored stop vs OHLCV
  recompute across 94 trades: **max abs diff 1.46e-11** — sizing, stored `risk_amount`, exit
  close-check, and gap check all read one value (lines `:134`, `:145`, `:103`, `:149`).
- **Elasticity:** `units ∝ 1/(entry − stop)`. Any change to the stop anchor or ATR timestamp
  changes every size. Measured: signal-close-anchored distance vs entry-anchored distance is
  **+0.467% median** ⇒ units **−0.465% median** — this independently cross-checks OD-2's
  measured sizing median delta of **+0.47%** between the same two anchors.
- **Dependency chain (`VERIFIED`):** ATR timestamp (OD-2.3) + anchor (OD-2.1) → stop (`:133`) →
  stop distance (`:134`) → units → entry cost/capital (`:135`) → concurrent cash use → portfolio.
- The anchor/timestamp *choice itself* is not re-decided here: **OD-4.4 `CARRIED FROM OD-2`**.

---

## 8. Audit C — Entry Price Basis (`VERIFIED`)

- **Sizing uses the executable entry:** `entry_price = open × (1 + 0.0005)` (`:132`) is the same
  variable used in cost (`:135`). Trade-record entry (2dp display) vs `open × 1.0005`:
  **max diff 0.0000** over 94 trades — sizing and execution share one price.
- **Effect on size (slippage inside the stop distance):** sizing with the slipped entry vs raw
  open changes units by **min −1.3195%, median −0.4625%, max −0.1859%** (larger distance →
  smaller units). Synthetic Case C/M: slipped dist 15.0525 vs raw 15.0000 → units 0.664341 vs
  0.666667 = **−0.3488%**.
- Which price the PPT intends as the sizing anchor is **NOT SPECIFIED IN APPROVED PPT**
  (it specifies execution mechanics only in the general shift-1 passage, audited in OD-2) →
  **OD-4.3**.

---

## 9. Audit D — Actual Historical Risk % & Deviation Decomposition (`VERIFIED`)

Four distinct measurement bases for the same 94 trades (never conflated):

| Basis | Result |
|---|---|
| Gross stop risk ÷ sizing basis (engine definition) | **exactly 1.000000000%, 94/94** |
| Net all-in loss at stop ÷ basis (`units×(entry×(1+fee) − stop×(1−fee−slip))`) | min **1.0078%**, median **1.0216%**, max **1.0645%** ⇒ over budget **+0.0078pp … +0.0645pp** (median +0.0216pp) |
| Gross risk ÷ entry-day-close equity (if basis were same-day equity) | min **0.9821%**, median **0.9998%**, max **1.0268%** |
| Realized loss ÷ budget at exit (r-multiple) | min **−1.688R**; **31 of 94** realized **worse than −1R** — close-confirmation fills (stop checked vs `close`) can realize beyond the budgeted stop; stop-fill semantics belong to OD-2.9/OD-3, recorded here as **evidence for OD-4.1** |

Constraint events over the full history: **clamps 0, spot caps 0, global skips 0, cluster skips
498** (independent counter in this audit).

Interpretation constraint (no verdict): the engine's "1%" is a **gross stop-distance** budget on
**previous-day total equity**; deviations arise only from (a) transaction costs excluded from the
budget, (b) basis-timing choice, (c) exit-fill semantics — each mapped to OD-4.1/4.5, OD-4.2, and
OD-2/OD-3 respectively.

---

## 10. Audit E — Rounding & Quantity Precision (`VERIFIED`)

- **Accounting uses full float.** Position `units` is stored and used unrounded in every cash,
  risk, and PnL path (`p["units"]` at `:103`, `units` at `:140`).
- **Trade rows round for display only:** `"units": round(p["units"], 6)` at
  `run_backtest.py:112/:160`. Synthetic Case N: full float `6.758713913295403` vs display
  `6.758714` ⇒ delta **8.670e-08 units ≈ $1.283e-07 of risk** — no accounting path reads the
  rounded row.
- **No exchange lot/step/min-qty/precision logic exists** in `backtest/` (no matching code;
  `NOT IMPLEMENTED`) — quantities like `0.004659 BTC` or `1180.170688 ADA` are accepted as-is.
  The spot cap (`min(units, equity/entry)`, `strategy.py:82–83`) is a notional ceiling, **not** a
  rounding rule.
- Rounding/lot policy for the thesis is **NOT SPECIFIED IN APPROVED PPT** → **OD-4.6**.

---

## 11. Audit F — Capital Allocation (`VERIFIED`)

Representative historical allocations (from `/tmp/od4_inst/trades.csv`; Risk budget =
basis × 1%; Cap% = notional ÷ basis; Risk% is always 1.000 by construction):

| Trade | Equity (basis) | Risk bgt | Stop dist | Quantity | Notional | Cap% | Risk% |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2020-12-01 BTC/USDT | 1000.00 | 10.00 | 2146.32 | 0.004659 | 91.79 | 9.2 | 1.000 |
| 2023-07-26 DOGE/USDT | 1534.34 | 15.34 | 0.01 | 1669.734812 | 136.69 | 8.9 | 1.000 |
| 2026-03-05 BTC/USDT | 2373.09 | 23.73 | 7345.49 | 0.003231 | 234.88 | 9.9 | 1.000 |
| 2023-10-20 SOL/USDT | 1527.84 | 15.28 | 2.51 | 6.076939 | 151.53 | 9.9 | 1.000 |
| 2025-09-22 BNB/USDT | 2605.75 | 26.06 | 61.71 | 0.422232 | 442.59 | 17.0 | 1.000 |
| 2026-08-03 ADA/USDT | 2288.74 | 22.89 | 0.02 | 1180.170688 | 223.87 | 9.8 | 1.000 |

**Aggregates (n=94):** Cap% **min 3.72 / median 9.25 / max 26.40**; stop distance as % of entry:
**median 10.81% (min 3.79%, max 26.88%)**; risk budget$ median **20.58**.

**Mechanism (synthetic contrast, `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`):**
same $10 risk on the same $1000 basis — Case B-1 dist 1.4796 → notional $689.73 (**Cap 68.97%**);
Case B-2 dist 13.051 → units 0.766225, notional $78.19 (**Cap 7.82%**). **Constant risk never
means constant capital**: capital share is driven entirely by stop distance (and, historically,
by the ~10.81% median distance → ~9.25% median Cap%).

**Distinct from cash outflow:** entry cost = notional × (1 + fee) (Case A: $689.73 → $690.42).

---

## 12. Audit G — Concurrent Exposure (`VERIFIED`)

From the full curve (2120 days, `/tmp/od4_inst/curve.csv`):

- **Open-position count distribution:** `{0: 798, 1: 428, 2: 786, 3: 108}` — max **3**,
  mean **1.096**. The global cap 5 **never binds** (0 skips; structural max 3, §13).
- **Deployed capital (notional of open positions):** max **$1283.82**; as % of equity: median
  **12.09%**, max **49.31%** (2023-12-25). Cash and deployed notional are reported separately —
  cash never went negative (min 826.19, §16).
- **Simultaneous portfolio risk (Σ open `risk_amount`):** max **$78.81**; as % of equity:
  median **1.002%**, max **3.237%** (2025-07-13) — see §19.
- **Synthetic Case D** (`FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`): 3 same-day
  positions (2 cluster-A + HYPE) open with `open_risk(end) = 30.0000`, nA=2, nB=1, deployed
  237.91, cash 765.18 — three positions at 1% each coexist; each position's Risk stays $10 on
  the $1000 basis while Portfolio risk triples to $30 (≈2.99% of equity after MTM).

---

## 13. Audit H — Cluster Constraint (Independent Re-verification) (`VERIFIED`)

- **Independent recount in this audit:** `CLUSTER_SKIPS = 498` over the full history —
  **identical to OD-3's independently obtained 498** (`498 == 498: True`). Sample skip events:
  `2021-01-31 XRP/USDT`, `2021-03-21 XRP/USDT`, `2021-04-14 BTC/USDT`.
- **Source:** hardcoded `CLUSTERS` dict (`strategy.py:14–18`) — cluster **A** = 9 high-correlation
  pairs (BTC, ETH, SOL, BNB, XRP, ADA, AVAX, LINK, DOGE per `config.yaml:22` comment), cluster
  **B** = {HYPE} singleton. Cap `max_positions_per_cluster: 2` (`config.yaml:22`).
- **Semantics:** count = open positions whose symbol is in the *same* cluster, evaluated at the
  candidate's **own loop turn** (`:130`); a skip `continue`s before any sizing (`:131–134`) —
  skipped signals consume no cash and produce no counterfactual position.
- **Structural consequences (`VERIFIED`):** cluster A occupancy max 2 (days sitting at the
  2-position cap: **882**); cluster B max 1 (singleton can never fill its own cap of 2) ⇒
  **structural maximum portfolio = 3 positions**, which is why global-5 never binds.
  Global skips: **0**.
- Cluster *composition* is implementation metadata (correlation-mitigation research in
  `backtest/research/correlation_mitigation.py`, `CLUSTERS` `:43`) — cluster rules per PPT are
  capped (§4) but composition is `NOT SPECIFIED IN APPROVED PPT` → evidence under **OD-4.10**.

---

## 14. Audit I — Same-Day Capacity & Re-entry Semantics (`VERIFIED`)

Two distinct same-day rules, both order-sensitive:

1. **Same-day capacity reuse across symbols:** exits are processed *inside* the same symbol loop
   that performs entries, so an earlier-listed symbol's exit frees a cluster slot *before* a
   later-listed symbol's entry check. Synthetic Case F (`FORENSIC SENSITIVITY — NOT CANONICAL
   THESIS RESULT`):
   - **Config order (BTC,ETH,SOL):** BTC exits (stop, close 98.5) → SOL, checked later the same
     day, sees cluster A count 1 → **enters the same day**, cash-clamped to the freed remainder:
     risk **$9.627931 = 0.954876%** of basis (basis 1008.2910 = previous-day equity — same-day
     exits do **not** update the sizing basis), clamps = 2, final equity **983.90**.
   - **Reversed order (SOL,ETH,BTC):** SOL is checked *before* BTC's exit → cluster A full
     (ETH + BTC) → **cluster-skipped** (skip recorded `2024-02-02`); final equity **997.59**.
   - Same data, different order ⇒ different trades and equity.
2. **Same-symbol re-entry on the exit day is impossible by structure:** exit and entry for one
   symbol live in opposite branches of the same `if symbol in pos / else` (`:100/:120`) — an
   exiting symbol never reaches the entry branch that day.

Both rules are covered by carried decisions: **OD-4.7 `CARRIED FROM OD-3`** (exit-day
re-entry/lifecycle semantics) — recorded here with the additional capacity-reuse evidence, not
re-decided.

---

## 15. Audit J — Asset-Ordering Dependency (`VERIFIED` — ORDER-DEPENDENT)

**Full-history runs on identical data, three iteration orders** (config = symbol-first as
written; rev = reversed; alpha = alphabetical). All rows
`FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`; only the config-order row equals the
canonical baseline:

| Order | Return | Sharpe | Max DD | Trades | Final equity | Cluster skips |
|---|---:|---:|---:|---:|---:|---:|
| **config (canonical)** | **152.00%** | **0.82** | **−26.45%** | **94** | **2520.02** | **498** |
| reversed | 162.51% | 0.72 | −26.53% | 92 | 2625.14 | 503 |
| alphabetical | 159.17% | 0.72 | −26.34% | 93 | 2591.74 | 509 |

Spread between orders: **10.51pp** of final return (162.51 − 152.00), 92–94 trades, +5 to +11
cluster skips. Sharpe/DD move too (0.82 → 0.72; −26.45% → −26.53% / −26.34%).

**Mechanism on toy portfolios (same data, dict order only):**
- Case F: equity **983.90 vs 997.59** (same-day slot reuse vs skip, §14).
- Case K: config keeps BTC+ETH (BTC stops out, PnL −21.62, SOL skipped) → final **978.72**;
  reversed keeps SOL+ETH (BTC cluster-skipped, **0** closed trades) → final **1002.06**;
  **delta −23.34** reported by the engine as `ORDER-DEPENDENT`.

Ordering determines *which* signals consume the fixed cluster slots; nothing in the PPT
prescribes an iteration order (`NOT SPECIFIED IN APPROVED PPT`) → **OD-4.8**.

---

## 16. Audits K & L — Cash Handling Under Insufficient Cash (`VERIFIED`)

**Implemented semantics (three-stage chain, in order):**

1. **Spot cap** (`strategy.py:82–83`): `units ≤ equity / entry` — notional ≤ equity (no
   leverage; cost then still includes fee, so it can exceed *cash* even at the cap).
2. **Cash clamp** (`:136–138`): if `cost > cash` → `units = cash / (entry × (1+fee))` —
   **partial fill to exactly the remaining cash** (not a reject).
3. **Reject at ≤ 0** (`:139`): zero/negative units never open a position.

**Historical frequency: 0** — `CLAMPS = 0`, `SPOT_CAPS = 0`, `GLOBAL = 0` over all 94 entries;
curve cash min **826.19**, never negative. Consequence: an alternative policy
(reject-on-shortfall) is **identical on history by construction** (variant D, §23) — the
difference exists only under synthetic shortfall.

**Synthetic severity ladder (all `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`):**

| Case | Scenario | Outcome |
|---|---|---|
| **G** | slight insufficiency (tight stop → risk formula wants 12.840738 units) | spot cap → 9.955182, cash clamp → **9.945237**, delivered risk **$7.745066 = 0.774507%** of basis (budget unmet, not exceeded), notional $999.0010 = **99.9001%** of equity, cost $1000.00, cash → **−0.0000** (float zero), counters: 1 clamp + 1 spot cap |
| **H** | severe (initial cash $6, two same-day entries) | BTC drains cash to **−8.88e-16** (float epsilon); ETH sized on that cash → clamped to ~0 → **rejected** (never opens); clamps = 2, spot caps = 2; cash never meaningfully negative |
| **I** | multiple same-day (BTC + ETH + HYPE) | BTC full **1.000000%** ($690.42 of $1000), ETH clamped to remainder **0.448387%** (units 3.030519, cash → 0.0000), HYPE third with cash 0.0 → **rejected**; open = {BTC, ETH} |

**Design consequence:** because clamp-to-cash *under*-sizes rather than over-sizing, the cash
constraint can only ever **reduce** delivered risk below 1% (G: 0.7745%; F: 0.9549%; I: 0.4484%)
— it never amplifies risk, and cash never goes negative. Which policy the thesis adopts (clamp
vs reject vs minimum-notional threshold) is `NOT SPECIFIED IN APPROVED PPT` → **OD-4.9**.

---

## 17. Audits M & N — Equity Basis Identification (`VERIFIED`)

**Which "equity" feeds the 1% (94/94 identification against the curve):**

| Candidate basis | Matches |
|---|---|
| **previous-curve-day total equity (cash + unrealized), pooled across the portfolio** | **94/94** |
| previous-day cash only | 51/94 (flat-position coincidences) |
| initial capital 1000 (constant) | 1/94 (the first trade only) |
| same-day-close equity | **0/94** |
| entries made while other positions were open (basis ≠ prev cash) | **43/94** |

Example rows (basis == prev-curve equity for all): `2024-01-09 BTC` basis **2152.79** vs
prev-cash 1557.88; `2025-01-12 XRP` basis **2476.51** vs 2032.68; `2026-08-03 ADA` basis
**2288.74** vs 1934.96; `2025-06-11 ETH` basis **2604.52** vs 2327.25. First trade
`2020-12-01 BTC` basis = 1000.00 = initial.

**Timing nuance:** the basis is read *before* the day's loop mutates cash/pos — same-day exits
freed cash are not in the basis (Case F: SOL sized on 1008.2910 = prev-day equity while BTC's
same-day exit had already refilled cash to 664.73 — basis and cash diverge by design).

**Composition effect (synthetic J±, `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`):**
- **J+** (BTC floating +50%): next-day ETH basis **1323.3838** → risk formula wants
  **8.944373 units** (= $13.2338 = 1% of inflated basis; +32.34% vs the $1000-basis 6.758714);
  cash clamp delivers 3.030519 → delivered risk 0.338818% of that basis (cash-limited).
- **J−** (BTC floating loss): basis **992.2069** → wants **6.706042 units** (−0.78% vs
  6.758714); clamp delivers 3.030519 → 0.451909% of basis.
- Sequential-trade table (§stats) shows the same effect live: e.g. XRP 2025-01-12 sized on
  2476.51 while cash was 2032.68 — unrealized gains in *other* positions directly scale the
  next position's budget.

Unrealized PnL is therefore inside the basis for **94/94** historical trades, while the PPT says
only "ekuitas" → snapshot timing **OD-4.2**, unrealized composition **OD-4.11** (decide
together).

---

## 18. Audit O — Fees & Slippage in the Risk Budget (`VERIFIED`)

**Where costs enter the engine:**

| Cost | Where applied | Enters the 1% budget? |
|---|---|---|
| Entry slippage 0.05% | inside `entry_price` (`:132`) | **Yes — indirectly:** it lengthens `(entry − stop)`, shrinking units by −0.19%..−1.32% (median −0.46%) for 94/94 |
| Entry fee 0.1% | inside entry `cost` (`:135`) — cash only | **No** — not in `risk_amount` |
| Exit fee + slippage 0.15% | exit proceeds (OD-3 accounting; cash-path verified: Case F-config BTC exit refilled cash to 664.73 = units×98.5×0.9985) | **No** |

**Net vs gross at the stop (synthetic Case M, engine numbers from Case C):**

- Gross stop risk = `units×(entry − stop)` = **$10.000000 = 1.000000%** of equity.
- Net all-in loss at stop = `units×(entry×(1+fee) − stop×(1−fee−slip))` = **$10.159477 =
  1.015948%** ⇒ **+0.0159pp over the stated budget**.
- Historical band for the same quantity: **1.0078%–1.0645%** (median 1.0216%, §9).

**Net-budget variant (§23, `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`):** sizing on
the net definition → final 2471.97, return **147.20%**, Sharpe 0.82, DD −25.97%, 94 trades
(vs canonical 152.00% / 2520.02) — reported as measured, no evaluation.

Whether the approved "Risiko maksimal 1%" is gross or net is **NOT SPECIFIED IN APPROVED PPT**
→ **OD-4.5** (with OD-4.1 defining *which loss event* the budget denotes).

---

## 19. Audit P — Risk Concentration & Portfolio-Level Risk (`VERIFIED`)

**Portfolio risk = Σ open `risk_amount`** (a risk measure — distinct from deployed notional and
from cash):

- Historical: max **$78.81**; as % of equity: median **1.002%**, max **3.237%**
  (2025-07-13).
- Concentration at structural maximum (3 positions = 2 cluster-A + HYPE), representative days:

| Date | Clusters | Active | Portfolio risk ($) | Deployed notional | Equity |
|---|---|---:|---:|---:|---:|
| 2025-08-14 | A=2, B=1 | 3 | 78.81 | 733.03 | 2630.43 |
| 2025-08-15 | A=2, B=1 | 3 | 78.81 | 727.90 | 2625.30 |
| 2025-08-16 | A=2, B=1 | 3 | 78.81 | 729.51 | 2626.91 |
| 2025-08-17 | A=2, B=1 | 3 | 78.81 | 762.44 | 2659.83 |
| 2025-08-18 | A=2, B=1 | 3 | 78.81 | 741.57 | 2638.97 |

- Across the **882** days holding 2 cluster-A positions: aggregate risk % of equity —
  median **1.964%**, max **3.237%**.
- **Synthetic Case L** (5 simultaneous signals across both clusters): 2×A + 1×B enter
  (structural max 3), SOL + ADA cluster-skipped, portfolio risk **30.0000 = 2.9907%** of equity;
  explicit engine note: *"PPT portfolio-level risk cap: NOT SPECIFIED IN APPROVED PPT (only
  per-position 1%)"*.
- **The PPT provides no aggregate portfolio risk ceiling** — only per-position 1% (`:191`) and a
  research-gap statement about max 5 positions (`:51`). Observed concentration (max 3.237%) is a
  *consequence* of per-position sizing + cluster caps, not of an approved portfolio rule →
  **OD-4.10** (evidence includes: global cap 5 never binds, structural max 3, cluster-B
  singleton, 498 skips).

---

## 20. Audit Q — Portfolio Return Construction & Attribution (`VERIFIED`)

Final equity is a **marked-to-market identity**, rebuilt two independent ways from
`/tmp/od4_inst/`:

1. **Balance identity:** final **2520.02** = cash **1324.37** + open MV **1195.65**
   (residual **−0.004**).
2. **Attribution identity:** 1000 (initial) + closed PnL **1304.50** − all-time entry fees
   **19.75** + unrealized PnL **235.30** = 2520.05 vs actual **2520.02** (residual
   **−0.031**, attributable to trade-row display rounding `round(...,6)` / `round(...,2)`).
3. **Return:** `final / 1000 − 1 = 152.00%`; **unrealized contributes 23.53pp** (= 9.34% of
   final equity). Closed-trade PnL excludes entry fees by construction (OD-3 accounting —
   carried, not re-decided).
4. **Cash invariant:** curve cash min **826.19** — never negative at any point.

Trade PnL → curve equity → reported return is therefore a closed chain with no unexplained
residual beyond display rounding (`VERIFIED`).

---

## 21. Audit R — Reproducibility of the Baseline (`VERIFIED`)

Unmodified-engine re-run (`/tmp/od4_repro`) + instrumented-copy equivalence + test suite:

```text
HEAD d728ec891036a62f142d98ade8913a0e86176370 | dataset Bitget 10 pairs 1D |
preset config.yaml (risk_per_trade_pct=1.0, max_concurrent=5, max/cluster=2,
fee=0.1%, slip=0.05%, initial=1000) |
trades=94 final=2520.02 ret=152.0 sharpe=0.82 dd=-26.45 |
instrumented==repo: trades True, curve True, metrics True | pytest 70 passed
```

- Canonical baseline confirmed unchanged: **152.00% return, Sharpe 0.82, max drawdown −26.45%,
  94 trades, final equity 2520.02** — identical to the Snapshot B record.
- All §6–§20 instrumentation ran on an engine **copy** (`/tmp/od4_engine/rb_inst.py`); equivalence
  gate (trades/curve/metrics all `True`) proves the counters did not change engine behavior.
  Closing line of the instrumented run: *"Repo untouched; all runs use
  /tmp/od4_engine/rb_inst.py copy."*
- Independent recount of the cluster counter (498) matches OD-3's independent count exactly.

---

## 22. Synthetic Test Matrix (Cases A–N)

Every row: synthetic OHLCV built in `/tmp`, run against the instrumented copy — engine behavior
proofs, **not** historical frequencies. All rows
`FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`.

| Case | Scenario | Key measured result | Evidences |
|---|---|---|---|
| **A** | normal single 1% entry (design1) | units 6.758713913295403; risk $10.000000 = 1.000000% of 1000; notional $689.7335 (Cap 68.9734%); cash 309.58; equity 1005.72; 0 constraint events | §6 baseline formula |
| **B-1 / B-2** | same $10 risk, stop dist 1.4796 vs 13.051 | B-1: notional $689.73 (68.97%); B-2: units 0.766225, notional $78.19 (7.82%) | Risk ≠ Notional ≠ Capital (§11) |
| **C** | mandated hand-calc (close 100 → open 105 → entry 105.0525, stop 90) | engine units **0.6643414715163596** == `10/15.0525` bit-exact; raw-open sizing would give 0.666667 (**+0.3500%**) | §6 exactness, §8 slippage-in-sizing |
| **D** | 3 concurrent (2×A + 1×B) | open_risk(end) 30.0000, nA=2, nB=1, deployed 237.91, cash 765.18, equity 1003.10 | §12 concurrency, portfolio risk vs per-position risk |
| **E** | 3 same-day cluster-A signals, cap 2 | 2 enter (78.19 each), SOL skipped `2024-02-01`; cash 843.46, equity 1002.06 | §13 cluster cap enforced pre-sizing |
| **F** | exit + new signal, config vs reversed order | config: SOL enters same day after BTC exit, clamped risk **0.954876%** (basis 1008.2910), clamps 2, equity **983.90**; reversed: SOL cluster-skipped, BTC clamped in, equity **997.59**; BTC PnL −25.00 / −11.21; no same-symbol same-day re-entry (`:100/:120`) | §14 capacity reuse + ordering |
| **G** | slight insufficiency (tight stop) | spot cap 12.840738 → 9.955182 → clamp 9.945237; risk 0.774507%; notional 99.9001% of equity; cash −0.0000; 1 clamp + 1 spot cap | §16 constraint chain |
| **H** | severe (initial $6, 2 same-day) | BTC cost $6.00 → cash **−8.88e-16**; ETH sized on it → **rejected**; clamps 2, spot caps 2; cash never meaningfully negative | §16 rejection at ≤0 |
| **I** | 3 same-day (2×A + B) | BTC full 1.000000%; ETH clamped **0.448387%** (cash → 0.0000); HYPE rejected (cash 0.0); open {BTC, ETH} | §16 full/clamped/rejected ladder |
| **J+** | BTC +50% floating → next sizing | ETH basis **1323.3838**, wants 8.944373 units (+32.34% vs 1000-basis), cash clamp delivers 3.030519 (0.338818% of basis) | §17 unrealized inflates basis (OD-4.11) |
| **J−** | BTC floating loss → next sizing | basis **992.2069**, wants 6.706042 units (−0.78%), delivered 3.030519 (0.451909%) | §17 deflation side |
| **K** | reversed asset ordering, identical data | config 978.72 (BTC stops out, SOL skipped) vs reversed 1002.06 (0 closed trades, BTC skipped); **delta −23.34**, `ORDER-DEPENDENT` | §15 ordering, composition effect |
| **L** | 5 same-day signals across A+B | structural max 3 (nA=2, nB=1), SOL+ADA skipped, portfolio risk **30.0000 = 2.9907%**; PPT portfolio cap **NOT SPECIFIED IN APPROVED PPT** | §19 concentration → OD-4.10 |
| **M** | fee/slippage vs budget (Case C numbers) | gross **$10.000000 = 1.000000%** vs net-at-stop **$10.159477 = 1.015948% (+0.0159pp)**; slippage on size −0.3488% | §18 OD-4.5 evidence |
| **N** | quantity rounding | full-float 6.758713913295403 vs display `round(,6)` 6.758714 → delta **8.670e-08 units ($1.283e-07 risk)**; no lot/step code in `backtest/` | §10 → OD-4.6 |

---

## 23. Historical Sensitivity Runs

**Every row in this section is `FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`.** Only row A
is the canonical thesis baseline. One factor changed per variant; all other config unchanged;
instrumented-copy runs with equivalence gate passed. Figures are reported as measured — this
audit draws no conclusion about which variant is preferable.

| # | Variant (one factor) | Return | Sharpe | Max DD | Trades | Final equity | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| **A** | **current (canonical): basis = prev-day total equity incl. unrealized, config order, gross-risk budget** | **152.00%** | **0.82** | **−26.45%** | **94** | **2520.02** | == Snapshot B baseline (`True`) |
| B | sizing basis = **cash only** (exclude unrealized) | 139.62% | 0.81 | −26.06% | 94 | 2396.21 | clamps 0 |
| B | sizing basis = **constant initial 1000** | 106.41% | 0.87 | −19.23% | 94 | 2064.11 | clamps 0; measured lower DD and higher Sharpe, lower return — stated, not evaluated |
| C | iteration order **reversed** | 162.51% | 0.72 | −26.53% | 92 | 2625.14 | cluster skips 503 |
| C | iteration order **alphabetical** | 159.17% | 0.72 | −26.34% | 93 | 2591.74 | cluster skips 509 |
| D | cash handling **reject-on-shortfall** instead of clamp | *identical* | *identical* | *identical* | *identical* | *identical* | 0 historical clamp events → identical **by construction**; differs only in synthetic G/H/I |
| E | risk budget = **net all-in loss at stop** | 147.20% | 0.82 | −25.97% | 94 | 2471.97 | clamps 0 |

Canonical order row for reference (config): cluster skips 498, matching §13 and OD-3.

---

## 24. Findings by Evidence Strength

**`VERIFIED` (re-derived and/or reproduced in this audit):**
1. Gross per-position risk == basis × 1% for 94/94 (bit-level: 1.000000000%); Case C hand-calc
   matches engine exactly.
2. Single stop variable shared by sizing, stored risk, exit, gap-check (identity 1.46e-11 over
   94 trades).
3. Sizing entry == execution entry == slipped next-open (identity diff 0.0000 over 94).
4. Net-at-stop band 1.0078–1.0645% (median 1.0216%); slippage-in-sizing −0.19%..−1.32% units
   (median −0.46%); anchor elasticity +0.467% dist → −0.465% units (cross-checks OD-2 +0.47%).
5. Basis = previous-curve-day pooled total equity (94/94; same-day 0/94; 43/94 sized while
   holding).
6. No rounding/lot logic; display-only round-6dp delta 8.67e-08 units.
7. Capital% 3.72–26.40 (median 9.25) at constant 1% risk; stop distance median 10.81% of entry.
8. Concurrency: max 3, mean 1.096, global cap never binds (0 skips); deployed max 49.31% of
   equity; portfolio risk max 3.237% of equity.
9. Cluster skips 498 — independent recount equals OD-3's 498; A-cap binds (882 days), B
   singleton never binds; structural max 3.
10. Same-day capacity reuse + same-symbol re-entry impossibility (`:100/:120`, Case F).
11. ORDER-DEPENDENT results: 152.00/159.17/162.51% (spread 10.51pp), skips 498/509/503;
    synthetic deltas F 983.90/997.59, K 978.72/1002.06.
12. Cash clamp/spot-cap/reject semantics (Cases G/H/I); 0 historical events; cash min 826.19
    never negative; reject-variant identical by construction.
13. Return chain: 2520.02 = 1324.37 + 1195.65 (resid −0.004) = 1000 + 1304.50 − 19.75 +
    235.30 (resid −0.031); return 152.00%; unrealized 23.53pp.
14. Baseline repro: 152.00% / 0.82 / −26.45% / 94 / 2520.02 at HEAD `d728ec8`; instrumented ==
    repo (`True/True/True`); pytest 70 passed.

**`STRONGLY SUPPORTED`:** none — every quantitative claim above reached `VERIFIED`; claims that
did not are listed as `UNKNOWN` below or as `INFERRED`.

**`INFERRED`:**
- The engine's construction *treats* "ekuitas" in PPT `:191` as previous-day total equity
  including unrealized (consistent across 94/94 trades and with `PLAN.md` prose), but the PPT
  wording alone supports an alternative reading (cash equity) — hence OD-4.2/OD-4.11 rather
  than a match verdict.
- The clamp-to-cash design intent is "never reject a valid signal while cash exists" (single
  guard `:136–138`, comment-free) — intent not documented anywhere in-repo.

**`UNKNOWN / OWNER DECISION REQUIRED` (all `NOT SPECIFIED IN APPROVED PPT`):** gross-vs-net
definition of the 1% (OD-4.1); equity snapshot timing (OD-4.2); sizing price anchor (OD-4.3,
implementation-side of OD-2's execution question); cost inclusion in budget (OD-4.5);
rounding/lot policy (OD-4.6); iteration-order policy (OD-4.8); cash-shortfall policy (OD-4.9);
aggregate portfolio risk cap (OD-4.10); unrealized-in-basis composition (OD-4.11).
Carried, not decided here: stop anchor/ATR timestamp (OD-4.4 ← OD-2), same-day
re-entry/lifecycle (OD-4.7 ← OD-3).

---

## 25. Owner Decision Register (OD-4.1 – OD-4.11)

Options are listed for each decision. **No option is selected in this document.**

### OD-4.1 — Definition of the "1% risk": which loss event does the budget denote?
- **Evidence:** gross stop-distance risk == 1.000000000% for 94/94; net-at-stop 1.0078–1.0645%
  (median 1.0216%, up to +0.0645pp); realized r < −1R on **31/94** trades (close-confirmation
  fills — exit semantics per OD-2.9/OD-3, evidence folded in here); Case M +0.0159pp.
- **PPT status:** `NOT SPECIFIED IN APPROVED PPT` (":191" does not define gross vs net, nor
  fill-vs-close measurement).
- **Option A:** gross stop-distance loss at the sizing entry (current implementation).
- **Option B:** net all-in loss at the stop, including entry/exit fee + exit slippage.
- **Option C:** realized PnL at exit as the budgeted loss (acknowledges close-confirmation
  overshoot beyond −1R).
- **Status: `OWNER DECISION REQUIRED`.**

### OD-4.2 — Which equity snapshot sizes the next position?
- **Evidence:** == previous-curve-day total equity 94/94; == same-day 0/94; == initial 1/94;
  == prev-day cash 51/94; same-day exits not reflected (Case F basis 1008.2910 vs cash 664.73).
- **PPT status:** `NOT SPECIFIED IN APPROVED PPT` ("ekuitas" undefined as to snapshot timing).
- **Option A:** previous curve day's end-of-day equity (current).
- **Option B:** same-day equity at the moment of entry (includes that day's exits/MTM).
- **Option C:** initial capital (constant basis; measured in §23 → 106.41%).
- **Status: `OWNER DECISION REQUIRED`.** (Decide jointly with OD-4.11.)

### OD-4.3 — Which price anchors the sizing stop distance?
- **Evidence:** sizing uses slipped next-open (identity 0.0000 over 94/94); vs raw open:
  units −0.19%..−1.32% (median −0.46%), Case C −0.3488%; vs signal-close anchor: dist +0.467%
  median → units −0.465% (OD-2 cross-check +0.47%).
- **PPT status:** sizing anchor `NOT SPECIFIED IN APPROVED PPT` (execution timing itself is
  OD-2's pending question).
- **Option A:** executable entry = next open × (1 + slippage) (current).
- **Option B:** raw next open (slippage excluded from the distance, kept in cash costs).
- **Option C:** signal-day close (anchor of the PPT's `Entry − 2×ATR` formula before slippage).
- **Status: `OWNER DECISION REQUIRED`.**

### OD-4.4 — Stop anchor and ATR timestamp feeding every size
- **Evidence (this audit):** single-variable chain verified (1.46e-11); dist elasticity +0.467%
  → units −0.465%; all sizing inherits any OD-2 change.
- **PPT status:** direct L1 conflict documented in OD-2 (`:189` "Entry − 2 × ATR(14)" vs
  implementation `prev_close − 2 × ATR`).
- **Status: `CARRIED FROM OD-2`** (OD-2.1 anchor, OD-2.3 ATR timestamp) — options live in
  OD-2's register; not restated or re-opened here.

### OD-4.5 — Do fees/slippage belong inside the 1% budget?
- **Evidence:** entry slippage already inside sizing (units median −0.46%); entry fee and
  exit fee+slippage outside `risk_amount`; net-vs-gross gap 1.0078–1.0645%; net-budget variant
  → 147.20% (`FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`).
- **PPT status:** rates specified (`:197`) but budget inclusion `NOT SPECIFIED IN APPROVED PPT`.
- **Option A:** exclude all costs from the budget (current; slippage still enters via entry
  price mechanics).
- **Option B:** budget the net all-in loss at the stop (fee + slippage inside the 1%).
- **Option C:** hybrid — keep gross budget but cap/flag realized r overshoot (relates to
  OD-4.1 Option C and OD-2.9/OD-3 exit semantics).
- **Status: `OWNER DECISION REQUIRED`.**

### OD-4.6 — Quantity rounding / exchange lot-step policy
- **Evidence:** raw float everywhere; display-only `round(units, 6)` (`:112/:160`) delta
  8.67e-08 units; no lot/step/min-qty code in `backtest/` (Case N: `NOT IMPLEMENTED`).
- **PPT status:** `NOT SPECIFIED IN APPROVED PPT`.
- **Option A:** raw float (current; internal simulation only).
- **Option B:** round down to exchange lot/step/min-qty per symbol (live-tradable sizes).
- **Option C:** fixed decimal rounding (e.g., display precision) for accounting — must then
  propagate to cash/risk/PnL paths.
- **Status: `OWNER DECISION REQUIRED`.**

### OD-4.7 — Same-day capacity reuse and same-day re-entry semantics
- **Evidence:** Case F — a same-day exit frees a cluster slot for a *later-listed* symbol
  (config) but not for an *earlier-listed* one (reversed); same-symbol same-day re-entry
  impossible by structure (`:100/:120`); interacts with OD-4.8.
- **PPT status:** `NOT SPECIFIED IN APPROVED PPT`.
- **Status: `CARRIED FROM OD-3`** (exit-day re-entry / lifecycle accounting already owned by
  OD-3; the capacity-reuse-by-ordering aspect is recorded here as additional evidence, with its
  ordering component owned by OD-4.8).

### OD-4.8 — Multi-asset iteration order policy
- **Evidence:** full-history ORDER-DEPENDENT spread **10.51pp** (152.00 / 159.17 / 162.51),
  trades 94/93/92, skips 498/509/503; synthetic F (983.90 vs 997.59) and K (978.72 vs 1002.06,
  delta −23.34) on identical data.
- **PPT status:** `NOT SPECIFIED IN APPROVED PPT`.
- **Option A:** symbol-first iteration in config order (current — an artifact of dict order, not
  a documented rule).
- **Option B:** explicit deterministic priority rule (e.g., by signal strength, volatility, or
  risk contribution) — documented and frozen before the thesis run.
- **Option C:** seeded randomized/alphabetical order with the seed frozen (order-dependence
  acknowledged and made reproducible).
- **Status: `OWNER DECISION REQUIRED`.**

### OD-4.9 — Cash-shortfall behavior (clamp vs reject)
- **Evidence:** clamp-to-cash partial then reject-at-≤0 (`:136–139`); **0** historical clamps /
  spot caps (reject-variant identical by construction); synthetic G/H/I show delivered risk
  0.7745% / rejection / 0.4484%; cash never negative (historical min 826.19; synthetic −8.9e-16
  float epsilon only); spot cap uses *equity* while clamp uses *cash* (two different ceilings).
- **PPT status:** `NOT SPECIFIED IN APPROVED PPT`.
- **Option A:** clamp to remaining cash, partial fill (current).
- **Option B:** reject the signal entirely when full cost is unaffordable (identical on history).
- **Option C:** clamp with a minimum-notional/quantity threshold (below exchange minimum →
  reject), combining A with B — requires data OD-4.6 does not yet exist.
- **Status: `OWNER DECISION REQUIRED`.**

### OD-4.10 — Portfolio-level aggregate risk cap & concentration rule
- **Evidence:** portfolio risk max **3.237%** of equity (median 1.002%), 882 days at cluster-A
  cap (aggregate median 1.964%); structural max **3** positions (A ≤ 2; B = HYPE singleton) vs
  configured global 5 that never binds (0 skips, `config.yaml:27–28` comment admits "maksimum
  riil 3"); 498 cluster skips; Case L portfolio risk 2.9907% with explicit engine note of PPT
  silence; PPT `:51` mentions "maks 5 posisi aktif" only as a **research gap**, and cluster
  composition (A=9/B=1) is implementation metadata.
- **PPT status:** portfolio-level aggregate risk cap `NOT SPECIFIED IN APPROVED PPT` (only
  per-position 1% at `:191`).
- **Option A:** no aggregate cap beyond per-position 1% + cluster limit + global max-concurrent
  (current — concentration emerges, max observed 3.237%).
- **Option B:** enforce the configured global 5 as a binding portfolio rule *and* document the
  structural max 3 (i.e., keep both caps as-is, freeze their interaction explicitly).
- **Option C:** introduce an explicit aggregate portfolio risk cap (e.g., X% of equity summed
  over open positions) — a new methodology parameter requiring owner calibration.
- **Status: `OWNER DECISION REQUIRED`.**

### OD-4.11 — Unrealized PnL inside the sizing basis
- **Evidence:** unrealized included for **94/94** trades; 43/94 sized while holding others;
  J± basis 1323.3838 / 992.2069 → wanted units +32.34% / −0.78% vs 1000-basis; live examples
  (XRP 2025-01-12: basis 2476.51 vs cash 2032.68); basis variants → 139.62% (cash-only) and
  106.41% (constant) (`FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`); unrealized itself
  contributes 23.53pp of the canonical 152.00%.
- **PPT status:** `NOT SPECIFIED IN APPROVED PPT`.
- **Option A:** include unrealized (pooled marked-to-market equity, current).
- **Option B:** cash-only basis (exclude unrealized from other positions' budgets).
- **Option C:** include unrealized only for the *same* position family/cluster (partial pooling).
- **Status: `OWNER DECISION REQUIRED`.** (Decide jointly with OD-4.2.)

**No OD-4.12+ was created.** Candidate extras were checked and folded in, not registered:
realized r < −1R (31/94) belongs to exit-fill semantics (OD-2.9/OD-3) and appears only as
evidence under OD-4.1; the global-cap-5/stuctural-max-3 observation and the cluster-B singleton
are evidence under OD-4.10; entry-fee exclusion from trade PnL is OD-3.4 (carried); the
equity-based spot cap is part of OD-4.9's constraint chain. None constitutes a genuinely new
methodology issue beyond the mandated eleven.

---

## 26. Recommended Freeze Sequence (Dependency Order — Not Selected)

Freezing decisions out of order re-opens downstream numbers (stop → distance → units → capital →
portfolio). The dependency-respecting sequence, **proposed for the owner's approval, not
executed by this audit**:

1. **OD-2 stop basis** (anchor + ATR timestamp) — the stop feeds every size; must land first.
2. **OD-4.1 + OD-4.5** — loss definition and cost treatment (they jointly define "budget").
3. **OD-4.3** — sizing entry price (defines the distance denominator).
4. **OD-4.2 + OD-4.11** — basis snapshot and composition (define the numerator; decide together).
5. **OD-4.6** — rounding/lot policy (defines final quantity).
6. **{OD-4.7, OD-4.8, OD-4.9}** — lifecycle/order/cash semantics (define sequence-level results).
7. **OD-4.10** — aggregate portfolio cap (defines the ceiling over the above).
8. **Align documentation** (`PLAN.md`, `DESIGN.md`, `config.yaml` comments, PHASE2H audit) with
   the frozen choices.
9. **Full re-run on the frozen configuration** → new canonical snapshot recorded against HEAD,
   superseding/complementing Snapshot B — no silent number edits before then.
10. Only after the new snapshot: continue existing phase gates (this audit opens **no OD-5** and
    changes no gate).

Precondition: steps 2–7 each require the owner's Option A/B/C selection from §25.

---

## 27. Limitations & Out-of-Scope

- **Read-only by mandate:** no repo file besides this one was created or modified; no commit, no
  push. All instrumentation lives in `/tmp` (artifact list in the header table).
- **No strategy verdict:** §23 numbers are mechanisms, not recommendations; the constant-basis
  variant's lower drawdown/higher Sharpe is reported as measured, without evaluation.
- **OD-2/OD-3 untouched:** stop anchor, exit timing, touch-vs-close, and PnL-asymmetry questions
  remain exactly where those audits left them (OD-4.4/OD-4.7 are carries, not resolutions).
- **One-factor-at-a-time:** sensitivity variants changed a single factor each; interactions
  (e.g., cash-basis × ordering) were not explored.
- **Synthetic cases prove behavior, not frequency:** G/H/I/J/L/M/N outcomes show what the engine
  *does* under constructed conditions; 0 historical clamps means their historical frequency is
  unknown, not zero-by-omission.
- **Equivalence boundary:** the instrumented copy matched the repo engine on trades, curve, and
  metrics for this dataset/preset; equivalence for other presets/models (SMA/RSI sizing shares
  `position_size` but was not re-run) is not asserted here.
- **PPT extraction:** L1 quotes come from the text extraction `/tmp/opencode/od2_ppt.txt`; if the
  owner re-extracts the PDF differently, line references may shift (wording was matched
  verbatim).
- **Scope:** risk sizing, position sizing, cluster constraint, capital allocation, concurrent
  exposure, ordering, cash handling, equity basis, fee/slippage-in-risk, risk concentration,
  portfolio-return construction. Data quality, signal logic, exit execution, and live-trading
  concerns belong to other audits.

---

### Final Answers

The twelve factual questions, answered from this audit's evidence:

1. **What exactly is the per-position 1% risk formula?**
   `units = (equity_basis × 0.01) / (entry_price − stop)`, then `risk_amount = units ×
   (entry_price − stop)` (`run_backtest.py:134/:145` → `strategy.py:79–83`), subject to spot cap
   `min(units, equity/entry)` and cash clamp before opening. — **`VERIFIED`**

2. **Which equity value feeds it?**
   The previous curve day's pooled total equity (cash + unrealized, whole portfolio) — 94/94
   historical matches; same-day equity 0/94; initial-only 1/94. — **`VERIFIED`**

3. **Which prices feed it?**
   Entry = next-day Open × (1 + 0.05%) and stop = signal-day Close − 2 × ATR(14), the same two
   variables shared with cost, stored risk, exit check, and gap check (identities 0.0000 and
   1.46e-11 over 94 trades). — **`VERIFIED`**

4. **Is delivered risk exactly 1% historically?**
   Gross stop-distance risk: exactly **1.000000000% for 94/94** trades. Net all-in at stop:
   1.0078–1.0645% (median 1.0216%). Relative to entry-day-close equity: 0.9821–1.0268%
   (median 0.9998%). Realized worse than −1R: 31/94 (close-confirmation fills). —
   **`VERIFIED`**

5. **Are quantity rounding / exchange lot-steps modeled?**
   No. Accounting uses full float; trade rows display `round(units, 6)` only (delta 8.67e-08
   units ≈ $1.28e-07 risk); no lot/step/min-qty code exists in `backtest/`. — **`VERIFIED`**

6. **How much capital does a position occupy?**
   Notional = units × entry: historically Cap% min 3.72 / median 9.25 / max 26.40 of the sizing
   basis, driven by stop distance (median 10.81% of entry); at identical 1% risk synthetic sizes
   ranged 7.82%–68.97%; cash outflow adds the 0.1% fee. — **`VERIFIED`**

7. **What limits how many positions can be open?**
   Global cap 5 (`config.yaml:27`) — never binds (observed max 3, 0 skips — structural max = 2
   cluster-A + HYPE singleton); cluster cap 2 per cluster (`:22`, `strategy.py:14–18`) — binds
   often: **498** skipped signals (independent recount == OD-3's 498); same-symbol same-day
   re-entry impossible (`:100/:120`). — **`VERIFIED`**

8. **Does asset iteration order change results?**
   Yes — ORDER-DEPENDENT: 152.00% / 159.17% / 162.51% on identical data (spread 10.51pp),
   94/93/92 trades, skips 498/509/503; toy cases 983.90 vs 997.59 and 978.72 vs 1002.06. No PPT
   rule exists → `UNKNOWN / OWNER DECISION REQUIRED` (OD-4.8). — **`VERIFIED` (mechanism);
   policy `OWNER DECISION REQUIRED`**

9. **What happens when cash is insufficient?**
   Clamp to remaining cash (partial fill), then reject if units ≤ 0 — three-stage chain with the
   equity-based spot cap first. Historically 0 events (cash min 826.19, never negative);
   synthetics: G delivered 0.7745%, H rejected the second symbol at cash −8.9e-16, I full /
   0.4484% / rejected. Policy choice `NOT SPECIFIED IN APPROVED PPT` → OD-4.9. —
   **`VERIFIED` (behavior); policy `OWNER DECISION REQUIRED`**

10. **Do fees/slippage enter the risk budget?**
    Slippage: yes, indirectly (inside the entry anchor → units −0.19%..−1.32%, median −0.46%).
    Fees: no (cash-only); exit fee+slippage: no. Net-vs-gross gap 1.0078–1.0645%; net-budget
    variant → 147.20% (`FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT`). Budget inclusion
    is `NOT SPECIFIED IN APPROVED PPT` → OD-4.5. — **`VERIFIED` (mechanics); policy
    `OWNER DECISION REQUIRED`**

11. **What is the maximum aggregate portfolio risk observed, and is it capped by rule?**
    Max **$78.81 = 3.237% of equity** (2025-07-13; median 1.002%; 882 days at cluster-A cap with
    aggregate median 1.964%). No approved portfolio-level risk cap exists — PPT specifies only
    per-position 1% (`:191`) and a research-gap note on max 5 positions (`:51`); observed
    concentration emerges from per-position sizing + cluster rules. — **`VERIFIED` (measurements);
    cap question `UNKNOWN / OWNER DECISION REQUIRED` (OD-4.10)**

12. **How is the 152.00% total return constructed?**
    Final equity = cash 1324.37 + open MV 1195.65 = 2520.02 (residual −0.004) =
    1000 + closed PnL 1304.50 − entry fees 19.75 + unrealized 235.30 (residual −0.031, display
    rounding); return = 2520.02/1000 − 1 = **152.00%**, of which **23.53pp** is unrealized
    (9.34% of final equity); baseline repro at HEAD `d728ec8`: 152.00% / Sharpe 0.82 /
    DD −26.45% / 94 trades / 2520.02, instrumented == repo, pytest 70 passed. — **`VERIFIED`**
