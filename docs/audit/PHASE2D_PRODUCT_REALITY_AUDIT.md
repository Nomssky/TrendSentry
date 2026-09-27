# Phase 2D — Product Reality Audit

> **Scope:** READ-ONLY audit of HEAD `78b46c2` (2026-09-22). The only repository change
> made by this phase is this file. No product code, config, schema, migration, RLS policy,
> API contract, payment logic, frontend behavior, dependency, or test was modified.
> No production database access, no production API calls, no credentials, no external side effects.
>
> **Method:** every claim below is grounded in source code found at the cited path/line.
> Capability is classified using the required vocabulary:
> `REAL` / `PARTIAL` / `SCAFFOLD` / `DEAD` / `UNPROVEN` / `ABSENT`.
> Filenames, UI labels, TODOs, and documentation were NOT treated as evidence of capability.

---

## 1. Executive Factual Summary

1. **The repository contains two loosely-coupled products** (README.md:5-13 states this
   accurately): (a) a Python backtest + paper-trading engine running ONE global,
   owner-configured Donchian strategy, and (b) a Next.js SaaS that is a *trade-discipline
   tracker* for a user's OWN Bitget trades (read-only key → daily fill import → deviation
   check → discipline score). They share no runtime data path.
2. **The core product loop is broken at arrow 2.** A user-created strategy
   (`user_strategies`) is a configuration record only. No code anywhere maps it to an
   engine: the Python side never reads Supabase (no supabase client in any `*.py`), and
   `paper_trading/live_signal.py` reads only `config.yaml` (live_signal.py:34, 329).
   Creating a strategy starts nothing.
3. **The 8 SaaS strategy templates do NOT correspond to 8 implemented strategies.**
   Backtest engines exist for 3 (Donchian, SMA, RSI); paper trading runs only 1 (Donchian);
   Bollinger Bands, MACD Crossover, Ichimoku Cloud, VWAP Strategy have **no implementation
   in any file** (repo-wide grep = 0 hits outside the seed/test files); `Custom` is a
   free-text field (`rules_text`) that no code parses. `template_id` is only stored,
   never dispatched to anything.
4. **Paper trading is a genuine executable paper simulation** (simulated fills, fees,
   slippage, ATR stops, gap stops, intraday live-stop check, equity/yield ledger) — but it
   is ONE global account driven by `config.yaml`, scheduled by GitHub Actions daily
   01:00 UTC, exposed on a public dashboard. It is not per-user, not configurable, and not
   startable by a customer.
5. **Live trading is ABSENT**, guarded four independent ways: `validate_config` rejects
   `execution.mode == "live"` (guards.py:56-57), `cli.py live` refuses without `--dry-run`
   (cli.py:41-47), the web Bitget key allowlist contains exactly two read-only endpoints
   (lib/bitget.ts:6-9), and repo-wide grep finds zero order-submission code
   (`create_order`/`cancel`/`withdraw`/private endpoints = no hits in `*.py`; TS hits are
   only UI copy saying orders are never placed).
6. **Payment infrastructure exists but the product cannot currently be bought, and paying
   would change nothing.** Checkout is hard-gated to 403 unless `PAYMENTS_ENABLED === "true"`
   (checkout/route.ts:38-40; that env var is not even in `.env.example`); `live_assist`
   is never openable by the gate (same lines, comment 32-37). The Stripe webhook is complete
   and signature-verified and writes `profiles.plan` — but **`profiles.plan` is never read
   by any feature code** (grep: only the webhook touches `profiles`). There is no
   server-side or frontend entitlement enforcement anywhere.
7. **The claimed paid feature "real-time Telegram deviation alerts" is not wired to the
   active pipeline.** The alert fires only in `POST /api/trades` (trades/route.ts:157-160),
   a route with **zero callers**. The real ingestion path (`/api/cron/daily-sync`) inserts
   deviations without any Telegram call (no telegram import in that file), and the web
   Telegram client targets a single global `TELEGRAM_CHAT_ID` (lib/telegram.ts:4-5), not a
   per-user chat.
8. **The deviation engine is real but narrow in the active path.** Eight rule types are
   coded (lib/deviation.ts:54-165); however `max_concurrent`, `position_sizing`,
   `min_holding`, `max_position_size` require context (`openPositions`/`accountEquity`/
   `positionEntryDate`) that no active caller ever supplies (daily-sync:192-194,
   trades/route.ts:93-97), and `rules_json` rules (`allowed_pairs`, `max_daily_trades`,
   `no_trade_hours`…) are never set by the UI (strategies/new sends only
   `name/template_id/params`, page.tsx:116). For a UI-created strategy in the live daily
   pipeline, effectively only the **`direction` rule (sell while `long_only`) can fire**,
   and only when the user has **exactly one active strategy** (attribution guard,
   daily-sync:162-165).
9. **Tests are green but prove offline engine logic, not the product loop.** Verified this
   run: pytest **70 passed**, typecheck **0**, build **0**, lint **exit 1** with the known
   2 errors + 7 warnings. No CI workflow runs any web check (the 4 workflows: pytest+engine,
   prod curl, two manual data tools). Playwright (34 tests) never runs in CI; authenticated
   specs fail closed without credentials and default to the production URL. No automated
   test exercises strategy creation (write path), key connect, checkout, webhook, sync, or
   daily-sync.
10. **Security fundamentals are solid and code-verifiable** (RLS on all 13 tables, CSRF
    origin checks, timing-safe cron secrets, Stripe signature verification, AES-GCM-encrypted
    exchange keys, HSTS/CSP, read-only exchange allowlist, account deletion with FK cascade).
    There is no admin surface. Known soft spots are documented in-code (in-memory rate
    limiting; read-only key permissions cannot actually be enforced — lib/bitget.ts:30-37).

Docs agree with code on phase status: Fase 2 active/gated, Fase 3 (LLM) and Fase 4 (live)
unchecked in TASKS.md; README:134-137.

---

## 2. Product Surface Matrix

