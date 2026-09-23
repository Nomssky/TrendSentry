# Phase 2F — Target Architecture & Vertical Slice Design

> **Scope:** DESIGN/AUDIT ONLY, on HEAD `bab8fae` (2026-09-24). The only repository change
> made by this phase is this file. No production access, no credentials, no live trading, no
> exchange write calls, no schema changes, no application code changes, no dependency changes,
> no config changes, no deletions, no refactoring, no migrations, no new tests, no push.
> All existing safety gates (PLAN.md §5/§9, Fase 4 gates, read-only Bitget allowlist,
> `validate_config` live rejection, `cli.py` dry-run refusal) remain **frozen constraints**.
>
> **Purpose:** answer *"If we started building the real TrendSentry product from the current
> repo, what architecture should we move toward, what is the smallest viable vertical slice,
> and how do we migrate from today's code without breaking existing research/paper
> functionality?"*
>
> **Inputs:** owner product decisions issued after Phase 2E (product identity = automated
> trading; primary user = passive operator; first value = create → deploy → run → monitor;
> paper engine stays internal; backtest stays internal; Supabase = canonical control plane
> for customer strategy config; trade streams stay separated; Bitget only; live trading =
> intended direction but gated; monetization = free self-hosted → paid managed VPS;
> first slice = small proven strategy subset, Donchian strongest candidate; AI/LLM not core
> MVP), plus `ARCHITECTURE.md`, `PHASE2D_PRODUCT_REALITY_AUDIT.md`,
> `PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md`, `PHASE2_SOURCE_OF_TRUTH.md`, `REPO_MAP.md`,
> `supabase/migrations/*`, Python engine files, and `monitoring/web/*` read this phase.
>
> **Labeling vocabulary used throughout:** `CURRENT` (exists in code today), `TARGET`
> (the direction this document defines), `REQUIRED BRIDGE` (the gap that must be built to
> get from CURRENT to TARGET), `FUTURE` (deliberately out of the next implementation phase).

---

## SECTION 1 — Executive Architecture Decision

**TrendSentry (TARGET) is an automated trading product:** a user configures a trading
strategy, deploys it, a trading runtime executes it, and the user monitors execution,
risk, and performance. The user does not manually trade each position to get core value.

The resulting target architecture, in concise form:

```text
Supabase = CONTROL PLANE (desired state: identity, entitlement, strategy definition,
            deployment intent/status, config versions, audit)
        │  (delivered as a versioned config bundle — NOT queried per tick)
        ▼
Trading RUNTIME = EXECUTION PLANE (market data, signals, local risk state, positions,
            idempotency, emergency stop; runs on self-hosted machine or managed VPS;
            Bitget ONLY; exchange writes stay GATED until the live-execution phase)
        │
        ▼
Trade events / results / health ──write-back──► Supabase ──► Dashboard + Alerts
```

| Concern | Label | Statement |
|---|---|---|
| What TrendSentry is | **TARGET** | Run-a-strategy-automatically + monitor-it product, with two deployment options: self-hosted and TrendSentry-managed VPS. |
| What is core | **TARGET** | Control plane (Supabase), deployment control, trading runtime, per-deployment state, results write-back, dashboard, alerts. |
| What is core **today** | **CURRENT** | Only two disconnected halves exist: (A) Python engine running ONE global owner account from `config.yaml` (GitHub Actions daily, SQLite, Telegram owner alerts, one-way sync to `paper_*`); (B) Next.js/Supabase SaaS with auth, strategy *storage*, read-only Bitget key vault, daily fill import, deviation detection, discipline score, dashboards. **Zero runtime connection between them** (no Supabase client in any `*.py`; Phase 2D §16 — the "strategy → signal" arrow is ABSENT for every user). |
| What is supporting infrastructure | **CURRENT + TARGET** | Backtest/research tooling (internal), global paper engine (internal validation), discipline/deviation analytics on the user's **real fills** (supporting capability, not the product core), public `/papertrading` dashboard (marketing + owner dogfood display), Stripe plumbing (gated, entitlement unread), Telegram (owner ops today; per-user delivery is a TARGET gap). |
| What is internal-only for now | **CURRENT** | `backtest/` + `presets/` + `backtest/research/` + `backtest/reports/`, `scripts/fetch_bitget_data.py`, `scripts/compare_live_vs_backtest.py` (Fase 2 gate tool), the **global** paper engine and its SQLite state, `llm_filter/` (disabled skeleton), `deploy/` (prepared, never built), CLI `backtest/paper/watcher/doctor`. |
| What is customer-facing now | **CURRENT** | Signup/login, create a strategy (persisted only — starts nothing), connect a read-only Bitget key, daily import of the user's own fills, deviation log, discipline score, public paper dashboard, settings (password/delete). Checkout exists but is closed (`PAYMENTS_ENABLED` gate, checkout/route.ts:38-40) and `profiles.plan` is read by nothing — **no paid entitlement is delivered today**. |
| What is future | **FUTURE** | Deployment control (self-hosted + managed VPS), per-user runtime and per-user results, per-user alert delivery, entitlement enforcement, customer-facing paper (optional, isolated from the internal engine), live execution (gated behind PLAN Fase 4 gates + dedicated safety phase — **not implemented here**), billing activation, backtesting-as-a-product (explicitly NOT built), AI/LLM central to product (explicitly NOT built). |

**Overselling guard (factual):** the current SaaS **cannot** deploy customer bots; live
trading is **not** implemented (four independent guards: guards.py:56-57, cli.py:41-47,
lib/bitget.ts:6-9, zero order code repo-wide); no customer runtime exists; no entitlement
enforcement exists. Nothing in this document changes those facts — it defines the requirements
to eventually reach them.

---

## SECTION 2 — Current → Target Architecture Map

Allowed actions: `KEEP` / `ADAPT` / `ISOLATE` / `DEPRECATE LATER` / `REPLACE LATER` /
`NEW COMPONENT`. **Nothing is deleted.**

| Existing subsystem | Current responsibility | Target responsibility | Action | Reason |
|---|---|---|---|---|
| `config.yaml` | Sole input of the executing engine; internal SoT for all strategy/risk/paper/backtest parameters (live_signal.py:49-51, run_backtest load_config) | Internal engine **defaults**, research, development, and the **internal** global paper engine; frozen presets stay anchored to it. **Not** the source of customer configuration | KEEP | Owner decision: Supabase becomes canonical for *customer* config; `config.yaml` remains useful for internal/research/dev/paper. Deleting it would break research and the internal engine. |
| `presets/` (3 frozen YAML) | Frozen parameter fixtures for backtest gate + tests (`test_presets`, `test_parameter_beku`) | Unchanged — research evidence and regression fixtures | KEEP | Frozen by test; provenance for published gate results. No target-state role beyond research. |
| `backtest/` (`strategy.py`, `run_backtest.py`, `research/`, `reports/`) | Local research engine (3 models), metrics, reports; manual runs only | Internal research infrastructure. `strategy.py` indicator/sizing functions are **reused by the target runtime** (single-source, as today between backtest and paper) | ISOLATE | Backtest stays internal per owner decision; not a SaaS loop. ISOLATE = outside the customer product loop, not deleted, not refactored here. |
| `paper_trading/` (`live_signal.py`) + `db/paper_trading.db` + `db/schema.sql` | ONE global owner paper account: daily GitHub Actions run, simulated fills, idempotent SQLite, Telegram alerts, one-way sync | (a) **unchanged** internal strategy-validation engine; (b) its signal/fill/state *pattern* (and `strategy.py`/`guards` it calls) becomes the blueprint for the per-deployment runtime — but the global account, its DB, and its schema are **not** reused as the customer store | ISOLATE (+ ADAPT pattern later) | Owner decision: do not turn the global paper engine into the customer-facing architecture; preserve internal engine uncorrupted. The single-tenant schema (meta single `paper_cash` :4-7, `signals UNIQUE(candle_date,pair)` :23, `equity_log` date PK :67, `sync_state` :77-80) cannot hold multiple tenants. |
| `risk_manager/` (`validate_config`, `CircuitBreaker`, `can_open_position`) | Startup config guardrail; CB + concurrency helper **implemented but runtime-unwired** (callers = tests only) | Same guardrail applied to **customer-supplied** instance configs at deploy validation; per-deployment risk instances; `CircuitBreaker` gains a real runtime caller before any live stage (PLAN Fase 4 requirement) | ADAPT | Validation becomes more important, not less: untrusted user params cross into a config-driven engine. Wiring CB to runtime is a MUST-FIX *before live*, not now. |
| `db/` (SQLite engine state) | Single-tenant paper state, committed to git daily as backup | Remains the **internal** paper store. Per-deployment runtime state is a separate per-deployment store (see §10 open decision: per-deployment SQLite vs Postgres) | ISOLATE | Git-committed single-file backup does not scale to N tenants; internal engine must keep working untouched. |
| `monitoring/web` (Next.js 16) | Customer-facing SaaS: auth, strategy CRUD (create/view), key vault, fill import, deviation, discipline, dashboards, 14 API routes, Stripe plumbing; **read-only display + product backend**, never an order path (permanent) | Control-plane UI + API: strategy definition, deployment intent/status, runtime health, per-deployment results views, alerts config; discipline views remain as supporting feature; **order path stays permanently forbidden** (PLAN §9, web/AGENTS.md §6) | ADAPT | Same app grows control-plane responsibilities; frontend stays display-layer per AGENTS.md §9 (new data → backend first). |
| Supabase (Postgres, 13 tables, RLS) | Product data SoT: identity, templates, user strategies, keys, fills, deviations, scores; mirror of paper data | **Canonical control plane**: + deployment records, desired-state/config versions, runtime health, audit events; existing tables keep their roles | ADAPT | Owner decision: Supabase = control plane / desired state. Additive evolution; existing RLS/migrations stay source of truth (`supabase/migrations/`). |
| `user_strategies` | Stored config with **no execution consumer** (Phase 2D §16 THE BREAK) | Customer **strategy instance** — the input to deployment once a param-mapping layer exists | ADAPT | Becomes engine input only via an explicit mapping layer (REQUIRED BRIDGE, §6); params shape must be normalized first. |
| `strategy_templates` (8 rows, canonical seed `20260922120000`) | Catalog for schema-driven forms; `template_id` stored, never dispatched; **3 have engines, 5 do not** (Phase 2D §4) | Catalog where **only implemented templates are deployable**; Donchian first; non-implemented templates marked non-deployable (not silently executable) | ADAPT | Owner decision: support a strategy abstraction but ship a small proven subset. Declaring 8 executable strategies would be false. |
| Bitget integration — web (`lib/bitget.ts`) | Closed 2-endpoint **read-only** allowlist; verify-on-submit; AES-GCM vault; daily fills | Unchanged for the control plane (fills/discipline). **No** write endpoint is ever added in this phase or the next implementation phase | KEEP | Frozen safety gate. Write capability is a FUTURE live-phase concern with its own dedicated design (§9, §21). |
| Bitget integration — engine (public ccxt, keyless) | Market data for paper + backtest + data fetch | Market data for the target runtime (still keyless at paper/simulated stage) | KEEP | The paper/simulated stage of any customer runtime needs only public data — already proven. |
| Stripe (`checkout`, `webhooks/stripe`, `lib/stripe.ts`, `profiles.plan`) | Checkout gated closed; webhook signature-verified; `profiles.plan` written, **read by nothing** | Entitlement SoT **when monetization activates**: plan readers gate managed-deployment features; feature copy must match delivered capability | ADAPT (+ FUTURE activation) | Owner decision: paid managed tier is the revenue direction — but entitlement enforcement must exist *before* any claim (invariant 16). No billing is implemented in this phase. |
| Telegram (`monitoring/telegram_alert.py`, `lib/telegram.ts`) | Owner-only ops alerts (paper ENTER/EXIT/STOP/crash, workflow failure); web alert path exists only on an uncalled route to one global chat (trades/route.ts:157-160, telegram.ts:4-5) | Split: **operator/owner ops channel** (keep) + **per-user delivery channel** (new, for deployment/status/result alerts) | ADAPT | Single env chat cannot serve N users; per-user alert delivery is a REQUIRED BRIDGE for the product loop, not a rewrite of existing alerts. |
| LLM filter (`llm_filter/filter.py`) | Disabled always-pass skeleton (`config.yaml:43` `enabled: false`) | Unchanged, dormant, outside the product core | ISOLATE | Owner decision: AI/LLM is NOT the core MVP; no architecture effort spent making it central. |
| Discipline / deviation engine (`lib/deviation.ts`, trigger `20260912130000`, `deviation_log`, `discipline_scores`) | Detects rule deviations on the user's **real fills**; dual-computed score (app + DB trigger) | Remains a **supporting capability operating on real user fills**; must never become the canonical performance system for automated bots; streams stay separated (§11) | KEEP (+ ADAPT semantics guard) | Owner decision: discipline/analytics may remain supporting; automated-bot performance is a different stream with a different SoT. |
| Backtest reports (`backtest/reports/*`, `lib/backtest-reference.json`) | Internal evidence + static marketing reference numbers; **two snapshots coexist, canonical choice pending** (ARCHITECTURE §16) | Unchanged internal evidence; marketing keeps honest "reference" labeling; canonical-metric decision stays OPEN (§19) | KEEP | Editing numbers before the owner decision is forbidden (Phase 2A §7.1). |
| Current paper sync (`scripts/sync_paper_to_supabase.py` → `/api/cron/paper-sync` → `paper_*`) | One-way incremental SQLite→Supabase mirror of the **global** account, watermark-after-200 | Unchanged for the internal engine + public dashboard. Per-deployment runtimes get their **own** results/status write-back path (validated like `PaperSyncSchema`, cap + column allowlist) | KEEP (+ NEW write-back for deployments) | The proven watermark/upsert pattern is reused conceptually; the internal stream is never merged with customer data. |
| Current API layer (14 routes + 2 auth routes) | Cron sync ×2, strategy/trades/templates/deviation/discipline CRUD (several orphaned), api-keys, prices, events, checkout/webhook, account | Control-plane endpoints: deployment lifecycle (create/pause/stop/status), config-version read, runtime heartbeat/status, per-deployment results read; orphaned routes resolved in a later implementation phase | ADAPT | Deployment intent must be written/read somewhere; new endpoints follow existing patterns (session+CSRF+Zod, or Bearer secret for machine callers). |
| GitHub Actions (`paper-trading.yml`, `trendsentry-daily-sync.yml`, `fetch-bitget-data.yml`, `test-bitget-api.yml`) | Daily global paper run (+test gate + DB commit + failure alert); daily fill-sync trigger (failure swallowed at :20); manual data tools | Internal loops keep running unchanged. Customer runtimes are NOT scheduled by these workflows (per-deployment scheduling belongs to the runtime host) | KEEP | These are internal infrastructure; overloading them for N tenants is exactly the single-cron limitation §10 documents. |
| `deploy/` (Dockerfiles, compose, backup/restore/migrate, RUNBOOK) | Prepared VPS/Coolify cutover, **never built** | Foundation for managed-VPS packaging (image + systemd + backup/restore scripts already sketched) | ADAPT (FUTURE execution) | Repo demonstrates intent and scripts; using them avoids inventing infrastructure the repo does not have (no Kubernetes). |
| `cli.py` | Local ops: backtest/paper/watcher/doctor; `live` refused without `--dry-run` | Self-hosted installation/runtime driver for the target; `live` refusal stays until the live phase | KEEP | Already the self-host-shaped entry point ("tanpa kustodian" — cli.py:10). |

