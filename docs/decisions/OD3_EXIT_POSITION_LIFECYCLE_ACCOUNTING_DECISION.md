# OD-3 — Exit, Position Lifecycle & Portfolio Accounting Decision Audit

> **Audit type: forensic, read-only (OD-3 only).** No strategy/backtest/research code, data, config,
> presets, datasets, reports, thesis artifacts, DB, Supabase, or product files were modified. No code
> was fixed, refactored, or optimized; no methodology was chosen on the owner's behalf; no OD-2
> decision was quietly resolved. All experiments ran against engine copies in `/tmp`. **This file is
> the only repository change; no commit, no push** (per mandate, unless the owner later says
> otherwise). Evidence labels used throughout: `VERIFIED` / `STRONGLY SUPPORTED` / `INFERRED` /
> `UNKNOWN` / `OWNER DECISION REQUIRED`.

---

## 1. Executive Summary

**The eight mandated questions, answered factually:**

1. **Apakah exit signal implementation sesuai PPT?** — **Yes for the channel exit (VERIFIED):**
   `close[t] < min(low[t−10..t−1])` (`run_backtest.py:92`, `strategy.py:66–68`) implements
   "Close menembus Lowest Low 10 hari sebelumnya" with the same strict "menembus" reading and
   shift(1) anti-look-ahead construction the PPT approves. The **stop** condition
   (`close ≤ stop`, close-confirmation) does **not** match the PPT's "*menyentuh*" (touch) wording —
   carried unresolved as OD-2.9 → **OD-3.2**.
2. **Apakah exit execution timing sesuai PPT?** — **`UNKNOWN / OWNER DECISION REQUIRED`.**
   The PPT's shift-1 passage reads as a general rule ("sinyal … eksekusi … open hari berikutnya",
   and it cites Grądzki et al. against close-execution), yet exits fill at the **same day's close**
   (`:103/:151`). The passage's diagram is entry-labeled. Both readings are defensible → **OD-3.1**
   (carries OD-2.8; this audit does not resolve it).
3. **Apakah trade PnL accounting konsisten?** — **Self-consistent but entry-fee-asymmetric
   (VERIFIED, re-computed independently):** `pnl = units×exit×(1−0.0015) − units×entry` includes
   exit fee+slippage but **omits the entry fee** (`:104` vs `:135/:140`): **$18.79 of $1,304.50**
   (re-verified from scratch this session), avg R 1.0334→1.0233, PF 2.2669→2.2342, win rate
   unchanged (0 flips) → **OD-3.4**.
4. **Apakah equity accounting konsisten?** — **Yes internally (VERIFIED by exact reconciliation:**
   1000 + 1304.50 − 19.75 + 235.30 = 2520.05 vs curve 2520.02, Δ0.028 = storage rounding), **but
   not market-consistent on data-gap days:** a held position's mark-to-market is silently zeroed
   when its pair has no candle (`:171–175`) → 4 artifact return days, Sharpe 0.82→1.10 and max DD
   −26.45%→−18.08% under a carry-forward correction (**FORENSIC SENSITIVITY — NOT CANONICAL THESIS
   RESULT**) → **OD-3.7**.
5. **Apakah period-end positions ditangani secara metodologis jelas?** — **No
   (`NOT SPECIFIED IN APPROVED PPT` → OWNER DECISION REQUIRED).** The implementation is internally
   coherent: **3 open positions (BTC, LINK, HYPE; deployed $1,195.65; unrealized $235.30) sit in
   final equity, return, and drawdown, but are excluded from `n=94`, win rate, PF, and avg R**
   (`:105` only fires on close) → **OD-3.6**.
6. **Apakah data gaps memengaruhi open-position lifecycle?** — **Yes (VERIFIED).** Position is
   carried (never force-closed, never crashes — synthetic Case L + historical 3/94), but its MTM
   value is zeroed on hole days and the stop is **not evaluated** while data is missing (`:86–87`
   skips the symbol entirely) → **OD-3.7**.
7. **Apakah multi-asset ordering deterministic?** — **Deterministic: yes (VERIFIED** — sorted dates
   `:79`, config pairs order `config.yaml:5–15`, identical re-runs**). Order-independent: no
   (VERIFIED)** — same data, reversed loop order changes which symbols enter when cluster capacity
   is scarce (synthetic Case M: BTC+ETH vs SOL+BTC) → **OD-3.8 / OD-3.9**.
8. **Apa saja yang masih membutuhkan owner decision?** — **OD-3.1 … OD-3.11** in §22 (several are
   the *same open questions* as OD-2.5/2.7/2.8/2.9 and Phase 2H OD-10 — carried here with new
   lifecycle/accounting evidence, **not** resolved).

**What this audit adds beyond OD-2/Phase 2H (all `VERIFIED` this session):** exact open-state field
inventory (5 fields, no fee/ID/cluster/equity snapshot); the priority flip quantification
(**15 of 30** historical `stop_loss` exits also satisfied the channel exit → alternative label
priority = 79/15 split, money identical); the exact-period-end decomposition (**23.53pp of the
152.00pp headline return comes from 3 never-closed positions**); the period-end carry-forward DD
correction (+8.36pp, trough leaves the artifact day); **498 cluster-cap-blocked signal-days**
versus 0 global-cap and 0 cash-clamp binds; the end-to-end equity reconciliation identity; and a
full synthetic matrix (Cases A–M2) pinning every exit path's fill price, timestamp, and label.

**What is proven vs different vs to-decide:** proven — entry-side execution, exit *signal* predicate,
sizing mechanics, equity reconciliation, determinism. Different — exit fill timing vs the PPT's
general shift-1 reading, touch-vs-close stop, entry-fee omission in trade stats, MTM on gap days,
period-end inclusion/exclusion split. To decide — §22 (OD-3.1–3.11) plus the still-unanswered
OD-2.1–2.9 and Phase 2H OD-1/OD-7/OD-10, **before any methodology freeze or re-run.**

---

## 2. Scope

- **In scope:** the full position lifecycle — entry execution → open state → holding state → exit
  signal semantics → exit execution → fees/slippage → trade PnL → equity update → portfolio capacity
  → statistics lineage → period-end/final-bar handling — audited against the approved PPT, the
  existing owner decisions, Phase 2H, and OD-2.
- **Mode:** forensic audit only. Forbidden (and not done): code changes, config/preset/data/report
  changes, bug fixes, refactors, deletions, renames, methodology selection, profitability-based
  choices, Sharpe-threshold work, Supabase/DB/product touches.
- **Allowed (and done):** reading all sources; running the existing test suite and the existing
  backtest; synthetic cases and investigation scripts **in `/tmp` only**; independent recomputation
  of numbers; **one** new repository file (this one).
- **Explicit non-goals:** OD-3 does **not** resolve OD-2.1–2.9 (their questions are re-presented as
  cross-references only); does not decide Snapshot A vs B; does not produce any canonical number;
  does not commit or push.
- **Temp artifacts (outside repo):** `/tmp/od3_instrument.py`, `/tmp/od3_engine/
  run_backtest_patched.py`, `/tmp/od3_cases.py`, `/tmp/od3_stats.py`, `/tmp/od3_dd.py`,
  `/tmp/od3_prio.py`, `/tmp/od3_instrument_out.txt`, `/tmp/od3_open_pos.csv`, `/tmp/od3_repro/`.

---

## 3. Source Hierarchy