| Capability | Status | Evidence | What a user can actually do |
|---|---|---|---|
| Authentication | REAL | signUp app/auth/signup/page.tsx:17-26; login page (signInWithPassword); callback `verifyOtp`/`exchangeCodeForSession` app/auth/callback/route.ts:26,36; `proxy.ts:34-44` gates `/app/*`; e2e `auth.spec.ts` (8 tests) | Register, confirm email, log in; `/app` redirects when logged out |
| Onboarding | PARTIAL | Dashboard setup checklist `isSetupComplete = key+strategy+fills` dashboard/page.tsx:26-29; marketing steps `/start` start/page.tsx:8-30; no in-app guided wizard | Sees a 3-item checklist; must self-serve connect key + create strategy + trade; email-confirmation flow works |
| Strategy template selection | REAL | `GET /api/templates` templates/route.ts:7-17 (auth) ← fetch strategies/new:92; 8 rows seeded (migrations 20260911120000 + 20260922120000) | Pick 1 of 8 templates; schema-driven parameter forms render from `params_schema` |
| Strategy creation | REAL (no automated write-path test) | strategies/new:110-123 `POST /api/strategies` → insert with Zod + guardrails validations.ts:33-63, route.ts:19-47 | Persist a named strategy with params under own account; server rejects non-long-only / risk>1% / max>5 |
| Strategy configuration (edit) | PARTIAL | `PUT/DELETE /api/strategies` route.ts:51-127 exist with **zero callers** (grep of app/, lib/, e2e/); list UI has no edit/pause/delete buttons strategies/page.tsx:34-44 | Configure only **at creation**; cannot edit, cannot pause (the "Active/Paused" badge is unreachable state), cannot delete |
| Strategy execution | ABSENT (for user strategies) | No supabase usage in any `*.py`; live_signal.py:34,329 engine bound to `config.yaml`; no `template_id` → engine mapping anywhere | Nothing runs their strategy; no per-user signals or trades are ever generated |
| Paper trading | REAL — but global, not per-user | live_signal.py (engine), `.github/workflows/paper-trading.yml:6-8` (daily cron), sync script → `/api/cron/paper-sync`, public `/papertrading` | Watch the single owner dogfooding account; cannot start, stop, or configure their own paper run |
| Live trading | ABSENT | guards.py:56-57; cli.py:41-47; lib/bitget.ts:6-9; zero order code (greps §7) | Nothing; `/live` page honestly states "NOT LIVE" (live/page.tsx:35) |
| Portfolio / equity monitoring | PARTIAL | Paper equity REAL: `equity_log` → `paper_equity_log` → getDashboardData db-supabase.ts:59-100 + `/papertrading`; per-user equity ABSENT: `user_trades` is a fills log with no pnl/exit columns (trades/route.ts:24, 93-97) | Public paper equity curve + positions; own account shows fills count and discipline only — no PnL, no equity |
| Fills | REAL | daily-sync fetches Bitget spot fills (route:57-76, allowlist endpoint), dedupe+insert (141-190); dashboard reads `user_trades` (dashboard/page.tsx:15) | Their Bitget spot fills imported daily at 01:30 UTC — only if they connected a key **and** actually traded |
| Deviation detection | PARTIAL | checkDeviation deviation.ts:54-165; active caller daily-sync:216-234; context-disabled rules noted daily-sync:192-194; attribution requires exactly 1 active strategy (162-165) | With exactly one active strategy, a `sell` vs `long_only` is flagged to `deviation_log`; most rule types dormant; multiple strategies → silently no checks |
| Discipline score | REAL | `calculateDisciplineScore` deviation.ts:167-214 + DB trigger `20260912130000` (identical formula `100 − crit×25 − rest×10`, clamp 0..100); dashboard chart ScoreTrendChart | Daily 0-100 score and trend for attributed trades |
| Alerts | PARTIAL | Deviation→Telegram only in uncalled `POST /api/trades` (trades/route.ts:157-160); daily-sync has no telegram call; single global chat lib/telegram.ts:4-5; owner paper alerts REAL (live_signal ENTER/EXIT/LIVE_STOP/crash; workflow failure yml:64-72) | **Users receive no alerts today.** Owner receives paper-engine and workflow alerts |
| API key management | PARTIAL | POST: verify read access + AES-GCM encrypt + upsert api-keys/route.ts:19-75; GET returns metadata only (6-17); **no DELETE / revoke anywhere** (no UI, no route) | Add or replace a read-only Bitget key; cannot revoke or deactivate from the product |
| Subscription / payment | PARTIAL | checkout gated 403 checkout/route.ts:38-40; complete signature-verified webhook webhooks/stripe/route.ts:71-145; no billing-portal code, no plan UI | Cannot purchase under default config; even if opened, purchase only sets `profiles.plan` (unused) |
| Free tier ("Watcher") | REAL | No gating exists anywhere (grep `plan` read = none) | Every implemented feature is available without payment |
| Paid tier ("Paper Beta") | PARTIAL (infrastructure only) | Gate default-closed (checkout:38-40); `PAYMENTS_ENABLED` absent from `.env.example`; entitlement never enforced; claimed paid feature not wired (§1, bullet 7) | Nothing purchasable; nothing would unlock if purchased |
| Cancellation | PARTIAL | Webhook `customer.subscription.deleted`/`unpaid` → `plan="free"` webhooks:130-142, expirePlanBySubscription:39-51; no customer-facing portal/UI | Backend downgrade path exists; user has no self-serve cancellation screen in the product |
| Dashboard | REAL | dashboard/page.tsx:11-18 direct RLS reads (scores, deviations, strategies, trades, key); public `/papertrading` force-dynamic | Own discipline/deviations/fills/checklist; separate public paper dashboard |
| Historical performance | PARTIAL | Paper history REAL (`equity_log`, closed trades, signal log → `/papertrading/log`); user-level performance ABSENT (no PnL/positions model per user) | Paper trade history + daily signal log publicly; own history = raw fills table |
| Backtesting | ENGINE REAL / PRODUCT EXPOSURE ABSENT | run_backtest.py:52-292 executable locally/CLI (cli.py:29-30); zero API routes/UI triggers (grep backtest in web = marketing copy only) | SaaS user **cannot** trigger a backtest; only a repo developer can, via CLI |
| Reports | RESEARCH REAL / USER-FACING ABSENT | `backtest/reports/*` files (metrics.md, equity_curve.csv, trades.csv, PNG); web shows only static `lib/backtest-reference.json` (reference.ts:1-24) | Developer reads repo reports; public sees fixed reference numbers on `/`, `/proof`, `/disclaimer` |
| LLM filter | SCAFFOLD | llm_filter/filter.py:43-49 `evaluate()` always returns pass; `llm_filter.enabled: false` config.yaml:42-45; sole caller gated live_signal.py:490 | Nothing — never invoked (dead branch in practice) |
| Telegram | PARTIAL | Owner ops alerts REAL (monitoring/telegram_alert.py:29-52; live_signal alerts; paper-trading.yml:64-72); user-facing product alerts not wired (see Alerts row) | Owner-only operations notifications |
| Admin functionality | ABSENT | No admin routes/roles/pages; service-role client server-only (lib/supabase/admin) | None |

---

## 3. User Journey

```text
Landing page (/)                                              REAL
   ↓  (marketing; static backtest reference; events beacon → /api/events)
Sign up (/auth/signup → supabase.auth.signUp + email confirm) REAL
   ↓  (/auth/callback verifyOtp | exchangeCodeForSession)
Login (/auth/login)                                           REAL
   ↓  (proxy.ts redirects logged-in users to /app/dashboard)
Dashboard (/app/dashboard)                                    REAL
   ↓  (empty state: SETUP CHECKLIST — needs key + strategy + fills)
Create strategy (/app/strategies/new)                         REAL
   ↓  (GET /api/templates → 8 templates → schema form)
Select template                                               REAL
   ↓
Configure strategy (params at creation only)                  PARTIAL  ← edit/continue-configure ABSENT
   ↓
Start paper trading                                           ABSENT    ← FIRST BREAK POINT
   ↓  (no such step exists: no button, no route, no per-user runner;
   ↓   creating a strategy triggers nothing anywhere)
Signals generated                                             ABSENT for this user
   ↓  (signals exist only for the global config.yaml Donchian account)
Paper state stored                                            REAL (global SQLite only)
   ↓  (GitHub Actions → db/paper_trading.db → sync watermark)
Supabase sync                                                 REAL (paper_* tables)
   ↓
Dashboard reads data                                          REAL for discipline/deviation/fills;
                                                               ABSENT for per-user signals/PnL
```

**First point a new user encounters an incomplete flow: immediately after "Create
strategy."** The product's central promise (strategies list empty-state: "TrendSentry will
check your trades against these rules and flag deviations", strategies/page.tsx:27) only
activates if the user (1) connects a Bitget API key, and (2) *actually trades on Bitget
themselves*. Until then the dashboard checklist stays incomplete forever — there is no
"start" action, no simulation, no signal. A user who signs up expecting a bot has no next
step. (For a user who does trade on Bitget, the Watcher flow then proceeds REAL:
key → daily import → deviation → score → dashboard.)

Transition notes:
- Create → Configure: UI sends only `{name, template_id, params}` (strategies/new:116);
  `rules_json` rules are unreachable from the UI (API-only).
- Strategy list badge shows Active/Paused but no control exists to change it
  (strategies/page.tsx:39) — user-visible state they cannot influence.
- No automated test covers the create→persist transition (e2e only *loads* the page; the
  template-presence check is `console.log`, not `expect`, free-tier-flow.spec.ts:172-183).

---

## 4. Strategy Layer — 8-Template Matrix

**Answer to the central question: NO.** 8 database templates ≠ 8 executable strategies.
No code anywhere maps `template_id` (or template name) to a strategy engine; `template_id`
is only stored/displayed (insert strategies/route.ts:46, select strategies/page.tsx:12).

| Template | DB row | Configurable (SaaS) | Backtest implementation | Paper implementation | Live implementation |
|---|---|---|---|---|---|
| Donchian Breakout | REAL (id 1) | REAL — form renders + persists params (stored only) | REAL — strategy.py:61-93 `donchian_high/low`, `entry_signal`/`exit_signal`; run_backtest.py:58-60,91-93,122-123; params config.yaml:17-23 | REAL — live_signal.py:34,396-538 uses the same functions; params from config.yaml | ABSENT |
| SMA Crossover | REAL (id 2) | REAL — stored only | REAL — strategy.py:96-114 `sma_entry_signal`, 117-122 exit; model `sma` run_backtest.py:61-63,94-96,124-125; frozen preset presets/sma_crossover.yaml | ABSENT — paper engine hardcodes Donchian functions/params | ABSENT |
| RSI Mean-Reversion | REAL (id 3) | REAL — stored only | REAL — strategy.py:125-143 `rsi`, 146-151 entry, 154-158 exit; model `rsi` run_backtest.py:64-65,97-98,126-127; preset presets/rsi_mean_reversion.yaml | ABSENT | ABSENT |
| Custom | REAL (id 4) | PARTIAL — `rules_text` free-text field is parsed by **no code**; structured rules only via `rules_json` (API-only, deviation checks only) | ABSENT | ABSENT | ABSENT |
| Bollinger Bands | REAL (id 5) | REAL — `period`/`std_dev` rendered + persisted (stored only) | ABSENT — grep `bollinger` in `*.py`/`*.ts` = 0 impl hits | ABSENT | ABSENT |
| MACD Crossover | REAL (id 6) | REAL — stored only | ABSENT — grep `macd` = 0 impl hits | ABSENT | ABSENT |
| Ichimoku Cloud | REAL (id 7) | REAL — stored only | ABSENT — grep `ichimoku` = 0 impl hits | ABSENT | ABSENT |
| VWAP Strategy | REAL (id 8) | REAL — stored only | ABSENT — grep `vwap` = 0 impl hits | ABSENT | ABSENT |

Notes:
- "Configurable" means: the schema-driven form renders the fields and
  `POST /api/strategies` persists them under guardrails (validations.ts:33-63). Persisted
  params have **no execution consumer** — no engine reads `user_strategies.params`.
