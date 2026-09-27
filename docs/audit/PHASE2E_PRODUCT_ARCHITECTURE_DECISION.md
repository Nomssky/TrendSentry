# Phase 2E — Product Architecture Decision Audit

> **Scope:** READ-ONLY decision document on HEAD `91dbc07` (2026-09-22). The only repository
> change made by this phase is this file. No trading logic, strategy logic, risk logic,
> paper trading, Supabase schema, migration, RLS policy, API route, frontend, Stripe code,
> execution, GitHub Actions, test, or dependency was modified.
> No production access, no credentials, no production API calls, no database mutations, no push.
>
> **Purpose:** produce evidence for choosing a future direction. This document **does not
> choose a direction, does not rank options, and does not estimate revenue.** No model is
> recommended over another anywhere below.
>
> **Method:** all claims cite source code at file:line (Phase 2D evidence reused where marked,
> plus fresh reads this phase). Status vocabulary for loop maps: `EXISTING` / `PARTIAL` /
> `ABSENT` / `UNPROVEN`. Gap tables use qualitative descriptions only — no scores.
> All facts are from code inspection. No assumptions upgraded to facts.

---

## 1. Executive Summary

1. The repository contains two systems with **zero runtime connection between them**:
   System A (Python engine: backtest + global paper trading on `config.yaml`, SQLite state,
   GitHub Actions) and System B (Next.js/Supabase SaaS: auth, templates, user strategies,
   read-only Bitget keys, daily fill import, deviation detection, discipline score,
   dashboard, Stripe). The only cross-system data movement is the one-way
   SQLite → `/api/cron/paper-sync` → Supabase mirror of the **global** paper account
   (scripts/sync_paper_to_supabase.py:145-153). No code path carries
   `Supabase user_strategies → Python engine` or anything else in the reverse direction
   (no Supabase client exists in any `*.py`).
2. **Model A (Trading Automation)** has a substantial reusable engine core
   (signal → simulated fills → risk guards → idempotent state → tests), but everything that
   makes it a *product* is missing: the strategy bridge, per-user state (the SQLite schema
   is single-tenant — no `user_id` anywhere, `db/schema.sql:1-80`), a job/scheduling model
   beyond one global cron, strategy dispatch for 5 of 8 templates, alert delivery, per-user
   results UI, and — for the eventual live stage — an order path that does not exist and is
   explicitly forbidden by current guards and project rules (guards.py:56-57, lib/bitget.ts:6-9).
3. **Model B (Discipline/Analytics)** is the most complete loop in the repository today:
   a user can already go signup → create rule-sheet strategy → connect read-only key →
   daily fill import → deviation check → discipline score → dashboard with **no new backend
   code**. Its known narrowness is functional, not architectural: effectively only the
   `direction` rule fires in the active pipeline, attribution requires exactly one active
   strategy (daily-sync:162-165), alerts are not delivered to users, custom-rule authoring
   has no UI, and the write path has no automated test.
4. **Model C (Backtesting/Research SaaS)** has a complete, tested Python engine
   (3 strategy models, metrics, reports; run_backtest.py:52-292) and committed data
   (10 pairs, 22,894 daily rows, last refreshed by manual workflow 2026-09-02) — and
   **zero API, job, report-persistence, or frontend surface**. It is developer tooling end
   to end; a SaaS would need a job execution model, per-user report storage, a parameter
   surface, and a data-refresh schedule that does not exist (fetch workflow is
   `workflow_dispatch` only).
5. **Hybrids** (A+B, A+C, B+C, A+B+C) are each analyzed factually below: what they share,
   what coupling they add, what state/security/ops surface they introduce, whether the
   journey stays coherent, and whether one capability would depend on another
   unnecessarily. Hybrids are not assumed superior; no combination is ranked.
6. **Product claims vs code reality** (§15) documents every implied claim found in UI,
   pricing, README, and marketing — including AI/LLM claims (Hero.tsx:59,71;
   BentoFeatures.tsx:103-105) over a disabled always-pass skeleton
   (llm_filter/filter.py:43-49, config.yaml:43), paid-feature claims without delivery
   (stripe.ts:19,25; pricing:31,43-47), and the honest ones (`/live` gates, README status
   table). Evidence only — no copy is rewritten here.
7. **Canonical-state reality today:** execution is canonical in `config.yaml` + SQLite;
   the SaaS loop is canonical in Supabase; they answer different questions about different
   subjects (owner's account vs the user's own account) and never intersect. Any model
   that merges these subjects forces a canonical-data decision first (§2.1, §17).

The owner must answer the ten concrete questions in §16 before any implementation begins.
A neutral decision sequence is given in §17; no model is selected.

---

## 2. Current Architecture Reality

```text
VERIFIED RUNTIME CONNECTIONS TODAY
─────────────────────────────────
GitHub Actions cron 01:00 UTC ─► pytest ─► paper_trading/live_signal.py
        (paper-trading.yml)          │        reads: config.yaml (fixed Donchian)
                                     │        data:  Bitget PUBLIC ccxt (no keys)
                                     │        state: SQLite db/paper_trading.db (single tenant)
                                     │        alerts: Telegram → owner chat
                                     ▼
                        scripts/sync_paper_to_supabase.py ─Bearer CRON_SECRET─►
                                     │
                                     ▼
Supabase paper_* tables  ◄─(service-role upsert)─ /api/cron/paper-sync
        │
        ▼
Public pages /papertrading, /papertrading/log  (service-role reads)

GitHub Actions cron 01:30 UTC ─curl prod─► /api/cron/daily-sync (CRON_SECRET)
        │                                   │ decrypts user keys, fetches Bitget fills
        ▼                                   ▼
Supabase user_trades → deviation_log → discipline_scores ─► /app/* pages (RLS session reads)

Browser ─► Next.js (proxy + CSRF + rate limit) ─► Supabase (3 clients, RLS)
Stripe ─signature─► /api/webhooks/stripe ─► profiles.plan  (read by nothing)

NO CONNECTION EXISTS:
  Supabase user_strategies ──X──► Python engine        (no supabase client in any *.py)
  Python engine ──X──► Supabase user tables            (engine never writes user data)
  profiles.plan ──X──► any feature                     (entitlement never read)
```

Two subjects, two state worlds:

| Subject | Strategy source | State | Performance | History | Identity |
|---|---|---|---|---|---|
| **System A** — owner's global account | `config.yaml` (:4-23) | SQLite `db/schema.sql:1-80` | `equity_log` (date PK) | `signals`/`positions` | none (single implicit owner) |
| **System B** — each user's own account | `user_strategies` (stored, never executed) | Supabase (derived rows) | `discipline_scores` (no PnL) | `user_trades`/`deviation_log` | Supabase Auth + `profiles` |

### 2.1 Canonical state today (single-source-of-truth baseline)

| Concern | Canonical today | Why (evidence) |
|---|---|---|
| Strategy configuration (executing) | **`config.yaml`** | Sole input of the engine (live_signal.py:34,329); `user_strategies.params` has no consumer |
| Strategy configuration (stored for users) | **Supabase `user_strategies`** | Written by POST (strategies/route.ts:44-47), read by pages/attribution — storage only |
| Strategy catalog | **`strategy_templates`** (canonical seed migration `20260922120000`) | 8 rows; UI renders `params_schema`; no engine dispatch |
| Execution state | **SQLite** (`meta`, `signals`, `positions`, `equity_log`, `yield_log`, `slippage_log`, `sync_state`) | Engine R/W; schema.sql:1-80; Supabase `paper_*` is a **mirror** (sync watermarks, script:164-172) |
| Performance (paper) | SQLite → mirrored to `paper_equity_log` | equity_log upsert per date (schema.sql:66-72) |
| Performance (user) | **Supabase `discipline_scores`** (discipline, not PnL) | Only score/trend exist; `user_trades` has no pnl columns (trades/route.ts:24) |
| Trade history (user) | **Supabase `user_trades`** | daily-sync insert (route:181-190); fills log |
| User identity | **Supabase Auth + `profiles`** | trigger handle_new_user (remote_schema:239-276) |
| Exchange credentials | **Supabase `user_api_keys`** (AES-GCM) | encrypted at rest (encryption.ts:3-66); decrypted server-side only (daily-sync:110-126) |
| Billing state | **`profiles.plan` columns** | webhook writes (webhooks:31,47,65); read by nothing |
| Backtest numbers (marketing) | **`lib/backtest-reference.json`** | single web source (reference.ts:1-24); README:94-100 notes engine-vs-web snapshots **not yet reconciled** (+149.59%/−26.19% vs +152.0%/−26.45%) |