| Level | Source | Role in OD-3 |
|---|---|---|
| L1 | Approved PPT `Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf` (extracted via `pdftotext -layout` → `/tmp/opencode/od2_ppt.txt`, line refs below) | Binding methodology |
| L2 | Explicit owner decisions actually given: **OD-1** (data rebuild — status: examined, not yet answered); **`decision_log.md` Cluster-A2 entries 2026-09-05/06** (cluster limit + membership — decided); later ODs **not yet answered** (OD-2.1–2.9 remain open questions) | Decided items only |
| L3 | `PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md` | Prior verified findings (cited, some re-verified) |
| L4 | `OD2_ENTRY_EXECUTION_STOP_DECISION.md` | Entry/execution/stop findings carried as context |
| L5 | Repository implementation (`backtest/run_backtest.py`, `backtest/strategy.py`, `config.yaml`) | What the code actually does |
| L6 | General domain knowledge / trading convention | **Not used to substitute methodology**; where a convention would "fill a gap", the item is marked `NOT SPECIFIED IN APPROVED PPT` → `UNKNOWN / OWNER DECISION REQUIRED` instead |

Rule applied throughout: *methodology question* ("menurut tesis, seharusnya bagaimana?"),
*implementation question* ("code sekarang melakukan apa?"), and *empirical sensitivity* ("kalau rule
A vs B, hasil historis berubah berapa?") are kept in separate columns; no convention is treated as
approval; no `UNKNOWN` is silently resolved.

---

## 4. Approved Methodology Relevant to OD-3

PPT quotes (extracted text, line refs → `od2_ppt.txt`):

| Topic | Approved text (L1) | Line |
|---|---|---|
| Timeframe | "Timeframe — 1D (daily candle close)" | :183 |
| Exit signal | "Sinyal Exit — **Close menembus Lowest Low 10 hari sebelumnya, atau menyentuh stop loss**" | :187 |
| Stop rule | "Manajemen Risiko — Stop loss **dinamis**: **Entry − 2 × ATR(14)**" | :189 |
| Sizing | "Position Sizing — Risiko maksimal **1% dari ekuitas** per posisi" | :191 |
| Clustering | "Correlation Mitigation — … **maksimal 2 posisi aktif per kluster korelasi harian**" (+ "maks 5 posisi aktif" research slide, :51) | :193 |
| Direction | "Arah Posisi — **Long-only (In-or-Out)**" | :195 |
| Costs | "Biaya Transaksi — **0,1% fee taker + 0,05% slippage per eksekusi**" | :197 |
| Look-ahead rule | "metodologi **shift-1 hari**: sinyal dihitung dari data yang sudah tertutup, **eksekusi direncanakan pada harga pembukaan (open) hari berikutnya**" + "penggunaan harga penutupan (close) sebagai harga eksekusi menghasilkan bias yang tidak realistis" (citing Grądzki, Wójcik & Lessmann 2025) + "Donchian High/Low … fungsi shift(1)" | :205–219 |
| Multi-asset | portfolio **10 cryptocurrency**, buy-and-hold comparison, VaRSR mentioned in the research questions ("risk-adjusted return (Sharpe Ratio / **VaRSR**)") | :113–115, :269 |

**`NOT SPECIFIED IN APPROVED PPT` (exit/lifecycle/accounting side):** execution timing *of exits*
(the shift-1 passage is generic but the diagram is entry-labeled — see OD-2 §Finding); stop fill
price/path (touch vs close-confirmation); same-bar priority between channel exit and stop;
gap-through behavior; **period-end open-position treatment**; **data-gap/MTM policy for held
positions**; **same-day capacity reuse after an exit**; **multi-asset same-day entry ordering**;
whether the entry fee belongs in trade-level PnL/R statistics; cash-shortfall handling when cost >
available cash; VaRSR implementation status. After L2 checks: cluster limit/membership and fee
*rates* are decided (`decision_log.md:63–69,88–96`; `DESIGN.md:118–130`) — the rest stay
`UNKNOWN / OWNER DECISION REQUIRED` (§22).

---

## 5. Current Implementation

Code map (L5), all `VERIFIED` by direct read:

| Stage | Code | Lines |
|---|---|---|
| Init | `cash = initial 1000`, `equity = cash`, `dates = sorted(union of pair indexes)` | `run_backtest.py:77–79` |
| Missing-day skip | `if d not in df.index: continue` → symbol skipped entirely (no entry/exit/stop evaluation) | `:86–87` |
| Exit signal (donchian) | `exit_hit = close < df["don_lo"].iloc[i]`, `don_lo = low.rolling(10).min().shift(1)` | `:90–93`; `strategy.py:66–68` |
| Close-confirmed exit | `if close <= p["stop"] or exit_hit:` → `proceeds = units×close×(1−fee−slip)`, `pnl = proceeds − units×entry`, label `"stop_loss" if close <= stop else exit_label`, `cash += proceeds`, `del pos[symbol]` | `:100–119` |
| Trade row storage | `entry/exit round(…,2)`, `units round(…,6)`, `pnl round(…,2)`, `r_multiple round(…,3)` | `:110–114` |
| Entry (else branch — only when flat) | `entry_hit = prev.close > prev.don_hi`; global cap + cluster cap (`continue` = silent drop); `entry_price = open×(1+slip)`; `stop = prev.close − 2×prev.atr`; `units = position_size(equity,…)`; `cost = units×entry×(1+fee)`; cash clamp; `cash -= cost`; `pos[symbol] = {units, entry, stop, risk_amount, entry_date}` | `:120–147` |
| Gap-stop branch | `if symbol in pos and open <= stop:` → fill at `open×(1−fee−slip)`, label `gap_stop` | `:149–167` |
| Equity/MTM | `mtm = cash`; per open position `+units×close` **only if `d in dfs[symbol].index`**; `equity = mtm`; curve row `(equity, deployed_usd)` | `:169–177` |
| Metrics | total return/CAGR from curve; Sharpe/Sortino from curve `pct_change` (rf=0, √365); max DD from curve; win/loss/avg-R/PF from `trades` | `:182–228` |
| Sizing/cluster/ATR | `position_size` raises if `stop ≥ entry`, caps at equity/entry (spot); `CLUSTERS` hardcoded A=9 pairs, B=HYPE; `cluster_position_count` | `strategy.py:71–83`, `:14–18`, `:27–34` |

---

## 6. Position Open Lifecycle (Audit A)

Field inventory of a newly opened position (`:141–147`) — printed live from an instrumented run:

| Item | Implemented? | Evidence |
|---|---|---|
| Entry timestamp | Yes — `entry_date = d.date()` (execution day, not signal day) | `:146`, `POSITION_FIELDS` dump — VERIFIED |
| Entry price | Yes — raw Open × 1.0005 (slippage embedded) | `:132` — VERIFIED |
| Quantity (`units`) | Yes | `:134` — VERIFIED |
| Stop price | Yes — `prev.close − 2×prev.atr`, fixed at entry, never updated later | `:133`, `:143` — VERIFIED |
| Risk amount | Yes — `units × (entry − stop)`; **excludes entry fee** | `:145` — VERIFIED |
| Capital allocated | Implicit — `cost = units×entry×(1+fee)` deducted from cash | `:135,:140` — VERIFIED |
| Entry fee | **Not stored in position state** — exists only inside `cash` movement | `:135` vs `:141–147` — VERIFIED |
| Slippage | Embedded in entry price (no separate field) | `:132` — VERIFIED |
| Symbol / cluster / position ID | Symbol = dict key; **cluster not stored** (derived on demand); **no trade/position ID** (trades get list order) | `:82`, `strategy.py:27–34` — VERIFIED |
| Equity before/after entry | **No per-entry snapshot**; `equity` variable changes only at day end (`:176`) | VERIFIED |
| Cash changes same day | **Yes** — `cash -= cost` at entry (fee included) | `:140` — VERIFIED |
| Open position counted in portfolio state same day | **Yes** — the day-end MTM loop (`:169–177`) runs after entry, so the new position is marked at that day's close | VERIFIED |

**Findings:** open-state creation is complete and causal (no look-ahead in any field); the gaps are
*recording* gaps (no fee field, no ID, no equity snapshot) which matter only for audit-trail
quality, not for arithmetic — `INFERRED` immaterial to results, `VERIFIED` absence of fields.

---

## 7. Position Holding Lifecycle (Audit B)

| Aspect | Behavior | Evidence |
|---|---|---|
| Mark-to-market | `units × close` of the pair's own daily candle | `:171–175` — VERIFIED |
| Unrealized PnL | **Never stored anywhere** — implicit as `units×close` vs cost inside `equity = cash + ΣMV` | VERIFIED (absence) |
| Available cash / reserved capital | **No reservation mechanism**: sizing uses *total* prior-day `equity` (`:134`), not free cash; the only cash guard is the clamp at `:136–138` | VERIFIED |
| Stop persistence | Stored once, **fixed**, never re-anchored or trailed | `:143`, no other writes — VERIFIED |
| Quantity persistence | Constant — no partial exits, no pyramiding (entry branch only when flat, `:120`) | VERIFIED |
| Position state persistence | Only two writes ever: creation `:141`, deletion `:119/:167` | VERIFIED |
| Cross-asset interaction | Shared single pool: `cash`, `equity`, cluster capacity, global cap — one asset's entry/exit changes what others can do | VERIFIED |

**Direct answer to the mandated question:** *on days when the pair has data, equity genuinely equals
cash + market value* (exact reconciliation, §13) — **VERIFIED**; *on the pair's missing days the
mechanism is not market value*: the position contributes **0** (`if d in dfs[symbol].index`, `:172`),
so equity silently drops by the full position value until the next candle — **VERIFIED**, quantified
in §14. There is no other mechanism (no dividends/accruals/yield applied in backtest; the
`yield_apy_idle_cash` setting belongs to paper trading only).

---

## 8. Exit Signal Semantics (Audit C)

Exact predicate and window, `VERIFIED` (code + synthetic Cases B–H):

- `don_lo[t] = min(low[t−10 … t−1])` via `rolling(10).min().shift(1)` — **current day excluded**,
  previous 10 bars included (`strategy.py:66–68`).
- Trigger: `close[t] < don_lo[t]` — **strict `<`, close vs low** (`:92`). Therefore the
  implementation means exactly `close[t] < lowest(low[t−10:t])`, **not** `≤`.
- **Equality case:** `close == don_lo` → **no exit** (synthetic Case G: position held) — VERIFIED.
- Stop trigger: `close[t] ≤ stop` — **`<=`** (`:102/:115`); equality exits (Case H: fill exactly at
  stop) — VERIFIED. *Asymmetry: channel uses strict, stop uses inclusive.*
- **NaN handling:** `close < NaN` → False → no exit during warm-up; a position can only exist after
  the entry warm-up (`i ≥ ~31`), where both columns are non-NaN — `INFERRED` never load-bearing,
  `VERIFIED` 0 NaN in historical data (OD-2).
- **Signal timestamp vs execution timestamp:** both are **the same bar t** — signal computed from
  close of t, fill at close of t (`:89,:92,:103`). The stop uses the same close of t. (Entry, by
  contrast, is signal t−1 → fill open t, 94/94 `gap_days=1` — OD-2 L4.)
- Exit is evaluated **only on the pair's own bars**; during a data hole the predicate is not run at
  all (`:86–87`) — see §14. Historical: 0 entries/exits on hole-resume days (Phase 2H L3).
- The independent `strategy.exit_signal()` helper (`strategy.py:91–93`) matches the inline check —
  no drift between helper and engine — VERIFIED.

**Methodology vs implementation:** channel signal = MATCH to L1 (both "menembus" strict, both
shift(1)) — freeze-ready as a *signal* definition. Stop *trigger* ("menyentuh" = touch) vs
close-confirmation = **MISMATCH/UNRESOLVED** → OD-3.2 (carries OD-2.9; 29/2,236 intraday touches
ignored, Phase 2H AR-16 L3).

---

## 9. Exit Execution Semantics (Audit D)

All exit paths, exact fill (implementation column `VERIFIED`):

| # | Path | Trigger condition | Fill price | Fill timestamp | Label | PPT / methodology position |
|---|---|---|---|---|---|---|
| 1 | Donchian exit | `close < don_lo` | `close × (1−0.0015)` | **same day t, at close** | `donchian_exit` | Signal: MATCH (L1). Fill timing: `NOT SPECIFIED` for exits vs general shift-1 passage → **OD-3.1** |
| 2 | Stop-loss (close-confirmed) | `close ≤ stop` | `close × (1−0.0015)` | same day t, at close | `stop_loss` | Trigger ("menyentuh" touch) unresolved → **OD-3.2**; fill timing → **OD-3.1** |
| 3 | Gap-through stop | close-check did **not** fire, `open ≤ stop` | `open × (1−0.0015)` | same day t, **at open** | `gap_stop` | Reachable only when close recovers above stop (OD-2 precedence); rule itself → **OD-2.6** (not re-decided here). Historical 0/94 |
| 4 | Simultaneous channel + stop | `close ≤ stop` AND `close < don_lo` | `close` (identical either way) | same day t | **`stop_loss` wins** (`:115`) | Priority is *label-only* under close-fills → **OD-3.3** (carries OD-2.5) |
| 5 | Final dataset bar | exit triggers on last bar | normal | last date | normal | Case J: recorded — consistent, no special rule needed |
| 6 | Forced close | — | — | — | — | **Does not exist** (grep `force` → 0; Case K: open position produces **no** trade row) → period-end treatment → **OD-3.6** |

PPT comparison: the approved document never states how an *exit signal* is executed (close-of-t vs
open-of-t+1). Its shift-1 passage argues against close-execution on microstructure grounds and is
not entry-qualified in text, while its diagram is entry-labeled — both readings recorded, **neither
selected** → **OD-3.1** (`OWNER DECISION REQUIRED`; identical to open item OD-2.8).

---

## 10. Same-Bar Priority (Audit E)

Synthetic matrix results (engine copies in `/tmp`; design1 = stop 100.5714 > don_lo 99; design2 =
stop 98.8571 < don_lo 100 — both needed because the two exits are only independently reachable on
opposite sides of that ordering):

| Case | Condition | Signal result | Selected reason | Fill | PnL (r) |
|---|---|---|---|---|---|
| A | neither (close 104 > stop, > don_lo) | no exit | — | — | position held, deployed 702.91 |
| B | donchian only (design2: 99.5 < 100, > 98.8571) | channel | `donchian_exit` | close 99.5 | −8.66 (−0.866) |
| C | stop only (design1: 100 ≤ 100.5714, > 99) | stop | `stop_loss` | close 100.0 | −14.88 (−1.488) |
| D | both, open > stop (close 98.5) | both | **`stop_loss`** (label precedence) | close 98.5 | −25.00 (−2.5) |
| E | both, open < stop (open 99.8, close 98.5) | both | `stop_loss`; **gap branch unreachable** | close 98.5 | −25.00 (−2.5) |
| F | open 100 < stop, close 102 > stop | recovery gap | **`gap_stop`** | **open 100.0** | −14.88 (−1.488) |
| F2 | open 98.5 < stop, close 99.5 > stop, channel fires | channel | `donchian_exit` — gap branch still unreachable | close 99.5 | −8.66 (−0.866) |
| G | `close == don_lo` exactly (100.0) | **no exit** (strict `<`) | — | — | held |
| H | `close == stop` exactly | stop (`<=`) | `stop_loss` | **exactly at stop** | −11.02 (−1.102) |

**Key quantifications (`VERIFIED`):**

- **Priority is money-irrelevant but statistics-relevant under current close-fills:** Case D fills
  identically to Case C; only the label differs. Historically **15 of the 30 `stop_loss` exits also
  satisfied `close < don_lo` on the same bar** (independently recomputed: XRP 2021-12-29 … HYPE
  2026-02-23) — an alternative priority would report **79 `donchian_exit` / 15 `stop_loss` /
  0 `gap_stop`** instead of 64/30/0 (**FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT**). The
  decision becomes *load-bearing for money* only if OD-3.1/OD-3.2 change fill rules → **OD-3.3**.
- **Same-day exit + new entry (Case I):** an exit day whose previous bar also satisfies an entry
  signal produces **no re-entry** — `if/else` at `:100/:120` and `deployed = 0` on the exit day.
  Capacity is freed (`del pos`), but only *other symbols later in that date's loop* can use it →
  **OD-3.8**; cross-ref OD-2 (entry-side note: no pyramiding, no same-day re-entry).

---

## 11. Gap and Stop Interaction (Audit F)

Lifecycle/accounting view (rule *decisions* remain in OD-2.6 — not re-opened or resolved here):

- **Reachability (reconfirmed):** close-check first ⇒ the open-fill `gap_stop` path fires only when
  the close recovers above the stop *and* the channel does not trigger (Case F). OD-2's finding
  stands: **0/94 historical `gap_stop`**; 2 CASE2 legs (XRP/ADA, 2025-03-04) exited close-first.
- **Abnormal PnL direction:** on those 2 legs the engine fills at **close**, i.e. **better than the
  open the gap gapped to** — XRP **+$3.41**, ADA **+$10.70**, total **+$14.11** versus an open-fill
  (recomputed from raw OHLC this session; ≈ +0.56% of final equity). Doc-faithful open exits would
  be *worse* → current accounting is **optimistic on those two trades** — VERIFIED (arithmetic),
  flagged without any suggestion of which rule should win.
- **Accounting integrity through a gap exit (VERIFIED):** proceeds added to cash exactly once
  (`:166`), position deleted (`:167`) so neither the MTM loop nor a second gap check can see it;
  `units` unchanged through exit; `pnl` computed once (`:152`); trade row mirrors the close-exit row
  (`:153–165`) except fill = raw open; **no double counting, no negative-quantity path, no
  position-residue** — Case F plus historical 0 anomalies.
- **Same-bar reopen after a gap exit:** impossible through the entry path (entry block already ran
  for that symbol, `:120`); the only same-bar open→close sequence is the *entry-day* Case E2 band
  (OD-2), historical 0 (`entry_date == exit_date` count = 0/94, re-verified).
- **Position state on entry-day E2 band:** enter accepted → immediate `gap_stop` at raw open → r ≈
  −10.67 from collapsed risk denominator (OD-2, `UNKNOWN`-covered → stays inside OD-2.6).
- **Not re-decided here:** which gap rule *should* apply (open-fill vs close-confirm vs stop-price
  vs touch) — **OD-2.6**, pending owner.

---

## 12. Trade PnL Accounting (Audit G)

Exact formulas (`VERIFIED`, `:103–104,:151–152,:132,:135,:145,:114`):

```text
entry_price   = raw_open × (1 + 0.0005)                      # slippage inside entry
cost          = units × entry_price × (1 + 0.001)            # entry fee inside CASH cost
exit_proceeds = units × exit_price × (1 − 0.001 − 0.0005)    # exit fee + slippage inside proceeds
pnl           = exit_proceeds − units × entry_price          # NO entry-fee term
risk_amount   = units × (entry_price − stop)                 # no fee term
r_multiple    = pnl ÷ risk_amount                            # exit costs in, entry fee out
per-trade return %: NOT COMPUTED anywhere (portfolio return comes only from the equity curve)
```

So: `net PnL = exit proceeds − entry cost (slippage-included, fee-excluded)` — **neither** of the
two naive forms in the mandate; the entry fee lives only in the cash/equity path.

**Entry-fee omission — independent re-verification (mandated):** from `/tmp/od3_repro/trades.csv`,
recomputed from scratch this session: Σ(units×entry) = **$18,790.08** → entry fee =
**$18.79** vs Σpnl = **$1,304.50** — **matches OD-2's $18.79 exactly (VERIFIED, not copied).**
avg R 1.0334 → **1.0233**; PF 2.2669 → **2.2342**; win rate 36.17% → 36.17% (**0 trades flip**).

**Where the accounting divergence occurs (exact):** the *equity* path charges the entry fee twice-adjacent
to correct places — `cash -= units×entry×(1+fee)` (`:135,:140`) — while the *trade* path
(`:104,:152`) subtracts only `units×entry`. One number therefore means two things: trade-level
`pnl` excludes entry fees, equity-level results include them. This is a **statistics-consistency
question, not an arithmetic bug** → **OD-3.4** (same open tail as OD-2.7 and Phase 2H OD-10 —
carried, not resolved). Storage rounding (entry/exit 2dp, units 6dp, pnl 2dp, r 3dp — `:110–114`)
affects only CSV round-trips (Δ0.028 in §13), `INFERRED` immaterial.

---

## 13. Equity Accounting (Audit H)

End-to-end trace (`VERIFIED` against code and numbers):

```text
initial cash 1000 (:77) → per day: [entry: cash −cost incl entry fee | exit: cash +proceeds
incl exit fee & slip] → mtm = cash + Σ(units × close on data days) (:169–175) → equity (:176)
→ curve row rounded 2dp (:177)
```

- **Reconciliation identity (VERIFIED):** `1000 + Σ closed pnl 1304.50 − all entry fees 19.75
  (94 closed + 3 open legs) + open unrealized 235.30 = 2520.05` vs curve final **2520.02**
  (Δ **0.028** = storage rounding). This *proves* the full chain: entry fee in equity but not in
  trade pnl; exit costs in both; open positions valued at raw close in equity.
- **Double counting:** none — every cash mutation has exactly one counterpart state change
  (`:140/:141` pair, `:118/:119` pair, `:166/:167` pair) — VERIFIED by trace + reconciliation.
- **Stale/silent position value:** per-pair close of the day = correct on data days; **0 on the
  pair's missing days** (`:172`) = the §14 distortion (4 artifact jumps: −15.85/+19.62,
  −16.79/+20.42 %).