- Every template's `params_schema` includes `direction` (enum-locked `long_only`),
  `risk_per_trade_pct` (≤1) and `max_concurrent` (≤5) (seed 20260922120000), which is what
  makes the single effective deviation rule (`direction`) possible for UI-created strategies.
- The marketing `/start` page lists only 4 templates hardcoded in TS
  (start/page.tsx:32-37) — diverges from the 8-row DB (duplicated source, §18).

Relationship summary:

```text
strategy_templates (8 rows, DB)      → UI selection & params only            [storage]
strategy configuration (user_strategies.params) → deviation checks only      [storage → checker]
backtest strategy (backtest/strategy.py: donchian|sma|rsi)                    [research, local]
paper-trading strategy (config.yaml → live_signal.py: donchian only)          [global runner]
future execution strategy            → nothing exists (Fase 4 gated)         [ABSENT]
```

---

## 5. Backtest Architecture

```text
historical data   data/historical/{PAIR}_1d.csv (committed)
                     ↑ scripts/fetch_bitget_data.py (ccxt.bitget public OHLCV)
                       ↑ manual workflow fetch-bitget-data.yml (workflow_dispatch only)
 ↓
strategy          run_backtest.py:52-68 load_ohlcv + model select
                  model ∈ {donchian, sma, rsi} (config.yaml / PRESET overlay load_config:36-49)
 ↓
signal            entry/exit functions in strategy.py (anti look-ahead: shift(1), prior-bar cross)
 ↓
position sizing   position_size() strategy.py:71-83 — risk% ÷ stop distance, equity-capped (spot)
 ↓
risk              risk_per_trade_pct ≤1%, max_concurrent_positions ≤5,
                  max_positions_per_cluster (run_backtest.py:128-131), mandatory ATR stop (133),
                  fee 0.1% + slippage 0.05% (config.yaml:39-40), cash clamp (136-138)
 ↓
portfolio sim     run_backtest.py:71-179 — next-open execution (132), gap-stop handling (149-167),
                  daily MTM equity curve (169-177)
 ↓
trade records     in-memory trades list → reports/trades.csv (252)
 ↓
metrics           compute_metrics 182-228 — return, CAGR, Sharpe, Sortino, max DD, win rate,
                  avg R, profit factor, buy-and-hold benchmark
 ↓
reports           save_report 248-277 → backtest/reports/{metrics.md, equity_curve.csv,
                  trades.csv, equity_drawdown.png}; REPORT_SUBDIR for research variants (231-235)
```

- **What is genuinely executable:** the entire chain above, locally, offline-from-committed
  CSVs: `python backtest/run_backtest.py` or CLI `trendsentry backtest` (cli.py:29-30).
- **Input data source:** committed CSVs from Bitget public API (fetch_bitget_data.py:1-30);
  refreshed only by the *manual* workflow.
- **Strategy actually used:** whichever `model` config/PRESET selects — `donchian` (default),
  `sma`, `rsi`. Parameters FROZEN in `presets/*.yaml` (preset headers: tuned-to-pass is
  forbidden).
- **Configurable parameters:** config.yaml (strategy/risk/backtest blocks) + `PRESET` env
  overlay; research scripts under `backtest/research/` are separate manual experiments.
- **Can SaaS users trigger it?** **No.** Zero backtest routes/UI (grep in
  `monitoring/web/app|lib` returns marketing copy only).
- **Are reports user-facing?** **No.** They are repo files. The web displays a *static*
  snapshot (`lib/backtest-reference.json` via `lib/reference.ts`) on marketing pages —
  honestly labeled "reference" on `/proof`, and used as the paper scoreboard baseline
  (papertrading/page.tsx:31-34).

**ENGINE CAPABILITY = REAL. PRODUCT EXPOSURE = ABSENT.** The backtest engine is
independent research tooling that also supplies static marketing numbers; it is not a
SaaS feature.

---

## 6. Paper-Trading Architecture

```text
Bitget public market API (ccxt.bitget, NO API key)
   live_signal.py:116-126 make_exchange, :376 fetch_ohlcv, :345/:416/:508 fetch_ticker,
   :88 fetch_order_book (slippage sample)                    → VERIFIED
 ↓
paper_trading/live_signal.py
   risk/strategy checks: validate_config :312-319; max_concurrent :476;
   cluster cap :477-485; position_size 1% risk :512; mandatory stop = close − 2×ATR :510;
   (CircuitBreaker class is NOT called here — see §18)       → VERIFIED
 ↓
SQLite db/paper_trading.db (schema db/schema.sql: meta, signals, positions,
   equity_log, slippage_log, yield_log, sync_state)
   idempotency UNIQUE(candle_date,pair) :391; missed days deliberately NOT backfilled
   for signals :382-384; equity gap backfill :227-307; yield idempotent+backfill :129-183 → VERIFIED
 ↓
scripts/sync_paper_to_supabase.py  (called by GitHub Actions, same job)
   incremental watermarks (signals/slippage/yield by id, positions by open+new+recent-closed,
   equity by date, meta full) :100-136; POST {VERCEL_URL}/api/cron/paper-sync with
   Bearer CRON_SECRET :145-153; watermark advanced ONLY after HTTP 200 :164-172 → VERIFIED
 ↓
Supabase paper_* tables via /api/cron/paper-sync (timing-safe secret :20-30; upserts with
   per-table conflict keys :48-94 → paper_signals, paper_positions, paper_equity_log,
   paper_slippage_log, paper_yield_log, paper_meta)           → VERIFIED
 ↓
Next.js public pages /papertrading + /papertrading/log (force-dynamic; admin client reads
   db-supabase.ts:59-100; live MTM ticker via /api/prices 3s poll LiveSection.tsx:50 ←
   PaperLiveBoard.tsx:3,113; stale >30h flag papertrading/page.tsx:36-39)             → VERIFIED
```

- **Scheduling:** GitHub Actions `paper-trading.yml` cron `0 1 * * *` UTC (+ manual
  dispatch), timeout 10 min, concurrency-locked; runs pytest first (:35-36), then engine
  (:38-42), then sync (:44-48), then commits `db/paper_trading.db` back to the repo
  (:50-59), Telegram failure alert on any failed step (:64-72).
- **Data freshness:** once daily after 01:00 UTC (≈ 08:00 WIB footer claim on
  /papertrading/log:125 checks out). Intraday price only exists during the run
  (live-stop check) and on the dashboard ticker (3s REST poll).
- **Signal generation:** Donchian only, from `config.yaml` (entry: close > 20-day prior
  high; exit: stop / live-stop / 10-day prior low) — same code as backtest (single source).
- **Position state:** SQLite `positions` (open/closed, stop_price, risk_amount, pnl,
  r_multiple, exit_reason ∈ {stop_loss, donchian_exit, gap_stop, live_stop}).
- **Risk checks:** listed above; **note:** the configured
  `risk.max_drawdown_circuit_breaker_pct: 15.0` is *validated* at startup (guards.py:44-48)
  but **never evaluated at runtime** by the paper engine — `CircuitBreaker` has no caller
  outside tests (grep §18).
- **Trade persistence + fills:** this IS a simulated-fill execution, not just signal
  generation: entry at `ticker.last × (1+slip)` :509, fee 0.1% :330, exit at
  `close × (1−slip)` :424, gap exit at open :451-473, intraday `live_stop` forced exit
  :339-370, cash ledger in `meta.paper_cash` :61-73.
- **Error handling / recovery:** fetch retry ×3 with backoff :98-113; per-pair failure
  skips that pair and continues :549-552; top-level crash alert :586-595; workflow-level
  failure alert closes the gap for non-engine failures (yml:61-72); safe re-runs
  (idempotent inserts); daily git commit of the DB = off-disk backup.
- **Sync behavior:** one-way SQLite → Postgres; no back-writes; failures re-send the same
  rows next run (watermark-after-200).
- **Dashboard consumption:** public, per-request Supabase reads; graceful local-only
  fallback message when DB unreachable (page:29).

**Verdict:** actual executable paper simulation with simulated fills (not merely signal
generation, not delayed reporting) — **for one global owner account.** The per-user paper
dimension does not exist: a customer cannot run, view "their own," or configure paper
trading.

---

## 7. Live-Trading Audit

**LIVE TRADING = ABSENT.**

