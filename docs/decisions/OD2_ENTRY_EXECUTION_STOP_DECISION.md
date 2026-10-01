# OD-2 — Entry, Execution & Stop-Loss Decision Audit

**Thesis:** *Analisis Efektivitas Strategi Long-Only Donchian Channel Breakout pada Portofolio Cryptocurrency Multi-Aset*

Audit type: **read-only, decision-support**. No strategy/backtest/research code, data, config, presets, reports, thesis artifacts, database, or git history were modified. No commit, no push. This file is the only repository change.

| Item | Value |
|---|---|
| Repo HEAD | `73856fa74ee5f2a5a50d6d01a266e18d7aef6ff2` (`73856fa`) |
| Audit date | 2026-09-24 |
| Pre-existing untracked files (preserved, untouched) | `PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md`, `backtest/reports/bh_drawdown_and_btc_eth_corr.md`, `backtest/reports/bh_max_drawdown.md` |
| Temp artifacts (outside repo) | `/tmp/opencode/od2_ppt.txt` (PPT text extraction), `/tmp/od2_repro/` (unmodified-engine re-run), `/tmp/od2_verify.py` + `/tmp/od2_verify_rows.csv`, `/tmp/od2_cases.py`, `/tmp/od2_variants.py` + `/tmp/od2_variants/` (patched engine **copies**, `/tmp` only) |
| Evidence labels used | `VERIFIED` · `STRONGLY SUPPORTED` · `INFERRED` · `UNKNOWN` |

> Scope note (per owner instruction, 2026-09): the first-guidance PPT's exploratory "Sharpe ≥ 1" statement is **no longer a success criterion**. The research will evaluate the strategy relative to buy-and-hold and across multiple risk/performance dimensions. This audit does not assess Sharpe.

---

## 1. Executive Summary

This audit answers one question: **what exactly does one Donchian trade mean in this thesis, from signal formation through entry and eventual stop/exit — and where does the current code deviate from the owner-approved methodology?**

**Bottom line: THE ENTRY/EXECUTION SIDE IS APPROVED-AND-IMPLEMENTED CONSISTENTLY; THE STOP-LOSS SIDE IS NOT YET FREEZABLE.**

Key findings:

1. **Entry & execution match the approved PPT (VERIFIED).** Signal = close of day *t* breaking the highest high of the 20 days strictly before *t* (`shift(1)`, current day excluded, strict `>`); execution = day *t+1* Open × (1 + 0.05% slippage); 94/94 historical entries executed exactly one day after the signal row. The intended architecture (Close t → Signal → Open t+1 → Entry) is implemented as specified.
2. **The stop formula in the code is NOT the approved formula (VERIFIED).** PPT/`PLAN.md:34`/`DESIGN.md:37`/`config.yaml:20` state `Stop = Entry − 2 × ATR(14)`; the code computes `stop = signal-day Close − 2 × signal-day ATR(14)` (`run_backtest.py:133`), which `DESIGN.md:64,221` also states (the design doc contradicts itself). Exact anchor: previous bar's close, not any entry price.
3. **Materiality of the anchor discrepancy is historically SMALL; materiality of the ATR-timestamp choice is LARGE (VERIFIED via `/tmp` variant runs).** Because Bitget daily candles are 00:00-UTC continuous, historical `Open(t+1) − Close(t)` is within ±0.22% for all 94 entries → entry-anchored vs signal-close-anchored stops differ by ≤1.6% in stop distance (sizing delta median +0.47%). Changing the **ATR timestamp** (signal-day → day-before-signal) moves return +152.0% → +158–159% and DD −26.45% → −27.7%. Both choices must be frozen on methodology grounds, **not** on which produces better numbers.
4. **Gap-stop findings from Phase 2H reproduced exactly (VERIFIED).** `gap_stop` fired 0/94; close-first precedence makes the documented "gap → exit at open" rule unreachable when the close also sits below the stop; the 2 affected historical exits (XRP/USDT, ADA/USDT, 2025-03-04) would have filled **worse** under doc-faithful behavior (−2.73%, −8.80%); a synthetic entry-day gap-down crashes the engine with an unhandled `ValueError` — historical occurrence 0/94.
5. **The stop discrepancy explains NONE of the Snapshot A/B difference (VERIFIED).** Snapshot A (`e6188de`) used the identical stop line; A→B is entirely the ATR-seeding rewrite.
6. **Freezable today:** timeframe, universe, entry rule, signal timing, next-open execution, entry price/slippage mechanics, 1% risk sizing, cluster limit, direction, fee/slippage *rates*. **Not freezable:** stop anchor (OD-2.1/2.2), ATR timestamp (OD-2.3), fixed-vs-dynamic stop (OD-2.4), same-bar priority (OD-2.5), gap-through behavior (OD-2.6), stop-execution cost treatment (OD-2.7) — plus two further genuine gaps found here: exit fill timing (OD-2.8) and stop touch/fill semantics (OD-2.9).

---

## 2. Source Hierarchy

Applied exactly as mandated:

| Level | Source | How used here |
|---|---|---|
| **L1** | First-guidance PPT (`Bimbingan_Pertama_Donchian_Crypto_Final.pptx.pdf`, text extracted to `/tmp/opencode/od2_ppt.txt`) | Decides the approved methodology. Quoted verbatim in §3. |
| **L2** | Explicit post-guidance owner decisions | (a) Sharpe ≥ 1 withdrawn as criterion (owner, current conversation) — context only; (b) `PLAN.md` §1 strategy table (`:33–38`) and `backtest/reports/decision_log.md` — project decision records. Where L2 conflicts with L1 (e.g. `PLAN.md:35` "trailing stop berbasis ATR" vs PPT's Entry-anchored formula), **L1 wins**, but the conflict itself is disclosed as a decision trigger. |
| **L3** | `PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md` | Findings independently re-verified here where relevant (§9, §14); cited as-is for items not re-derived (e.g. 29/2236 intraday wick days, A-era diff). |
| **L4** | Current implementation (`backtest/strategy.py`, `backtest/run_backtest.py`, `config.yaml`, presets). Repo documentation *describing* the implementation (`backtest/DESIGN.md`, except where it restates L1) is treated as L4-adjacent. | Describes what actually runs. Never used to overrule L1 silently. |
| **L5** | General assumptions | Not used to resolve any ambiguity. Anything L1–L4 leave undetermined is marked `UNKNOWN` → owner decision (§16). |

Conflict-resolution examples used in this audit:
- Stop formula: L1 (`Entry − 2×ATR`) vs L4 (`prev_close − 2×prev_ATR`) → conflict recorded, **not** silently resolved → OD-2.1.
- Stop dynamics: L1 internal ambiguity (formula is Entry-anchored = fixed; the word "*dinamis*") + L2 (`PLAN.md:35` trailing) vs L4 (fixed) → `UNKNOWN` → OD-2.4.

---

## 3. Approved Methodology (L1 — first-guidance PPT)

Verbatim from the approved PDF (slide *RENCANA METODOLOGI I* and *II*):

| Element | Approved wording (ID) | Meaning |
|---|---|---|
| Timeframe | "Timeframe — 1D (daily candle close)" | Daily bars. |
| Data | "Bitget — 10 cryptocurrency: BTC, ETH, SOL, BNB, XRP, AVAX, LINK, DOGE, ADA, HYPE" | Venue + universe. |
| Entry signal | "Sinyal Entry — Close menembus Highest High 20 hari sebelumnya" | Close breaks the highest high of the **previous 20 days**. |
| Exit signal | "Sinyal Exit — Close menembus Lowest Low 10 hari sebelumnya, atau menyentuh stop loss" | Close breaks the previous-10-day lowest low **or touches** the stop loss. |
| Stop loss | "Manajemen Risiko — **Stop loss dinamis: Entry − 2 × ATR(14)**" | Stop anchored on **Entry**, distance 2 × ATR(14). Word "*dinamis*" = dynamic (see OD-2.4). |
| Position sizing | "Risiko maksimal 1% dari ekuitas per posisi" | ≤ 1% equity risk per position. |
| Clustering | "maksimal 2 posisi aktif per kluster korelasi harian" (+ "maks 5 posisi aktif" on the research-gap slide) | Max 2 per cluster, max 5 concurrent. |
| Direction | "Long-only (In-or-Out)" | No shorts, no pyramiding implied (in-or-out). |
| Costs | "0,1% fee taker + 0,05% slippage **per eksekusi**" | Fee and slippage on every execution. |
| Look-ahead rules | "metodologi shift-1 hari: sinyal dihitung dari data yang sudah tertutup, eksekusi direncanakan pada harga pembukaan (open) hari berikutnya"; "fungsi shift(1) — mengeksklusi data hari berjalan agar algoritma hanya merespons informasi t-1 dan sebelumnya"; diagram *Hari t: pasar tutup → sinyal terbentuk / Hari t+1: pasar buka → rencanasi eksekusi pada harga Open*; cites Grądzki, Wójcik & Lessmann (2025): "penggunaan harga penutupan (close) sebagai harga eksekusi menghasilkan bias yang tidak realistis secara mikrostruktur pasar" | Signal after close of *t*; execution planned at Open of *t+1*; Donchian excludes the current day; **close-as-execution-price is called out as an unrealistic bias**. |
| Statistical framing | "Target Sharpe ≥ 1,0" (exploratory slide) | **Withdrawn by the owner post-guidance** (L2): evaluation is relative to buy-and-hold and multi-dimensional, not a Sharpe threshold. Not part of this audit's freeze. |

**What the PPT does NOT specify (all `UNKNOWN` by mandate):** equality-vs-strict inequality on breakouts; the ATR *timestamp*; the ATR *seeding variant*; whether "Entry" means raw Open or slippage-adjusted Open; whether the stop is fixed or recalculated/trailed (beyond the ambiguous "*dinamis*"); same-bar priority between channel exit and stop; gap-through behavior at the open; the exact fee/slippage arithmetic; the **execution timing of exits** (the shift-1 passage reads as a general signal rule; the architecture diagram is entry-labeled); the stop **fill price** (the word "*menyentuh*"/touches implies intraday touch vs the code's close-confirmation).

---

## 4. Current Implementation (L4 — as-run, HEAD `73856fa`)

All line refs VERIFIED by full-file reads of `backtest/strategy.py` and `backtest/run_backtest.py`.

| Component | Exact implementation |
|---|---|
| Donchian high | `df["high"].rolling(20).max().shift(1)` (`strategy.py:61–63`) → at bar *j*: max high of *j−20..j−1* (current day excluded). |
| Donchian low | `df["low"].rolling(10).min().shift(1)` (`strategy.py:66–68`). |
| Entry signal | At row *i*: `prev["close"] > prev["don_hi"]` where `prev = df.iloc[i−1]` (`run_backtest.py:121,123`) — strict `>`, evaluated from the previous **row**. |
| Entry execution | `entry_price = df["open"].iloc[i] * (1 + slip)` (`:132`), `slip = 0.0005` (`:76`, `config.yaml:40`). Fee charged separately: `cost = units * entry_price * (1 + fee)` (`:135`), `fee = 0.001` (`:75`, `config.yaml:39`). |
| Entry price of record | `p["entry"] = entry_price` (slippage-adjusted Open) (`:143`); used for sizing input (`:134`), `risk_amount = units × (entry − stop)` (`:145`), and trade `pnl = proceeds − units × entry` (`:104`). |
| Stop | `stop = prev["close"] − atr_stop_multiplier × prev["atr"]` (`:133`), multiplier 2.0 (`config.yaml:20`). `prev` = **signal-day** bar. Stored once in `pos[symbol]["stop"]` (`:144`) and never mutated (only read at `:102`, `:115`, `:149`) → **fixed for the life of the position**. |
| ATR | Wilder recursion with SMA seed at index `period−1` (`strategy.py:37–58`); `df["atr"]` computed per bar → `prev["atr"]` = ATR of the signal day, using data through the signal-day close only. |
| Exit (channel) | Same day *t*: `close < df["don_lo"]` (`:92`), fill at that day's close × (1 − fee − slip) (`:103`). |
| Exit (stop) | Same day *t*: `close <= p["stop"]` (`:102`), fill at close × (1 − fee − slip); label precedence `"stop_loss" if close <= stop else exit_label` (`:115`). |
| Gap-stop branch | After entry logic: `if symbol in pos and open <= p["stop"]` → fill at open × (1 − fee − slip), label `gap_stop` (`:149–167`). Because the close-check runs **first** in the same day, this branch is only reachable when the close recovers **above** the stop. |
| Sizing | `units = min((equity × 1%) / (entry − stop), equity / entry)` (`strategy.py:71–83`); raises `ValueError` if `stop >= entry` (`:77–78`) — unhandled at the call site (`:134`) → run crash. |
| Equity used for sizing | `equity` variable, last written at the **end of the previous date iteration** (`:176`) → prior-day mark-to-market. |
| Guards | Global cap `max_concurrent_positions: 5` (`:128`); cluster cap `max_positions_per_cluster: 2` (`:129–131`, silent `continue`). Entry branch only runs when **flat** (`if/else` at `:100/120`) → no pyramiding; no same-day re-entry after an exit. |
| Params | Donchian 20/10, ATR 14, multiplier 2.0, risk 1%, cluster 2, fee 0.1%, slip 0.05% (`config.yaml:16–40`; `presets/donchian_cluster_a2.yaml:8–22`) — match the PPT numbers. |

Independent re-run of the unmodified engine (`REPORT_SUBDIR=/tmp/od2_repro`) reproduces **Snapshot B exactly**: return 152.0%, Sharpe 0.82, MDD −26.45%, 94 trades, final equity 2520.02 (VERIFIED).

---

## 5. Entry Audit

### Reconstruction (current code)

| Question | Answer | Evidence |
|---|---|---|
| Donchian lookback | 20 days | `strategy.py:61–63`; `config.yaml:17` — VERIFIED |
| Highest-high definition | `max(high)` over the 20 rows strictly before the signal day (*t−20..t−1*) | rolling + `shift(1)` trace — VERIFIED |
| Current day excluded? | Yes | `shift(1)`; matches PPT "mengeksklusi data hari berjalan" — VERIFIED |
| `shift(1)` used? | Yes | `strategy.py:63` — VERIFIED |
| Equality counts as breakout? | No — strict `>` (`prev close > prev don_hi`) | `run_backtest.py:123`. PPT "menembus" (penetrate) → strict reading STRONGLY SUPPORTED; equality not formally defined in PPT (minor, non-blocking). |
| Signal evaluated at Close? | Yes — the signal is `close(t) vs highest-high window ending t−1` | `:123` — VERIFIED |
| Signal at day *t* can execute before *t+1*? | **No.** The signal is only *read* when the engine processes the next row; fill price is that row's Open | `:121,132` — VERIFIED (anti-look-ahead holds) |
| Consecutive breakout signals | While flat, each day re-evaluates only the immediately preceding bar (no signal queueing: a cluster-blocked or cap-blocked signal is dropped that day — `continue` at `:131` — and retried only if the next bar also breaks out). While holding, breakout signals are ignored entirely (entry logic sits in the `else` of `if symbol in pos`). | `:100,120,128–131` — VERIFIED |
| Already-open position | No add-ons, no pyramiding ("In-or-Out" long-only consistent) | code + PPT wording — STRONGLY SUPPORTED MATCH |
| Staleness across data holes | `prev` = previous **row**, not previous calendar day → a hole defers execution to the next available row (never accelerates it). Historically irrelevant: **94/94 entries executed exactly 1 calendar day after the signal row**. | `/tmp/od2_verify.py §4` — VERIFIED |

### Approved (L1) vs Current Code — entry

| # | Approved/Prior | Current code | Diff |
|---|---|---|---|
| E1 | Close breaks highest high of previous 20 days (`Close menembus Highest High 20 hari sebelumnya`) | identical | **none** (VERIFIED) |
| E2 | `shift(1)` excludes current day | identical | **none** (VERIFIED) |
| E3 | Signal after close of *t* | evaluated from row *t* when processing *t+1* | **none** (VERIFIED) |
| E4 | Execution next day Open | Open of next available row, ×(1+0.05%) | **none**, modulo hole-deferral (INFERRED acceptable; 0/94 occurred) |
| E5 | Equality handling | strict `>` (not stated in PPT) | unspoken, non-blocking (STRONGLY SUPPORTED consistent with "menembus") |

**Conclusion:** the entry leg needs **no owner decision** to freeze.

---

## 6. Execution Audit

### Reconstruction

| Question | Answer | Evidence |
|---|---|---|
| Signal timestamp | Close of day *t* | VERIFIED |
| Execution timestamp | Open of day *t+1* (next available row) | `:132` — VERIFIED; 94/94 historical entries `gap_days = 1` |
| Execution price | `Open(t+1) × (1 + 0.0005)` | `:132` — VERIFIED |
| Open vs Close | **Open** for entries | VERIFIED — matches approved architecture |
| Slippage applied to entry? | Yes, multiplicative, adverse to buyer (raises price) | VERIFIED |
| Exact entry formula | \(P_{entry} = O_{t+1} \times 1.0005\); cash out \(= units \times P_{entry} \times 1.001\) | `:132,135` — VERIFIED |
| Execution price = Entry Price used for risk sizing? | **Yes** — same variable feeds `position_size` (`:134`), becomes `p["entry"]` (`:143`), defines `risk_amount = units×(entry−stop)` (`:145`) and trade `pnl` (`:104`) | VERIFIED |
| Entry-day gaps handled? | Raw gap Open used as-is. Two regimes: (a) `Open×1.0005 <= stop` → unhandled `ValueError` → **whole run crashes** (synthetic Case E, §13); (b) stop within the 0.05% band below the raw open → entry accepted, then **same-bar** `gap_stop` round-trip (Case E2, entry_date == exit_date). Historical occurrence of (a): 0/94. | §13 — VERIFIED |
| Open unavailable/missing bar possible? | Row missing: symbol skipped that day; execution deferred to next row (mechanism VERIFIED; 0/94 deferrals occurred). Missing *value*: **0 NaN OHLC values across all 10 datasets** (VERIFIED, `/tmp/od2_verify.py §0`); a hypothetical NaN Open would silently skip the entry (units → NaN → `if units > 0` False) — INFERRED from code trace, untested. | VERIFIED / INFERRED |

### Architecture check

```text
Day t:   Close observed  → signal = close(t) > highest-high(t-20..t-1)   [evaluated at t]      VERIFIED
Day t+1: Open observed   → entry = open(t+1) × 1.0005                    [executed at t+1]     VERIFIED
```

**Current implementation follows the approved entry architecture exactly (VERIFIED).**

**POTENTIAL ISSUE (found by this audit):** the same next-day-open rule reads as a *general* signal-execution rule in the PPT ("sinyal dihitung dari data yang sudah tertutup, eksekusi direncanakan pada harga … open hari berikutnya", no entry-only qualifier), yet **exits are executed at the same day's close** (`:103`) — the exact practice the PPT's own cited reference (Grądzki et al.) calls microstructure-unrealistic. Phase 2H classified same-day-close exits as a "mild idealization (standard in daily backtests)" (`INFERRED`, minor). The sources do not settle whether exit fills should be close-of-*t* or open-of-*t+1* → **OD-2.8**.

---

## 7. Stop-Loss Audit

The approved formula is `Stop = Entry − 2 × ATR(14)`. Eleven questions, answered strictly from sources:

| # | Question | Current code (L4) | Approved (L1/L2) | Status |
|---|---|---|---|---|
| 1 | Is "Entry Price" the raw market Open? | Stop does **not** use any entry price: `stop = signal-day close − 2 × signal-day ATR` (`:133`) | `UNKNOWN` — PPT says "Entry" without defining it | `UNKNOWN` → **OD-2.2** |
| 2 | Or Open after slippage? | Same as above (unused) | `UNKNOWN` | `UNKNOWN` → **OD-2.2** |
| 3 | ATR uses only info available at signal time? | **Yes** — `prev["atr"]` = ATR through the signal-day close | Required by PPT's own shift-1 rules (STRONGLY SUPPORTED); exact bar `UNKNOWN` | code SAFE; approved `UNKNOWN` → **OD-2.3** |
| 4 | ATR from day *t* (signal day)? | **Yes** — signal-day ATR (equivalently: "previous-day ATR" relative to the entry day) | `UNKNOWN` | `UNKNOWN` → **OD-2.3** |
| 5 | Or day *t−1*? | No | `UNKNOWN` — causally permissible, but PPT doesn't say. Materiality: `|ATR(t)−ATR(t−1)|` median **4.04%**, max **48.9%** of ATR; variant runs move return 152.0 → 158.3–159.4% (§14) | `UNKNOWN` → **OD-2.3** |
| 6 | ATR before or after entry? | Before (computed at signal; frozen at entry). Entry-day ATR is never used — it would require the entry day's close, i.e. look-ahead at execution | PPT look-ahead rules force ATR ≤ signal time (STRONGLY SUPPORTED); ATR(t+1) is excluded by evidence, not by silence | code SAFE; exact choice `UNKNOWN` → **OD-2.3** |
| 7 | Stop fixed after entry? | **Yes** — written once (`:144`), only read afterward (`:102,115,149`) | Formula is Entry-anchored (reads fixed), but the PPT labels it "**Stop loss dinamis**" | `UNKNOWN` → **OD-2.4** |
| 8 | Recalculated daily? | No | `UNKNOWN` (same "*dinamis*" ambiguity; `PLAN.md:35` additionally says "trailing stop berbasis ATR") | `UNKNOWN` → **OD-2.4** |
| 9 | Does the stop trail upward? | No — never moves | L1 formula: no; L1 word "*dinamis*" + L2 `PLAN.md:35` trailing: yes-ish. Hierarchy can't resolve an L1-internal ambiguity | `UNKNOWN` → **OD-2.4** |
| 10 | Does the stop ever move down? | Never (no mutation path exists) | Not addressed | `UNKNOWN` trivially aligned with fixed reading → folded into **OD-2.4** |
| 11 | Exit-channel and stop same day — precedence? | Same fill either way (both at close, `:103`); **label** = `stop_loss` (`:115`). Economically identical under the current fill design; matters for exit-reason statistics and if fill rules change | PPT silent; DESIGN lists both exits without priority | `UNKNOWN` → **OD-2.5** |

**Documentation state (VERIFIED):**
- States `Entry − 2×ATR`: PPT (L1), `PLAN.md:34`, `DESIGN.md:37`, `config.yaml:20` (comment).
- States `prev_close − 2×prev_ATR`: `run_backtest.py:133`, `DESIGN.md:64` and `DESIGN.md:221`.
- `DESIGN.md` contradicts itself (`:37` vs `:64/:221`).

**No fix was made (per mandate).**

---

## 8. ATR Timing Audit

- **Construction:** Wilder smoothing, explicit recursion, SMA seed at index `period−1` (`strategy.py:37–58`) — i.e. the textbook Wilder ATR(14). STRONGLY SUPPORTED as canonical; the thesis must still *name* the seed convention for reproducibility (Phase 2H §7: the Snapshot-A era used an `ewm(alpha=1/14)` variant that differed → the A/B split).
- **Timestamp in the stop:** signal-day ATR — computed after the signal close, available before entry (Q3/Q4/Q6 above): VERIFIED SAFE (no look-ahead).
- **Causal ceiling:** only ATR values through the signal day are permissible at decision time; entry-day ATR(t+1) would leak the entry day's close into the open-execution moment → excluded by L1's own anti-look-ahead rule (STRONGLY SUPPORTED, evidence-based narrowing — not a silent choice).
- **Materiality of the timestamp choice (VERIFIED, `/tmp/od2_variants`):** signal-day vs day-before-signal ATR differ median 4.04% per trade (0/94 identical); full-engine variant runs shift return +6.3–7.4pp, DD −1.3pp, stop-exit count 30→32, avg R 1.03→1.08, PF 2.27→2.20, Sharpe 0.82→0.81. The choice is **methodologically consequential**; per the audit mandate it must be selected for design fidelity, **never** for which output looks better.
- **Anchor choice is historically near-neutral (VERIFIED):** `Open(t+1) − Close(t)` ∈ [−0.081%, +0.218%] across all 94 entries (Bitget 00:00-UTC daily candles are continuous) → entry-anchored stops sit within 1.6% of code stops; sizing deltas median +0.47%. This is a *sample accident*, not a spec argument — a venue/timeframe change (or intraday entries) would widen it (INFERRED).

---

## 9. Gap Behavior Audit (Phase 2H claims — independently re-verified)

| Phase 2H claim | Re-verification result | Status |
|---|---|---|
| `gap_stop` fired 0/94 | Re-run of unmodified engine: `donchian_exit=64, stop_loss=30, gap_stop=0` | **VERIFIED** |
| Close-first precedence makes documented gap-exit unreachable when close also ≤ stop | Synthetic Case B (§13): open ≤ stop & close ≤ stop → exit at **close**, labeled `stop_loss`; the open-fill branch never runs | **VERIFIED** |
| 2 historical exits would fill differently under doc-faithful behavior | Recomputed fixed stops from the code formula: exactly **2 CASE2** trades — XRP/USDT 2025-03-04 (engine close 2.4547 vs doc-faithful open 2.3876 = **−2.73%**), ADA/USDT 2025-03-04 (engine 0.9406 vs 0.8578 = **−8.80%**); stops 2.4550 / 0.9448. Doc-faithful fills are **worse** → current numbers are optimistic on these two legs relative to the documented rule | **VERIFIED** |
| Synthetic entry-day gap-down crashes the engine | Case E: `ValueError: invalid stop: entry=90.045, stop=100.571428…` raised at `run_backtest.py:134` → unhandled → whole run dies | **VERIFIED** |
| No historical entry-day crash | 0/94 entries have `Open×1.0005 ≤ stop`; the engine completed all runs | **VERIFIED** |

Additional observations from this audit:
- **Exit-day case distribution (historical, 94 trades):** 64 donchian exits (no stop cross on exit day), **28 × Case A** (open > stop, close ≤ stop → close-fill `stop_loss`), **2 × Case B**, **0 × Case C** (`gap_stop`) — VERIFIED.
- **New edge (Case E2):** when the entry-day open gaps below the stop but the *slipped* open remains above it (a 0.05%-wide band), entry is accepted and the same-bar gap check immediately closes the position at the raw open (`entry_date == exit_date`, r ≈ −10.7 because the risk denominator collapses). Not covered by any source → folded into **OD-2.6**. Not observed historically (0/94; band is ~0.05% wide).
- The close-only stop check means intraday touches without a close below the stop do not exit — Phase 2H measured **29/2,236** held days (1.3%) of `low < stop ≤ close` (L3, cited) → relevant to the PPT's "menyentuh" wording → **OD-2.9**.

---

## 10. Fee & Slippage Audit

Rates: fee 0.1%, slippage 0.05% — approved ("per eksekusi") and configured identically (`config.yaml:39–40`) — **VERIFIED MATCH**. Treatment, all VERIFIED from `run_backtest.py`:

| Question | Answer |
|---|---|
| Entry fee | Charged as a separate cash charge: `cost = units × entry_price × (1 + 0.001)` (`:135`). Included in **equity/cash** accounting. **Excluded from the trade-level `pnl` column** (`:104` subtracts only `units × entry`). Quantified: Σ omitted entry fee ≈ **$18.79** of Σ pnl $1,304.50 (~1.4%); avg R 1.0334 → 1.0233 if included; win rate unchanged 36.17%. |
| Exit fee | Inside proceeds: `proceeds = units × price × (1 − 0.001 − 0.0005)` (`:103` normal/stop exit, `:151` gap exit) → included in trade `pnl`. |
| Entry slippage | Multiplicative on the Open: `× 1.0005` (`:132`) → inside `p["entry"]` → affects sizing input, `risk_amount`, and trade `pnl` baseline. |
| Exit slippage | Inside `× (1 − 0.0015)` on close or open fills (`:103,151`). |
| Is slippage directional? | Yes — **adverse to the trader on both sides** (buy higher, sell lower). The PPT says only "per eksekusi"; adverse-both-sides is the standard reading (STRONGLY SUPPORTED), not stated verbatim (not fabricated as approved text). |
| Fee included in entry price? | No — `p["entry"]` carries slippage but not fee; fee sits on top in the cash charge. |
| Fee affects quantity/risk? | Not directly — sizing (`:134`) uses `entry_price` and `stop` only. Indirectly via the cash clamp if `cost > cash` (`:136–138`); Phase 2H instrumented this branch as `CLAMP_BINDS = 0` (L3, cited). Slippage *does* affect quantity (higher entry → wider stop distance → fewer units). |
| Fee deducted from P&L only? | Equity: yes, both sides. Trade stats: **exit-side only** — entry fee omitted from `pnl`/`r_multiple` (asymmetry quantified above; matches Phase 2H F8). |
| Do stop calculations use pre- or post-cost entry price? | **In the code: neither** — the stop never references the entry price (anchor = signal-day close). Under the approved formula this becomes exactly OD-2.2 (raw vs slipped Open) and OD-2.7 (cost treatment on the stop *fill*). |
| Stop-execution fee/slippage | Code applies the same `× (1 − 0.0015)` to stop fills as to channel fills — consistent with "per eksekusi" (STRONGLY SUPPORTED MATCH at the *rate* level). Not modeled: gap-size-dependent slippage beyond the fixed 0.05% (execution-realism caveat, Phase 2H §8). Exact convention for the freeze → **OD-2.7**. |

Note: entry side compounds `1.0005 × 1.001 = 1.0015005` vs the exit side's flat `0.9985` — a second-order asymmetry of ~0.00005% per round trip (VERIFIED arithmetic; immaterial, documented for completeness, no decision needed).

---

## 11. Look-Ahead Audit

| Component | Verdict | Basis |
|---|---|---|
| Donchian uses only pre-signal information | **VERIFIED SAFE** | `rolling(20/10).max/min().shift(1)` excludes the current day (`strategy.py:63,68`); repo test `test_no_lookahead` exists (DESIGN §9) |
| ATR uses only information available before entry | **VERIFIED SAFE** | signal-day ATR: data through close(t) only (`:133` + `strategy.py:37–58`) |
| Stop uses no future price | **VERIFIED SAFE** | built once from signal-day bar; never recomputed from later data |
| Execution no earlier than next-day Open (entries) | **VERIFIED SAFE** | read from next row; 94/94 next-day fills; holes defer, never accelerate |
| No current-day Close used as entry execution price | **VERIFIED SAFE** | entry fill is Open (`:132`) |
| No future portfolio equity in sizing | **VERIFIED SAFE** | sizing uses `equity` last written at the end of the previous date (`:176` vs `:134`) — prior-day MTM (same-day cross-pair entries also share the prior-day value: stale-but-causal) |
| Exit fills at the signal day's own close | **POTENTIAL ISSUE** (mild, disclosed) | zero-lag fill idealization: the fill price *is* the signal price; not look-ahead (close is known at decision time) but flagged as microstructure-unrealistic by the PPT's own citation; approved next-open reading unresolved → **OD-2.8** |
| Stop checked against close/open only (intraday path ignored) | **POTENTIAL ISSUE** (small, disclosed) | 29/2,236 held days touched intraday without exit (Phase 2H L3); conflicts with PPT "menyentuh" → **OD-2.9** |
| Hole-induced stale signal row | **VERIFIED SAFE in-sample** (0/94 stale) / mechanism INFERRED safe out-of-sample | previous-row logic never reaches forward in time; can only delay |
| Selection-level look-ahead (parameters/cluster chosen on the full sample) | **POTENTIAL ISSUE** — *not code look-ahead* | Phase 2H §21 (best-of-9, post-hoc gates, no OOS) — out of OD-2 scope, flagged for the thesis framing |

---

## 12. Approved-vs-Code Comparison Table

| Component | Approved/Prior Definition | Current Implementation | Status | Decision Needed |
|---|---|---|---|---|
| Donchian entry | Close breaks highest high of previous 20 days; `shift(1)` excludes current day (PPT L1; `PLAN:33`; `DESIGN:35`) | `prev_close > prev_don_hi`, strict `>`, rolling-20-high shifted 1 (`strategy.py:61–63`, `run:123`) | **MATCH** (VERIFIED) | none (equality strictness: STRONGLY SUPPORTED, not written) |
| Signal timing | After market close of day *t*; general shift-1 rule (PPT L2 slide) | Signal read from row *t* when processing *t+1* (`run:121–123`) | **MATCH** (VERIFIED) | none |
| Entry execution | Next day's Open (PPT diagram: Hari t close → Hari t+1 open) | `open(i)` of next row; 94/94 next-day (`run:132`) | **MATCH** (VERIFIED) | none |
| Entry price | Open with 0.05% slippage per execution; fee 0.1% on top (PPT "per eksekusi") | `open×1.0005`; fee charged separately in cash (`run:132,135`) | **MATCH** (STRONGLY SUPPORTED — exact arithmetic not written in PPT) | none |
| ATR | "ATR(14)" only — timestamp & seed variant unspecified (PPT) | Wilder recursion, SMA seed; **signal-day** value (`strategy.py:37–58`, `run:133`) | **PARTIAL / UNRESOLVED** | **OD-2.3** (+ name seed variant; A-vs-B = Phase 2H §7/OD-1) |
| Stop formula | `Entry − 2 × ATR(14)`; "Stop loss **dinamis**" (PPT; `PLAN:34`; `DESIGN:37`; `config:20` comment) | `signal_close − 2 × signal_day_ATR` (`run:133`; also `DESIGN:64,221` — doc self-contradiction) | **MISMATCH (anchor)** VERIFIED | **OD-2.1**, **OD-2.2** |
| Stop timing | Fixed vs dynamic unresolved: Entry-anchor (reads fixed) + word "*dinamis*" (L1) vs "trailing stop berbasis ATR" (`PLAN:35`, L2) | Fixed at entry; never recalculated, never trails, never moves (no mutation path) | **UNRESOLVED** | **OD-2.4** |
| Gap stop | DESIGN doc: "Open ≤ Stop → exit di open"; PPT: stop "*menyentuh*" (touch); code: close-check first | Close-first precedence → open-fill only when close recovers above stop; `gap_stop` 0/94; 2 CASE2 fills differ (doc-faithful **worse**); entry-day gap-down → `ValueError` crash (0/94 historical) | **MISMATCH (docs vs code)** VERIFIED | **OD-2.6** (+ **OD-2.9** for touch semantics) |
| Exit signal | Close breaks lowest low of previous 10 days, **or touches** stop (PPT); general rule implies next-open execution for signals | Channel: `close < don_lo` strict, **filled at same-day close**; stop: `close ≤ stop` filled at close; same-bar label precedence = stop | **PARTIAL** — signal MATCH; fill timing & touch semantics unresolved | **OD-2.5**, **OD-2.8**, **OD-2.9** |
| Fees | 0.1% taker **per execution** (both sides) (PPT) | Both sides charged; but trade-level `pnl` omits the entry fee (~$18.79 of $1,304.50; avg R 1.0334→1.0233 if included) | **MATCH at rate / PARTIAL in trade stats** VERIFIED | **OD-2.7** |
| Slippage | 0.05% **per execution** (PPT) | Entry `×1.0005`; exit inside `×(1−0.0015)`; adverse both sides; stop/channel fills identical treatment | **MATCH** (STRONGLY SUPPORTED) | none beyond OD-2.7's stop-fill convention |

---

## 13. Synthetic Scenario Results

All cases ran the **unmodified** `run_backtest.run_backtest()` on engineered single-pair OHLCV frames in memory (`/tmp/od2_cases.py`); repo untouched. Setup common to all: 30 flat bars (100 ± 1 → ATR(14) = 2.0), breakout signal bar (close 105 > prior high 101; ATR = 2.2143 → **engine stop = 100.5714**), entry bar (Open 102 → entry 102.05 unless stated).

| Case | Setup | Expected under methodology | Actual current-code behavior | Differ? |
|---|---|---|---|---|
| **A** — Open > Stop, Close ≤ Stop | exit bar: open 104, close 100 | DESIGN `:94` normal path: exit at **close** ✓. PPT "menyentuh": intraday touch → exit at/near **stop (100.5714)**, trigger intraday | exit at **close 100.0**, label `stop_loss`, r = −1.488 | vs DESIGN: **no**. vs PPT touch-reading: **YES** — trigger timing + fill price differ (0.57% lower here) → OD-2.9 |
| **B** — Open ≤ Stop, Close ≤ Stop | exit bar: open 100, close 99.5 (≥ don_lo so no channel signal) | DESIGN `:80,96` gap table: "Open ≤ Stop → exit di **open**" → fill 100.0 | exit at **close 99.5**, label `stop_loss`; gap branch never reached | **YES** — doc says open-fill, code close-fills (0.5% worse here). Historical twins: XRP/ADA 2025-03-04 (−2.73%/−8.80% vs doc) → OD-2.6 |
| **C** — Open ≤ Stop, Close > Stop | exit bar: open 100, close 102 | DESIGN gap table: exit at **open**, reason gap stop | exit at **open 100.0**, label `gap_stop`, r = −1.488 | **no** — code matches docs *in this recovery case* (the only case where the branch is reachable) |
| **D** — Channel exit + stop both trigger | entry-day low 98.5; exit bar open 99.5, close 98 (< don_lo 98.5 **and** ≤ stop) | Priority `UNKNOWN` (PPT silent); DESIGN gives both paths the same fill (close) | fill **close 98.0** (same either way), label = **`stop_loss`** (precedence at `:115`), r = −2.837 | Fill: **no** difference. Label: stop wins. Priority itself undecided → **OD-2.5** |
| **E** — Entry Open gaps below intended stop | signal bar close 105; **entry** bar open 90 (90.045 slipped) vs stop 100.5714 | Under approved `Entry − 2×ATR`: **structurally impossible** — the stop is defined *from* the entry price, so it always sits below it. Under a signal-anchored stop: behavior `UNKNOWN` (no source covers it) | **CRASH**: unhandled `ValueError: invalid stop: entry=90.045, stop=100.57142857142857` — entire run aborts | **YES** — code can die; approved formula makes the case impossible. Historical occurrence 0/94 → **OD-2.6** |
| **E2** (new) — entry Open inside the 0.05% band below stop | entry bar open 100.54 (≤ stop 100.5714) but slipped 100.5903 (> stop) | `UNKNOWN` — uncovered by all sources | no crash; entry accepted, then **same-bar** `gap_stop` closes it at raw open 100.54 (`entry_date == exit_date`), pnl −2.00, r = −10.67 (collapsed denominator) | Undocumented edge → folded into **OD-2.6** |

Corresponding historical frequencies (VERIFIED, `/tmp/od2_verify.py`): **A = 28, B = 2, C = 0, D-label-overlap ⊂ the 30 stop exits, E = 0/94, E2 = 0/94.**

---

## 14. Snapshot A/B Relevance

| Question | Finding |
|---|---|
| Does the stop-formula discrepancy explain the Snapshot A/B differences? | **No — VERIFIED.** Snapshot A (`git show e6188de:backtest/run_backtest.py:89`) used the *identical* line `stop = prev["close"] - mult * prev["atr"]`; only the **ATR seeding** changed between A (`ewm(alpha=1/14)` + manual seed, `e6188de` strategy.py) and B (explicit Wilder recursion, `029a311`). A→B mechanism = ATR values → stop distance → units (94/94 rows) → pnl/equity (Phase 2H F7, re-confirmed by reading both versions). |
| Is the discrepancy identical across both snapshots? | **Yes (VERIFIED)** — both A and B implement `prev_close − 2×prev_ATR`. Both equally deviate from the approved `Entry − 2×ATR` text; the `DESIGN:37`/`config:20` comments were wrong for *both*. |
| Do the gap-stop findings apply to both? | **Yes (STRONGLY SUPPORTED)** — trade sequence incl. exit reasons is identical A↔B (Phase 2H §23): both contain the same 0 `gap_stop` / 30 `stop_loss` and the same 2 CASE2 legs. |
| Would adopting `Entry − 2×ATR` change the snapshots? | **Yes — every stop, size, R-denominator, and possibly exit date changes → a full re-run and a NEW snapshot are mandatory.** Magnitude probe (audit sensitivity only, `/tmp/od2_variants`, B-era ATR kept): entry-anchored + signal-day ATR → return 152.0 → **152.4 (raw open) / 153.47 (slipped)**, DD −26.45 → −26.51/−26.61, n=94 unchanged, exit reasons flip 64/30 → 64/30 (raw) / 63/31 (slipped), avg R 1.03→1.04. |
| Which pending choice moves numbers more? | The **ATR timestamp** (OD-2.3): signal-day → day-before-signal gives 158.3–159.4% return, DD −27.7/−27.9, exit reasons 62/32, avg R 1.08, PF 2.20, Sharpe 0.81. Reported strictly as materiality — **the audit explicitly does not recommend the more profitable variant**; the mandate forbids choosing methodology by historical performance. |
| Interaction with Phase 2H OD-1/OD-7 | OD-2.1 *is* Phase 2H OD-7 (stop text vs code); deciding it triggers the same "re-run + single-source rewrite" procedure (`ARCHITECTURE.md` §16) as OD-1. This document does not select Snapshot A, B, or a post-freeze Snapshot C. |

All variant outputs live under `/tmp/od2_variants/out_*`; **no repo file was modified**; variants patched only copies under `/tmp`.

---

## 15. Unresolved Questions

Items the source material (L1–L4) genuinely does **not** determine — recorded as `UNKNOWN`, *not* converted into assumptions:

1. What "Entry" means in `Entry − 2×ATR` — raw Open vs slippage-adjusted Open.
2. Which bar's ATR(14) the approved stop uses (signal day / earlier); the PPT writes only "ATR(14)".
3. Whether "Stop loss **dinamis**" means (a) volatility-based-but-fixed-at-entry (the formula's plain reading), (b) recalculated, or (c) trailing (`PLAN:35`) — and what a trailing variant's formula would even be (unwritten).
4. Priority when the Donchian exit and the stop both trigger on one bar (label-only under current fills; fill-relevant if OD-2.5/2.6/2.9 change fills).
5. Behavior when the next-day Open gaps through the stop: fill at open? at stop? close-confirmed? and what happens on the *entry* bar (crash Case E / round-trip Case E2 are code facts, not approved behavior).
6. Exact fee/slippage arithmetic for stop executions (rates are approved; the formula convention and the entry-fee-in-trade-pnl question are not).
7. Whether exits are executed at the signal day's close (code) or the next day's open (general reading of the PPT's shift-1 passage + its Grądzki citation against close-fills).
8. Whether the stop triggers on intraday *touch* (PPT "menyentuh", uses bar lows / stop-price fills) or on close confirmation (code; 29/2,236 intraday touches ignored — Phase 2H L3).
9. Equality (non-strict) breakout handling — *not* escalated: "menembus" STRONGLY SUPPORTED as strict; recorded for completeness.
10. ATR seed variant naming for reproducibility ("ATR(14)" alone does not distinguish the A-era `ewm` from the B-era recursion — Phase 2H §7; ties into Phase 2H OD-1).

---

## 16. Owner Decisions Required

Only decisions the sources truly leave open. Each needs an explicit owner answer, recorded in `PLAN.md`/`decision_log.md` per repo rules, **before** any methodology freeze or re-run.

- **OD-2.1 — Stop formula of record.** Adopt the approved `Entry − 2 × ATR(14)` (PPT L1, `PLAN:34`, `DESIGN:37`, `config:20`) as the thesis definition — which requires changing `run_backtest.py:133` and a full re-run producing a new snapshot — **or** formally re-approve the implemented `signal-close − 2×ATR(14)` rule as the thesis methodology (amending the PPT-derived text with recorded rationale). Cannot be decided by the audit; Phase 2H OD-7 is the same decision.
- **OD-2.2 — If Entry-anchored: which "Entry"?** Raw next-day Open, or the slippage-adjusted Open (`open×1.0005`)? `UNKNOWN`. (Materiality on this sample: ≤1.6% stop-distance / ≤1.5pp return — small here, but the *definition* must still be exact for reproducibility.)
- **OD-2.3 — ATR timestamp.** Signal-day ATR (what the code uses today), day-before-signal ATR, or another definition? Causal ceiling: only information through the signal day is admissible (entry-day ATR would be look-ahead at execution and is excluded by the PPT's own rules). Materiality: median 4.04% ATR difference; +6–7pp return, −1.3pp DD in variant runs. **Decide on design grounds, not on which number is better.**
- **OD-2.4 — Fixed or dynamic stop?** The Entry-anchored formula reads *fixed at entry*; the PPT says "*Stop loss dinamis*"; `PLAN:35` says "*trailing stop berbasis ATR*"; the code is fixed. Pick one and align all four texts. If "dynamic/trailing" wins, the trailing formula itself must be specified (sources don't contain one → would be new methodology).
- **OD-2.5 — Same-bar priority.** When the channel exit and the stop trigger together: stop precedence (current label behavior), channel precedence, or "either, same fill"? Under close-fills the economics coincide; the decision becomes load-bearing if OD-2.6/2.9 change fill rules, and it always affects exit-reason statistics.
- **OD-2.6 — Gap-through behavior at the open.** Exact rule when next-day Open gaps below the stop: exit at open (DESIGN doc), close-confirmed (current code — makes the documented rule unreachable in Case B), exit at stop price, or touch-based? Must also cover: (a) the **entry-day** gap-through — current code *crashes* (`ValueError`, Case E) and an entry-anchored stop would make the case structurally impossible; (b) the 0.05% band round-trip (Case E2). Note the two historical legs (XRP/ADA 2025-03-04) currently realize *better* fills than doc-faithful open-exits — the decision must not be justified by that.
- **OD-2.7 — Cost treatment on stop (and trade-stat) executions.** Confirm: fee 0.1% + slippage 0.05% charged on stop fills exactly as approved "per eksekusi" (code: `×(1−0.0015)` — consistent); decide whether trade-level `pnl`/R statistics must include the entry fee (currently omitted: ≈$18.79 of $1,304.50; avg R 1.0334→1.0233, win rate unchanged) or whether equity-level accounting suffices with disclosure; and whether gap fills assume only the fixed 0.05% slippage regardless of gap size (current) or a gap-sensitive convention.
- **OD-2.8 — Exit fill timing (found by this audit).** Same-day close (current code, standard daily-backtest idealization, but contradicted by the PPT's general "signal after close → execute next open" rule and its own Grądzki citation against close-execution) **or** next-day open for exits (methodology-literal, changes every exit price and possibly date → re-run)? Both readings are defensible; no source resolves it.
- **OD-2.9 — Stop trigger semantics (found/confirmed by this audit).** The PPT's "*menyentuh stop loss*" (touch) vs the code's close-confirmation (ignores 29/2,236 intraday touches; Case A would fill at close instead of at/near the stop). Choose: intraday-touch model (bar-low based, fill at stop when `low ≤ stop ≤ high`), close-confirmation (current), or document close-confirmation as an explicit simplification of "touch" with the 1.3% frequency disclosed.

*Not listed because the sources resolve them:* entry rule/timing/execution (match), sizing 1% mechanics, cluster/global limits, direction, fee/slippage rates, Donchian shift(1), strict-inequality breakouts ("menembus"), no-pyramiding ("In-or-Out").

---

## 17. Recommended Freeze Specification

**Nothing below resolves an `UNKNOWN`; pending items stay pending.**

### 17a. Freeze-ready (evidence-backed — no owner input needed)

| Component | Frozen statement | Confidence |
|---|---|---|
| Timeframe | 1D daily candles, Bitget, 10-pair universe (survivorship/period-label caveats are Phase 2H OD-6, out of OD-2 scope) | VERIFIED (PPT = config = preset) |
| Entry signal | At close of day *t*: enter iff `close(t) > max(high(t−20 … t−1))` — strict, current day excluded | VERIFIED (PPT wording + code + tests) |
| Entry timing | Signal formed after close of *t*; evaluated only from information through *t* | VERIFIED |
| Entry execution | At Open of day *t+1*, never earlier; holes defer, never accelerate | VERIFIED (94/94) |
| Entry price | `Open(t+1) × 1.0005`; fee 0.1% charged on top of notional | STRONGLY SUPPORTED (PPT "per eksekusi" + code; arithmetic convention to be restated in the thesis) |
| Risk & sizing | ≤ 1% equity risk per position; `units = (1% × equity) / (entry − stop)`, capped `equity/entry` (spot, unlevered) | STRONGLY SUPPORTED (PPT 1% + code formula; cap consistent with long-only spot) |
| Equity basis for sizing | Prior-day mark-to-market equity | VERIFIED (causal) |
| Concurrency | Long-only in-or-out (no pyramiding); ≤ 2 positions per correlation cluster; ≤ 5 nominal global cap | VERIFIED (PPT = config = code) |
| Exit channel signal | At close of day *t*: exit iff `close(t) < min(low(t−10 … t−1))` — strict | VERIFIED (signal side only — *fill timing is pending, 17b*) |
| Costs | Fee 0.1% taker + slippage 0.05% on **every** execution, both sides, adverse to the trader | VERIFIED at rate level; trade-stat entry-fee question pending (17b) |
| Parameters | Donchian 20/10, ATR period 14, stop multiplier 2.0, risk 1% | VERIFIED (all sources agree) |

### 17b. PENDING — explicitly NOT frozen until the owner decides

| Component | Pending because | Gate |
|---|---|---|
| Stop formula (anchor) | L1 says `Entry − 2×ATR`; code says `signal-close − 2×ATR` | **OD-2.1** |
| "Entry" definition (raw vs slipped Open) | `UNKNOWN` in all sources | **OD-2.2** |
| ATR timestamp in the stop | `UNKNOWN`; materially moves results | **OD-2.3** |
| ATR seed-variant naming (A-era vs B-era) | "ATR(14)" underspecified; ties to which snapshot stands | Phase 2H §7 / OD-1 (cross-ref) |
| Stop dynamics (fixed / recalculated / trailing) | L1 "*dinamis*" + L2 `PLAN:35` trailing vs Entry-anchored formula vs fixed code | **OD-2.4** |
| Same-bar exit priority | PPT silent | **OD-2.5** |
| Gap-through behavior (incl. entry-day Case E crash & Case E2 band) | docs ≠ code; PPT silent; crash is a robustness defect | **OD-2.6** |
| Stop-execution fee/slippage convention; entry fee in trade stats | rates approved, mechanics/stat treatment not | **OD-2.7** |
| Exit fill timing (same-close vs next-open) | PPT general rule vs code practice vs PPT's own microstructure citation | **OD-2.8** |
| Stop trigger semantics (touch vs close-confirmation; fill price) | PPT "menyentuh" vs code close-check (29/2,236 touches ignored) | **OD-2.9** |

**Freeze procedure once decided** (per the repo's own `ARCHITECTURE.md` §16, cited by Phase 2H): record decisions → align code + all four documentation texts (`PPT`-derived methodology text, `PLAN.md`, `DESIGN.md`, `config.yaml` comments) → re-run the frozen config → publish metrics from **one** source. Any stop change produces a new snapshot; neither A nor B remains quotable as-is.

---

## 18. Limitations

- **PPT extraction:** the approved PDF was read via `pdftotext -layout` (`/tmp/opencode/od2_ppt.txt`); slide *text* is VERIFIED, but PowerPoint **speaker notes were not examined** (`UNKNOWN` whether extra specification exists there — the original `.pptx` was not parsed for notes).
- **Sensitivity runs are audit probes, not proposals:** the four stop variants patched engine **copies under `/tmp` only** (same technique as Phase 2H §16); they cover 2 anchors × 2 ATR timestamps with the B-era Wilder ATR. The A-era `ewm` ATR was **not** re-executed (would require checking out old code — forbidden). No intraday-touch backtest, no gap-sensitive slippage model, no alternative fee conventions were run.
- **Materiality is sample-specific:** anchor deltas rely on this dataset's 00:00-UTC continuity (max |Open(t+1)−Close(t)| = 0.218%); conclusions may not transfer to other venues/timeframes (INFERRED).
- **Case D equivalence is conditional:** channel-vs-stop priority is economically irrelevant *only while both exits fill at the same close*; any OD-2.6/2.9 fill change makes it financially relevant.
- **Exit-side idealization not re-quantified:** same-day-close exit fills (and intraday-touch frequencies beyond Phase 2H's 29/2,236) were not re-simulated under alternative fill rules.
- **Out of scope:** paper-trading engine semantics (`DESIGN.md:216–223`), benchmark/gate/snapshot-choice issues (Phase 2H OD-1…OD-6, OD-9…OD-12), Sharpe assessment (owner: not a target), any parameter optimization, and any profitability-based methodology recommendation — none were performed, per mandate.
- **No statement here recommends a variant because it backtests better**; all variant numbers appear solely to bound materiality.

---

*OD-2 audit, HEAD `73856fa`, 2026-09-24. Evidence artifacts under `/tmp/od2_*` and `/tmp/opencode/od2_ppt.txt`. Repository modified only by this file; no commit, no push.*