---

## SECTION 3 — Target Logical Architecture

Conceptual diagram adapted to repository reality (labels: `CURRENT` / `TARGET` /
`REQUIRED BRIDGE` / `FUTURE`):

```text
                SUPABASE / CONTROL PLANE                      [CURRENT (tables) + TARGET (new)]
                         │
          ┌──────────────┼──────────────────────────┐
          │              │                          │
     User Account   Strategy Config          Deployment Desired State
   [CURRENT:       [CURRENT: user_strategies  [TARGET: deployment record,
    profiles/Auth]  + strategy_templates;      config version, desired status,
                   TARGET: versioned,          runtime health, audit events]
                   validated instance]                  │
          │              │                              │
          └──────────────┼──────────────────────────────┘
                         │
                  Deployment Control                     [TARGET — NEW COMPONENT]
            (validate → persist version → instruct runtime)
                         │
              ┌──────────┴──────────┐
              │                     │
        SELF-HOSTED              MANAGED VPS             [TARGET / FUTURE]
     (user's machine,         (TrendSentry VPS,
      keys stay local)         systemd + Docker)         ← PLAN §9 amendment needed
              └──────────┬──────────┘                    only for LIVE-stage key custody
                         │                                (§19 open decision 1)
                  TRADING RUNTIME = EXECUTION PLANE       [REQUIRED BRIDGE — nothing
                         │                                 runs a customer strategy today]
          ┌──────────────┼──────────────────┐
          │              │                  │
     Market Data     Strategy logic      Risk checks
   [CURRENT: public  [CURRENT: strategy.py [CURRENT: position_size,
    ccxt Bitget,      Donchian; ADAPT:      concurrency, cluster, guards;
    keyless]          param mapping from    TARGET: per-deployment instances,
                      instance → engine]    CB wired before live]
          │              │                  │
          └──────────────┼──────────────────┘
                         ▼
                    Execution
            [TARGET stage 1: SIMULATED/paper fills — safe, no exchange write
             FUTURE stage 2: live orders — GATED, dedicated phase, NOT here]
                         │
                       Bitget
            [stage 1: PUBLIC data only (no key)
             stage 2: FUTURE trade key — frozen gates, allowlist unchanged today]
                         │
                         ▼
                    Trade Events
              (signals, positions, fills, errors — local store FIRST,
               idempotent, per-deployment)                [REQUIRED BRIDGE]
                         │
          ┌──────────────┼──────────────────────┐
          │              │                      │
     Write-back      Monitoring/Health      Alerts
  [TARGET: validated  [TARGET: heartbeat,   [TARGET: per-user delivery;
   result/status      last signal/fill,      CURRENT: owner-only Telegram
   sync → Supabase]   error, emergency stop]  + workflow failure alert]
          │              │                      │
          └──────────────┼──────────────────────┘
                         ▼
                     Dashboard
        [CURRENT: discipline/fills + public paper pages
         TARGET: + per-deployment status, results, risk state]
```

**Boundary explanations:**

1. **Supabase / Control Plane** — owns *desired* state: who the user is, what strategy they
   defined, what should be running, which config version is current, what entitlement they
   hold, and an audit trail. It never computes trading decisions. `CURRENT`: identity,
   templates, strategies, keys, fills, scores, paper mirror already live here with RLS.
   `TARGET`: add deployment/config-version/health tables via future migrations (none in this
   phase).
2. **Deployment Control** — the component that turns desired state into a runnable package:
   validates the strategy instance against guardrails, snapshots it into a versioned config
   bundle, and instructs a runtime host to start/update/stop. `CURRENT`: **ABSENT** (creating
   a strategy starts nothing — Phase 2D §16). This is the single most important
   `REQUIRED BRIDGE`.
3. **Deployment targets (self-hosted / managed VPS)** — where runtimes physically execute
   (§8). `CURRENT`: only GitHub Actions running the owner's one global account; `deploy/`
   scripts prepared but never built.
4. **Trading Runtime / Execution Plane** — a per-deployment process that reads a config
   bundle, fetches public market data, computes signals with the *existing* strategy
   functions, applies risk checks, records state locally and idempotently, and writes results
   back. `CURRENT`: the pattern exists once, globally, in `live_signal.py`;
   `REQUIRED BRIDGE`: make it input-driven and per-deployment instead of `config.yaml`-bound
   and singleton.
5. **Execution (simulated vs live)** — `TARGET` stage 1 executes in simulated/paper mode
   (needs no exchange key, therefore no custody question). `FUTURE` stage 2 (live orders) is
   out of scope here and stays behind the frozen gates.
6. **Trade events → Dashboard/Alerts** — one-way validated write-back (reusing the proven
   `PaperSyncSchema`-style cap + column-allowlist pattern), never direct ad-hoc writes from
   the runtime into arbitrary tables.
7. **What does NOT exist and is not invented here:** message bus, queue, Kubernetes,
   microservices, event sourcing. The repo's proven transport is *HTTPS + shared secret +
   incremental sync* (`sync_paper_to_supabase.py` → `/api/cron/paper-sync`) — the target
   reuses that shape.

---

## SECTION 4 — Control Plane vs Execution Plane

### Control plane (Supabase — `TARGET`)

| Item | Verdict | Evidence / reasoning |
|---|---|---|
| User identity | **IN** — `CURRENT` already | Supabase Auth + `profiles` (remote_schema:19-23, handle_new_user trigger) |
| Subscription/entitlement | **IN** — `CURRENT` partially | `profiles.plan` columns exist (migration `20260909120001`), written by webhook, **read by nothing** — becomes real when plan readers gate deployments |
| Strategy definition & parameters | **IN** — `CURRENT` storage, `TARGET` canonical | `user_strategies` + `strategy_templates` already here; owner decision makes this the customer SoT; `config.yaml` demoted to internal defaults |
| Deployment intent | **IN** — `TARGET`, `ABSENT` today | "Should this strategy be running, paused, stopped" is desired state; nothing models it today |
| Deployment status (desired vs observed) | **IN** — `TARGET` | lifecycle states (§5); `CURRENT`: no such concept anywhere |
| Engine/runtime version | **IN** — `TARGET` | which runtime build a deployment should run; needed for support/rollback |
| Runtime health (heartbeat, last-seen) | **IN** — summary form, `TARGET` | coarse liveness belongs in control plane for dashboard; **fine-grained** state stays local (below) |
| Alert configuration | **IN** — `TARGET` | who to notify, by what channel; `CURRENT`: one env chat, not per-user |
| Audit events | **IN** — `TARGET` | who changed which config version when; config changes must be versioned/auditable (invariant 15) |

### Execution plane (trading runtime — `REQUIRED BRIDGE`)