| Evidence | Location |
|---|---|
| No `execution/` directory; engine dirs are backtest/paper_trading/risk_manager/llm_filter only | repo listing §Evidence |
| `validate_config` rejects `execution.mode == "live"`: `"Fase 4 belum tersedia, pakai 'paper'"` | risk_manager/guards.py:53-57 |
| CLI `live` without `--dry-run` prints DITOLAK and returns exit 2 | cli.py:37-49 (parser :157-159) |
| Config ships `execution.mode: "paper"` | config.yaml:47-49 |
| Web Bitget allowlist = exactly `spot/account/assets` + `spot/trade/fills`; comment forbids adding order endpoints without PLAN amendment | lib/bitget.ts:3-9 |
| Python ccxt usage = public market data only (`fetch_ohlcv`/`fetch_ticker`/`fetch_order_book`); files: fetch_bitget_data.py, live_signal.py, cli.py (import for doctor), test (fake) | grep `import ccxt` |
| Grep `create_order\|create_limit\|privatePost\|edit_order\|cancel_order\|withdraw\|place_order\|fetch_balance` in `*.py` | **0 hits** |
| Grep order verbs in web TS | 0 code hits — only copy: "it can never place orders or withdraw funds" (settings/page.tsx:110), "Read-only" instructions (:114), marketing disclaimers |
| Order state reconciliation / position close / amend | nowhere (no implementation exists to reconcile) |
| Docs concur | README:36 (not implemented, no order-submission code exists), PLAN.md §9 boundary, TASKS Fase 4 all unchecked |

No live execution was created or attempted by this audit.

---

## 8. Supabase Data Flow

```text
SQLite (db/paper_trading.db, source of truth for paper state)
   └─ scripts/sync_paper_to_supabase.py ─POST/Bearer CRON_SECRET─► /api/cron/paper-sync
                                                                        │ service role upsert
Supabase Postgres ◄─────────────────────────────────────────────────────┘
   │  ├─ session client (RLS) ── Next.js server pages (/app/*)
   │  ├─ anon/browser client ── forms → /api routes (session-checked)
   │  └─ service role (server-only) ── cron routes, webhook, admin reads (/papertrading)
Next.js frontend
```

There is **no `subscriptions` table** — billing state lives in `profiles`
(`plan`, `stripe_customer_id`, `plan_expires_at` added by 20260909120001; `referral_source`
by 20260911130000). No Supabase→SQLite back-write exists.