- **Sizing base:** `equity` from the *previous loop day's* close (`:176` written, `:134` read on a
  later date) — the latest causally-available equity at execution; all same-day entries share that
  one base (intra-day equity is never fed back) — causal, no look-ahead — VERIFIED. (Whether
  "ekuitas" should mean pooled total equity vs available cash is settled by L1 wording "dari
  ekuitas" → pooled; the *cash-shortfall* case is separate → OD-3.10.)
- **Equity jump on data-gap boundaries:** present, quantified §14. **No position value ever
  "disappears permanently"** — it reappears at the next candle (Case L, historical 3/3).

---

## 14. Data-Gap Impact (Audit I)

**Mechanism (VERIFIED):** `:86–87` skips the symbol entirely on missing days (so entry, exit, and
**stop evaluation do not run** while data is absent), and `:171–175` contributes **0** to MTM for a
held position without a candle. Position state is untouched → carried forward, never closed,
never crashed.

**Synthetic Case L (two pairs so the calendar day exists):** ALPHA held across a hole:
equity **1005.72 → 309.58 → 995.59**, deployed **696.15 → 0.00 → 686.01**, position **survived**
(exit recorded 2024-02-04, after the hole) — the full position value vanished for exactly one row
and returned. VERIFIED.

**Historical examples (recomputed this session):** 3/94 trades held over hole days, zeroed values:
**ADA 2023-01-22 = $250.41**, **LINK 2023-11-15 = $371.32**, **AVAX 2025-07-13 = $233.15**. Plus
**4 calendar days absent from the curve entirely** (2124 calendar days, 2120 rows) where equity is
implicitly bridged by `pct_change`. 4 artifact return days (|r|>10%) exactly pair with the first two.

**Mandated question — is the Phase 2H max-drawdown artifact a direct product of open-position
accounting? YES (VERIFIED):** the as-implemented max DD **−26.4454% has its trough exactly on hole
day 2023-01-22**, when the only held position (ADA) was worth $0 on the curve. Carrying those three
positions at last-known close (only correction applied; nothing else touched):

> **FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT**
> max DD **−26.4454% @2023-01-22 → −18.0836% @2023-01-07** (+8.36pp; trough leaves the artifact
> day); Sharpe **0.8234 → 1.1011**; artifact |r|>10% days **4 → 0**; final equity unchanged
> (2520.02). Triangulates with Phase 2H's independent forward-fill sensitivity (−26.45→−18.10,
> 0.82→1.10; L3).