| Item | Verdict | Evidence / reasoning |
|---|---|---|
| Market data (OHLCV/tickers/order book) | **LOCAL** | Already fetched keyless inside the engine (live_signal fetch path); high-frequency, ephemeral |
| Current position | **LOCAL first** | SQLite `positions` pattern (db/schema.sql:27-41); authoritative locally, summarized on write-back |
| Local orders / order attempts | **LOCAL** | Idempotency + retry state must survive restarts without a network round-trip (§17 #8) |
| Local risk state | **LOCAL** | open counts, cluster counts, per-deployment equity/cash, circuit-breaker state — must be consistent within one run |
| Signal state (last processed candle, decisions) | **LOCAL** | `signals UNIQUE(candle_date,pair)` idempotency (schema.sql:23) — the proven anti-double-processing key |
| Exchange connectivity state | **LOCAL** (reported coarsely) | retry/backoff decisions are runtime-internal (fetch_retry ×3 pattern) |
| Execution retries / idempotency keys | **LOCAL** | must be atomic with the state they protect |
| Emergency stop / kill-switch state | **LOCAL, fail-safe** | on split from control plane the runtime must be able to stop **without** contacting it (§17 #12) |

### Why the execution engine must NOT depend on Supabase for every trading decision

1. **Availability coupling:** a control-plane outage (Supabase/Vercel/network) would then
   become a trading outage. Decisions on 1d candles are local facts (closed candle + local
   position state); requiring a per-decision RPC converts an observability dependency into a
   correctness dependency.
2. **Atomicity:** signal → risk check → position update → cash update must be one
   consistent local transaction (the SQLite pattern proves this). Split across HTTP calls you
   get partial execution with no way to roll back (§17 #9).
3. **Latency & cost:** fine-grained polling per tick is the only "alternative" and is both
   wasteful and still not a transaction boundary.
4. **Blast radius:** control-plane compromise should be limited to *what should run*, never
   to *how a run executes mid-flight* (§9).
5. **Precedent:** the repo already separates planes this way — the engine never reads
   Supabase today and still functions; sync is asynchronous and watermark-based.

**Design rule (`TARGET`):** the runtime consumes a **versioned config bundle** (§7), keeps
all decision state locally, and exchanges only *desired state in* and *status/results out*
with the control plane at low frequency.

---

## SECTION 5 — Customer Strategy Lifecycle

`TARGET` state machine (adapted from the proposed DRAFT→FAILED flow to fit the two-plane
model — strategy authoring happens in the control plane; RUNNING health is co-owned):

```text
DRAFT ──► VALIDATED ──► READY ──► DEPLOYING ──► RUNNING ⇄ PAUSED
                                            │        │
                                            ▼        ▼
                                          FAILED   STOPPED (terminal-ish; can REDEPLOY → DEPLOYING)
```

| State | Who can transition | System that owns it | Meaning |
|---|---|---|---|
| DRAFT | User | Control plane | Strategy instance being authored; not yet checked against engine capability |
| VALIDATED | Control plane (automatic on save/submit) | Control plane | Params pass `params_schema` + guardrails (`GUARDRAILS`: long_only, risk ≤1%, max ≤5 — validations.ts:33-37) **and** the engine-side envelope (`validate_config` semantics: risk 0..1, max 1..5, cluster 1..5, ATR mult >0, mode≠live, exchange=bitget, direction=long_only — guards.py:16-72) |
| READY | User (explicit action) | Control plane | Validated + versioned (immutable config version created); eligible for deployment |
| DEPLOYING | User requests; Deployment Control executes | Control plane observes, runtime host acts | Bundle delivered, runtime starting; idempotent (duplicate deploy command = same version, §17 #7) |
| RUNNING | Runtime reports heartbeat | Runtime is authoritative for liveness; control plane records it | Runtime alive, processing, reporting status |
| PAUSED | User | Control plane (desired) + runtime (applies) | Stop opening new positions / stop processing, keep state; resume → DEPLOYING with same or new version |
| STOPPED | User | Control plane | Runtime shut down, state persisted; no processing |
| FAILED | Runtime / Deployment Control | Runtime reports, control plane records | Crash, repeated heartbeat loss, config rejected at startup, or exchange unreachable beyond policy |

**Transition rules and failure semantics:**

- **Who may transition:** only the owner-user (via session+CSRF routes) for
  DRAFT/VALIDATED/READY/PAUSED/STOPPED; DEPLOYING/RUNNING/FAILED transitions are written by
  the deployment-control/runtime machinery (machine auth, not user session). Users never
  write runtime-owned columns directly (RLS scoping, mirroring existing `*_self` policies).
- **If deployment fails** (bundle won't load, validation fails at runtime start, process
  won't stay up): state → **FAILED** with a machine-readable reason; control plane shows it;
  retrying = user/system re-enters DEPLOYING with the same config version (idempotent). A
  failed deploy never affects any other tenant's deployment (§10).
- **If the control plane becomes unavailable:** **RUNNING runtimes keep running** on their
  last applied config bundle (this is the entire point of §4/§7). Status write-backs queue
  locally and flush on recovery (watermark pattern). No *new* deploys/pauses/stops can be
  requested until it recovers — dashboard shows "control plane unreachable", not "strategy
  stopped".
- **If the exchange (Bitget) becomes unavailable:** runtime retries with the existing
  backoff pattern, marks market-data freshness stale (§16), **does not act on stale data**
  (current engine already refuses to chase stale candles — live_signal:380-384), keeps last
  known position state, alerts on persistent failure. In stage 1 (simulated) the only cost is
  a missed signal day, recorded as a gap — exactly how the internal engine treats downtime.
- **Emergency stop** is a local runtime capability (FUTURE wiring, §21): it transitions to
  FAILED/STOPPED **locally** even with no control-plane connectivity.

`CURRENT`: none of these states exist — `user_strategies.is_active` has a flag and an
orphaned PUT/DELETE API but no transitions, no deployment, no runtime (Phase 2D §18).
`FUTURE`: PAUSED→RUNNING with a *new* config version must record which version was live when
(invariant 15).

---

## SECTION 6 — Strategy Model

### Conceptual structure (`TARGET`)

```text
Strategy Template            (catalog: identity, params_schema, capability flag)
      │  instantiate + validate
      ▼
User Strategy Instance       (user's named configuration: template_id, params, rules)
      │  version + deploy        ← creates immutable Config Version N
      ▼
Deployment                   (binding instance ↔ runtime host ↔ desired status)
      │  run
      ▼
Runtime                      (applies Config Version N; reports applied_version)
```

- **Template** answers *what kind of strategy and what parameters are legal*.
- **Instance** answers *this user's choices*.
- **Deployment** answers *should/where is it running* (a paused instance has no active
  deployment effect; one instance could later have self-hosted OR managed deployment —
  exactly one active deployment per instance in the first slice).
- **Runtime** answers *what is actually executing right now* (instance version + host +
  health).

### Where the current artifacts fit

| Current artifact | Role in target model | Notes |
|---|---|---|
| `strategy_templates` (8 rows, seed `20260922120000`) | **Template** catalog — keep as-is structurally | Must gain (conceptually) a **capability marker**: Donchian = executable; SMA/RSI = backtest-only; Bollinger/MACD/Ichimoku/VWAP/Custom = **not implementable today** (0 implementation hits — Phase 2D §4). Non-executable templates stay browsable but are **not deployable**; silently declaring them executable is forbidden. |
| `user_strategies` (`params` jsonb, `rules_json` jsonb) | **User Strategy Instance** | `rules_json` currently feeds only the deviation checker (`parseRules`); instance `params` feed nothing executable. Both get explicit per-template meaning. |
| `config.yaml` | **Template defaults + internal engine config**, NOT customer instance storage | Remains SoT for the internal paper engine, backtest, and dev defaults (owner decision). Customer instances must never write it. |
| `presets/*.yaml` | Research fixtures pinned to `config.yaml` (frozen) | No customer role; frozen by tests. |

### Parameter-shape inconsistency (the real problem)

Four different shapes exist today for "strategy parameters":

1. `config.yaml` `strategy.*` — flat keys (`donchian_entry_period`, `donchian_exit_period`,
   `atr_period`, `atr_stop_multiplier`, `pairs`, `timeframe`,
   `max_positions_per_cluster`) + `risk.*`.
2. `presets/*.yaml` — overlays of (1), frozen.
3. `strategy_templates.params_schema` — JSON-schema with **different names** for the same
   concepts: `entry_period` / `exit_period` (template) vs `donchian_entry_period` /
   `donchian_exit_period` (engine); `max_concurrent` vs `max_concurrent_positions`.
4. `user_strategies.params` — an instance dict validated only by zod `record()` +
   `checkStrategyGuardrails` (which checks just `direction`, `risk_per_trade_pct`,
   `max_concurrent` — validations.ts:40-63), plus `rules_json` for deviation rules.

**Do NOT build a universal abstraction** (owner instruction + YAGNI). The **minimum
abstraction for the first vertical slice** is exactly one mapper:

```text
DonchianInstanceParams {
  entry_period, exit_period, atr_period, atr_stop_multiplier,
  risk_per_trade_pct, max_concurrent
}
        │  map + validate (guards.validate_config envelope applied to the mapped dict)
        ▼
engine config dict { strategy: {...}, risk: {...}, backtest: {...}, execution: {mode:"paper", exchange:"bitget"} }
```

- The mapper is a **REQUIRED BRIDGE** component with one job: template-specific translation
  + running the existing `validate_config` on the result. It lives where untrusted input
  crosses into engine semantics (deployment validation).
- `pairs`/`timeframe` in the first slice come from **server-side defaults** (reusing the
  current 10-pair universe), not from free user input — one less shape to design, and the
  pair-universe drift risk (config.yaml ↔ constants.ts, Phase 2A §1) is not multiplied.
- Adding a second strategy later = a second mapper, not a general framework.

---

## SECTION 7 — Runtime Configuration Delivery

### Problem restated

```text
Supabase desired configuration  ──??──►  Python trading runtime
without: Python → Supabase on every tick/candle.
```

### Options evaluated (conceptually)

| Option | How it works | Pros | Cons | Fit for this repo |
|---|---|---|---|---|
| **A. Startup snapshot** | Runtime fetches full config bundle at process start; runs on it until restart | Simplest; zero steady-state coupling; matches current engine (read config once per run, live_signal.py:311) | Config changes need a restart/re-run to apply; stale if control plane changes mid-run | **Excellent** — the engine is *already* a run-once-daily process; one run = one config version is the natural unit |
| **B. Signed / versioned config bundle** | Bundle carries version id (+ optionally signature) | Auditability (which version ran when), rollback, integrity | Signature infra = more machinery; versioning alone gives most of the benefit | Versioning: **yes (adopt)**. Signing: defer — the transport is already authenticated HTTPS with a shared secret (existing sync pattern); signature is defense-in-depth, not MVP |
| **C. Polling** | Runtime periodically GETs desired state | Applies changes without full restart; simple | A poll loop in a long-running process; still needs safe application semantics | Useful **only for desired-status signals** (pause/stop/new version available), at low frequency — not per decision |
| **D. Event-driven control** (webhook/queue/push) | Control plane pushes commands | Fastest application | Requires an always-reachable endpoint per runtime, inbound auth, delivery semantics — **new infrastructure the repo does not have** (no queue exists) | Rejected for MVP |
| **E. Local configuration cache** | Bundle persisted on disk; runtime boots from cache when offline | Survives control-plane outage; enables A/C hybrid | Needs cache invalidation rules | **Adopt as the companion to A**: last-known-good bundle on disk is what keeps RUNNING runtimes running during a control-plane outage (§5) |

### Chosen design (smallest reliable, `TARGET`)

**Startup snapshot + last-known-good local cache + low-frequency desired-status poll:**

```text
1. Deployment Control validates instance → writes Config Version N to control plane.
2. Runtime host starts/updates runtime with (deployment_id, control-plane endpoint, machine credential).
3. Runtime STARTUP: fetch bundle N → persist locally (last-known-good) → run validate_config → RUNNING.
4. During a run: NO control-plane reads. All decisions local (signals, risk, fills, idempotency).
5. Between runs (daily cadence): low-frequency poll of desired status only
   (RUNNING | PAUSED | STOPPED | version changed?) — same shape as existing cron+Bearer calls.
6. Version change detected → apply at RUN BOUNDARY (next run start), never mid-run.
7. Control plane unreachable → keep running on cached bundle; queue status/results; flush on recovery.
8. Heartbeat/status write-back: one validated POST per run (cap + column allowlist, PaperSyncSchema pattern).
```

**Why this and not something fancier:**
- The strategy cadence is **1d candles** (config `timeframe: "1d"`); staleness tolerance is
  ~a day, so poll-at-run-boundary is more than sufficient — a per-minute event system would
  add failure modes for zero decision-quality gain.
- It reuses two **proven repo patterns** instead of inventing infra: read-once-per-run
  config (`load_config`), and authenticated incremental sync with watermark-after-success
  (`sync_paper_to_supabase.py:164-172`).
- It preserves the invariant that a control-plane outage degrades *manageability*, never
  *trading correctness* (§4).
- `ponytail:` ceiling — applying a config change only at run boundaries means a user's
  "pause now" takes effect on the next poll/run rather than instantly; upgrade path is a
  finer-grained in-run status check or a signal file watched by the process, if instant
  pause ever becomes a real requirement.

---

## SECTION 8 — Deployment Model

Both targets run the **same runtime artifact**; they differ only in who operates the host.

### A. Self-hosted (`TARGET`, lowest custody risk — aligns with PLAN §9 as written)

| Aspect | Design (conceptual) |
|---|---|
| Installation | Repo/CLI-based: the existing `cli.py` + engine already form a local installer surface (`doctor` checks deps/config/db — cli.py:99-149). `TARGET`: a `deploy`-ish command or documented steps that fetch the runtime package and register the deployment (deployment_id + machine credential) with the control plane. No new packaging system in the repo exists — start from what `cli.py`/`requirements-engine.txt`/`Dockerfile.engine` already provide. |
| Configuration | Runtime pulls the versioned bundle (§7); local `config.yaml` remains internal defaults. User does **not** hand-edit strategy params for a deployed strategy. |
| Credentials | **User's machine, user's `.env`** — consistent with PLAN §9 rule 2 ("key exchange hanya hidup di `.env` mesin user"). Stage 1 needs **no exchange key at all** (public data + simulated fills). |
| Update mechanism | Version reported by runtime; control plane flags available version; user approves/`cli` updates (git pull / package update). Rollback = reinstall previous version; state schema is append-mostly and versioned. |
| Health reporting | Heartbeat POST with last signal/fill/error + applied config version (§16). If the user's machine is off, heartbeat stops → dashboard shows "runtime offline", **not** strategy failure. |
| Local persistence | Per-deployment SQLite file (same engineering shape as `db/paper_trading.db`, but per-deployment — never the shared file, §10). |
| Failure behavior | Process crash → local state intact (idempotency makes restart safe); OS-level restart (systemd/cron) optional on user side; control plane only ever sees stale heartbeat. No cross-tenant blast radius (there is no other tenant on that machine). |

### B. Managed VPS (`FUTURE` provisioning, `TARGET` architecture defined here)

Prefer **simple infrastructure** — the repo already sketches exactly this in `deploy/`
(Dockerfile.engine, Dockerfile.web, docker-compose, backup/restore/migrate scripts,
RUNBOOK with systemd timers); RUNBOOK §4 confirms images were never built. **No
Kubernetes** (§13).

| Aspect | Design (conceptual) |
|---|---|
| Provisioning | A small pool of VPS (per RUNBOOK: single Ubuntu VPS + Docker + Coolify-style orchestration is the documented comfort level). Start: **one VPS, process/container per deployment**, not per-customer VMs (cost/complexity); split later only if isolation demands it (open decision §19 #10). |
| Deployment | Deployment Control renders bundle + systemd unit (or `docker run` of `Dockerfile.engine` with the bundle mounted) → start. Mirrors RUNBOOK §4's systemd-timer pattern (`docker exec engine python ...`) but per deployment with per-deployment env/state paths. |
| Isolation | Per deployment: separate OS process, separate working dir, separate SQLite state file, resource limits (memory/CPU caps), no shared writable state. Failure of one process must not touch another (§10). Container-per-deployment via the existing Dockerfile is the natural boundary; compose-per-deployment is acceptable at small N. |
| Credential handling | **Stage 1 (simulated): no user exchange keys on the VPS at all** — public data only. Read-only keys (if ever needed for a managed feature) stay in Supabase (AES-GCM, server-side only — existing pattern). **Trade-capable keys on TrendSentry infrastructure (live stage) is EXPLICITLY an open decision** conflicting with PLAN §9 rule 2 as written (§19 #1). |
| Updates | Pin runtime version per deployment (control plane records engine version — §4). Roll out by restarting units with the new image; staggered, one deployment at a time at first. Rollback = previous image + previous config version. |
| Monitoring | Heartbeats → control plane health table → operator view (§16 split: operator/debug vs customer status). Owner-level Telegram alerts stay as the ops channel (existing pattern). |
| Restart | Supervised restart (systemd `Restart=on-failure` / container restart policy); idempotent engine makes crash-restart safe (existing daily-run idempotency). Restart storms → mark FAILED after N attempts (§17 #4). |
| Failure recovery | State files are per-deployment; backup/restore per `deploy/backup.sh`/`restore.sh` **pattern** generalized to per-deployment state; VPS loss ⇒ redeploy runtime with same config version; local (authoritative) state recovered from last backup + re-synced write-backs (watermark makes re-send safe). |

**Explicitly not designed:** orchestrators, service meshes, autoscaling, multi-region,
custom control-plane daemons — no repository evidence of need (Phase 2E §13: even the
current Docker stack was never built).

---

## SECTION 9 — Security / Trust Boundary

```text
User browser ──► Supabase/control plane ──► Deployment control ──► Trading runtime ──► Bitget
     │                  │                         │                      │             │
 session+CSRF        RLS + service role       machine creds        runtime host        public API today
                                            (scoped per deploy)   + local state      (write: FUTURE, gated)
```

| Component | May trust | Must never trust | Secrets it holds | Secrets reaching the browser? | Compromise consequence + mitigation |
|---|---|---|---|---|---|
| **User browser** | Its own session cookie; public data | Nothing else; all inputs are untrusted | None (session only) | **NEVER** — no exchange key, no service-role key, no machine credential, no ENCRYPTION_KEY (pattern already holds today: keys are metadata-only on GET) | Session theft = account actions as user; CSRF origin allowlist + re-auth on sensitive account actions (existing) bound the blast radius to that user's rows (RLS) |
| **Supabase (control plane)** | Its own RLS + Auth; service role only server-side | Browser-supplied values beyond validated schemas; runtime-reported data is *observed*, never *desired* | Service-role key (Vercel env), `ENCRYPTION_KEY` (read-only key ciphertext), future machine credentials | Never — service role is server-only (`lib/supabase/admin.ts` rule) | **Control-plane compromise** ⇒ attacker can alter *desired state* (deploy/pause, config versions). **Mitigation required by design:** (a) runtime enforces the immutable guardrail envelope regardless of bundle content — `validate_config` rejects `mode=live`, `exchange!=bitget`, `direction!=long_only`, risk>1%, max>5 (guards.py:29-70); (b) config changes versioned/auditable (invariant 15); (c) runtime write-back is validated server-side (schema caps/allowlist) so forged results don't silently poison dashboards; (d) stage-1 runtimes hold **no exchange keys**, so control-plane compromise cannot move funds pre-live |
| **TrendSentry backend (Next.js)** | Supabase via 3 scoped clients; Stripe via signature | Any client-supplied origin not on allowlist; raw secrets in responses | Service role, `ENCRYPTION_KEY`, `CRON_SECRET`, Stripe secrets (env — existing) | Never — GET routes return metadata only (api-keys pattern) | Server compromise = same as control plane + key-vault ciphertext exposure; rotate `ENCRYPTION_KEY`/`CRON_SECRET`/Stripe (documented rotation practice already exists: SECURITY-ACTIONS.md) |
| **Deployment control** | Control-plane service role or scoped token; runtime machine identities | Runtime-supplied status as authority over desired state | Machine credentials (issued per deployment; FUTURE) | Never | Compromise ⇒ mass deploy/pause of runtimes, but **not** fund movement in stage 1 (no keys) and **not** guardrail escape (runtime-side `validate_config` is the second gate) |
| **Trading runtime** | Its control-plane endpoint (TLS + machine cred); Bitget **public** API | Anything user-controlled outside its validated bundle; nothing from other deployments | Stage 1: none. Self-hosted live (FUTURE): user's own key in local `.env`. Managed live (FUTURE, open decision): trade key — **only if PLAN §9 is explicitly amended by owner** | Never — runtime config/secrets are host-local files, not web-exposed | **Runtime compromise (stage 1)** ⇒ attacker gets a machine credential + fake-result ability (mitigated by server-side write-back validation) + no funds. **Managed-live runtime compromise** is the highest-impact event in the system ⇒ per-deployment isolation, trade-no-withdraw key, IP whitelist, kill-switch — all FUTURE, dedicated-phase requirements (PLAN §3 envelope), frozen until then |
| **Bitget credentials** | The exchange | — | Self-hosted: user `.env` only (PLAN §9 rule 2). Read-only keys: Supabase ciphertext, server-side decrypt only (existing) | **Never** | Key permissions (FUTURE live stage, stated as requirement not implemented): trade **without** withdraw, IP-whitelisted, small balance; today's read-only web allowlist (`USER_KEY_READ_ENDPOINTS`, bitget.ts:6-9) is **frozen** — adding any order/transfer/withdraw endpoint requires explicit PLAN §9 amendment (code comment bitget.ts:3-5) |
| **Bitget API** | Signed requests from the above | — | — | — | Exchange outage/unavailability handled as §17 #2; read-only permission cannot be *enforced* (Bitget has no permission-read endpoint — documented caveat bitget.ts:30-37) |

**Frozen boundary statement:** current read-only restrictions and all four live gates remain
exactly as they are through this phase and the next implementation phase. This document
*describes* requirements before live can be enabled (§21 "IMPLEMENT LATER": order idempotency,
exchange-side stop verification, reconciler, CB wiring, entitlement, gates passed); it
creates **no** capability.

---

## SECTION 10 — Multi-Tenant Model

### Why the current Python engine is effectively single-tenant (exact reasons)

From `db/schema.sql` and the engine — structural, not incidental:

1. **One identity:** no `user_id`/tenant column anywhere in the SQLite schema
   (meta :4-7, signals :11-24, positions :27-41, equity_log :66-72, sync_state :77-80).
2. **One cash pot:** `meta` holds a single `paper_cash` key (engine `get_cash`/`set_cash`,
   live_signal:61-73) — two tenants would share one balance ledger.
3. **Idempotency key collides across tenants:** `signals UNIQUE(candle_date, pair)` — two
   users running BTC/USDT on the same date would silently dedupe into **one** signal
   (Phase 2E §10).
4. **One equity history:** `equity_log.date PRIMARY KEY` — one row per date globally.
5. **One position pool:** `positions` has no tenant column; `SELECT ... WHERE pair=? AND
   status='open'` (live_signal:404-407) would find another tenant's position.
6. **One sync stream:** `sync_state` watermarks are global — the mirror assumes one dataset.
7. **One schedule:** a single GitHub cron (`0 1 * * *`) with global `concurrency:` lock —
   no queue, no per-tenant trigger (workflows are single-account by construction).
8. **One failure domain:** per-pair `try/except` (live_signal:549-552) isolates pairs, not
   tenants; the process serves exactly one config read at startup (load_config :49-51).
9. **Git-as-backup:** the daily `git add -f db/paper_trading.db` backup model does not scale
   to N concurrently-written state files.

### Target tenant boundary

```text
User (Supabase Auth / profiles)
  └── Strategy instance (user_strategies, user_id already present)
        └── Deployment (1 active per instance in slice 1; owns config version + desired status)
              └── Runtime (1 process per deployment; owns local state; reports applied_version)
                    └── Exchange account (FUTURE live binding; stage 1 = none / simulated)
```

Why a `user_id` added to current SQLite is **not** sufficient:

| Dimension | Why naive `user_id` fails | Target requirement |
|---|---|---|
| Concurrent users | SQLite single-writer file + global cron serialization; git-commit backup conflicts | Per-deployment state file (or Postgres rows keyed by deployment — open decision §19 #4); schedulers independent per runtime |
| Multiple strategies | Engine reads ONE config per process; cluster/concurrency caps are global (`n_open` counts all rows) | Caps/cluster counts computed **within** a deployment's state only; first slice = one instance per deployment |
| Multiple deployments | No deployment concept; `sync_state` single stream | Watermarks/write-backs keyed per deployment |
| Multiple exchange accounts | No account binding; engine keyless | FUTURE: deployment ↔ account binding, one active account per deployment |
| Position isolation | `positions` lookup by pair only | All state queries scoped by deployment; isolation test = two deployments, same pair, same date (the critical new test, Phase 2E §12) |
| Signal uniqueness | `UNIQUE(candle_date,pair)` is global | Uniqueness within `(deployment_id, candle_date, pair)` |
| Equity history | `equity_log` date PK | `(deployment_id, date)` |
| Job scheduling | One cron, concurrency-locked | Each runtime schedules itself (host cron/systemd timer) or is run on-demand; control plane never assumes a global tick |
| Logs | One process log stream | Per-deployment log separation + aggregation only for operators (§16) |
| Alerts | One env chat (telegram.ts:4-5) | Alert routing keyed by user/deployment (control-plane alert config, §4) |

**Boundary rule (`TARGET`):** every runtime state artifact and every write-back carries
`deployment_id`; every control-plane row carries `user_id`; the dashboard joins
user → deployment → results under RLS. This is design only — **no schema is changed in this
phase.**

---

## SECTION 11 — Data Ownership / Source of Truth

| Data | Current SoT | Target SoT | Owner | Notes |
|---|---|---|---|---|
| Users | Supabase Auth + `profiles` | Unchanged | Supabase | `CURRENT` |
| Plans/entitlement | `profiles.plan` (written by webhook, **read by nobody**) | `profiles.plan` **+ plan readers** in control-plane APIs | Supabase | `TARGET`: enforcement must exist before any paid claim (invariant 16); not built in this phase |
| Strategy templates | `strategy_templates` (canonical seed `20260922120000`) | Unchanged + capability flag (deployable or not) | Supabase | Forward-only migrations remain SoT |
| User strategies | `user_strategies` (storage only) | `user_strategies` = canonical **customer instance** + immutable config versions derived at deploy | Supabase | `TARGET`: versioning added; `config.yaml` not involved |
| Deployment state | **Nowhere** (ABSENT) | New control-plane tables (deployment, desired status, applied version, health) | Supabase | `REQUIRED BRIDGE` |
| Desired configuration | `config.yaml` (engine) / `user_strategies` (dead storage) — split | Supabase config versions (customer) ; `config.yaml` (internal engine only) | Supabase for customer; repo for internal | The split itself is the resolution of Phase 2E Q7 per owner decision |
| Runtime state | SQLite `db/paper_trading.db` (global account) | **Local per-deployment store = SoT while running**; summarized outward by write-back | Runtime host | Never Supabase-SoT for in-flight decisions (§4) |
| Signals | SQLite `signals` → mirrored `paper_signals` | Per-deployment local signals; customer-facing projections in control plane | Runtime → Supabase projection | Mirror stays one-way |
| Orders | **None exist** (no order code — Phase 2D §7) | FUTURE: local order journal → (live phase) exchange reconciliation | Runtime | Not built; frozen gates |
| Fills | Real user fills: `user_trades` (daily-sync from Bitget) | Unchanged for **manual/real** stream; automated-stream fills are a **separate** record in per-deployment state | Supabase (manual) / Runtime (automated, projected) | Owner decision: streams logically separate |
| Positions | Global paper: SQLite → `paper_positions` | Internal paper unchanged; customer automated positions = per-deployment, projected | Runtime | No merging with `user_trades` |
| P/L | Paper: SQLite `equity_log` → `paper_equity_log`. User: **no PnL model** (fills log has no pnl/exit cols) | Per-deployment equity history `(deployment_id, date)` | Runtime → projection | Discipline score stays a *separate* notion (not PnL) |
| Paper trades (internal) | SQLite → `paper_*` | Unchanged | Engine | `KEEP` |
| Discipline data | `deviation_log`, `discipline_scores` (dual formula: TS + trigger) | Unchanged, **operates on real user fills only** | Supabase | Must not absorb automated/paper fills (owner decision); parity risk of dual formula stays documented (Phase 2A §2b) |
| Backtest results | `backtest/reports/*` (repo) + `lib/backtest-reference.json` (web copy) | Unchanged (internal) | Repo | Canonical snapshot decision still OPEN (§19 #2) — do not "reconcile" unilaterally |
| Alerts | Owner Telegram (env) + workflow failure alert; user alerts ABSENT | Operator channel unchanged + per-user alert records/config in control plane | Runtime/Control plane | Delivery to users is a `REQUIRED BRIDGE` before any alert-based claim |
| Billing | Stripe webhook → `profiles.plan` columns | Unchanged until entitlement readers exist | Supabase (+ Stripe external) | `FUTURE` activation; no billing built here |
| Runtime health | **Nowhere** (dashboard stale-flag only, papertrading:36-39) | Control plane (heartbeat summary), detail local | Control plane projection | New but small |

**What must NOT be duplicated unnecessarily:**

- **Strategy config:** exactly one customer SoT (Supabase config versions). `config.yaml`
  must never mirror customer instances; the engine never reads `user_strategies` directly —
  it reads the *bundle produced from* it (one derivation, versioned, not two live copies).
- **Guardrail bounds:** the numeric envelope (risk ≤1%, max ≤5, long-only) already lives in
  ≥3 places (`guards.validate_config`, `GUARDRAILS`, template seed) — Phase 2A §2a calls
  this intentional defense-in-depth. Do **not** add a fourth *independent* copy; new layers
  must call the existing validators (web: `checkStrategyGuardrails`, runtime:
  `validate_config`).
- **Pair universe / constants:** already duplicated (config.yaml ↔ `lib/constants.ts`) with
  documented drift risk — the first slice takes pairs from server defaults to avoid a third
  copy.
- **Trade streams:** paper ≠ automated-live ≠ manual-real — three streams, three
  projections, never merged into `user_trades` (which is defined as real fills,
  trades/route.ts:24).
- **Equity/performance:** automated performance SoT = per-deployment runtime; the discipline
  score SoT = Supabase; do not present either as the other (invariant: labels by source).

---

## SECTION 12 — First Production Vertical Slice

**Slice thesis (owner first-value loop):** *one user, one Donchian strategy, one
deployment, simulated execution stage, visible results and status.*

```text
Signup                        [EXISTS — Supabase Auth + proxy gating]
  ↓
Create one strategy           [EXISTS — template form + POST /api/strategies + guardrails]
  (Donchian template only — the one with a real engine)
  ↓
Configure risk                [EXISTS — params + GUARDRAILS (long_only, ≤1%, ≤5)]
  ↓
Validate configuration        [PARTIAL → REQUIRED BRIDGE: run the Donchian param mapper
                               + engine validate_config against the instance at deploy time]
  ↓
Deploy                        [ABSENT → NEW: deployment record + config version in control
                               plane + runtime host instruction]
  ↓
Runtime starts                [ABSENT → REQUIRED BRIDGE: input-driven runtime process;
                               reads versioned bundle + local cache (§7)]
  ↓
Market data                   [EXISTS — public ccxt Bitget, keyless]
  ↓
Signal                        [EXISTS — backtest/strategy.py Donchian, shared single source]
  ↓
Risk check                    [EXISTS — position_size, max_concurrent, cluster cap,
                               mandatory ATR stop; validate_config envelope]
  ↓
Paper/safe validation stage   [EXISTS as pattern (simulated fills in live_signal) → ADAPT:
                               per-deployment simulated execution, isolated from the
                               internal global engine and its state]
  ↓
Execution architecture ready  [DESIGN-ONLY now: interface + journal shape defined so a later
                               live phase can slot in; NO order code, NO write permissions,
                               NO allowlist change, gates frozen]
  ↓
Trade event                   [EXISTS as pattern (row + Telegram) → NEW: validated write-back
                               of signals/positions/equity/status to control plane]
  ↓
Dashboard                     [EXISTS read patterns + RLS → NEW: per-deployment status,
                               applied config version, positions, equity views]
  ↓
Alert                         [EXISTS infra (Telegram, workflow alerts) → NEW: per-user
                               delivery for lifecycle events (deployed/failed/paused)]
```

### Exact MVP boundaries

**IN (implementable in the first implementation phase, no live trading anywhere):**

1. One template deployable: **Donchian Breakout** (engine exists in both backtest and
   paper paths — Phase 2D §4). SMA/RSI remain backtest-only; the other five remain
   non-deployable.
2. One execution mode: **simulated/paper fills** — public data, no exchange key, no
   custody question, mirrors the proven daily engine semantics (closed-candle only,
   idempotency, fee+slippage assumptions, mandatory stop).
3. One deployment per strategy instance; single runtime process per deployment; daily
   cadence (1d timeframe, 10-pair server defaults).
4. Control plane: deployment lifecycle states (§5), config versioning (§7), heartbeat/status.
5. Runtime: input-driven config, local per-deployment state, `validate_config` as second
   gate, local emergency-stop *state* recorded (wiring to a global kill-switch = later).
6. Results: validated write-back → per-deployment views on the dashboard + at least one
   per-user alert path for lifecycle failures.
7. Isolation proof: the two-deployments-same-pair-same-date test must pass before anything
   else ships (Phase 2E §12).

**OUT of the MVP (explicitly):** live orders of any kind; exchange write permissions;
managed VPS GA (self-hosted/manual-host runtime first proves the loop; managed packaging
follows in a later migration); billing activation; per-user Telegram chat binding at scale
(one delivery channel is enough for the slice); multi-strategy portfolios; customer
backtesting; LLM anything; edit/pause UI beyond what the lifecycle needs (though the
orphaned PUT/DELETE API becomes the natural implementation point for PAUSE/STOP).

**Revenue adjacency (honest framing):** the slice proves the product loop. Whether the
*pre-live* slice (simulated execution) is sold, or revenue begins only after the live gate
passes, is an owner decision recorded in §19 #3 — this document does **not** claim the
slice itself is sellable, and no paid entitlement may be advertised before plan readers and
delivery exist (invariant 16).

---

## SECTION 13 — What NOT to Build Yet

Evidence-backed exclusions (Phase 2E §13 + owner decisions + repo state):

| Not now | Repository evidence / reason |
|---|---|
| 8 executable strategy templates | 5 of 8 have **zero** implementation (Phase 2D §4 matrix); one proven strategy beats eight nominal ones (owner decision, invariant 9) |
| Multi-exchange support | Only Bitget exists anywhere (allowlist, engine, data); `/start` "others coming" copy has no provider layer — owner decision: Bitget only, no speculative abstraction (Phase 2E §13) |
| LLM-centric trading / advanced AI optimization | Always-pass skeleton behind `enabled: false` (filter.py:43-49, config.yaml:43); owner decision: AI is not the core MVP |
| Kubernetes / orchestration platform | `deploy/` never even built a Docker image (RUNBOOK §4); managed model needs systemd+Docker at most (§8) |
| Complex event bus / queue / microservices | No queue exists; proven transport = HTTPS+secret+watermark sync; Phase 2E §11 lists these as *created* boundaries with real cost |
| Customer backtesting SaaS | Zero API/UI/job-runner/report-store surface (Phase 2E §5); owner decision: backtest stays internal this phase |
| Advanced social/community features | No stable product API even on web; several routes have zero callers (Phase 2D §9) |
| Complicated analytics / PnL dashboards for user's own account | `user_trades` is a fills log with no position/PnL model (trades/route.ts:24) — rebuild scope not needed for the automation loop |
| Live execution before its dedicated safety phase | Zero order code + four independent guards; frozen (AGENTS.md #3, PLAN §9/Fase 4 gates) — this document adds no capability |
| Billing activation / paid claims | `profiles.plan` read by nothing; claimed paid features undelivered (Phase 2D §11) — entitlement readers must precede any claim |
| Instant event-driven config push | §7: run-boundary application is sufficient for 1d cadence; upgrade path noted |
| Per-customer VM fleet / autoscaling | Single-VPS process-per-deployment suffices until isolation evidence demands more (§8, §19 #10) |
| Discipline-centric redesign | Product identity is automation (owner decision); discipline stays supporting, not core |

---

## SECTION 14 — Migration Plan

Nothing below is implemented in this phase. Each migration is additive-first and keeps the
running system running.

### Migration 1 — Foundation
*Prerequisite:* owner answers §19 #1 (PLAN §9 managed-custody conflict scope) and #5
(template deployability policy) — documentation/decision only.
*Work:* control-plane schema additions (deployment table, config versions, health/audit —
future migrations in `supabase/migrations/`, forward-only); capability flags on templates
(Donchian deployable / others not); reconcile product copy so nothing implies deployment
exists yet.
*Risk:* low — additive tables with RLS; unused-table sprawl if stalled.
*Rollback:* stop using; tables are inert (service-role-only writes, no readers yet).
*Unchanged:* engine, paper workflow, backtests, dashboard, sync, all gates, all tests.

### Migration 2 — Customer strategy control plane
*Prerequisite:* Migration 1; Donchian param mapping spec (§6) written as a tested contract
(web-side).
*Work:* strategy instance → validated + **versioned** config version; wire the existing
orphaned `PUT/DELETE /api/strategies` into real lifecycle actions (edit/pause); enforce
"only deployable templates selectable for deployment"; validation = existing web guardrails
+ the mapped `validate_config` envelope.
*Risk:* param-shape mistranslation (entry_period ↔ donchian_entry_period) — mitigated by a
single explicit mapper + tests; drift vs `config.yaml` defaults.
*Rollback:* instances remain storage-only exactly as today; versioning is additive metadata.
*Unchanged:* engine execution (still reads `config.yaml`), paper, backtest, discipline loop,
templates seed.

### Migration 3 — Runtime bridge
*Prerequisite:* Migration 2; tenancy decision §19 #4; §7 delivery design confirmed.
*Work:* input-driven runtime (new component reusing `strategy.py` + `guards` — **not** a
rewrite of `live_signal.py`); versioned bundle fetch + local cache; per-deployment local
state schema (deployment-scoped keys, §10); validated status/results write-back endpoint
(`PaperSyncSchema` pattern: caps + column allowlist + machine auth).
*Risk:* **highest migration** — new state semantics; idempotency keys must be redesigned
per-deployment; must not disturb the global engine (it keeps its own files/schedule).
*Rollback:* runtimes are new components — disabling them changes nothing for existing users
(who have none); write-back endpoint unused → inert.
*Unchanged:* global paper workflow + sync + `paper_*`; backtests; discipline loop; web
auth/RLS; all gates.

### Migration 4 — Per-user paper/simulation
*Prerequisite:* Migration 3 + passing isolation proof (two deployments, same pair/date;
cross-tenant caps; failure isolation).
*Work:* simulated fills per deployment (fee/stop/gap semantics ported from the proven
engine); per-deployment equity/positions projections; dashboard views for "my deployment";
**stream separation enforced** (automated-simulated rows never enter `user_trades` or
discipline); gap/stale indicators per deployment.
*Risk:* subtle isolation bugs (shared default pair universe makes collisions likely by
design — that is the point of the isolation test); performance noise misread as product
quality.
*Rollback:* hide views + stop write-back ingestion; internal paper untouched throughout.
*Unchanged:* internal global paper engine and its public dashboard; real-fill discipline
pipeline; backtest reports.

### Migration 5 — Deployment
*Prerequisite:* Migration 4 loop demonstrated on a manually hosted runtime; §19 #6
(entitlement packaging) decided before any paid surface; PLAN §9 amendment **only needed
for live-stage key custody** (stage-1 managed runtimes hold no keys — §8).
*Work:* self-hosted path first (CLI/docs + machine credential + heartbeat); then managed
VPS (per-`deploy/` scripts: image, systemd supervision, backup/restore generalized,
operator health view, restart policy); alert routing per user.
*Risk:* operational (state backup/restore correctness — "a backup never restored is not a
backup", RUNBOOK §5); support load from heartbeat gaps mistaken for failures (UI must
distinguish offline host vs FAILED strategy).
*Rollback:* self-hosted users unaffected by managed removal; managed runtimes stopped →
state preserved → resume with same config version.
*Unchanged:* engine logic, internal paper, discipline, backtest, gates.

### Migration 6 — Live-execution readiness (design + gate verification only until its own phase)
*Prerequisite:* PLAN Fase 2 gate evidence (≥10 closed trades, 8 weeks — TASKS/AGENTS
gates); §19 #1 PLAN §9 amendment if managed custody proceeds; entitlement live; all
MUST-FIX-before-live items in §18; dedicated live-execution design phase.
*Work (requirements, NOT implementation here):* order path with idempotency keys + local
order journal; exchange-side stop verification (PLAN §3 envelope: programmatic
`stopLossPrice` check + dust test in dry-run); reconciler (15-min, separate from daily
signal run); `CircuitBreaker` wired into runtime with manual-resume; dry-run mode =
full code path + paper money; trade-no-withdraw key + IP whitelist + $50–100 capital;
allowlist/PLAN amendments made **explicitly by owner**, never implicitly.
*Risk:* highest in the system — fund loss, compliance, custody.
*Rollback:* `execution.mode` stays `paper`; gates are one-way evidence-based, not config
flips done casually.
*Unchanged:* everything until the dedicated phase passes its own gates.

---

## SECTION 15 — Revenue Path

Factual mapping of the intended funnel to existing systems. **Nothing below is claimed to
exist unless marked `CURRENT`.**

```text
Free / self-hosted
   │  engine + CLI + docs:           CURRENT (cli.py backtest/paper/watcher/doctor, engine, presets)
   │  deploy-a-strategy self-hosted:  TARGET (Migrations 1–4 + self-hosted path of Migration 5)
   ▼
Paid / managed deployment
   │  entitlement gate:              REQUIRED BRIDGE — profiles.plan exists but is read by
   │                                  nothing (Phase 2D §11); plan readers + honest copy first
   │  checkout machinery:            CURRENT but CLOSED (PAYMENTS_ENABLED gate,
   │                                  checkout:38-40; not even in .env.example)
   │  what is actually delivered:    depends on Migrations 3–5 (none exist today)
   ▼
VPS
   │  scripts + runbook:             CURRENT-as-artifacts (deploy/* prepared, NEVER BUILT,
   │                                  RUNBOOK §4); provisioning/operating = Migration 5 TARGET
   ▼
Monitoring
   │  operator-only:                 CURRENT (owner Telegram, workflow failure alert, stale flag)
   │  customer-facing status:        TARGET (heartbeat, §16) — ABSENT today
   ▼
Alerts
   │  owner ops:                     CURRENT
   │  per-user delivery:             REQUIRED BRIDGE (single global chat today, telegram.ts:4-5;
   │                                  deviation alert path on an uncalled route)
   ▼
Operational convenience (updates, restart, backup/restore, support)
                                   FUTURE (Migration 5) — deploy/backup.sh|restore.sh|RUNBOOK
                                   are the prepared pattern; never executed
```

**Absent pieces that gate any paid claim (all `REQUIRED BRIDGE`):** entitlement readers;
per-deployment monitoring; per-user alert delivery; a delivery surface that actually runs a
customer's strategy (today: **nothing does** — Phase 2D §16). Existing Stripe plan copy
(`STRIPE_PLANS` features: Telegram alerts, Discipline Benchmark, Unlimited strategies —
stripe.ts:19,25) describes capability that is absent or unwired; before monetization, copy
must be rebuilt around what the managed-deployment tier truly delivers (invariant 16).
Billing itself is **not implemented in Phase 2F** and no paid entitlement is advertised by
this document. The PLAN §9 historical model (paid LLM filter) is superseded as *direction*
by the owner's post-2E decision (managed deployment) — the PLAN text amendment itself is an
owner action (§19 #1 covers the custody conflict; the pricing-model text conflict should be
resolved in the same amendment).

---

## SECTION 16 — Observability Requirements

What must **eventually** be observable for an automated trading system. Split as required:

| Signal | Customer-facing status | Operator/debug information |
|---|---|---|
| Runtime alive/dead | "Running / Offline / Failed" + last heartbeat time | Restart attempts, exit codes, crash traces, host metrics |
| Exchange connectivity | "Market data: OK / Degraded" (no raw errors) | Retry counts, HTTP/ccxt error codes, backoff timeline |
| Market-data freshness | Last candle processed date; stale indicator (pattern exists: >30h flag, papertrading:36-39) | Fetch latency, per-pair gap log (current `signals` gap rows = precedent) |
| Last signal | Latest decision per pair (pattern exists: watcher table, cli.py:72-81) | Full indicator inputs (don_hi/don_lo/atr) for anti-look-ahead audit (pattern exists: `signals.reason`) |
| Last order attempt | Stage 1: "n/a (simulated)" — shown honestly | FUTURE live: order journal (idempotency key, attempt #, exchange response) |
| Last fill | Fill row in per-deployment results | Fill id, slippage vs assumption (pattern: `slippage_log`) |
| Open position | Positions table + risk_amount | Full position ledger incl. exit reasons (pattern: `positions`) |
| Current risk state | Open count vs cap; "risk envelope: OK" | Cash/equity ledger, cluster counts, CB state (tripped/baseline) |
| Strategy version | Human name + "config vN since <date>" (invariant 15) | Bundle hash, mapper output, `validate_config` result |
| Configuration version | Same as above (customer) | Diff vs previous version, audit actor |
| Deployment version (engine build) | "Engine 1.2.3" in support view | Full build/commit, host OS, Python/deps |
| Error state | Last error summary + since when | Stack traces, per-pair skip reasons (pattern: live_signal:549-552) |
| Emergency stop state | Big, unambiguous "EMERGENCY STOP — paused" | Who/what tripped it, equity at trip, reset actor (mirrors CB manual-resume design) |

`CURRENT`: only fragments exist (owner Telegram, workflow failure alert, stale flag, local
`watcher`). Everything in the table is `TARGET` for the runtime/control-plane build;
none is built in this phase.

---

## SECTION 17 — Failure Scenarios

| # | Failure | Detection | Safe behavior | Recovery | Data consistency |
|---|---|---|---|---|---|
| 1 | Supabase unavailable | Fetch/poll errors at startup or run boundary | RUNNING runtime continues on last-known-good bundle (§7); queue write-backs locally; no mid-run dependency | On recovery: flush queued status/results via watermark-style resend (advance-only-after-success, precedent sync:164-172) | Local state authoritative during outage; projections converge after flush; no partial writes (single-writer local store) |
| 2 | Bitget unavailable | Existing fetch_retry ×3 + backoff (live_signal:98-113) fails | Stage 1: skip run with recorded gap, alert; **never act on stale data** (closed-candle rule :380-384); positions untouched | Next run processes only the newest closed candle (current anti-stale-chase policy: gaps logged, not backfilled for signals) | Idempotency key means a re-run cannot double-process; gaps visible in signal history |
| 3 | Market data stale | Freshness check: last candle older than expected window (stale flag pattern) | Mark market-data "Degraded"; do not generate signals from stale bars; open positions keep last-known stops | Data catches up → freshness returns; missed days remain visible as gaps | No synthetic fills from stale prices; equity snapshot reflects last valid marks |
| 4 | Runtime crashes | Heartbeat stops; supervisor exit detection (systemd/container policy) | Local state intact (WAL-style SQLite precedent); restart re-reads bundle; idempotency makes re-run safe | Auto-restart; repeated failures → FAILED + customer alert (restart-storm cap) | Signals/positions unique keys prevent double inserts; cash/equity upserts are idempotent (precedent: equity date PK, yield UNIQUE date) |
| 5 | VPS restarts | Same as #4, plus host boot supervision | Systemd/container brings runtimes back; no manual intervention; state on persistent disk | Automatic; if state volume lost → restore from backup (deploy/restore.sh pattern) then re-flush write-backs | Backup/restore is per-deployment; watermarks make re-sync idempotent |
| 6 | Config changes while runtime active | Version poll at run boundary (§7 step 5) | Changes apply **only at run boundary**, never mid-run; active run finishes on version N | Next run starts on version N+1, reports `applied_version` | Config versions immutable; audit records who/when; mid-run state belongs to N (invariant 15) |
| 7 | Duplicate deployment command | Same deployment_id + version already applied | Idempotent: second command recognizes applied version → no-op (state machine in DEPLOYING/RUNNING) | None needed; audit logs both attempts | One runtime per deployment enforced; no double-start |
| 8 | Duplicate order request | FUTURE live concern — local order journal + idempotency key (invariant 14) | Stage 1 N/A (simulated fills are locally idempotent by candle key). Live design: never retry without key reconciliation against exchange state | Reconciler (15-min, PLAN §3 envelope) resolves unknowns | Journal is SoT for attempts; exchange is SoT for truth; both recorded |
| 9 | Partial execution | FUTURE live: fill quantity ≠ requested; mid-run crash between attempt and record | Stage 1 N/A (atomic local transaction covers signal→fill→cash). Live design: journal-first (write attempt before send), then reconcile | Reconciler closes/adjusts; positions reflect exchange truth after sync | Local journal + exchange reconciliation; never assume, always verify (PLAN §3 "klaim tidak boleh jadi asumsi") |
| 10 | User disables strategy | Pause/Stop transition in control plane (§5) | Desired status propagates at next poll/run boundary; no *new* entries; open positions follow defined policy (first slice: let simulated exits complete; live-phase design must define position-close policy explicitly — recorded as open requirement, not decided here) | Resume = new deploy cycle (same or new config version) | State preserved across pause; equity history continuous; version timeline intact |
| 11 | Strategy config becomes invalid | Deploy-time validation (`params_schema` + `validate_config`) and startup re-validation | Invalid bundle **rejected before RUNNING** → FAILED with reason; runtime keeps last-good if update fails mid-life | User fixes instance → new version → redeploy | Old version stays applied until a valid new one lands (never half-applied) |
| 12 | Network split runtime ↔ control plane | Heartbeat/write-back timeouts; stale status on dashboard | Trading continues on cached bundle (§4 principle); local emergency-stop still functional (local capability); dashboard shows "status stale (last seen T)" — **not** "stopped" | Heal → queued write-backs flush; desired-status changes apply at next boundary | Eventual consistency via watermark-style flush; no decision depends on the link |

---

## SECTION 18 — Technical Debt Classification

Reclassified against the target architecture (concrete files/components):

| Item | Class | Notes |
|---|---|---|
| No Supabase→engine bridge; `user_strategies` never executed (Phase 2D §16 THE BREAK) | **MUST FIX before customer automation** | The entire product value depends on it (Migrations 2–3) |
| Single-tenant SQLite schema (`db/schema.sql` global keys) | **MUST FIX before customer automation** | Per-deployment state (§10) — the global DB itself stays as-is for internal paper |
| Param-shape mismatch (`entry_period` vs `donchian_entry_period`, `max_concurrent` vs `max_concurrent_positions`) with no mapper | **MUST FIX before customer automation** | One explicit Donchian mapper + validation (§6) |
| Templates selectable but non-executable (5 of 8; Phase 2D §4) | **MUST FIX before customer automation** | Deployability gating; do not silently claim executability |
| Orphaned `PUT/DELETE /api/strategies`, unreachable Active/Paused badge (Phase 2D §18) | **MUST FIX before customer automation** | Lifecycle states need real transitions (§5) |
| `trendsentry-daily-sync.yml:20` swallows failures (`\|\| echo`) | **MUST FIX before customer automation** | Ops invisibility is unacceptable once customers depend on automation |
| No automated write-path test (strategy create chain) + smoke blind spot (`api-smoke-test.mjs:92-100` accepts 401 **or** 200) | **MUST FIX before customer automation** | Tests first for any chain a customer relies on |
| No per-user alert delivery (single chat, dead route trades:157-160) | **MUST FIX before paper customer beta** | A beta user must see their deployment's failure |
| Per-deployment results views (dashboard shows discipline only) | **MUST FIX before paper customer beta** | First-value loop ends in visibility (§12) |
| Multi-strategy attribution silent no-op (daily-sync:162-165) | **MUST FIX before paper customer beta** | If beta allows >1 active strategy; otherwise enforce exactly-one explicitly instead of silently |
| No key revoke path (Phase 2D §2) | **MUST FIX before paper customer beta** | Key hygiene is table stakes once beta users exist |
| `CircuitBreaker` runtime-unwired (guards.py:80-118, callers = tests) | **MUST FIX before live trading** | PLAN Fase 4 gate requires it active with manual resume |
| Order idempotency/journal/reconciler/exchange-side stop verification | **MUST FIX before live trading** | Entirely absent (Phase 2D §7); PLAN §3 envelope |
| Entitlement readers (`profiles.plan` read by nothing) | **MUST FIX before live trading** (and before **any** paid claim, whichever comes first) | Invariant 16 |
| PLAN §9 custody conflict with managed VPS live keys | **MUST FIX before live trading** | Owner amendment (§19 #1) |
| In-memory rate limiting (`lib/rate-limit.ts:1-7`, documented weakness) | CAN WAIT | Acceptable at current scale; revisit with paid traffic |
| 2 lint errors + 7 warnings (AppSidebar:24, strategies/new:107) | CAN WAIT | Known baseline (AUDIT.md), unrelated to target architecture |
| Dead `EquityCurveChart.tsx` + 5 unused SVGs | CAN WAIT (cleanup candidate) | Zero importers (Phase 2A §4); needs owner-approved cleanup phase |
| Duplicate discipline formula (TS + SQL trigger, no parity test) | CAN WAIT / INTERNAL ONLY | Documented intentional defense-in-depth; parity test is a small future test (Phase 2A §2b) |
| Pair-universe / constants duplication (config.yaml ↔ `constants.ts`) | CAN WAIT | Documented drift risk (Phase 2A §1); slice avoids adding copies |
| Canonical backtest metric discrepancy (two snapshots) | CAN WAIT — owner decision pending | Do **not** edit numbers unilaterally (ARCHITECTURE §16) |
| Dead env vars (`EXCHANGE_API_KEY/SECRET`, `RUN_MODE`) | CAN WAIT | Zero usages (Phase 2D §18); harmless placeholders for a gated future |
| `vectorbt` unused in requirements | INTERNAL ONLY | Phase 2A §7.2 pending owner decision |
| `backtest/`, `presets/`, `research/`, reports, `compare_live_vs_backtest.py`, fetch-data workflow | INTERNAL ONLY | Research/validation infrastructure — stays, isolated from product loop |
| `test-bitget-api.yml` one-off probe | DEPRECATE LATER | Owner decision pending (Phase 2A §7.8); superseded |
| Stripe `STRIPE_PLANS` feature copy (alerts/benchmark/unlimited) | DEPRECATE LATER | Claims don't match delivery; replace when entitlement model is rebuilt (§15) |
| Discipline-centric onboarding framing (checklist requires own fills) | DEPRECATE LATER | Product identity shifted to automation; copy/UI realignment in a later phase |
| `llm_filter/` skeleton | INTERNAL ONLY (dormant) | ISOLATE per §2; not MVP |

---

## SECTION 19 — Open Decisions

Not resolvable responsibly now — each with why, evidence required, and deadline:

| # | Decision | Why unresolved | Evidence required | Deadline / phase |
|---|---|---|---|---|
| 1 | **PLAN §9 custody conflict:** owner direction allows TrendSentry-provided managed VPS, but PLAN §9 rule 2 (locked 2026-09-11) says exchange keys "tidak pernah transit ke server kita" and explicitly discards "eksekusi cloud kustodian"; the same section names the *LLM filter* as the only paid item while the new direction sells managed deployment | This is an owner-locked document contradiction — the agent must not amend PLAN.md or reinterpret locked rules | Owner decision + explicit PLAN §9 amendment text (scope: self-hosted-only vs managed-with-keys; and pricing-model update) | Before **Migration 5 live-stage** any key custody; recommended resolution in Migration 1 (it also affects §15 copy) |
| 2 | Canonical backtest metric snapshot (+149.59%/−26.19% vs +152.0%/−26.45%) | Phase 2A §7.1 assigned it to the owner; technical repro already proved Snapshot B, but choosing + regenerating all quotes is an owner call | Owner adoption decision → regenerate `metrics.md` + fix quotes in one pass | Before any marketing/copy edit touching those numbers (can slip past Migration 2) |
| 3 | **Revenue sequencing:** does revenue begin on the pre-live slice (simulated execution + managed ops), or only after the live gate passes (mid-2027 target vs Fase 2 gate: ≥10 closed trades + 8 weeks, AGENTS #3)? | Business decision with compliance/gate implications; selling "automated trading" while execution is simulated would be a misleading claim (invariant 16) | Owner decision + gate evidence status (compare_live_vs_backtest output) + honest packaging definition | Before Migration 5 pricing/checkout work |
| 4 | Per-tenant state store: per-deployment SQLite (repo precedent) vs Postgres rows | Depends on concurrency/isolation evidence from the first isolation tests; both are valid; premature choice risks rework | Isolation test results, expected N deployments, ops cost estimate | Before Migration 3 implementation |
| 5 | Template catalog policy: mark 5 non-executable templates non-deployable vs implement SMA/RSI for automation first (they exist in backtest) | Owner said "small proven subset, Donchian strongest candidate" — expanding beyond one strategy is a product choice, not a technical necessity | Demand evidence (template_id distribution, H3 from Phase 2D) + backtest gate status for SMA/RSI as automation candidates | Migration 1 (flagging) / Migration 2 (selection UI) |
| 6 | Entitlement packaging: what the paid managed tier includes, price, and `PAYMENTS_ENABLED` activation | Copy currently promises undelivered features (stripe.ts:19,25); package cannot be defined before delivery surfaces (Migrations 3–5) are real | Working delivery + per-user alerting + monitoring; rewritten feature copy matched to code | Before any checkout activation / paid claim |
| 7 | Discipline feature scope in the automation product (keep as supporting real-fills feature? adjust onboarding that currently requires own fills?) | Owner said "may remain supporting" — retention/UI emphasis is open | Product decision on whether the manual-trading audience remains served | Migration 2 (dashboard/lifecycle UI decisions) |
| 8 | Config-delivery final mechanism (confirm startup-snapshot+poll, or require signed bundles) | §7 chose the smallest option; signing can be added if threat model changes (e.g., managed-live) | Threat-model review at live design; no evidence today requires more | Migration 3 (confirm), live phase (revisit signing) |
| 9 | Deployment granularity: one deployment per strategy instance (slice-1 assumption) vs one runtime hosting multiple strategies of one user | Multi-strategy per runtime changes risk isolation semantics (shared equity? separate?) | Isolation/risk design review; owner preference on portfolio semantics | Before Migration 4 scope lock |
| 10 | Managed VPS isolation model: container-per-deployment on one VPS vs VM-per-customer | Depends on live-stage custody decision (#1) and observed tenancy risk | Migration 5 operational evidence; revisit if/when trade keys are in scope | Migration 5 |

---

## SECTION 20 — Architecture Invariants

Future implementation phases MUST NOT violate these. Each evaluated against the audit:

1. **Supabase is the customer control-plane source of truth.** — `TARGET`, owner decision;
   consistent with where customer data already lives (RLS'd tables, migrations SoT).
2. **Trading runtime is the execution plane.** — `TARGET`; local state is authoritative for
   in-flight decisions (§4).
3. **Runtime must not require Supabase for every trading decision.** — `TARGET`; startup
   snapshot + local cache (§7); a control-plane outage degrades manageability, not trading
   correctness (§17 #1).
4. **Paper and live trades remain separated.** — `CURRENT` by absence of live + `TARGET`
   stream model (§11); paper must never contaminate live performance or discipline stats.
5. **Manual and automated trades remain distinguishable.** — `TARGET`; `user_trades` stays
   the real-fills log (trades/route.ts:24); automated rows are a separate stream with
   explicit source labels.
6. **Bitget only initially.** — `CURRENT` fact + owner decision; no speculative
   exchange abstraction (but keep exchange-specific code behind the narrow seam the engine
   already has — `make_exchange` — so a future venue is a new builder, not a rewrite).
7. **Existing live-trading safety gates remain frozen.** — `CURRENT` four-way guard
   (guards.py:56-57; cli.py:41-47; bitget.ts:6-9; zero order code) + PLAN/AGENTS gates.
8. **No live order capability is introduced accidentally.** — `CURRENT` property of the
   codebase; the web allowlist comment (bitget.ts:3-5) and `validate_config` live rejection
   are the tripwires; this phase adds none.
9. **One proven strategy is preferable to eight nominal templates.** — owner decision +
   Phase 2D §4 evidence (5 templates have zero implementation).
10. **Internal research infrastructure must not be confused with customer product.** —
    `ISOLATE` classifications (§2); public `/papertrading` shows the *owner's* global
    account and must be labeled honestly (Phase 2D §18).
11. **Customer secrets must never reach the browser.** — `CURRENT` property (metadata-only
    GETs, server-side decrypt); holds for all `TARGET` additions (§9).
12. **Multi-user isolation must be explicit.** — `TARGET`; deployment_id/user_id scoping
    everywhere (§10); isolation test is the ship gate for Migration 4.
13. **Deployment state must be observable.** — `TARGET`; lifecycle states (§5) + heartbeat
    (§16); "strategy created" without "deployment visible" violates the first-value loop.
14. **Every automated order path must eventually be idempotent.** — `FUTURE` live; local
    order journal + reconciliation required by design (§17 #8/#9); stage-1 candle-key
    idempotency is the existing precedent (`signals UNIQUE`).
15. **Configuration changes must be versioned/auditable.** — `TARGET`; immutable config
    versions applied at run boundaries (§7); applied_version reported (§16).
16. **Revenue features cannot be claimed before entitlement/delivery actually exists.** —
    `CURRENT` violated in existing Stripe copy (Phase 2D §11) → must be fixed before any
    paid activation; invariant for all future copy.
17. **The internal global paper engine, its SQLite state, sync, and public dashboard keep
    running unchanged through all migrations.** — protects the owner's validation
    infrastructure and the only production-like loop that exists today.
18. **`config.yaml` is never written by, or for, a customer.** — internal SoT only (owner
    decision); customer config lives in Supabase versions.
19. **The one-way SQLite→Supabase paper mirror stays one-way** (watermark-after-success) —
    no back-writes, no merging with customer tables.
20. **The guardrail envelope is enforced in at least two planes** (web `checkStrategyGuardrails`
    at authoring + runtime `validate_config` at deploy/start) — defense-in-depth already
    exists (Phase 2A §2a); new layers call existing validators instead of forking numbers.
21. **Runtime write-backs are validated server-side** (schema caps + column allowlist +
    machine auth) — extending the `PaperSyncSchema` precedent so a compromised runtime
    cannot poison arbitrary tables.
22. **Honest status semantics:** "control plane unreachable", "runtime offline", "strategy
    FAILED", and "market data stale" are four distinct states and must never be collapsed
    into one another in UI or alerts (§17).

---

## SECTION 21 — Final Implementation Boundary

### IMPLEMENT NEXT (the first implementation phase — Phase 2G starting boundary)

1. Migration 1 foundation: control-plane schema additions (deployment/config-version/health,
   forward-only migrations with RLS) — **after** §19 #1/#5 owner answers.
2. Donchian-only deployability gating in the template catalog + honest product copy pass
   (no implied "8 executable strategies", no implied "we deploy bots today").
3. The single **Donchian param mapper** + deploy-time validation reusing
   `checkStrategyGuardrails` and `validate_config` (contract-tested).
4. Deployment lifecycle states (§5) + real pause/stop wiring via the existing orphaned
   strategy PUT/DELETE surface.
5. Versioned config bundle + last-known-good local cache + run-boundary apply (§7).
6. Input-driven runtime component reusing `strategy.py` + `risk_manager/guards` +
   simulated-fill semantics — **as a new component**; `live_signal.py` untouched.
7. Per-deployment local state schema with deployment-scoped idempotency keys + the
   **two-deployments-same-pair-same-date isolation test** (ship gate).
8. Validated status/results write-back (PaperSyncSchema pattern) + per-deployment
   dashboard views + heartbeat/status display.
9. One per-user alert path for deployment lifecycle failures (deployed/failed/offline).
10. Fix `daily-sync` swallowed failure (`workflow:20`) and the smoke-test 401-or-200 blind
    spot — small, cheap, and required for any customer-dependent loop.

### IMPLEMENT LATER

- Self-hosted packaging polish (CLI deploy command, machine credentials, update/rollback
  UX) — Migration 5a.
- Managed VPS operations (per-`deploy/` scripts generalized: image, systemd supervision,
  per-deployment backup/restore, operator health view) — Migration 5b, **after** §19 #1.
- Entitlement readers + rebuilt pricing copy + checkout activation — Migration 5c, after
  §19 #3/#6.
- Second executable strategy (SMA/RSI automation) only with demand evidence — §19 #5.
- Customer-facing paper as a *product mode* (vs the validation stage inside automation) —
  only if useful, isolated from the internal engine (owner decision).
- Per-user Telegram/chat binding at scale, richer alert routing.
- `CircuitBreaker` runtime wiring, reconciliation cadence, dry-run envelope — **Migration 6,
  inside the dedicated live-execution phase**, gated by Fase 2 evidence.
- Order journal / idempotency / exchange-side stop verification / reconciler — same live
  phase.
- Config-bundle signing, richer observability (error tracking service), persistent rate
  limiting, backfill of known small debts in §18 CAN WAIT/INTERNAL rows.
- Canonical metric reconciliation **once the owner decides** (§19 #2).

### DO NOT IMPLEMENT NOW

- Any live order path, exchange write permission, allowlist addition, or gate weakening
  (four frozen guards stay untouched).
- Billing activation or any paid claim without entitlement readers + delivery.
- Multi-exchange abstraction or second venue.
- LLM/AI productization (skeleton stays dormant).
- Customer backtesting SaaS, social/community features, advanced analytics.
- Kubernetes, event bus/queue, microservices, autoscaling.
- Implementing the remaining 5 strategy templates as engines "because they exist".
- Editing backtest metric numbers, presets, frozen parameters, or research artifacts.
- Refactoring/deleting existing code (dead-code cleanup is a separate owner-approved phase).
- Changing the internal paper engine, its schema, its sync, or its public dashboard.
- Anything that would touch production, credentials, or run migrations — all excluded from
  this phase by its own hard rules.

---

## Appendix — Verification Results (Phase 2F run)

| Command | Result |
|---|---|
| `git diff --check` | exit 0 (no whitespace errors) |
| `git status --short` | only `PHASE2F_TARGET_ARCHITECTURE.md` (new, this file) + the 2 pre-existing untracked `backtest/reports/bh_*.md` (untouched, predating this phase) |
| `git diff --stat` | empty for all tracked files (no code/schema/config/workflow modified) |

Tests were not rerun: no code, schema, config, dependency, or workflow was changed, so no
architectural claim required test execution. No production access, no credentials, no
database mutations, no exchange calls, no push. The only file created by this phase is
`PHASE2F_TARGET_ARCHITECTURE.md`.