| Table | Writer(s) | Reader(s) | User-visible | Source of truth |
|---|---|---|---|---|
| `profiles` | DB trigger `handle_new_user` on signup (remote_schema:239-276, updated 20260911130000:16-27); Stripe webhook via service role (webhooks:31,47,65) | **Webhook only** — no frontend/API reads `profiles` (grep) | **No** (plan never shown in UI) | Postgres |
| `strategy_templates` | Migrations only (seed 20260911120000 + reproducible 20260922120000) | `GET /api/templates` (auth) → strategies/new form | Yes (creation form) | Postgres (canonical: `20260922120000`) |
| `user_strategies` | `POST /api/strategies` (session + CSRF + Zod + guardrails, route:44-47) | strategies page (server, RLS) :10-14; daily-sync (service role, attribution) :156-160; `GET /api/strategies` (no caller) | Yes (list + create) | Postgres |
| `user_api_keys` | `POST /api/api-keys` — verify + AES-GCM encrypt + upsert (route:19-75) | settings `GET` metadata only :6-17; daily-sync decrypts server-side :110-126 | Yes (metadata: exchange, active, date) | Postgres (ciphertext; plaintext never stored) |
| `user_trades` | **daily-sync** (service role, from Bitget fills) :181-190; `POST /api/strategies`… no — `POST /api/trades` (session) :67 — **route has no caller** | dashboard direct read :15; trigger counts for scores; `GET /api/trades` (no caller) | Yes (recent fills on dashboard) | Postgres (mirror of the user's real Bitget fills) |
| `deviation_log` | daily-sync :230-234; `POST /api/trades` (no caller) :144-155; DB trigger recalcs scores on change | dashboard :13,:16; deviation-log page :9-14; `GET /api/deviation-log` (no caller) | Yes (deviation log page) | Postgres (derived from trades + rules) |
| `discipline_scores` | `calculateDisciplineScore` (daily-sync :235-241, trades route :163-175) **and** DB trigger `recalc_discipline_score` (20260912130000, `SECURITY DEFINER`, same formula) | dashboard :12 + ScoreTrendChart; `GET /api/discipline` (no caller) | Yes (score + trend chart) | Postgres (derived) |
| `paper_signals`, `paper_positions`, `paper_equity_log`, `paper_meta` | `/api/cron/paper-sync` service-role upserts (route:48-94) ← sync script ← GH Actions ← SQLite | `/papertrading`, `/papertrading/log` (service role reads) | Yes (public pages) | **SQLite** — Postgres is a synced mirror |
| `paper_slippage_log`, `paper_yield_log` | same paper-sync upserts :72-86 | paper dashboard stats (slippage vs assumption, yield) | Yes (public) | SQLite → mirror (tables added by hotfix 20260910130000) |
| `analytics_events` | `POST /api/events` service role :34 (beacon, anon insert policy, rate-limited) | **Nobody** (no reader in repo) | No | Postgres (write-only) |

RLS: enabled on all 13 tables; 18+ policies — self-scoped `*_self` for user tables,
`profiles_select_self` (hardened 20260912120000), public-read + service-write for all six
`paper_*` tables, `events_insert` for anon/authenticated. Sync direction is strictly
one-way (SQLite → Postgres).

---

## 9. API Inventory

14 API route files under `app/api/**` (+ 2 auth routes):

| Route | Method | Auth | Reads | Writes | User-facing (has caller) | Tested |
|---|---|---|---|---|---|---|
| `/api/strategies` | GET | session | user_strategies | — | **No** (page reads DB directly) | No |
| `/api/strategies` | POST | session + CSRF + Zod + guardrails | — | user_strategies | **Yes** (strategies/new:113) | **No automated write test** |
| `/api/strategies` | PUT, DELETE | session + CSRF + Zod | user_strategies | user_strategies | **No callers** | No |
| `/api/templates` | GET | session | strategy_templates | — | **Yes** (strategies/new:92) | Smoke asserts unauth 401 (with blind spot, see below); e2e page-load only |
| `/api/trades` | GET | session | user_trades | — | **No callers** | No |
| `/api/trades` | POST | session + CSRF + Zod | user_strategies | user_trades, deviation_log, discipline_scores (+Telegram, uncalled path) | **No callers** | No |
| `/api/deviation-log` | GET | session | deviation_log | — | **No callers** | No |
| `/api/discipline` | GET | session | discipline_scores | — | **No callers** | No |
| `/api/prices` | GET | none (rate limit 60/min/IP, 30s cache) | Bitget public tickers | — | **Yes** (LiveSection.tsx:50, 3s poll) | smoke + e2e assert 200 ✓ |
| `/api/events` | POST | CSRF + rate limit 30/min/IP (no login) | — | analytics_events | **Yes** (AnalyticsBeacon) | smoke + e2e ✓ |
| `/api/api-keys` | GET | session | user_api_keys (metadata) | — | **Yes** (settings:35) | Page-load only |
| `/api/api-keys` | POST | session + CSRF + Zod + Bitget verify | — | user_api_keys (encrypted) | **Yes** (settings:47) | No |
| `/api/checkout` | POST | session + CSRF + Zod + **`PAYMENTS_ENABLED` gate (403 default)** | — | Stripe Checkout Session | **Yes** (CheckoutButton:11) — but returns 403 waitlist by default | No (would hit real Stripe — correctly untested) |
| `/api/webhooks/stripe` | POST | **Stripe signature** (`constructEvent`, route:83-89) | Stripe subscriptions | profiles (plan/customer/expiry) | Stripe platform | No (no fixture-based test) |
| `/api/cron/daily-sync` | GET | `CRON_SECRET` Bearer, timing-safe, fail-fast (:78-88) | all auth users (paginated :95-105), user_api_keys (decrypt), Bitget fills (signed :57-76) | user_trades, deviation_log, discipline_scores (service role) | GH workflow `trendsentry-daily-sync.yml` (prod URL) | e2e + smoke assert unauth **401** ✓ |
| `/api/cron/paper-sync` | POST | `CRON_SECRET` Bearer, timing-safe, fail-fast (:20-30) | — | 6 `paper_*` tables (service role) | sync script (paper-trading workflow) | e2e + smoke assert unauth **401** ✓ |
| `/api/account/password` | POST | session + CSRF + Zod + re-enter current password (:33-41) | — | auth user password + global signout | **Yes** (settings:67) | No |
| `/api/account/delete` | POST | session + CSRF + re-enter password (:30-36) | — | `admin.auth.deleteUser` → FK cascade cleans all user rows (:40-44) | **Yes** (settings:85) | No |
| `/auth/callback` | GET | session code/OTP exchange | — | session cookie | email-confirmation links | auth.spec: error/bogus paths ✓ (local) |
| `/auth/signout` | POST | session | — | session clear | sidebar Sign out | auth.spec (sidebar link visibility) |

Findings:
- **Routes with no callers:** `GET /api/strategies`, `GET+POST /api/trades`,
  `GET /api/deviation-log`, `GET /api/discipline` — dead API surface duplicating reads the
  pages do directly via RLS.
- **Frontend fetches → all resolve to existing routes** (no button calls a nonexistent
  endpoint; reverse grep of `fetch("/api/…")` vs route files matches).
- **Smoke-test blind spot (exact):** `testStrategyTemplates` accepts **either** 401 *or*
  200-with-data as pass (api-smoke-test.mjs:92-100), so it cannot detect the auth
  requirement being removed (an accidental public templates route would still "pass").
  All authenticated business routes (`strategies`, `trades`, `api-keys`, `deviation-log`,
  `discipline`, `checkout`, `account/*`, `webhooks`) are **absent** from the smoke suite.

---

## 10. Frontend Inventory

| Screen | Route | Data source | Interactive actions | Backend dependency | Status |
|---|---|---|---|---|---|
| Landing | `/` | static `backtest-reference.json` | nav, beacon | `/api/events` | REAL |
| Pricing | `/pricing` | static tiers (pricing:7-49) | **Subscribe** → `/api/checkout` | checkout (403-gated), Stripe | PARTIAL (button reaches real route; purchase closed) |
| Start / onboarding | `/start` | static copy; hardcoded 4-template list (:32-37) | none (links) | none | REAL as marketing; its template list ≠ DB |
| Live status | `/live` | static; all 3 gates `done: false` (:10-29) | none | none | REAL (honestly "NOT LIVE") |
| Proof / disclaimer | `/proof`, `/disclaimer` | static reference + caveats | none | none | REAL |
| Paper dashboard | `/papertrading` | `getDashboardData()` service-role reads + `/api/prices` ticker | live price polling | paper_* tables, prices route | REAL |
| Paper log | `/papertrading/log` | same | none | paper_* tables | REAL |
| Login / Signup | `/auth/*` | supabase browser client | forms | Supabase auth, callback | REAL |
| Dashboard | `/app/dashboard` | direct RLS reads (:11-18) | checklist links | DB only | REAL |
| Strategies list | `/app/strategies` | direct RLS read (:10-14) | "+ New" link only — **no edit/pause/delete** | DB only | PARTIAL (display works; management actions missing; PUT/DELETE API orphaned) |
| Strategy creation | `/app/strategies/new` | `/api/templates` (:92) | template select, schema params, submit | `POST /api/strategies` | REAL (write path untested) |
| Deviation log | `/app/deviation-log` | direct RLS read (:9-14) | none | DB only | REAL |
| Settings | `/app/settings` | `/api/api-keys` GET | save key (verify+encrypt), change password, delete account | api-keys, account routes | REAL — except **no key revoke control** |

Specific look-fors:

1. **Buttons calling nonexistent APIs:** none found (all `fetch("/api/…")` targets exist).
2. **Forms that cannot persist:** none — every form has a working route
   (key save, password, delete, strategy create, checkout reaches a real route).
3. **Mock/static data:** `lib/backtest-reference.json` — static backtest stats rendered as
   *reference* (honestly labeled on `/proof`; used as paper comparison baseline). No fake
   live data found; `/papertrading` reads real synced rows (with an explicit
   "local DB only" fallback message, page:29).
4. **UI implying live trading:** none — `/live` is explicitly "REAL ACCOUNT // NOT LIVE"
   (:35) and pricing marks Live Assist "COMING SOON" (:37-40). Copy is honest.
5. **UI implying user-triggerable backtesting:** none — no button/endpoint; marketing only
   cites the static reference.
6. **Subscription UI:** a working Subscribe button that returns
   `403 "payments not yet open — join the waitlist"` unless `PAYMENTS_ENABLED=true`
   (checkout:38-40); `live_assist` never purchasable from this route.
7. **Dashboard data scope:** discipline scores, deviations, strategies, recent fills,
   setup checklist — **no paper data, no PnL, no equity** (dashboard:11-29; comment :24
   "user_trades is a fill log"). Paper data lives only on the public `/papertrading`.
8. **Seed-data dependency:** strategy creation is impossible if `strategy_templates` is
   empty — submit stays disabled without a selected template (strategies/new:155) and the
   card list would render empty. (Seed is now reproducible per Phase 2C-3.)
9. **Sidebar** (AppSidebar.tsx:7-17): Dashboard, Strategies, Deviation Log, Settings,
   Paper Trading, Proof — every entry resolves to a working route. No billing/fills/
   backtest entries (consistent with those features' status).
10. **Dead UI state:** the Active/Paused badge (strategies:39) can never be changed from
    the UI; "Paused" is unreachable.

---

## 11. Payment / Business Infrastructure

- **Checkout:** `POST /api/checkout` — session+CSRF+Zod; creates a Stripe *subscription*
  Checkout with inline `price_data` ($19 `paper_beta`, $49 `live_assist` — lib/stripe.ts:14-27),
  `client_reference_id` = user, metadata carries `user_id`+`plan` into the subscription
  (checkout:47-72).
- **The gate:** `if (plan !== "paper_beta" || process.env.PAYMENTS_ENABLED !== "true") → 403`
  (checkout:38-40). `PAYMENTS_ENABLED` is **not documented in `.env.example`**. Code
  comment: payments locked until explicit owner decision; `live_assist` would charge $49
  "untuk barang yang tidak ada" without the gate (:32-37).
- **Webhook:** `POST /api/webhooks/stripe` — mandatory `stripe-signature`, `constructEvent`
  verification (:71-89); handles `checkout.session.completed` (with unpaid guard :101-104),
  `invoice.paid` (renew via subscription metadata), `customer.subscription.updated`
  (active/trialing → renew; canceled/unpaid → downgrade), `customer.subscription.deleted`
  (→ `plan="free"`, expiry null) (:93-142). Writes `profiles.plan`,
  `plan_expires_at`, `stripe_customer_id`.
- **Subscription state:** stored in `profiles` columns (migration 20260909120001) —
  no subscriptions table.
- **Entitlement:** **ABSENT as enforcement.** `profiles.plan` is written by the webhook and
  **read by nothing** (grep: no `.from("profiles")` read outside the webhook; no `plan`
  checks in app/lib). No feature checks plan server-side; the frontend never renders by
  plan. Free tier == paid tier functionally today.
- **Free tier:** everything, ungated (by absence of gating, not by explicit config).
- **Paid tier:** not purchasable under default config; if `PAYMENTS_ENABLED=true` were set
  in Vercel (not verifiable from the repo, and not attempted — no production access),
  buyers would get… a stored `plan` value. Claimed paid features are unenforced
  ("Unlimited strategies" implies a free-tier cap that exists nowhere; "Real-time Telegram
  deviation alerts" targets one global owner chat and the alert path isn't in the active
  pipeline — §1 bullet 7).
- **Cancellation:** server-side webhook downgrade path exists; **no billing portal**
  (`stripe.billingPortal` absent) and no in-product billing UI → user has no self-serve
  cancellation screen.
- **Distinction, as required:** *PAYMENT INFRASTRUCTURE EXISTS (checkout + verified webhook
  + state columns).* It does **not** follow that a customer can buy and receive product
  value: the buy path is closed by default, and the entitlement path from `plan` to any
  feature does not exist. No test purchase was made; no Stripe production call was made.

---

## 12. Security / Trust Boundaries

```text
browser ──(cookies/CSRF/rate-limit)──► Next.js ──(3 Supabase clients + RLS)──► Supabase
   │                                      │
   │                                      ├──(AES-GCM decrypt, server-only)──► Bitget READ (2 endpoints)
   │                                      └──(none)──► Python engine (no runtime link)
   └── public data only ◄── /api/prices ◄── Bitget public tickers
Python engine ── public ccxt only ──► Bitget   |   GH Actions ──(CRON_SECRET Bearer)──► cron routes
Stripe ──(signature)──► /api/webhooks/stripe   Telegram ──(bot token env)──► owner chat
```

- **Where secrets live:** root `.env` (gitignored — `git check-ignore` confirms
  `.gitignore:8-9`); GitHub Actions secrets (`TELEGRAM_*`, `CRON_SECRET`); Vercel env
  (service role, `ENCRYPTION_KEY`, `CRON_SECRET`, `STRIPE_*`, `TELEGRAM_*` — names from
  `monitoring/web/.env.example`); `.env.example` files list names/placeholders only.
  Hardcoded non-secret publishable Supabase URL/key in `.env.example` (public by design).
  Dead env vars documented but unused by any code: `EXCHANGE_API_KEY`, `EXCHANGE_API_SECRET`,
  `RUN_MODE` (grep: 0 usages).
- **API key encryption:** AES-GCM with PBKDF2-SHA256 (100k iterations, per-value random IV)
  under `ENCRYPTION_KEY` (lib/encryption.ts:3-46); stored ciphertext columns
  (`api_key_enc`…); decrypted **server-side only** inside the api-keys verify path and
  daily-sync (route:91,120-122). GET returns metadata only — plaintext never leaves the
  server.
- **Who can access exchange keys / are trading credentials usable:** only the service role
  can decrypt; the only uses are (a) re-verify on submit against
  `spot/account/assets`, (b) daily `spot/trade/fills` fetch — the closed allowlist
  lib/bitget.ts:6-9. **No order path exists** (§7), so stored credentials are
  *not usable for trading by this codebase*. Honest caveat in-code: Bitget offers no
  endpoint to read a key's permissions, so "read-only" cannot be *enforced* — it relies on
  the user creating a read-only key (lib/bitget.ts:30-37, settings copy :114).
- **User-triggered privileged actions:** none beyond self-service (self password change
  with re-auth, self delete → `deleteUser` + FK cascade, self inserts via RLS). No admin
  routes/roles exist.
- **Cron authentication:** both cron routes — `CRON_SECRET` required, timing-safe compare,
  500 fail-fast if unset (paper-sync:20-30, daily-sync:78-88).
- **Webhook authentication:** Stripe signature mandatory (:71-89), secret missing → 500.
- **CSRF:** `validateOrigin` on every mutating route (allowlist `ALLOWED_ORIGINS` or
  default prod+localhost; host fallback) — csrf.ts:23-39.
- **Rate limiting:** in-memory per instance — explicitly documented as weak
  (rate-limit.ts:1-7); applied to `/api/prices`, `/api/events`. IP taken from
  `x-real-ip` (spoof-resistant only on Vercel).
- **RLS:** enabled on all 13 tables with scoped policies (§8); profiles hardened to
  select-self (20260912120000). `paper_*` public read is intentional (public dashboard).
  `analytics_events` allows anon insert (beacon) — spam-only risk, rate-limited 30/min/IP.
- **Transport/browser hardening:** HSTS + CSP headers (next.config.ts:43-45).
- **Engine-side credentials:** paper engine uses **no** API keys (public market data only).
- No penetration testing was performed; all statements are code-derived.

---

## 13. Automation Inventory

| Automation | Trigger | Command | Output | Failure handling | Status |
|---|---|---|---|---|---|
| `paper-trading.yml` | cron `0 1 * * *` UTC + manual | pytest → `python paper_trading/live_signal.py` → `python scripts/sync_paper_to_supabase.py` → git commit `db/paper_trading.db` | signals/positions/equity in SQLite + `paper_*` in Supabase + daily DB commit (backup) | engine crash alert (live_signal:586-595); **workflow-level Telegram alert on any failed step** (yml:64-72); concurrency lock; 10-min timeout | **Production-like** (runs the real daily loop) |
| `trendsentry-daily-sync.yml` | cron `30 1 * * *` UTC + manual | `curl -H "Authorization: Bearer $CRON_SECRET" https://trendsentry.vercel.app/api/cron/daily-sync` | user fills → deviations → scores | **weak:** `|| echo "sync failed…"` swallows the failure (yml:20) — job stays green, no alert | Production-like trigger, dev-grade failure handling |
| `fetch-bitget-data.yml` | **manual only** | `scripts/fetch_bitget_data.py` → commit `data/historical/` | refreshed OHLCV CSVs | commit-if-changed | Dev tooling |
| `test-bitget-api.yml` | **manual only** one-off probe | raw HTTP + ccxt probes | log output | none needed | Dev tooling (historical) |
| Cron endpoints (invoked by the above) | HTTP | daily-sync 01:30 UTC, paper-sync after engine | DB writes | 401/500 fail-fast; sync script re-sends on non-200 | REAL |
| Scheduled paper trading | see row 1 | — | — | — | REAL (single global account) |
| Monitoring | Telegram alerts: engine ENTER/EXIT/LIVE_STOP/crash + workflow failure; dashboard stale-detection >30h (papertrading:36-39); gaps recorded in `signals` | | owner chat | alert skipped if env unset (telegram_alert:34-36) | REAL for owner; no user-facing monitoring; no error-tracking service (no sentry/datadog/posthog in package.json) |
| Backup | SQLite committed to git every run (off-disk daily backup); `deploy/backup.sh`/`restore.sh`/`export-cloud.sh` + RUNBOOK.md exist | | repo history | none automated for Postgres | PARTIAL (engine state backed up; Supabase backup not automated in repo) |
| Deployment | Vercel (web) + GitHub Actions (engine) — referenced by `VERCEL_URL` default (sync:21) and prod curl target; **no deploy workflow in repo** | | live site | Vercel platform | REAL (platform-managed) / `deploy/` Docker stack **prepared, never built** (README:41) |

Verdict: the paper-trading workflow is genuine production-like automation for the global
paper account; daily-sync is production automation with swallowed failures; the rest is
development tooling. Nothing schedules backups of Postgres or verifies deploys.

---

## 14. Test Reality

| Layer | Inventory | What it actually proves | What it does NOT prove | Mocks / services / credentials |
|---|---|---|---|---|
| Python unit/integration | **70 tests, 9 files** (this run: `70 passed in 9.90s`): test_strategy 24 (sizing, ATR, Donchian anti-look-ahead, SMA/RSI signals), test_risk 13 (sizing reuse, **circuit breaker**, concurrency caps, **config validation incl. live rejection**), test_live_signal 11 (**full `main()` with fake exchange**), test_compare 5, test_cli 4 (incl. live non-dry-run rejection), test_presets 4 (frozen params), test_filter 2, test_templates_seed 6 (Phase 2C-3 drift guard), test_backtest_cash 1 (cash-clamp regression) | Engine math, guards, idempotent paper flow, CLI refusals, seed determinism — **offline** | Real exchange behavior, real cron runs, sync-to-Supabase, anything about the web product | Fake exchange object; **no network**; no Supabase |
| TypeScript | `tsc --noEmit` (exit 0) | Type correctness | Behavior — there is **no vitest/jest anywhere** | n/a |
| Playwright E2E | **34 tests**: `auth.spec.ts` 8 (callback error paths, redirects, signup render, wrong-login) + `free-tier-flow.spec.ts` 26 | Public renders/redirects/wrong-credentials/cron-401/prices/events; sidebar links; *page loads* of authenticated screens | **Any write flow**: no strategy creation, no key connect, no fills/deviation/score assertion; template check is `console.log` not `expect` (spec:172-183); the "1-week simulation" is 7× page-load (spec:246-285) | `playwright.config.ts:6-19` starts `npm run start` locally (BASE_URL overridable); **authenticated tests require `E2E_TEST_EMAIL/PASSWORD` (fail-closed throw, spec:24-33)** and default `BASE_URL` = **production**; header: "jangan run di CI" |
| API smoke | `node e2e/api-smoke-test.mjs` (manual vs running server) | Protected-page redirects, cron 401s, prices, events, HTML shells | Authenticated API behavior; **templates auth has the blind spot** (accepts 401 *or* 200, :92-100); business routes untested | Needs a running server; no credentials used |
| CI | 4 workflows (§13). **Only `paper-trading.yml` runs pytest** (daily + manual). **No workflow runs typecheck, build, lint, or Playwright** | A green workflow means: unit tests passed and the paper day ran (or nothing at all for manual workflows) | Web correctness, E2E, prod sync success (`daily-sync` swallows failures) | GH secrets for Telegram/CRON only |
| Lint | `eslint .` → **exit 1**, exactly 2 errors + 7 warnings (unchanged baseline): `react-hooks/set-state-in-effect` at `app/app/AppSidebar.tsx:24:21` and `app/app/strategies/new/page.tsx:107:5` | Known issues remain documented (AUDIT.md); **not fixed in this phase** | — | — |

As required: **`all tests pass` ≠ `product works end-to-end`.** Green pytest proves the
offline engine; green typecheck/build proves the web compiles and renders; nothing in the
repository automatically verifies the user loop (signup → strategy → *signal* → trade →
score → dashboard), and the arrow "strategy → signal" is provably absent by code (§16).

---

## 15. Business Readiness Matrix

| Layer | Current capability | Status | Missing for production use |
|---|---|---|---|
| Strategy research | Full local tooling: 3 strategy models, presets, research scripts, frozen-parameter discipline | REAL | Nothing for research itself (developer-only by design) |
| Backtesting | Executable end-to-end locally from committed CSVs → metrics/reports | ENGINE REAL / EXPOSURE ABSENT | Any product surface (route/UI), fresh-data scheduling (workflow is manual), per-user runs |
| Paper trading | Real daily simulated-fill engine, idempotent, synced, public dashboard | REAL (global account) | Per-user strategy execution; runtime circuit-breaker enforcement (class has no caller); owner-account vs product-account clarity |
| Monitoring | Telegram ops alerts, workflow failure alert, stale/gap detection on dashboard | PARTIAL | User-facing notifications; failure alerting for daily-sync; error tracking |
| SaaS dashboard | Auth, discipline chart, deviations, fills, checklist | REAL | PnL/equity/positions for the user; edit/manage strategies; billing surface |
| User strategy management | Create + view only (guardrailed insert) | PARTIAL | Edit/pause/delete UI (orphaned PUT/DELETE API), execution binding, `rules_json` authoring surface |
| Exchange integration | Read-only: key verify + daily fills import (Bitget, 10 pairs) | REAL (read-only) | Multi-venue (`/start` promises "others coming"), key revocation, permission enforcement (platform-limited) |
| Live execution | — | ABSENT | Everything (execution engine, order+SL submission, reconciliation); gated by PLAN Fase 4 |
| Billing | Checkout + signature-verified webhook + plan columns | PARTIAL | Open the gate deliberately (`PAYMENTS_ENABLED`), billing portal, plan UI, test purchase path, documented env |
| Entitlement | Plan stored in `profiles.plan` | ABSENT (enforcement) | Any reader of `plan`; feature differentiation between free/paid |
| Security | RLS everywhere, CSRF, timing-safe cron, Stripe signatures, AES-GCM keys, HSTS/CSP, read-only allowlist, no admin surface | REAL (fundamentals) | Persistent rate limiting (in-memory), webhook/checkout test coverage, dead-credential cleanup (`EXCHANGE_API_KEY` etc.) |
| Reliability | Idempotent engine, retries, watermarks, DB-in-git backup, failure alerts (paper path) | PARTIAL | daily-sync failure visibility (currently swallowed), Supabase backup automation, deploy/rollback automation (`deploy/` never run) |

No score assigned; no overall judgment offered — per spec.

---

## 16. Core Product Loop (most important section)

| Arrow | Implementation | Evidence | Status | Break point |
|---|---|---|---|---|
| USER → CREATE STRATEGY | Schema-driven form → `POST /api/strategies` → `user_strategies` insert with Zod + guardrails | strategies/new:110-123; strategies/route.ts:19-47; validations.ts:33-63 | **REAL** (unproven by automated test) | — |
| STRATEGY → SIGNAL | **None for user strategies.** Python never reads Supabase; engine bound to `config.yaml`; no `template_id`→engine dispatch; 5 of 8 templates have no engine at all | grep (no supabase in `*.py`); live_signal.py:34,329; §4 matrix | **ABSENT** | **THE BREAK** — a created strategy generates nothing, ever |
| SIGNAL → TRADE | Global paper engine simulates trades for the *owner's* config strategy; per-user: user must trade manually on Bitget (or not at all) | live_signal.py:507-538 (simulated entry), :411-473 (exits); daily-sync imports *user's own* fills :181-190 | REAL for global account / **ABSENT for user's strategy** | No signal produced by the stored strategy exists to become a trade |
| TRADE → PERFORMANCE | daily-sync → `checkDeviation` → `deviation_log` → trigger/`calculateDisciplineScore` → `discipline_scores` | daily-sync:216-241; deviation.ts:54-214; trigger 20260912130000 | **PARTIAL** | Works only with exactly one active strategy (attribution :162-165); only the `direction` rule effectively fires (§1 bullet 8); >1 strategies → silent no-op |
| PERFORMANCE → DASHBOARD | Direct RLS reads + ScoreTrendChart | dashboard/page.tsx:11-33 | **REAL** | — |
| USER RECEIVES VALUE | Discipline visibility on their own Bitget trading | all of the above + checklist :26-29 | **PARTIAL** | Value requires: key connected **and** user actually trading **and** single active strategy; no automated-strategy value exists |

**Loop verdict:** the loop exists only in the *discipline-tracker* reading
(`create rules → user trades manually → import → score → dashboard`), and even there the
"strategy" is a rule sheet, not an engine. The loop **as drawn** (strategy generates
signal → produces trade) **is broken at arrow 2 for every user, permanently.**

---

## 17. What Is Actually Sellable?

### Existing executable capability
- Account system (signup/confirm/login, password change, account deletion with cascade).
- Read-only Bitget key vault: verify-on-submit, AES-GCM at-rest encryption, server-only use.
- Daily import of the user's real Bitget spot fills (10 pairs, deduplicated).
- Rule persistence under hard guardrails (long-only, risk ≤1%, max ≤5).
- Deviation detection on imported fills (effective today: direction rule; framework for 8 rules).
- Daily discipline score (0-100) + history + trend chart, dual-computed (app + DB trigger).
- Public paper-trading dashboard: equity curve, positions, trade log, slippage vs assumption,
  yield, 3-second live ticker, stale/gap flags.
- Ops alerting for the owner (paper engine events + workflow failures).
- Local CLI: `backtest`, `paper`, `watcher`, `doctor` (live locked to dry-run).

### Existing UI capability (exposed, not fully executable)
- Subscribe button → real checkout route, currently closed by env gate; paid-tier claims
  (per-user Telegram alerts, "Unlimited strategies") not implemented/enforced.
- Strategy template chooser offering 8 templates of which 5 have no engine — selection
  persists configuration that nothing executes.
- Strategy list "Active/Paused" badge with no control; orphaned PUT/DELETE API.
- `/start` onboarding copy with a hardcoded 4-template list that diverges from the DB.
- Setup checklist that can only complete if the user trades on Bitget themselves.

### Future architecture (documented intent, cannot execute today)
- Live execution (Fase 4): `execution/`, circuit breaker runtime wiring, dry-run infra —
  TASKS all unchecked, guards reject live mode.
- LLM filter (Fase 3): skeleton + config flag + call site exist; DeepSeek client/prompts
  explicitly not built (TASKS).
- Paid entitlement system (plan readers), billing portal, per-user notification delivery.
- "Discipline Benchmark" / "Auto-stop-loss enforcement" (Stripe feature copy, README:
  "not built" / never).
- Docker/VPS deployment (`deploy/` prepared, never built).

### Research capability (developer/research only)
- Backtest engine + `backtest/reports/*` + frozen presets + `backtest/research/*` experiments.
- `compare_live_vs_backtest.py` Fase-2 gate (manual; unit-tested pure function).
- Historical data fetch workflow; `test-bitget-api` probe; Playwright/smoke suites (manual).

---

## 18. Dead / Orphaned / Duplicated Product Surface

*(Audit only — nothing to be removed in this phase.)*

- **UI with no backend:** none found (every fetch target exists).
- **Backend with no UI / no callers:**
  - `GET /api/strategies`, `GET+POST /api/trades`, `GET /api/deviation-log`,
    `GET /api/discipline` (pages read tables directly instead).
  - `PUT`/`DELETE /api/strategies` (full Zod+CSRF implementations, zero callers) — and the
    UI badge states (Active/Paused) that only such an API could change.
  - Telegram deviation alert path inside `POST /api/trades` (:157-160).
- **Database tables / columns with no active reader:**
  - `analytics_events` — written by the beacon, read by nobody.
  - `profiles.plan` / `plan_expires_at` / `stripe_customer_id` — written by webhook, read
    by nobody (entitlement surface with no consumer).
- **Workflows with no active consumer:** `test-bitget-api.yml` (one-off probe, superseded);
  `fetch-bitget-data.yml` is manual dev tooling (backtest data refresh never scheduled).
- **Strategy templates without strategy engines:** Bollinger Bands, MACD Crossover,
  Ichimoku Cloud, VWAP Strategy, Custom (5 of 8).
- **Strategy engines without product exposure:** backtest (3 models), paper engine
  (1 model), CLI, `compare_live_vs_backtest.py`.
- **Code with no production caller (tested only):** `CircuitBreaker`,
  `can_open_position` (risk_manager/guards.py:75-118; grep: only `tests/test_risk.py`) —
  the configured 15% drawdown circuit breaker is validated but never evaluated at runtime.
  `llm_filter.evaluate` — reachable only behind `enabled: false`, and even then the
  skeleton always passes.
- **Duplicated sources of truth:**
  - Strategy catalog: DB (8 rows) vs hardcoded `/start` list (4) — start/page.tsx:32-37.
  - Discipline formula in two places by design (lib/deviation.ts:196-199 ↔ trigger SQL) —
    documented as must-stay-identical (web/AGENTS.md §7).
  - Backtest numbers: `backtest/reports/metrics.md` (engine output) vs
    `lib/backtest-reference.json` (web) — reconciled only manually (REPO_MAP §12.9).
  - Pair universe: `config.yaml:5-15` ↔ `lib/constants.ts:1` (duplicated 10-pair list).
  - Starting capital: `config.yaml:38` ($1000) ↔ `lib/constants.ts:3` (`STARTING_CASH`).
- **Research features presented as product features:** backtest statistics on marketing
  pages (static, labeled "reference" — honest, but they are engine output, not user
  results); the public paper dashboard shows *the owner's single account* in a layout a
  visitor may read as "the product trading for me."
- **Dead configuration:** `.env.example` documents `EXCHANGE_API_KEY`,
  `EXCHANGE_API_SECRET`, `RUN_MODE` — zero code usages; `execution` mode is effectively
  fixed (`paper`) by validation.
- **Dead UI state:** "Paused" strategy badge; `is_active` toggle (`StrategyPutSchema`)
  with no producer.

---

## 19. Business Hypotheses to Validate Later

```text
H1:
Observed fact: The complete executable loop for a user is "connect read-only Bitget key →
  daily fill import → deviation check → discipline score → dashboard", with zero strategy
  automation (§16).
Possible product hypothesis: Self-directed traders would use/pay for a tool that scores and
  flags their own trading discipline against stated rules.
Evidence needed: activation funnel (signups → keys connected → fills imported → scores
  shown), interviews with active users, paid conversion once checkout is deliberately opened.

H2:
Observed fact: All 8 templates persist configuration (entry/exit/sizing params) that no
  engine consumes (§4), and the marketing create-flow presents templates as strategies.
Possible product hypothesis: Users choose TrendSentry expecting hosted strategy execution
  (a bot), not a rule-sheet for manual trading.
Evidence needed: user testing of the create-strategy flow (what do users expect next?),
  drop-off rates after strategy creation, demand interviews for hosted execution vs
  tracking-only.

H3:
Observed fact: 5 of 8 seeded templates (Bollinger, MACD, Ichimoku, VWAP, Custom) have no
  implementation anywhere, while 3 backtest models exist without template parity issues
  (§4).
Possible product hypothesis: Breadth of selectable strategies materially affects signup or
  activation (or: the current 8 were chosen for catalog appeal, not capability).
Evidence needed: distribution of `template_id` in `user_strategies`, activation by template
  chosen, backtest viability of the 4 missing models before any would be wired.

H4:
Observed fact: The sole differentiated paid feature ("real-time Telegram deviation alerts")
  exists only as code on an uncalled route targeting a single global chat (§11).
Possible product hypothesis: Real-time deviation alerting is the feature users would pay
  for, and its absence blocks paid-tier value even if checkout opens.
Evidence needed: a working per-user notification path + delivery metrics, willingness-to-pay
  tests with/without alerts, retention comparisons across cohorts.

H5:
Observed fact: A working, guarded backtest engine + reports exist with zero product
  exposure; the web only shows a static reference snapshot (§5).
Possible product hypothesis: Exposing backtesting (run your parameters, see metrics) would
  be a user-valued capability distinct from discipline tracking.
Evidence needed: demand tests for user-triggered backtests, cost/latency of serving fresh
  OHLCV data (current data workflow is manual), correctness review for multi-user runs
  (single-venue Bitget data limitations).
```

No ranking, no recommendation, no revenue estimate, no invented customers — per spec.

---

## 20. Evidence Index

*(Exact paths and symbols/line ranges for every load-bearing claim above.)*

**Python engine**
- `paper_trading/live_signal.py` — exchange :98-126; yield :129-183; equity snapshot/backfill
  :186-307; `main()` start + `validate_config` :310-330; live-stop check :339-371;
  candle loop/idempotency :374-402; exits :411-473; cluster limit :476-485; LLM gate
  :487-505; entry + sizing + stop :507-538; signal insert :540-547; per-pair error skip
  :549-552; lastRun/equity :554-565; crash alert :586-595.
- `backtest/strategy.py` — clusters :14-34; ATR :37-58; Donchian :61-93; `position_size`
  :71-83; SMA :96-122; RSI :125-158.
- `backtest/run_backtest.py` — config/PRESET :36-49; CSV load + model select :52-68;
  simulation :71-179; metrics :182-228; reports :231-277; `main` :280-292.
- `risk_manager/guards.py` — `validate_config` :16-72 (**live rejection :53-57**);
  `can_open_position` :75-77; `CircuitBreaker` :80-118 (no non-test caller).
- `cli.py` — live dry-run refusal :37-49; watcher :57-96; doctor :99-149; parser :152-164.
- `scripts/sync_paper_to_supabase.py` — env/tables :20-26; watermarks :36-59; incremental
  :62-75; payload :100-136; POST :145-153; advance-after-200 :164-172.
- `scripts/fetch_bitget_data.py` :1-30; `monitoring/telegram_alert.py` :18-52;
  `llm_filter/filter.py` :43-49; `db/schema.sql` :1-47.
- `config.yaml` — strategy :4-23; risk :25-30; paper :32-34; backtest :36-40;
  `llm_filter.enabled: false` :42-45; execution :47-49.

**Web — routes** (`monitoring/web/app/api/…`)
- `strategies/route.ts` :6-47, :51-127 (orphaned PUT/DELETE); `templates/route.ts` :7-17;
  `trades/route.ts` :8-34 (GET, no caller), :36-178 (POST: disabled-rules comment :93-97,
  telegram :157-160); `deviation-log/route.ts` :4-25; `discipline/route.ts` :4-25;
  `prices/route.ts` :14-41; `events/route.ts` :16-39; `api-keys/route.ts` :6-17, :19-75;
  `checkout/route.ts` :7-43 (**gate :38-40**), :44-79; `webhooks/stripe/route.ts` :9-69,
  :71-145 (**signature :83-89**); `cron/paper-sync/route.ts` :20-30, :44-96;
  `cron/daily-sync/route.ts` :57-76, :78-105, :109-190 (**attribution :162-165**,
  :192-241, no telegram); `account/password/route.ts` :11-53; `account/delete/route.ts` :6-47;
  `auth/callback/route.ts` :9-43.

**Web — lib & config**
- `lib/validations.ts` :33-63 (GUARDRAILS); `lib/stripe.ts` :14-27; `lib/bitget.ts` :3-9,
  :30-37; `lib/encryption.ts` :3-66; `lib/csrf.ts` :23-39; `lib/rate-limit.ts` :1-58;
  `lib/telegram.ts` :3-28; `lib/deviation.ts` :31-52 (parseRules), :54-165 (rules),
  :167-214 (score formula :196-199); `lib/db-supabase.ts` :32-100; `lib/reference.ts` :1-24;
  `lib/constants.ts` :1-5; `proxy.ts` :4-51; `next.config.ts` :34-45.
- Pages: `app/dashboard/page.tsx` :11-33; `app/app/strategies/page.tsx` :10-44;
  `app/app/strategies/new/page.tsx` :91-123, :155; `app/app/settings/page.tsx` :34-114;
  `app/app/deviation-log/page.tsx` :4-37; `app/app/AppSidebar.tsx` :7-17;
  `app/pricing/page.tsx` :7-49; `app/pricing/CheckoutButton.tsx` :8-41;
  `app/start/page.tsx` :8-37; `app/live/page.tsx` :10-35; `app/papertrading/page.tsx` :17-46;
  `app/papertrading/log/page.tsx` :12-127; `app/papertrading/PaperLiveBoard.tsx` :16-51;
  `app/components/LiveSection.tsx` :50; `app/auth/signup/page.tsx` :12-27.

**Supabase**
- `supabase/migrations/20260909120000_remote_schema.sql` — tables :19-151, RLS :165+,
  `handle_new_user` :239-276; `20260909120001_add_stripe_columns.sql`;
  `20260910130000_add_paper_slippage_yield_tables.sql` :20-48;
  `20260911130000_metrics_referral_events.sql` :1-27; `20260912120000_harden_profiles_rls.sql`;
  `20260912130000_recalc_discipline_score_trigger.sql` (formula + trigger);
  `20260922120000_insert_builtin_strategy_templates.sql` (8-row canonical seed).

**Automation / tests**
- `.github/workflows/paper-trading.yml` :6-9, :35-48, :50-59, :64-72;
  `trendsentry-daily-sync.yml` :6-20 (**swallowed failure :20**);
  `fetch-bitget-data.yml` :3-9; `test-bitget-api.yml` :6.
- `tests/*` (70 tests, per-file counts in §14); `monitoring/web/e2e/auth.spec.ts` (8);
  `e2e/free-tier-flow.spec.ts` :24-33, :114-183, :221-242, :246-285;
  `e2e/api-smoke-test.mjs` :40-60, :86-101 (**blind spot :92-100**);
  `playwright.config.ts` :6-19.
- `README.md` :5-45, :134-137; `TASKS.md` (unchecked: Fase 2 gate, Fase 3, Fase 4);
  `PLAN.md` :52-82; `ARCHITECTURE.md` §1-17; `REPO_MAP.md` §12.9.

---

## Appendix — Verification Results (Phase 2D run)

Exact results of the required commands, run after this report was written:

| Command | Result |
|---|---|
| `venv/bin/python -m pytest tests/ -q` | **`70 passed in 9.90s`** (exit 0) |
| `cd monitoring/web && npm run typecheck` | **exit 0**, no output (clean) |
| `cd monitoring/web && npm run build` | **exit 0** (all routes compiled; proxy middleware present) |
| `cd monitoring/web && npm run lint` | **exit 1** — `✖ 9 problems (2 errors, 7 warnings)`, identical to known baseline: errors `react-hooks/set-state-in-effect` at `app/app/AppSidebar.tsx:24:21` and `app/app/strategies/new/page.tsx:107:5`; 7 × `@typescript-eslint/no-unused-vars`. **Not fixed** (audit-only phase). |
| `git status --short` | `?? backtest/reports/bh_drawdown_and_btc_eth_corr.md` · `?? backtest/reports/bh_max_drawdown.md` (pre-existing untracked files, untouched) · `?? PHASE2D_PRODUCT_REALITY_AUDIT.md` (this report — the only intended change) |
| `git diff --stat` | empty before this file was added; after: only `PHASE2D_PRODUCT_REALITY_AUDIT.md` (new file) |
| `git diff --check` | exit 0 (no whitespace errors) |

No production database access, no production API calls, no credentials used, no external
side effects. No file other than `PHASE2D_PRODUCT_REALITY_AUDIT.md` was created or
modified by this phase.