**Stop protection during holes:** a crash-through-stop on a day without a candle cannot exit; the
first evaluation happens on the resume bar (Phase 2H: 0/94 exits occurred on resume days — L3;
structural exposure `VERIFIED`, realized harm `UNKNOWN`/never observed). Treatment policy →
**OD-3.7** (overlaps data decision **OD-1** and its re-run consequences).

---

## 15. Period-End Open Positions (Audit J)

Verified live from an instrumented run (`OPEN_AT_END=3`, `DEPLOYED_SUM=1195.6540` — matches
Phase 2H §18 exactly):

| Symbol | Entry date | Entry | Units | Last close (2026-09-02) | Market value | Unrealized |
|---|---|---|---|---|---|---|
| BTC/USDT | 2026-07-15 | 65,067.52 | 0.005565 | 76,790.00 | 427.35 | **+65.24** |
| LINK/USDT | 2026-08-15 | 8.9745 | 38.443440 | 11.008 | 423.19 | **+78.18** |
| HYPE/USDT | 2026-08-18 | 59.5137 | 4.255106 | 81.108 | 345.12 | **+91.89** |
| **Total** | | | | | **1,195.65** | **+235.30** |

Inclusion matrix (`VERIFIED`):

| Statistic | Included? | Where |
|---|---|---|
| Final equity / return / CAGR | **Yes** — marked at raw last close (no hypothetical exit fee) | `:171–177,:185` |
| Max drawdown / Sharpe / Sortino | **Yes** — all derive from the curve | `:189–196` |
| Trade count `n=94` / win rate / avg win-loss / avg R / PF | **No** — trade rows exist only on close (`:105`) | `:198–204` |
| Expectancy | n/a — **not computed anywhere** (grep verified) | — |