---

## 3. Model A — Trading Automation

```text
User → Create strategy → Generate signal → Paper trading → Performance → Eventually live
```

### What already exists
- Engine core for **one fixed strategy**: Donchian signal (strategy.py:61-93, shared with
  backtest), simulated entry/exit/gap/live-stop fills, fee+slippage, ATR stop mandatory
  (live_signal.py:507-538, 411-473), cash ledger (:61-73), idempotent daily processing
  (:391), per-day equity/yield ledgers (:186-307, 129-183).
- Risk guards: `validate_config` (guards.py:16-72), concurrency caps (live_signal:476-485),
  `position_size` with spot clamp (strategy.py:71-83), `CircuitBreaker` implemented but
  runtime-unwired (guards.py:80-118; callers = tests only).
- Second/third strategy implementations exist for **backtest only**: SMA (strategy.py:96-122),
  RSI (:125-158).
- 70 Python tests including a full `main()` run against a **fake exchange**
  (tests/test_live_signal.py, 11 tests) — offline proof of the paper flow.
- Ops: Telegram owner alerts, workflow failure alert (paper-trading.yml:64-72), DB-in-git
  backup (:50-59), stale/gap detection on the public dashboard (papertrading:36-39).
- SaaS-side pieces A would inherit: auth, templates, user_strategies, guardrails
  (validations.ts:33-63), dashboard rendering patterns, Supabase.

### What is reusable as-is
Engine math + risk guards + tests + sync plumbing + public paper dashboard (as a reporting
pattern). The strategy function layer (single source shared by backtest and paper).

### What is missing
1. **The bridge**: nothing carries `user_strategies` → engine input (absent by grep).
2. **Per-user state**: `db/schema.sql` is single-tenant — `meta` holds one `paper_cash`
   (:4-7), `signals` dedupes by `UNIQUE(candle_date, pair)` (:23) which would collide
   across users running the same pair, `equity_log` is `date PRIMARY KEY` (:67), `positions`
   has no `user_id` (:27-41), `sync_state` is one stream (:77-80).
3. **Strategy dispatch**: only Donchian executes; SMA/RSI exist as functions but the paper
   runner hardcodes Donchian (live_signal:34); 5 of 8 templates have no implementation at all (Phase 2D §4).
4. **Job/scheduling model**: one global GH cron; no queue, no on-demand run, no per-user trigger.
5. **Per-user results surface**: dashboard shows discipline/fills only — no per-user
   paper positions/equity UI (paper dashboard reads global `paper_*`).
6. **Alert delivery** per user (Telegram targets one env chat, lib/telegram.ts:4-5).
7. **Entitlement enforcement** before any paid automation tier.
8. **Live execution layer entirely**: no order code, allowlist forbids it, `validate_config`
   rejects live mode, PLAN Fase 4 gated (Phase 2D §7).

### Coupling required between Python and SaaS
Two possible seams, **neither exists**: (a) engine authenticates to Supabase (service-role
or scoped read) — adds DB credentials to the engine and a network egress trust decision;
(b) SaaS enqueues jobs to an engine worker (webhook/queue) — adds a queue, job schema, and
result write-back path. Either way a **parameter mapping layer** is needed
(`params_schema` jsonb → engine config/preset), currently nonexistent. The discipline
loop (B) would also need semantic separation: engine-generated paper fills must not be
silently mixed into `user_trades` (currently defined as real fills, trades/route.ts:24).