**Material decomposition (VERIFIED):** closed-side equity = 1000 + 1304.50 − 19.75 = **2284.75
(+128.48%)**; the headline **+152.00%** therefore contains **+23.53pp (9.34% of final equity)
produced solely by 3 never-closed positions** that every trade-level metric ignores. A secondary
nuance: final equity marks them at raw close without the 0.15% exit cost a closed trade would pay
(≈ −$1.79 if liquidated) — noted, `NOT SPECIFIED IN APPROVED PPT`.

**Methodology comparison:** the PPT is silent on period-end open positions → current behavior is
*internally coherent but methodologically undetermined* → **OD-3.6** (same family as Phase 2H
OD-10's "closed-only counts disclosed" item — carried, not resolved).

---

## 16. Portfolio Capacity and Multi-Asset Ordering (Audits K & L)

**Lifecycle states (`VERIFIED`):** a position becomes **ACTIVE** the moment `pos[symbol]` is
written mid-loop on its entry day (visible to *subsequently processed* symbols that date); it
becomes **CLOSED** at `del pos` on its exit day (`:119/:167`) — capacity is freed *for symbols
later in that date's loop*, while symbols processed **earlier** that day still saw it occupied.
Same-symbol reuse on the exit day is impossible (`if/else`, Case I). Global cap checked first
(`:128`), then cluster cap (`:130–131`, silent `continue` = signal dropped that day, retried only
if the next bar also breaks out — OD-2 `:114`).

**Cluster counting:** `cluster_position_count` counts *all* open positions whose hardcoded cluster
equals the candidate's (`strategy.py:27–34`); membership = static `CLUSTERS` constant (A = 9 pairs,
B = HYPE) — **decided** by the owner in `decision_log.md` 2026-09-05/06 and `DESIGN.md §4.4`
(L2), derived from the correlation experiment; the PPT's "kluster korelasi **harian**" is *not*
recomputed daily — reading "harian" as the correlation-measurement basis = `INFERRED`
(decision_log-backed); a literal daily re-clustering would be new methodology, demanded by no
source → recorded as a note, **not** promoted to an OD.

**Ordering evidence (synthetic, `VERIFIED`):**

- Case M, config order `{BTC, ETH, SOL}` all breaking out same day (cluster A, cap 2): **entered
  BTC+ETH, SOL silently skipped**; **reversed loop order `{SOL, BTC, ETH}`: entered SOL+BTC, ETH
  skipped** — identical data, different iteration order → different portfolio. → **OD-3.9**.
- Case M2 (initial capital $100, two same-day entries): BTC sized full 0.675871 units, ETH
  **clamped to 0.303052** by remaining cash — first-in-loop wins the cash → same ordering class →
  **OD-3.9/OD-3.8**; **OD-3.10** for the clamp-vs-skip rule itself.
- Same-day capacity reuse after an exit only helps symbols *after* the exiting one in loop order →
  **OD-3.8**.

**Historical binding (instrumented counters, behavior-neutral — patched-vs-repo equivalence proven
True):** **CLUSTER_SKIPS = 498 blocked signal-days** (per `(date, symbol)`; consecutive blocked
days of one episode counted each day — no de-duplication, so an upper count of dropped signals),
**GLOBAL_SKIPS = 0** (cap 5 never binds; effective max = 2A+1B = 3), **CLAMPS = 0** (cash guard
never binds historically). Determinism: pairs order from `config.yaml:5–15`, dates sorted union
`:79`, dict insertion order preserved → **re-runs byte-identical** (VERIFIED twice, this session +
OD-2) — *deterministic given the fixed config order, but not order-independent by design*.

---

## 17. Trade Statistics Lineage (Audit M)

| Metric | SOURCE OF TRUTH | Line | Notes / mismatch |
|---|---|---|---|
| `n_trades` = 94 | trade list (`trades.csv` rows) | `:81,:105,:219` | **Closed only** — 3 period-end positions excluded while their equity is included |
| wins / losses / win rate 36.17% | trade list `pnl` (entry fee omitted) | `:198–200` | Fee asymmetry (§12); no zero-pnl trades (34+60=94) |
| avg R / avg win R / avg loss R | trade list `r_multiple` (rounded 3dp) | `:201–203` | Denominator `risk_amount` excludes entry fee |
| profit factor 2.27 | trade list pnl sums | `:204` | Would be 2.2342 with entry fees |
| expectancy | — | — | **Absent** (grep verified) |
| total return 152.00% / CAGR | **equity curve** | `:185–187` | Includes fees, unrealized +235.30, gap artifacts, raw-close mark |
| Sharpe 0.82 / Sortino | **equity curve** `pct_change`, rf=0, √365 | `:189–192` | Sortino uses negative-days std only (non-standard — Phase 2H AR-11) |
| max DD −26.45% | **equity curve** | `:194–196` | Trough = artifact day (§14) |
| VaR-adjusted Sharpe (VaRSR) | — | — | **Promised in L1 research questions (`od2_ppt.txt:115,269`), absent from the entire repo** (grep `VaRSR`/`VaR-adjusted` → 0 hits) → **OD-3.11** |
| B&H 155.03% | per-pair first/last close, idle cash | `:206–211` | Benchmark-construction issues = Phase 2H F2 (out of scope) |

**Denominator mismatches, explicitly (all `VERIFIED`):** (a) open positions excluded from every
trade-level denominator but included in every curve-level metric; (b) entry fee in equity but not
in trade pnl ($18.79); (c) unrealized +235.30 in return/DD but absent from trade stats; (d) curve
metrics carry the 4 gap-artifact days while trade stats cannot (fills use actual bars; no fills
occurred on resume days) — i.e., **the two families of metrics answer different populations**, and
the thesis must state each definition (Phase 2H OD-10 cross-ref — carried, not resolved).

---

## 18. Reproducibility Evidence (Audit O)

| Item | Value |
|---|---|
| Commit SHA | `d728ec891036a62f142d98ade8913a0e86176370` (main = origin after the owner-ordered OD-2 push); `git diff 73856fa..HEAD -- '*.py' config.yaml presets` = **empty** — engine/config identical to the OD-2 audit baseline |
| Dataset | repo CSVs via `load_ohlcv` (unchanged; OD-1 data question pending separately) |
| Config | `config.yaml` (10 pairs, 20/10/14×2, risk 1%, caps 5 & 2/cluster, fee 0.1%, slip 0.05%, capital 1000) |
| Existing tests | `pytest tests/ -q -p no:cacheprovider` → **70 passed** (repo untouched; cache disabled) |
| Unmodified re-run | `REPORT_SUBDIR=/tmp/od3_repro ./venv/bin/python backtest/run_backtest.py` → total **152.00%**, CAGR 17.24, **Sharpe 0.82**, Sortino 0.85, **maxDD −26.45%**, **n=94**, win 36.17, avgR 1.03, avgWinR 4.35, avgLossR −0.85, PF 2.27, B&H 155.03, **final 2520.02**, period 2123 — **identical to OD-2's repro and to `backtest-reference.json` (Snapshot B numbers)** |
| Exit reasons | 64 `donchian_exit` / 30 `stop_loss` / 0 `gap_stop`; same-day round trips 0; Case-E2 pattern 0 |
| Open positions at end | 3 (BTC, LINK, HYPE), deployed 1195.6540 (instrumented run) |
| Instrumentation | `/tmp` copy with list-appends + one extra returned value; **equivalence check: patched trades == repo trades → True** (Case C) |
| Canonical reports | `backtest/reports/metrics.md` (Snapshot A: 149.59/−26.19/2495.92) **read, untouched**; snapshot designation remains Phase 2H **OD-1 (PENDING)** — this audit designates nothing |
| Commands (all read-only) | pytest; repro run; `/tmp/od3_instrument.py`, `/tmp/od3_cases.py`, `/tmp/od3_stats.py`, `/tmp/od3_dd.py`, `/tmp/od3_prio.py` + one inline Sharpe/DD calc |

---

## 19. Synthetic Test Matrix

Expected column = what the *methodology sources* say; where none does → `NOT SPECIFIED` (not
replaced by convention).

| Case | Condition | Actual implementation | Expected per methodology | Divergence |
|---|---|---|---|---|
| B | normal channel exit | `donchian_exit`, fill = close t, same day | close breaks LL10 (L1) ✓ signal; fill timing `NOT SPECIFIED` (general shift-1 vs entry-labeled diagram) | Signal: none. Fill: **OD-3.1** |
| C | stop only (close ≤ stop, no channel) | `stop_loss`, fill = close t | "menyentuh stop loss" (L1) — touch wording | Trigger timing/fill vs touch: **OD-3.2**; timing: **OD-3.1** |
| D | channel + stop together | both true → label `stop_loss`, fill = close | `NOT SPECIFIED` (priority never stated) | Label-only today (money identical) → **OD-3.3** |
| E | open < stop, close < stop, channel true | close-first: `stop_loss` @ close; **gap branch unreachable** | DESIGN gap table says "Open ≤ Stop → exit di open" (docs ≠ code; rule itself → OD-2.6) | docs vs code: OD-2.6 (carried) |
| F | open < stop, close > stop (recovery) | `gap_stop` @ **open** | matches DESIGN gap table in this one reachable case | none (rule choice still OD-2.6) |
| F2 | recovery open + channel trigger | `donchian_exit` @ close (gap still unreachable) | `NOT SPECIFIED` | gap branch bypassed → folded in **OD-2.6/OD-3.3** |
| G | close == don_lo exactly | **no exit** (strict `<`) | "menembus" → strict reading ✓ | none (`INFERRED` consistent with L1) |
| H | close == stop exactly | exit, fill **exactly at stop** (`<=`) | `NOT SPECIFIED` (equality on stop) | `INFERRED` immaterial; state definition in freeze doc |
| A | neither | hold (position persists) | hold ✓ | none |
| I | exit day also carries a valid entry signal | **no same-day re-entry**; capacity freed only later-in-loop | `NOT SPECIFIED` | **OD-3.8** (+ OD-3.9) |
| J | exit on final bar | normal trade row, exit_date = last bar | `NOT SPECIFIED` but self-consistent | none material |
| K | position open at final bar | **no trade row**; in final equity at raw close | `NOT SPECIFIED` | **OD-3.6** |
| L | missing bar while held | carried; MTM = 0 that day; stop not evaluated; exits resume later | `NOT SPECIFIED` | **OD-3.7** (DD/Sharpe artifact quantified §14) |
| M | 3 same-day cluster-A breakouts | first 2 in **loop order** enter, 3rd silently dropped | "maks 2 posisi/kluster" ✓ limit; ordering `NOT SPECIFIED` | **OD-3.9** (deterministic but order-dependent) |
| M2 | cash-constrained same-day entries | first full size, later **clamped** to remaining cash | `NOT SPECIFIED` (cost > cash case) | **OD-3.10** (historically 0 binds) |
| E2 (OD-2) | entry-day open inside 0.05% band under stop | same-bar `gap_stop` round trip, r ≈ −10.67 | `NOT SPECIFIED` | OD-2.6 (carried); historical 0/94 |

---

## 20. Historical Impact

> **All figures below: FORENSIC SENSITIVITY — NOT CANONICAL THESIS RESULT.** Read-only
> recomputation against the current code's output; no official report was modified; no figure here
> is proposed as a thesis number.