### Multi-user implications
Process model shifts from one global run to N runs (or one run per user per day);
scheduling/queue required; per-user risk isolation (separate equity, separate caps);
failure isolation (today's per-pair `try/except` at live_signal:549-552 isolates pairs, not
users — one bad param set must not kill other users' runs); monitoring becomes per-user.

### State management implications
Single SQLite either partitions per user, moves to Postgres, or is replaced — all three are
schema-level changes; the sync watermark model (single stream, script:100-136) assumes one
dataset and would need per-user semantics.

### Security implications
Engine gains Supabase credentials or job-auth tokens; user-supplied params cross a trust
boundary into a config-driven engine (`validate_config` exists but validates a narrower
schema than `params_schema` offers); for the live stage, user trading credentials would
gain order capability — currently forbidden by the read-only allowlist (lib/bitget.ts:6-9)
and root project rules.

### Exchange/API requirements
Paper per-user runs need only **public** market data (already used, keyless) — sufficient
for the paper stage. Live requires order/SL endpoints that are absent and explicitly out
of scope until PLAN §9 is amended.

### Operational complexity
Worker infrastructure, queue, retries, concurrency limits, N-user monitoring, cost of
N daily runs, deployment of the engine outside (or alongside) GitHub Actions.

### Testing complexity
High — current suite assumes one global config and a fake exchange single-run; multi-tenant
isolation, concurrent state, cross-user idempotency, and job-failure behavior would all be
new test surfaces.

---

## 4. Model B — Trading Discipline / Analytics

```text
User connects exchange → Import fills → Analyze actual trades → Detect deviations
→ Calculate discipline score → Dashboard / insights
```

### Current implementation (how much already works)
End-to-end, **without new backend code**, for a Bitget spot trader:

| Step | Status | Evidence |
|---|---|---|
| Connect exchange | REAL — verify-on-submit against 2 read endpoints, AES-GCM at rest | api-keys/route.ts:19-75; bitget.ts:6-9 |
| Import fills | REAL — daily 01:30 UTC cron, per-user signed fetch, dedupe by trade id | daily-sync:57-76, 141-154; workflow trendsentry-daily-sync.yml:6-20 |
| Analyze actual trades | PARTIAL — fills stored as raw log; no positions/PnL model | trades/route.ts:24 ("fill log"), daily-sync:181-190 |
| Detect deviations | PARTIAL — 8 rules coded; effectively `direction` fires in active path; attribution needs exactly 1 active strategy | deviation.ts:54-165; daily-sync:162-165, 192-194, 216-234 |
| Discipline score | REAL — dual implementation (app + DB trigger, identical formula) | deviation.ts:167-214; migration 20260912130000 |
| Dashboard / insights | PARTIAL — score trend + deviation log + recent fills; no insights beyond score/chart | dashboard:11-33; deviation-log:9-14 |

### Data flow (verified)
`user_api_keys (AES-GCM)` → daily-sync decrypt (:110-126) → Bitget fills (:57-76) → dedupe
(:141-154) → attribute to sole active strategy (:156-165) → `user_trades` (:181-190) →
`checkDeviation` → `deviation_log` (:216-234) → `calculateDisciplineScore` →
`discipline_scores` (:235-241) + DB trigger recalc → dashboard reads via RLS.

### User value already exposed
Rule persistence under guardrails, automatic daily fill logging, deviation history page,
daily discipline score + trend chart, setup checklist, account lifecycle (change
password / delete with cascade). All reachable today on the deployed product.

### Missing pieces
- Per-user alert delivery (paid claim unwired: alert exists only on the uncalled
  `POST /api/trades` path, trades/route.ts:157-160; chat is single global,
  lib/telegram.ts:4-5; daily-sync never alerts).
- Custom-rule authoring UI (`rules_json` is API-only; strategies/new sends
  `name/template_id/params` only, page.tsx:116) — pricing claims a "Custom rule builder"
  (pricing:17).
- Multi-strategy attribution (today: >1 active strategy → silent no-op, daily-sync:162-165).
- Edit/pause/delete strategy UI (orphaned PUT/DELETE API).
- Key revocation; multi-exchange providers (only Bitget; /start promises "others coming").
- Fills → positions/equity reconstruction (needed for any PnL/insight depth).
- Entitlement wiring before charging; automated tests for the create→import→score chain
  (none exist — e2e stops at page loads, free-tier-flow:172-183 is `console.log` not `expect`).

### Dependencies
- **On live execution: none.** The loop never touches System A.
- **On the strategy engine: none.** "Strategy" here is a rule sheet consumed by the
  deviation checker (lib/deviation.ts parseRules), not an executable engine.

### Exchange credential requirements
Read-only key — already implemented with verification, encryption, server-only decryption.
Caveat documented in code: read-only permission cannot be *enforced* (Bitget has no
endpoint to read a key's permissions; lib/bitget.ts:30-37).

### Payment / entitlement implications
Maps naturally onto the existing tier copy (Watcher free / Paper Beta = alerts +
benchmark; stripe.ts:14-27, pricing:7-49), but `profiles.plan` is never read — enabling
sales requires entitlement code and a delivery channel before the claims are truthful.
Current sales posture is invite-only via GitHub waitlist (pricing:109-115).

### Testing gaps
No automated test covers the write chain (create strategy → key connect → sync → deviation
→ score); no fixture-based test for `checkDeviation` callers; the smoke suite's templates
auth check accepts 401 *or* 200 (api-smoke-test.mjs:92-100).

---

## 5. Model C — Backtesting / Research SaaS

```text
User → Choose strategy → Configure parameters → Run backtest → Metrics → Report
```

### Existing Python backtest capability
Complete local chain: CSV load + model select (run_backtest.py:52-68) → simulation with
next-open execution, fee+slippage, gap stops, concurrency caps (:71-179) → `compute_metrics`
(return, CAGR, Sharpe, Sortino, max DD, win rate, profit factor, buy-and-hold, :182-228)
→ `save_report` to `backtest/reports/{metrics.md, equity_curve.csv, trades.csv, equity_drawdown.png}`
(:248-277). CLI entry exists (cli.py:29-30). Covered by the Python suite (70 tests,
strategy math + cash clamp).

### Current strategy implementations
Donchian, SMA, RSI — REAL (strategy.py:61-158; models wired in run_backtest:58-67).
Bollinger/MACD/Ichimoku/VWAP/Custom — ABSENT (Phase 2D §4).

### Data availability
10 committed CSVs, **22,894 rows total** (~6 years daily; config.yaml:37), single venue
(Bitget public OHLCV). Refresh = **manual** workflow (`fetch-bitget-data.yml`,
`workflow_dispatch` only); file mtimes 2026-09-02 — freshness is a manual responsibility
today, no scheduled refresh exists.

### Parameterization
Engine params come from `config.yaml` + frozen `PRESET` overlays (presets carry FROZEN
headers forbidding tuning). Template `params_schema` fields (entry/exit/ATR/risk, seed
20260922120000) *names* align with engine inputs, but **no code maps user params → a
backtest run** exists.

### API exposure
None — no route executes or triggers a backtest (grep across `app/api`: backtest appears
only in marketing copy).

### Frontend exposure
None as a trigger; static reference numbers only (`lib/backtest-reference.json` via
reference.ts) on marketing/proof pages; the paper dashboard compares against that static
baseline (papertrading:31-34).

### Job execution model
Does not exist. `run_backtest` is a local synchronous CLI. In this stack (Vercel
serverless routes + Python not deployed as a service) a user-triggered run needs either a
queue/worker or a bounded request-time execution policy — neither is present. The engine
has no deployment target today (VPS/Docker `deploy/` prepared but never built, README:41).

### Resource limits
None defined (no timeout, quota, or concurrency guard for user-triggered runs — because no
trigger exists). Data volume is small (~23k rows); runtime was **not measured in this
phase** (no numbers invented).

### Multi-user isolation
Runs are stateless w.r.t. users (read-only CSVs + params → metrics), but `save_report`
writes fixed filenames unless `REPORT_SUBDIR` is set (run_backtest:231-235 — a single
process-wide env var, not per-request), so concurrent runs would collide on output paths.
No per-user result store exists.

### Report persistence
Repo files only. Nothing writes reports to Supabase/Storage; no report retrieval API or UI.

### Missing architecture (for a SaaS)
Job runner + result storage + per-user access control + param validation surface mapped to
the three implemented models + scheduled data refresh + metrics-display UI +
entitlement gate. Developer tooling above the "run" step is complete; SaaS surface below
it is entirely absent.

---

## 6. Hybrid Analysis

No combination is assumed superior; none is ranked. For each: shared infrastructure,
coupling, new state, added security surface, added operational complexity, journey
coherence, and unnecessary dependency.

### A + B (automation + discipline)
- **Shared infrastructure:** auth, `user_strategies`/templates, guardrails, Supabase, dashboard, Stripe.
- **Coupling:** engine must read user params and write per-user results the dashboard reads
  (the missing bridge); discipline semantics must decide whether simulated engine fills
  enter `user_trades` (currently defined as real fills, trades/route.ts:24) or stay a
  separate stream — otherwise scores silently change meaning.
- **New state models:** per-user execution state (SQLite has none) + separation of
  paper-result rows from real-fill rows.
- **Additional security surface:** engine↔Supabase credentials/job tokens; user params
  crossing into a config-driven engine.
- **Additional operational complexity:** worker/queue on top of the already-existing
  daily-sync + paper cron ops.
- **Journey coherence:** can stay coherent ("run my strategy, and audit my real trades")
  only if the two trade streams are presented distinctly; two loops with different subjects
  (simulated vs real fills) share one dashboard.
- **Unnecessary dependency:** B's loop needs nothing from A; adopting A attaches queue,
  state, and engine-availability failure modes to a loop that works today without them.

### A + C (automation + backtesting)
- **Shared infrastructure:** strategy function layer (strategy.py), data fetch, param
  model, CLI, tests.
- **Coupling:** natural conceptual sequence (configure → backtest → paper) requires one
  common parameter abstraction consumed by both runners — does not exist; both would
  canonicalize strategy configuration the same way (SSOT decision, §2.1).
- **New state models:** per-user backtest results + per-user execution state (two stores).
- **Additional security surface:** job input validation for two job types; report access scoping.
- **Additional operational complexity:** two classes of jobs (backtest runs + scheduled
  paper runs) sharing or splitting a worker.
- **Journey coherence:** coherent as a pipeline narrative; each stage is independently
  meaningful (C works standalone as tooling; A works standalone per user).
- **Unnecessary dependency:** C does not require A to run; A does not require C to execute
  (today's paper runs with no backtest attached) — the coupling is a design choice, not a
  technical necessity.

### B + C (discipline + backtesting)
- **Shared infrastructure:** auth, templates, `user_strategies` (dual role: rule sheet for
  deviation AND parameter source for backtest), dashboard, metrics rendering (Recharts),
  Stripe.
- **Coupling:** low — a backtest result is an additive panel; the discipline pipeline is
  untouched by it. No shared mutable state (C reads CSVs, writes results; B reads fills).
- **New state models:** per-user backtest reports only.
- **Additional security surface:** job input validation + report ownership scoping; **no
  exchange-credential surface is added** (backtest uses public data).
- **Additional operational complexity:** a job runner for backtests only; no queue for
  trading state.
- **Journey coherence:** "define rules → backtest the idea → trade manually → audit
  discipline" is a coherent single-subject journey (all about the user's own decisions).
- **Unnecessary dependency:** neither loop depends on the other; each is shippable alone.

### A + B + C (all three)
- Combines every surface above: engine bridge + per-user execution state + backtest job
  store + trade-stream semantics + queue/worker + entitlement across three value claims.
- Shared: the strategy/param abstraction would need to satisfy engine, backtest, and
  deviation-checker consumers simultaneously (today each reads a different shape:
  config.yaml, PRESET yaml, `params`/`rules_json`).
- Journey coherence is possible but each added loop multiplies state models, security
  boundaries, and ops surfaces; dependency analysis: B is self-sufficient, A and C each
  self-sufficient — the triple product's coherence depends on answers in §16 first.
- No ranking or superiority is implied by listing this combination.

---

## 6.1 Single-Source-of-Truth Impact (per model)

Which store becomes canonical for each concern, per model (baseline "today" from §2.1):

| Concern | Today | Model A | Model B | Model C |
|---|---|---|---|---|
| Strategy configuration | Split: `config.yaml` executes; `user_strategies` stored | **Forced decision:** engine input must become per-user canonical (Supabase-derived) or a per-user config projection is generated — `config.yaml` demoted to defaults/globals | No change needed — `user_strategies` already canonical as rule sheet; `config.yaml` stays engine-internal (isolated) | New: params for a run come from user input mapped to engine names; question whether `user_strategies.params` or ad-hoc request params are canonical for a run |
| Execution state | SQLite (single tenant) | Must become per-user (partitioned SQLite / Postgres / per-user DB) — schema change | Unchanged (engine not involved) | Stateless per run; only results are new state |
| Performance | `equity_log` (global) vs `discipline_scores` (per user) | Per-user paper performance becomes a new canonical stream alongside discipline scores — two performance notions must be named distinctly | `discipline_scores` remains the only performance notion (no PnL) | Backtest metrics per run become a third performance notion (hypothetical, not actual) |
| Trade history | Real fills: `user_trades`; paper: SQLite `positions` | Paper fills per user must either join `user_trades` (changes discipline meaning) or live in a new stream | `user_trades` canonical (real fills only) | Backtest trades are ephemeral report rows, not user history |
| User identity | Supabase Auth + `profiles` | Unchanged | Unchanged | Unchanged |
| Exchange credentials | `user_api_keys` (AES-GCM, read-only) | Unchanged for paper stage; live stage would expand what credentials are *used for* (order capability) — currently forbidden | Unchanged | Not used (public data) |
| Backtest numbers | `backtest-reference.json` (web) vs engine reports — README:94-100 says canonical choice **pending** | Same pending question | Same pending question | Fresh per-run metrics would coexist with the static reference — both remain until reconciled |

---

## 7. Current Reusable Assets (Section 1 inventory)

| Asset | System | Current status | Reusable by which model | Dependencies |
|---|---|---|---|---|
| Auth (signup/confirm/login/session) | B | REAL | A, B, C (all need identity) | Supabase Auth; proxy gating |
| Strategy templates (8 rows, schema-driven forms) | B | REAL as catalog; 5 have no engine | A (dispatch needed), B (rule sheet), C (param source for 3 models) | seed migration; engines for execution/backtest of only Donchian/SMA/RSI |
| User strategies | B | REAL storage, no consumer engine | A (would become engine input), B (rules for deviation — already consumed), C (possible param source) | bridge (A), rules authoring UI (B), param mapper (C) |
| Bitget integration (web, read-only) | B | REAL — 2-endpoint allowlist, verify+encrypt | B (core), A (paper stage needs no keys; live stage would need new endpoints — forbidden today) | lib/bitget.ts allowlist; PLAN §9 |
| Fill ingestion (daily-sync) | B | REAL daily import | B (core); A/C not dependent | CRON_SECRET, user keys, Bitget fills endpoint, 01:30 UTC cron |
| Deviation engine | B | REAL, narrow in active path (direction rule effectively) | B only | `user_trades` + `params`/`rules_json` |
| Discipline score (app + trigger) | B | REAL | B only | deviation_log; identical-formula invariant (web/AGENTS.md §7) |
| Dashboard (`/app/*`, `/papertrading`) | B | REAL (discipline + public paper views) | A (would add per-user results views), B, C (would add metrics view) | Supabase RLS reads |
| Stripe (checkout + webhook + plan columns) | B | PARTIAL — closed gate, entitlement unread | Any model that charges (A/C tiers would be new claims) | PAYMENTS_ENABLED decision; plan readers |
| Paper trading engine | A | REAL global; not per-user | A (core), internal validation for any model | config.yaml; SQLite schema is single-tenant; GH Actions |
| Backtest engine | A | REAL (3 models, local) | C (core), A (pre-run validation), research for all | committed CSVs; manual data refresh |
| Reports (`backtest/reports/*`) | A | REAL files in repo | C (would need per-user store), marketing numbers | `lib/backtest-reference.json` snapshot (canonical pending, README:94-100) |
| Telegram | A(+B claim) | REAL owner-only; user delivery ABSENT | B (if per-user alerts built), A ops | env chat ids; unwired alert path (trades:157-160) |
| GitHub Actions (4 workflows) | A | REAL — paper prod loop; daily-sync prod trigger; 2 manual tools | A (core scheduling), any model needing scheduled jobs | secrets; daily-sync failures currently swallowed (workflow:20) |
| SQLite + sync script | A | REAL, single-tenant, one-way mirror to Supabase | A (must adapt for multi-user), none needed for B/C | watermarks (script:164-172); paper-sync route |
| Supabase (schema/RLS/3 clients) | B | REAL, all tables RLS'd | A (would gain engine access — new trust decision), B, C (report store) | service role server-only; migrations |

---

## 8. Product Loop Maps (Section 2)

Statuses per stage: `EXISTING` / `PARTIAL` / `ABSENT` / `UNPROVEN`. Stages describe only
surfaces that exist in code — no marketing claims invented.

### Model A loop
| Stage | Status | Basis |
|---|---|---|
| Acquisition | EXISTING | Marketing pages exist (`/`, `/start`, `/pricing`, `/proof`, `/live`) |
| Signup | EXISTING | Supabase auth + confirm + login (callback/route.ts:26,36) |
| First value | **ABSENT** | No per-user execution exists — nothing runs a user's strategy (Phase 2D loop break) |
| Repeated value | **ABSENT** | No recurring per-user event exists (global paper runs are the owner's) |
| Retention mechanism | **ABSENT** | Nothing accumulates for the user from this loop |
| Paid feature | **UNPROVEN** | Paper Beta copy implies per-user paper/alerts (stripe.ts:19); no per-user automation code exists; entitlement unread |

### Model B loop
| Stage | Status | Basis |
|---|---|---|
| Acquisition | EXISTING | Same marketing surfaces; `/start` describes the watcher flow (:8-30) |
| Signup | EXISTING | Same auth stack |
| First value | **PARTIAL** | Pipeline is REAL but value appears only if the user *already trades on Bitget* (fills must exist): connect key → next 01:30 UTC sync → score. No value for a user without own fills (dashboard checklist stays incomplete, dashboard:26-29) |
| Repeated value | **PARTIAL** | Daily sync repeats automatically (workflow) and history accumulates — but insights are limited to score chart + deviation rows; no alerts |
| Retention mechanism | **PARTIAL** | Growing deviation/score history + checklist; no notification pulls the user back (alerts ABSENT for users) |
| Paid feature | **PARTIAL** | Claims exist and gate/waitlist infra exists (pricing:24-33,109-115; stripe.ts:14-27), delivery + entitlement ABSENT (§15) |

### Model C loop
| Stage | Status | Basis |
|---|---|---|
| Acquisition | EXISTING | Backtest referenced on marketing pages (10 files grep; ProofStrip/Methodology/`/proof` with honest "reference" label) |
| Signup | EXISTING | Same auth stack (would gate a C feature) |
| First value | **ABSENT** | No route/UI can trigger a run (§5); only static numbers are shown |
| Repeated value | **ABSENT** | No run exists to repeat |
| Retention mechanism | **ABSENT** | No saved runs/reports per user exist |
| Paid feature | **ABSENT** | No tier claims backtesting (pricing features lists, pricing:14-47) |

### Hybrid loops
Derived: any hybrid inherits the **strongest blocking stage of its weakest required
constituent** (e.g., A+C first value remains ABSENT until the A bridge or C job runner
exists; B+C first value is PARTIAL via B immediately, with C's first value ABSENT until a
runner exists). No combination improves a stage beyond what its parts contribute; not
ranked.

---

## 9. Technical Gap Analysis (Section 3)

Qualitative descriptions only; no numerical scores.

### Model A
| Capability | Existing | Missing | Complexity | Security impact | Dependency |
|---|---|---|---|---|---|
| Strategy bridge (SaaS→engine) | Nothing | Whole interface + param mapping | High — crosses two stacks and a trust boundary | Engine gains DB/job credentials | Prerequisite for everything in A |
| Per-user state | Single-tenant SQLite | user_id partitioning or new store + sync semantics | High — schema redesign, idempotency redesign | Cross-user data leakage risk if isolation wrong | Bridge |
| Strategy dispatch | Donchian only | Runner per template or explicit template limiting | Medium–High (5 templates have no engine at all) | Input validation of params into engine | Per-user state |
| Job/scheduling | One global cron | Queue/worker or per-user triggers, retries | High — new infra component | Job auth, abuse/quota control | Bridge |
| Per-user results UI | Global paper dashboard only | Views scoped to user results | Medium | RLS for new tables | State split |
| Alerts per user | Owner chat only | Per-user channel + delivery queue | Medium | Credential storage for chats | Results stream exists |
| Entitlement | None (plan unread) | Plan readers before charging | Low–Medium | Payment abuse if skipped | Any paid A claim |
| Live execution | Forbidden/absent (guards, allowlist, PLAN gate) | Order path, SL submission, reconciliation, PLAN §9 amendment, Fase 4 gates | Very high | Trading credentials become capability-bearing — highest-impact surface | Proven paper stage (explicit project gate) |

### Model B
| Capability | Existing | Missing | Complexity | Security impact | Dependency |
|---|---|---|---|---|---|
| Key connect + fill import | Full (verify/encrypt/daily fetch) | Multi-exchange abstraction; key revocation | Low for revocation; Medium for new venues | Credential handling already implemented; new venues expand allowlists | Nothing (works today) |
| Deviation breadth | 8 rules coded; ~1 effectively active | Context supply (equity/positions) or rule scoping; rules authoring UI | Medium — needs positions/equity reconstruction for sizing rules | Low (derived data) | Fills→positions model for the disabled rules |
| Multi-strategy attribution | Exactly-one guard (silent no-op otherwise) | Deterministic attribution or per-strategy fills | Medium | Low | Decision on strategy lifecycle (pause/edit API exists unused) |
| Alerts delivery | Dead path on uncalled route | Per-user chat binding + wired call in sync path + queue | Medium | Storing user chat ids; spam/abuse controls | Deviation stream (exists) |
| Insights beyond score | Score + rows + chart | Positions/PnL reconstruction for depth | Medium–High | Low | Fills model |
| Write-path tests | None | Fixture-based chain tests + smoke auth fix | Low–Medium | Test creds handling | Nothing |
| Entitlement | None | Plan readers + feature flags | Low–Medium | Payment bypass prevention | Sales intent decision |

### Model C
| Capability | Existing | Missing | Complexity | Security impact | Dependency |
|---|---|---|---|---|---|
| Backtest engine | Complete, tested (3 models) | Nothing in the math | — | — | — |
| Param surface | Template schemas exist | Schema→engine param mapper + validation | Medium | Untrusted params into computation (bounded input) | Implemented models only (3 of 8) |
| Job execution | Local CLI only | Queue/worker or bounded request policy + engine deployment | High (no Python service exists; Vercel can't run long jobs) | Job auth, resource exhaustion control | Param surface |
| Report persistence | Repo files, fixed paths | Per-user store + retrieval API + ownership checks | Medium | Cross-user report leakage if unscoped | Job results exist |
| Data refresh | Manual workflow, ~20-day-old CSVs | Scheduled fetch + freshness signaling | Low–Medium | None (public data) | Nothing |
| Metrics UI | Recharts exists for score/equity | Backtest results view | Medium | RLS for result tables | Report store |
| Entitlement | None | Gate before exposing compute | Low | Compute-cost abuse if open | Sales intent decision |

---

## 10. Multi-User Gap (Section 5)

What would have to change for **true multi-user** operation (principally Model A; B
is already per-user; C is per-user by statelessness):

| Dimension | Today | Required change |
|---|---|---|
| Process model | One global process per GH cron run over fixed config (paper-trading.yml:6-9, 38-42) | N user-runs: queue+worker, or batch loop over users inside one process with per-user isolation |
| Scheduling | Fixed 01:00 UTC daily, single job, concurrency-locked | Per-user cadence or on-demand triggers; backfill/retry semantics per user |
| State isolation | **None** — SQLite single tenant: one `paper_cash` (schema:4-7), `signals UNIQUE(candle_date,pair)` (:23) would wrongly dedupe across users on the same pair/date, `equity_log` one row per date (:67), `positions` no user column (:27-41), `sync_state` one stream (:77-80) | `user_id` partitioning everywhere (or per-user stores); idempotency keys must include user; sync watermarks per user |
| Database | SQLite single-writer file, committed to git as backup | Per-user DB files, or move state to Postgres with row-level tenancy; git-backup model stops scaling at N users |
| Risk isolation | One global risk config + one global equity (config.yaml:25-30) | Per-user equity, caps, circuit-breaker state; guard instances per user |
| Credentials | Engine uses **no credentials** (public data) | Paper stage: still none. Live stage: per-user order-capable keys — currently forbidden (allowlist lib/bitget.ts:6-9; PLAN §9) and would cross the highest-risk boundary |
| Failure isolation | Per-pair `try/except` continues (:549-552); crash alert to owner (:586-595) | Per-user failure isolation so one user's bad params/data can't abort others; per-user error visibility |
| Concurrency | GH Actions `concurrency` serializes globally; SQLite would lock under parallel writes | Queue with controlled parallelism; transactional state or sharded stores |
| Monitoring | Owner Telegram + workflow failure alert (yml:64-72) + stale flag on public dashboard | Per-user run status, user-facing failure signals, per-user alerting (chat credential storage) |

**Note:** Models B and C do not inherit most of this table — B is already per-user in
Supabase with RLS; C is stateless per run. The multi-user gap is almost entirely an
Model A cost.

---

## 11. Trust Boundaries (Section 6)

```text
Browser → Next.js → Supabase → Python → Exchange
```

### Which boundaries exist today
| Boundary | Exists? | Mechanism |
|---|---|---|
| Browser → Next.js | **Yes** | `proxy.ts` page gate (:34-51), per-route session checks, CSRF `validateOrigin` (csrf.ts:23-39), in-memory rate limits (rate-limit.ts:1-7), HSTS/CSP (next.config.ts:43-45) |
| Next.js → Supabase | **Yes** | 3 clients (cookie-session RLS / browser / service-role server-only), RLS on all 13 tables |
| Supabase → Python | **No** | No Supabase client in any `*.py`; the only cross-system motion is SQLite → HTTP → `/api/cron/paper-sync` (authenticated by CRON_SECRET), i.e., Python → Next.js → Supabase, one-way, global paper data only |
| Python → Exchange | **Yes, keyless** | Public ccxt market data only; no credentials in the engine (fetch_bitget_data.py, live_signal:116-126) |
| Next.js → Exchange | **Yes, read-only** | User key signed requests, closed 2-endpoint allowlist (bitget.ts:6-9), AES-GCM at rest, decrypt server-side only |
| Stripe → Next.js | **Yes** | Signature verification (webhooks:83-89) |
| Next.js → Telegram | **Yes, owner-only** | Bot token env; single chat (telegram.ts:4-5) |

### Boundaries that would have to be CREATED
- **Model A:** the Supabba→Python boundary does not exist — either the engine gains
  Supabase credentials (DB-read trust + egress policy) or a new authenticated job
  channel (SaaS→worker) is created; result write-back needs an authenticated reverse path.
  For live: Python→Exchange *authenticated order* boundary — explicitly forbidden today
  and gated by PLAN Fase 4. Per-user alerting: Next.js→Telegram with per-user chat
  credentials (new storage surface).
- **Model B:** boundary set is complete for its current loop. Additions only if scope
  grows: multi-exchange key providers (new allowlist entries — process-controlled by
  PLAN §9), per-user Telegram (chat-id storage), insights compute (derived-data only, low).
- **Model C:** a new Browser→Next.js→Job-runner boundary (job auth, quota), a new
  job-runner→Supabase result-write boundary (service credentials inside a Python worker),
  and per-user report read scoping. **No exchange-credential boundary is added** (public
  data).
- **Hybrids:** union of the above; A+B and A+C both introduce the engine↔Supabase/job
  channel; B+C introduces only the job channel without credentials.

---

## 12. Minimum Vertical Slices (Section 7)

Smallest end-to-end slice per model. Not implemented, not ranked.

### Model A slice
```text
one user → one strategy (their single Donchian template row)
        → one execution mode (daily paper, public market data, existing engine)
        → one result (their signals/positions/equity rows, user-scoped)
        → their dashboard section
```
- **Technically coherent:** reuses the engine's existing signal/fill/state logic and the
  dashboard's existing read pattern; the new parts are precisely the bridge, per-user state,
  and per-user read.
- **Testable:** extend the existing fake-exchange harness to a per-user state fixture;
  isolation tests (two users, same pair/date) are the critical new check.
- **Demonstrable:** a created strategy produces visible rows on the creator's dashboard.
- **Primarily existing code:** engine + templates + dashboard; new: bridge + state scoping.

### Model B slice
```text
one user → connects read-only Bitget key
        → one strategy (single active, direction rule)
        → one execution mode (existing 01:30 UTC fill import — no new runner)
        → one result (deviation row + discipline score visible next day)
        → dashboard
```
- **Technically coherent / primarily existing code:** every step already exists end-to-end
  (§4 table); no backend addition required.
- **Testable (the actual gap):** the chain currently has no automated test — a
  fixture-based test of sync→deviation→score is the missing piece for the slice to be
  provable.
- **Demonstrable:** requires a Bitget account with at least one fill on a configured pair.

### Model C slice
```text
one user → one strategy template (Donchian, 3 models exist)
        → one parameter set (validated against params_schema)
        → one backtest run (existing run_backtest over committed CSVs)
        → one result (compute_metrics output shown on a results view)
```
- **Technically coherent / testable:** math already tested (70-test suite); the new
  parts are job execution, param mapping, report persistence, and a results view.
- **Demonstrable:** metrics + report for a user-chosen parameter set.
- **Primarily existing code:** engine + templates + guardrails; new: runner + store + UI.

---

## 13. Premature Features (Section 8)

Features that are premature **before the respective core loop works**, each with its
technical dependency (no business judgment):

| Feature | Premature before… | Technical dependency |
|---|---|---|
| Multiple strategies per user (A) | Per-user state isolation exists | Current schema cannot isolate even one user's run (schema:1-80); dispatch exists only for Donchian |
| Live trading (A) | Per-user paper proven + PLAN Fase 4 gates passed | No order code exists; guards reject live (guards.py:56-57); allowlist forbids (bitget.ts:6-9); TASKS paper-gate unchecked; project rules require backtest+paper completion first |
| Advanced AI (any) | There is a signal path to filter | LLM filter is an always-pass skeleton behind `enabled: false` (filter.py:43-49; config.yaml:43); B has no signals (it analyzes fills); C has no run surface |
| Complex analytics / PnL (B) | Fills→positions reconstruction exists | `user_trades` is a fills log without exit/pnl columns (trades/route.ts:24; web/AGENTS.md §4) |
| Mobile app / social features (any) | The web core loop has a stable API surface | Multiple API routes today have zero callers (Phase 2D §9) — API shape unvalidated even on web |
| Advanced billing / opening all tiers (any) | Entitlement code reads `profiles.plan` | Plan is written by webhook and read by nothing — charging today would deliver no differential capability (§15) |
| Elaborate alerts (B) | A per-user delivery channel + wired call exist | Alert code exists only on an uncalled route to one global chat (trades:157-160; telegram.ts:4-5) |
| Backtest parameter marketplaces / 8-model backtesting (C) | Param mapper + implemented models exist | 5 of 8 templates have no engine (Phase 2D §4); running them is impossible |
| Concurrent multi-user backtests (C) | Job isolation + per-user output paths exist | `save_report` fixed paths collide across concurrent runs (run_backtest:231-235) |
| Live-data backtests (C) | Scheduled data refresh exists | Data fetch is manual-only (`fetch-bitget-data.yml` workflow_dispatch; CSVs 20 days old) |
| Multi-exchange support (B) | Key abstraction + allowlist process exist | Only Bitget allowlist endpoints exist; /start's "others coming" has no provider layer |
| Docker/VPS cutover (any) | A workload needs a always-on Python service | `deploy/` exists but is unused (README:41) — no runtime currently requires it |

---

## 14. Migration Impact (Section 9)

Classification only — `KEEP` / `ADAPT` / `ISOLATE` / `DEPRECATE` / `REPLACE`. Nothing is
actually changed.

### Under Model A
| Subsystem | Classification | Reason |
|---|---|---|
| backtest/ | ADAPT | Becomes pre-run validation; shares param mapper |
| paper_trading/live_signal.py | ADAPT | From global fixed-config to per-user input/state |
| SQLite + sync script | ADAPT (or REPLACE with Postgres state) | Single-tenant schema must gain tenancy; git-backup stops scaling |
| GH Actions paper workflow | ADAPT | From single global run to job-triggered or worker model |
| config.yaml | ADAPT | Demoted to defaults/globals; per-user params become input |
| CLI (watcher/doctor) | KEEP | Local ops tooling remains useful |
| risk_manager guards | ADAPT | Per-user instances; CircuitBreaker finally gains callers |
| llm_filter | ISOLATE (still dormant) | Disabled skeleton unchanged until a signal path exists |
| Next.js app + 14 routes | ADAPT | Add bridge/job endpoints; orphaned routes resolved later |
| Supabase schema/RLS | ADAPT | New per-user execution/result tables (future phase) |
| user_strategies/templates | ADAPT | Become engine inputs (param mapping required) |
| Fill ingestion / deviation / score | KEEP | Independent loop unaffected (unless A+B semantics merge streams — decision) |
| Dashboard | ADAPT | Add execution-results views |
| Marketing pages | KEEP (until claims reconciled — §15) | — |
| Stripe | KEEP + ADAPT (entitlement readers) | Only when automation becomes paid |
| Telegram | ADAPT | Owner ops + per-user delivery split |
| Tests (Python/Playwright/smoke) | ADAPT | Multi-tenant fixtures; write-path tests |
| deploy/ | ISOLATE | Needed only if/when a worker service exists |

### Under Model B
| Subsystem | Classification | Reason |
|---|---|---|
| backtest/, paper engine, CLI, GH paper workflow, SQLite, sync | **ISOLATE** | Internal research/validation assets; explicitly outside the product loop |
| config.yaml | ISOLATE | Engine-internal; irrelevant to B |
| Fill ingestion, deviation, score, dashboard, auth, keys | KEEP | The core loop |
| Orphaned API routes (`GET /api/strategies`, `/api/trades`, `/api/deviation-log`, `/api/discipline`, PUT/DELETE) | ADAPT | Either wired into UI or removed in a later implementation phase |
| Stripe | ADAPT | Entitlement + delivery before any paid claim |
| Telegram | ADAPT | Per-user binding for the paid alert claim |
| Tests | ADAPT | Add write-path/fixture chain tests; fix smoke blind spot |
| llm_filter, deploy/, Docker | ISOLATE (dormant) | Unused by B |

### Under Model C
| Subsystem | Classification | Reason |
|---|---|---|
| backtest/ + presets + research scripts | ADAPT | From CLI to job-run core |
| data fetch workflow | ADAPT | From manual to scheduled refresh (if user-facing freshness promised) |
| Reports dir | REPLACE (for product) | Repo files → per-user result store; repo reports can remain for research |
| config.yaml backtest block | ADAPT | Params come from request mapper; config as defaults |
| Paper engine + sync + paper_* | ISOLATE | Independent; could serve as internal validation only |
| Fill ingestion/deviation/score | KEEP | Independent loop (unless B retired — not assumed) |
| Dashboard | ADAPT | Add results view |
| Stripe | ADAPT | Only if C becomes a paid surface (no claim exists today) |
| GH paper workflow | KEEP or ISOLATE | Unaffected by C |
| Tests | ADAPT | Job isolation + param mapper tests |

### Under hybrids
Classifications are the union of the constituent models' tables; no hybrid gets a
*different* classification for any subsystem than the model it includes implies. A+B keeps
B's loop while adapting the engine; B+C isolates the engine entirely and adapts only the
backtest surface; A+C adapts both Python sides while the SaaS side changes little beyond
the param bridge; A+B+C applies all three.

---

## 15. Product Claims vs Code Reality (Section 10)

Evidence only — no copy rewritten, no judgment about messaging strategy.

| Implied product claim | Code reality | Evidence |
|---|---|---|
| Strategy creation implies working strategy automation ("New Strategy" flow; strategies list; empty-state "define your entry/exit rules… TrendSentry will check your trades") | Strategy persisted as config only; **no execution anywhere**; the checking claim itself is accurate but narrow (direction rule effectively) | strategies/new:110-123; no supabase in `*.py`; daily-sync:162-165, 192-194 |
| "8 strategies" (templates page renders 8 cards) | 3 have engines (backtest), 1 runs (paper, global), 4 have no implementation, Custom is unparsed text | seed 20260922120000; strategy.py:61-158; Phase 2D §4 |
| "Strategy templates (Donchian, SMA, RSI)" (Watcher feature) | Templates selectable/stored — but none *execute* for the user and backtest is not user-triggerable; the 3 named match the implemented engines | pricing:16; run_backtest:58-67; no route trigger |
| "Custom rule builder" (Watcher feature) | No builder UI exists; `rules_json` is API-only; some rule types never evaluated (no context) | pricing:17; strategies/new:116 sends no rules_json; deviation.ts:87-165 |
| "Auto-logging of every trade" (Watcher feature) | PARTIAL: Bitget **spot fills on 10 configured pairs**, imported **once daily** 01:30 UTC, attributed only with exactly one active strategy; other venues/pairs/times not covered | pricing:18; daily-sync:57-76, 162-165; lib/constants PAIRS; workflow 01:30 |
| "Deviation history dashboard" (Watcher feature) | Page exists and reads real rows; detection breadth narrow in practice | pricing:19; deviation-log:9-14 |
| "No time limit" (Watcher feature) | TRUE — no expiry enforcement exists anywhere (expiry set only for paid plans) | pricing:20; profiles.plan_expires_at only written by webhook |
| "Real-time deviation alerts (Telegram)" ($19 claim) | **Not delivered:** alert exists only inside uncalled `POST /api/trades`; daily-sync never alerts; single global chat, not per-user | stripe.ts:19; trades/route.ts:157-160 (zero callers); telegram.ts:4-5; daily-sync has no telegram import |
| "Discipline Benchmark" ($19 feature) | No implementation found anywhere (string appears only in feature copy) | stripe.ts:19; grep `benchmark` in app/lib = copy only |
| "Unlimited strategies" ($19 feature) | No free-tier strategy cap exists — free already equals unlimited; nothing to unlock | stripe.ts:19; no limit check in strategies/route.ts:19-47 |
| "Premium tiers unlock real-time alerts and the Discipline Benchmark" (pricing copy) | Both ABSENT as deliverables (above) | pricing:64; stripe.ts:19 |
| "Telegram the second you step outside your plan" (feature card) | ABSENT for users — same dead path; owner-only paper alerts exist | BentoFeatures.tsx:78; trades:157-160 |
| Paper Beta "SUBSCRIBE" button + "$19/mo" | Purchase path closed by default env gate (403 waitlist) + invite-only copy; even if opened, entitlement never applied | pricing:26,109-115; checkout/route.ts:38-40 |
| "Paid plan" generally | Infrastructure exists (checkout, signature-verified webhook, plan columns); **no feature reads plan** | webhooks:83-89; grep `.from("profiles")` read = none |
| Live Assist features: "Risk manager + circuit breaker", "Exchange-side stop orders", "Small-capital start ($50–100)" | ABSENT — no order code; CircuitBreaker unwired (test-only callers); labeled "COMING SOON" honestly on the page | pricing:35-47; guards.py:80-118 (grep callers = tests); bitget.ts:6-9 |
| "No leverage, no martingale — ever" | TRUE by absence — no leverage/martingale code exists; spot-clamped sizing | grep = none; strategy.py:82 (`max_units = equity / entry_price`) |
| "[ AI-AUGMENTED // DISCIPLINE LAYER ]" (hero) | The discipline layer contains zero AI — pure rule checks + arithmetic score | Hero.tsx:71; deviation.ts:54-214 |
| "✦ AI CURSOR" (hero) | No AI model invoked anywhere in the product path | Hero.tsx:59; llm_filter gated off |
| "LLM risk filter. AI sanity-checks valid signals…" (feature card) | Skeleton always returns pass; `enabled: false`; sole caller gated and unreachable in the product | BentoFeatures.tsx:103-105; filter.py:43-49; config.yaml:43; live_signal:487-505 |
| "AI" in README framing | README is honest ("not an AI trading bot… disabled skeleton") — claim matches code | README:11-13, 46 |
| Backtest metrics on marketing ("BACKTEST REFERENCE") | Static snapshot, honestly labeled as *reference*; engine not user-triggerable; README notes **two unreconciled metric snapshots** (+149.59%/−26.19% vs +152.0%/−26.45%) with canonical choice pending | reference.ts:1-24; proof/page.tsx; README:92-100; ARCHITECTURE §16 |
| Paper trading presented as a product surface (public dashboard, "the bot checks" copy) | REAL but it is **one global owner account**, not the visitor's; not startable/configurable by users | papertrading:17-46; live_signal config-driven; workflow 01:00 UTC |
| "REAL ACCOUNT // NOT LIVE" (`/live`) | Honest and matching: live ABSENT with four independent guards | live/page.tsx:10-35; guards.py:56-57; cli.py:41-47; bitget.ts:6-9 |
| README "What it actually does (CURRENT)" status table | Accurate per Phase 2D audit (component-by-component matches code) | README:16-45 |
| Onboarding promise `/start`: 4 templates, "others coming" (multi-exchange) | 4 ≠ DB's 8; multi-exchange has no provider layer | start/page.tsx:32-37; single allowlist in bitget.ts:6-9 |

---

## 16. Owner Decision Questions (Section 11)

Maximum 10. Concrete. **Not answered here.**

1. **Who is the primary user** — an active Bitget spot trader who wants oversight of
   their own execution, or a passive user who wants strategies executed on their behalf?
   (The two readings select disjoint subsystems as core.)
2. **What single action creates first value** for a newly signed-up user — connecting a
   key and seeing their own fills scored, creating a strategy that visibly runs, or
   running a backtest? (Determines which vertical slice in §12 is the product's first proof.)
3. **Is the product about executing strategies or analyzing the trader?** (Model A identity
   vs Model B identity — the repo currently supports only the second end-to-end.)
4. **Is paper trading a customer-facing product feature or an internal validation tool**
   for the owner's strategy? (Today it is de facto internal + public marketing surface.)
5. **Is live trading a near-term requirement** (next roadmap horizon)? If yes, the PLAN §9
   boundary, Fase 4 gates, and read-only allowlist become active design constraints
   immediately; if no, those stay frozen.
6. **Is backtesting user-facing**, or does it remain developer/research tooling with only
   static reference numbers shown publicly?
7. **Which subsystem becomes canonical for strategy configuration** — `config.yaml`
   (executes today) or Supabase `user_strategies` (stored today)? (Every model's bridge
   design depends on this answer — §2.1, §6.1.)
8. **Should the discipline score measure only the user's real fills**, or also/instead
   simulated engine output? (Determines whether the two trade streams may ever merge.)
9. **Are paid tiers intended to become sellable**, meaning entitlement + alert delivery
   get built first — or do they stay invite-only until a core loop is validated?
10. **Is Bitget-only scope acceptable for the near term**, or must multi-exchange
    abstraction come early? (The `/start` copy already implies "others coming".)

---

## 17. Neutral Decision Sequence (Section 12)

A sequence that applies **regardless of which model is chosen later**. No model is
selected; no winner is produced.

```text
Product identity
   └─ answer §16 Q1–Q3, Q4, Q6: which subject the product is about
        ↓
Core user loop
   └─ pick ONE loop from §8 and define its first-value moment (Q2);
      everything not on that loop is explicitly out of the first slice
        ↓
Canonical data model
   └─ resolve §2.1/§6.1: one canonical store per concern (strategy config,
      execution state, trade history, performance) BEFORE any bridge code;
      decide the trade-stream semantics (Q8)
        ↓
Vertical slice
   └─ build the smallest slice from §12 for the chosen loop only,
      using primarily existing code; add the missing tests first
      (the write-path/fixture gap noted in §9)
        ↓
Validation
   └─ owner-defined pass/fail criteria for the slice (measured by tests,
      observed usage, and the claim-vs-reality table §15 being brought in
      line with whatever the loop actually does)
        ↓
Expansion
   └─ features listed in §13 become eligible only after their stated
      technical dependency exists (multi-strategy, live, alerts depth,
      concurrent backtests, paid tiers, second exchange — in whatever
      order the validated loop demands)
```

Rules that hold under this sequence: entitlement code precedes any paid claim; a delivery
channel precedes any alert claim; per-user state precedes any multi-user feature; the
existing project gates (paper-before-live, frozen parameters, read-only allowlist) remain
in force until the owner explicitly amends them.

---

## 18. Evidence Index

**Python engine**
- `paper_trading/live_signal.py` — public-data exchange :116-126; cash ledger :61-73;
  equity :186-307; yield :129-183; `validate_config` call :312-319; live-stop :339-371;
  idempotency :391; exits :411-473; concurrency/cluster :476-485; LLM gate :487-505;
  entry/sizing/stop :507-538; per-pair error isolation :549-552; crash alert :586-595.
- `backtest/strategy.py` — Donchian :61-93; `position_size` :71-83; SMA :96-122; RSI :125-158.
- `backtest/run_backtest.py` — model select :52-68; simulation :71-179; metrics :182-228;
  `REPORT_SUBDIR` + report paths :231-277.
- `risk_manager/guards.py` — validate :16-72 (live rejection :56-57); `can_open_position`
  :75-77; `CircuitBreaker` :80-118 (callers = `tests/test_risk.py` only).
- `cli.py` — backtest/paper entry :29-30; live dry-run gate :41-47.
- `scripts/sync_paper_to_supabase.py` — payload :100-136; POST :145-153; watermarks :164-172.
- `db/schema.sql` :1-80 — single-tenant tables (meta :4-7; signals UNIQUE :23; positions
  no user :27-41; equity date PK :67; sync_state :77-80).
- `config.yaml` — strategy :4-23; risk :25-30; lookback :37; `llm_filter.enabled: false` :43.
- `llm_filter/filter.py` :43-49 (always-pass); `presets/*.yaml` (FROZEN headers).

**Web — routes & lib** (`monitoring/web/…`)
- `app/api/strategies/route.ts` :19-47, :51-127; `templates/route.ts` :7-17;
  `trades/route.ts` :24, :93-97, :157-160; `checkout/route.ts` :38-40;
  `webhooks/stripe/route.ts` :83-89, :93-142; `cron/daily-sync/route.ts` :57-76,
  :110-126, :141-190, :162-165, :192-241; `cron/paper-sync/route.ts` :20-30, :48-94;
  `api-keys/route.ts` :19-75; `account/password` + `account/delete` (re-auth, cascade).
- `lib/deviation.ts` :54-165, :167-214; `lib/stripe.ts` :14-27 (features lists);
  `lib/bitget.ts` :6-9, :30-37; `lib/encryption.ts` :3-66; `lib/csrf.ts` :23-39;
  `lib/rate-limit.ts` :1-7; `lib/telegram.ts` :4-5; `lib/reference.ts` :1-24;
  `lib/validations.ts` :33-63; `proxy.ts` :34-51; `next.config.ts` :43-45.
- Pages — `pricing/page.tsx` :7-49 (tier claims), :63-64 (unlock copy), :109-115
  (invite-only waitlist); `start/page.tsx` :8-37; `live/page.tsx` :10-35;
  `app/dashboard/page.tsx` :11-33; `app/app/strategies/page.tsx` :10-44;
  `app/app/strategies/new/page.tsx` :91-123, :155; `papertrading/page.tsx` :17-46;
  `papertrading/log/page.tsx` :125 (08:00 WIB sync claim);
  `components/marketing/Hero.tsx` :59, :71 (AI claims);
  `components/marketing/BentoFeatures.tsx` :78, :103-105 (alert + LLM claims).

**Supabase**
- `20260909120000_remote_schema.sql` (tables :19-151, RLS, handle_new_user :239-276);
  `20260909120001_add_stripe_columns.sql`; `20260910130000_add_paper_slippage_yield_tables.sql`;
  `20260911130000_metrics_referral_events.sql`; `20260912120000_harden_profiles_rls.sql`;
  `20260912130000_recalc_discipline_score_trigger.sql`; `20260922120000_insert_builtin_strategy_templates.sql`.

**Automation / data / tests / docs**
- `.github/workflows/paper-trading.yml` :6-9, :38-48, :50-59, :64-72;
  `trendsentry-daily-sync.yml` :6-20 (swallowed failure :20); `fetch-bitget-data.yml` :3-9
  (manual only); `test-bitget-api.yml` :6.
- `data/historical/` — 10 CSVs, **22,894 rows total** (`wc -l` this phase), mtimes
  2026-09-02 (manual refresh).
- `tests/` — 70 tests / 9 files (counts Phase 2D §14); `e2e/auth.spec.ts` (8),
  `e2e/free-tier-flow.spec.ts` :24-33, :172-183; `e2e/api-smoke-test.mjs` :92-100;
  `playwright.config.ts` :6-19.
- `README.md` :5-45 (honest status table), :60-100 (architecture, deployment, **canonical
  metric discrepancy pending** :94-100); `TASKS.md` (unchecked Fase 2 gate/3/4);
  `PLAN.md` :52-82; `ARCHITECTURE.md` §16.
- Phase 2D audit: `PHASE2D_PRODUCT_REALITY_AUDIT.md` (HEAD `91dbc07`) — reused findings
  marked as Phase 2D citations throughout.

---

## Appendix — Verification Results (Phase 2E run)

Per spec, verification is git-only (tests not rerun — not necessary to inspect behavior;
no test result is claimed or altered this phase):

| Command | Result |
|---|---|
| `git status --short` | `?? PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md` (this file — the only intended change) plus the 2 pre-existing untracked `backtest/reports/bh_*.md` (untouched) |
| `git diff --stat` | empty (no tracked file modified) |
| `git diff --check` | exit 0 (no whitespace errors) |

No code changed. No production access, no credentials, no production API calls, no
database mutations. The only file created this phase is
`PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md`.