| Item | Affected trades / days | Symbols | Dates | Approx. equity/metric impact |
|---|---|---|---|---|
| Entry fee omitted from trade pnl | all 94 closed trades | all 10 | whole period | −$18.79 of $1,304.50 not reflected in trade stats; avg R 1.0334→1.0233; PF 2.2669→2.2342; win rate 0 flips; **equity itself unaffected** (fee charged in cash) |
| CASE2 close-fill vs open-fill | 2 trades | XRP, ADA | 2025-03-04 | engine realizes **+$14.11** more than an open-fill (+3.41 + 10.70) ≈ +0.56% of final equity |
| Gap-day MTM zeroing of held positions | 3 held-over-hole positions | ADA, LINK, AVAX | 2023-01-22, 2023-11-15, 2025-07-13 | $250.41 / $371.32 / $233.15 zeroed for one row each; 4 artifact return days; **max DD −26.4454%→−18.0836% (trough 2023-01-22→2023-01-07)**, Sharpe 0.8234→1.1011 under carry-forward (triangles Phase 2H forward-fill −18.10/1.10) |
| Period-end open positions excluded from trade stats | 3 never-closed positions | BTC, LINK, HYPE | 2026-07-15/08-15/08-18 → end | +$235.30 unrealized = **+23.53pp of the +152.00pp headline return**; excluded from n/win/PF/avg-R |
| Same-bar label priority alternative | 15 of 30 `stop_loss` exits | XRP, SOL, ETH, BTC, DOGE, BNB, HYPE | 2021-12-29 … 2026-02-23 | reason split 64/30 → **79/15**; **$0 money change** under current close-fills |
| Cluster-cap dropped signals | **498 blocked signal-days** | concentrated in cluster A | 2021-01-31 onward | which candidates exist at all is loop-order/capacity-determined; global cap 0, cash clamp 0 binds |
| Entry-day gap band (Case E2) | 0 trades | — | — | historically never occurred (0/94) |
| Stop not evaluated during data holes | structurally all held positions | any pair with a hole | 3 realized holes | exposure exists; realized harm `UNKNOWN` (0 observed stop-runaway exits; Phase 2H: 0 exits on resume days) |

---

## 21. Findings Classified by Evidence Strength

**`VERIFIED` (direct code read + independent recomputation or synthetic proof):**
open-state field inventory and cash/equity timing; MTM formula incl. the zero-on-hole-day rule;
fixed stop / constant quantity persistence; exit predicates (strict `<` channel, `<=` stop,
shift(1), same-bar close fills for all three exit paths); gap-branch reachability and once-only
accounting; trade pnl formula and the **$18.79 entry-fee omission (re-derived)**; equity
reconciliation identity (Δ0.028); 3 period-end positions incl. exact fields and $1,195.65/$235.30;
exclusion from all trade stats; DD trough on the artifact day (+8.36pp carry-forward sensitivity,
4→0 artifact days, Sharpe 1.10); 498/0/0 capacity counters; loop-order dependence (Case M/M2);
label-priority flip count 15; no forced close; no expectancy/VaRSR in repo; determinism of reruns;
70/70 tests; SHA/code-identity.

**`STRONGLY SUPPORTED`:** exit-at-close is a *methodology-level* divergence from the PPT's general
shift-1 wording (text is generic; diagram entry-labeled — both documented, neither chosen);
"harian" in "kluster korelasi harian" denotes the correlation basis, not daily re-clustering
(static membership explicitly decided in decision_log L2); the entry-fee asymmetry is a
statistics-definition issue rather than an arithmetic error (chain reconciles).

**`INFERRED` (labeled, minor):** NaN warm-up exit path never load-bearing; CSV rounding (Δ0.028)
immaterial; no-fee-field/no-ID recording gaps do not alter arithmetic; the 498 count is an upper
count of dropped signals (no episode de-duplication).

**`UNKNOWN` (no source determines it):** exit fill timing (OD-3.1); touch vs close (OD-3.2);
same-bar label rule (OD-3.3); entry-fee-in-trade-stats policy (OD-3.4); period-end policy incl.
raw-close mark (OD-3.6); data-gap MTM + stop-during-hole policy (OD-3.7, ties to OD-1); same-day
capacity reuse (OD-3.8); multi-asset ordering (OD-3.9); cash-shortfall rule (OD-3.10, 0 historical
binds); VaRSR status (OD-3.11). Exit fee/slippage **rates and placement** are *not* unknown: L1
"per eksekusi" both sides matches code (exit fee inside proceeds, in equity *and* trade pnl) —
only the gap-size-slippage nuance remains inside OD-2.7.

**`OWNER DECISION REQUIRED`:** everything in §22 — plus the still-open OD-2.1–2.9 and Phase 2H
OD-1/OD-7/OD-10 that overlap them.

---

## 22. Owner Decision Register

Options are presented with implications; **no option is selected by this audit.** Cross-references
mark the *same* open question raised elsewhere (carried here with lifecycle/accounting evidence —
not resolved).

| ID | Decision | Current evidence | Status |
|---|---|---|---|
| OD-3.1 | **Exit signal execution timing** | A: fill at signal-day close — current code `:103/:151`; "standard daily-backtest idealization" (Phase 2H `INFERRED` minor), but contradicted by the PPT's generic shift-1 text + its own Grądzki citation. B: fill at next-day open — methodology-literal reading; changes every exit price and possibly exit date → full re-run. Historical: fills on 94/94 exits at close. *Same open question as OD-2.8.* | `OWNER DECISION REQUIRED` (carries OD-2.8) |
| OD-3.2 | **Exit touch vs close confirmation** | A: intraday touch (bar low/high path, fill at stop when `low ≤ stop ≤ high`) — literal "menyentuh"; would exit on 29/2,236 intraday touches currently ignored (Phase 2H AR-16). B: close-confirmation (current) — simple, no intraday path; must be disclosed as an explicit simplification with the 1.3% frequency. *Same open question as OD-2.9.* | `OWNER DECISION REQUIRED` (carries OD-2.9) |
| OD-3.3 | **Same-bar exit priority** | A: stop-label precedence (current `:115`); B: channel precedence. Under close-fills money is identical (Case D) — but historical reason split moves **64/30 ↔ 79/15** (15 flips), and the choice becomes money-load-bearing the moment OD-3.1/OD-3.2 change fills. *Same open question as OD-2.5.* | `OWNER DECISION REQUIRED` (carries OD-2.5) |
| OD-3.4 | **Entry fee inclusion in trade PnL** | A: include → pnl/R/PF include all costs (avg R 1.0334→1.0233, PF 2.2669→2.2342, win rate unchanged); B: keep equity-level inclusion with explicit disclosure (current; reconciliation proves no money is lost — only statistics differ). Overlaps OD-2.7 tail + Phase 2H OD-10. | `OWNER DECISION REQUIRED` (carries OD-2.7/OD-10) |
| OD-3.5 | **Exit fee/slippage accounting** | **Not forced into a decision:** L1 "0,1% fee taker + 0,05% slippage **per eksekusi**" is unambiguous and the code matches (exit fee+slip inside proceeds, present in both equity and trade pnl, both exit paths — `VERIFIED`). Only the gap-size-slippage nuance stays inside OD-2.7. | **No new decision required** (rate/placement `VERIFIED` match; nuance → OD-2.7) |
| OD-3.6 | **Period-end open position treatment** | A: mark-to-market at raw last close, exclude from trade stats (current — coherent, but injects **23.53pp** of unrealized into the headline return); B: forced close at final bar (would deduct ~$1.79 exit costs, move all 3 into n/win-rate/PF, change exit dates); C: report both realized-only and MTM curves. PPT: `NOT SPECIFIED`. | `OWNER DECISION REQUIRED` |
| OD-3.7 | **Data-gap open-position treatment** | A: current (carry position, zero MTM, no stop evaluation during holes) → DD trough on artifact day, Sharpe/DD move 0.82→1.10 / −26.45→−18.08 under carry-forward; B: forward-fill MTM (Phase 2H sensitivity, same direction); C: data rebuild/fill decided under **OD-1** first. Also must decide stop enforcement during holes (current: none until resume). | `OWNER DECISION REQUIRED` (sequence after OD-1) |
| OD-3.8 | **Same-day capacity reuse after exit** | A: current — same symbol cannot re-enter its exit day (`if/else`, Case I); other symbols can only if processed *after* the exiting symbol in the loop; B: full same-day reuse (exit frees slot for everyone, including same symbol). PPT: `NOT SPECIFIED`. | `OWNER DECISION REQUIRED` |
| OD-3.9 | **Multi-asset same-day entry ordering** | A: current config-pairs loop order (deterministic, BTC first; Case M shows winner flips when order reverses; 498 cluster-blocked signal-days historically); B: explicit deterministic tie-break rule (e.g., strongest signal / random-with-seed / largest ATR) — must be *stated* for reproducibility claims. PPT: `NOT SPECIFIED`. | `OWNER DECISION REQUIRED` |
| OD-3.10 | **Cash-shortfall handling (cost > available cash)** | A: partial fill clamped to cash (current `:136–138`; Case M2 — later symbol undersized); B: skip entry entirely (keep sizing pristine). Historical binds: **0** — the decision is definitional, not empirical. PPT: `NOT SPECIFIED`. | `OWNER DECISION REQUIRED` (0 historical impact) |
| OD-3.11 | **VaRSR promised in the approved research questions** | L1 asks "risk-adjusted return (Sharpe Ratio / **VaRSR**)" (`od2_ppt.txt:115,269`); **zero occurrences** anywhere in the repo — never computed, not in any report. Either implement VaRSR (new metric definition + re-run of metric layer) or amend the thesis question with recorded rationale. | `OWNER DECISION REQUIRED` (statistics layer; complements Phase 2H OD-10) |

*Not promoted to decisions because sources already resolve them:* exit-channel signal definition
(strict `<`, shift(1) — matches L1 "menembus"); sizing = 1% of pooled equity with spot cap;
cluster limit 2 + static membership (decision_log L2); no pyramiding / In-or-Out; fee & slippage
rates; trade-row rounding (storage only); equity formula on data days.

---

## 23. Recommended Freeze Sequence

**Nothing below resolves an `UNKNOWN`; pending items stay pending.**

1. **Owner answers the open registers first:** OD-1 (data) → OD-2.1–2.9 → Phase 2H OD-7/OD-10 →
   **OD-3.1–OD-3.11**, each recorded in `decision_log.md`/`PLAN.md` per repo rules. No
   methodology freeze is possible while any of these is open (stop formula OD-2.1 alone forces a
   re-run; exit timing OD-3.1 forces every exit price to move).
2. **Freeze-ready now (evidence-backed, no owner input):** exit-channel signal predicate
   (`close < min(low[t−10:t−1])`); entry-side execution chain (OD-2: signal t−1 → open t+1, 94/94);
   sizing mechanics (1% × prior-day pooled equity ÷ stop distance, spot cap); equity definition on
   data days (`cash + Σ units×close`); the trade-pnl formula *as such* (the fee question is OD-3.4,
   the formula itself is `VERIFIED`); reconciliation identity; determinism given config order;
   capacity limit *values* (2/cluster, 5 global) with static membership; the fact of no forced
   close. Each must be written into the freeze doc **with its pending cross-references listed**.
3. **Documentation alignment (after decisions, before any re-run):** `DESIGN.md:37` vs `:64/:221`
   stop contradiction; exit-execution wording; period-end and data-gap disclosure sentences;
   fee-inclusion sentence in the metrics chapter; exit-reason label rule; ordering/tie-break
   sentence; VaRSR line (implement or amend).
4. **Code changes only after methodology freeze** (explicitly *not* performed here): stop anchor,
   exit timing, touch logic, gap rule, fee-in-statistics, MTM policy, ordering rule — each change
   implies a **full re-run** producing a new snapshot per `ARCHITECTURE.md §16` (one source,
   rewrite all quoted figures, record the decision) — then Phase 2H **OD-1** picks/designates the
   canonical snapshot. This document selects no snapshot and no number.
5. **Blocked until then (explicit):** any "thesis baseline" claim; any updated `metrics.md`;
   any statement that the lifecycle/accounting is methodology-approved; any per-exit-reason
   statistics (OD-3.3 can flip 15 of 30); any drawdown/Sharpe headline (OD-3.7 moves them by
   +8.36pp / +0.28 in sensitivity).

---

## 24. Limitations

- Synthetic cases prove *code paths*, not market realism: designs deliberately place stop and
  don_lo on both orderings (design1/design2); real assets experience mixtures, and intraday paths
  (beyond `open/high/low/close`) are not modeled anywhere.
- Carry-forward DD/Sharpe corrections are **sensitivities only** — one narrow policy (position value
  held at last known close on its 3 hole-days); they are not proposed results and do not replace
  Phase 2H's independent forward-fill numbers (which triangulate).
- Some historical figures derive from CSVs stored with rounding (units 6dp etc.); the reconciliation
  residual (Δ0.028) bounds the effect; the priority-flip and CASE2 figures recompute from raw OHLC
  where precision mattered.
- The 498 cluster-skip count is per `(date, symbol)` signal-day without episode de-duplication (upper
  count of dropped signals); counters were collected with a behavior-neutral patch whose equivalence
  to the repo engine was proven on one full case (True) and whose outputs (metrics, 94 trades, 3
  open) match the unmodified run.
- Phase 2H findings (wick-throughs 29/2,236, artifact-day inventory, B&H construction issues,
  A↔B history) are cited as L3 rather than fully re-derived; Snapshot A vs B and all
  benchmark/gate questions remain outside OD-3 per mandate.
- No paper-trading/live execution semantics, no orderbook/maker-taker realism, no VaRSR computation,
  and no parameter or profitability judgment were performed; the audit intentionally does not say
  whether the strategy is "valid".

---

## Final Answers to the OD-3 Questions (factual recap)

1. **Exit signal vs PPT:** channel exit — **matches** (strict "menembus", shift(1), previous-10-day
   window; VERIFIED). Stop trigger — **differs** (close-confirmation vs "menyentuh") → OD-3.2.
2. **Exit execution timing vs PPT:** **not determined by the PPT** (generic shift-1 text vs
   entry-labeled diagram); code fills same-day close → **OD-3.1**, unresolved.
3. **Trade PnL consistency:** internally consistent, **entry fee omitted** ($18.79 of $1,304.50;
   avg R −0.0101, PF −0.0327, win rate unchanged; re-verified) → OD-3.4.
4. **Equity consistency:** reconciles end-to-end (Δ0.028 rounding; VERIFIED) — **but zeroed on
   3 gap-days**, moving Sharpe 0.82→1.10 and DD −26.45%→−18.08% under carry-forward sensitivity →
   OD-3.7.
5. **Period-end positions:** implementation coherent (in equity/return/DD, out of n=94/win/PF/R;
   3 positions, +$235.30 = +23.53pp of headline return) — **methodology silent** → OD-3.6.
6. **Data gaps affect lifecycle:** **yes** — MTM zeroing (equity/DD/Sharpe artifacts) and no stop
   evaluation while a hole is open; positions are carried, never crashed/closed → OD-3.7.
7. **Multi-asset ordering deterministic:** **deterministic yes** (identical reruns), **order-
   independent no** (Case M flips entrants when loop order reverses; 498 cluster-blocked
   signal-days) → OD-3.8/OD-3.9.
8. **Still needing owner decision:** **OD-3.1–OD-3.11** (§22), overlapping the still-open
   **OD-2.1–2.9** and Phase 2H **OD-1/OD-7/OD-10** — none of which this audit resolved.

*End of OD-3. Stop condition reached: the document exists, evidence is verified, no other repository
file changed, nothing committed or pushed, and OD-4 was not started.*
