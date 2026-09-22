# TrendSentry

> Trend-following backtest + paper-trading engine with a discipline-tracking web product.

**TrendSentry** today is two things in one repository:

1. **A Python trading engine** — Donchian breakout backtesting and a daily paper-trading
   runner (no real orders, no real capital) that we run on our own strategy, **Cluster-A2**,
   as dogfooding.
2. **A Next.js + Supabase web product** — it stores *your* strategy, stores *your* read-only
   exchange API key, fetches your fills once a day, detects deviations from your own rules,
   and scores your discipline.

It is **not** an AI trading bot: signal generation is pure quantitative logic (Donchian/ATR,
pure pandas). An LLM filter exists only as a disabled skeleton for a future phase (see below).

---

## What it actually does (CURRENT)

| Component | Status | What runs today |
|---|---|---|
| **Backtest engine** (`backtest/`) | ✅ | Python, 10-pair 1D Bitget OHLCV, next-open execution, fee+slippage, buy-and-hold benchmark → `backtest/reports/` |
| **Paper trading engine** (`paper_trading/live_signal.py`) | ✅ | GitHub Actions daily at 01:00 UTC against **public Bitget market data (no API key)**; signals, positions, slippage, yield, equity → SQLite |
| **SQLite persistence** (`db/paper_trading.db`) | ✅ | State committed back to the repo every run (off-disk backup) |
| **Supabase sync** | ✅ | Incremental watermark sync SQLite → `/api/cron/paper-sync` → Postgres `paper_*` tables |
| **Web product** (`monitoring/web/`) | ✅ | Next.js 16 App Router on Vercel: auth, user strategies, read-only Bitget key (encrypted), daily fill ingest, deviation detection, discipline score |
| **Public paper dashboard** | ✅ | [trendsentry.vercel.app](https://trendsentry.vercel.app/papertrading) — equity curve, positions, slippage vs assumption, live ticker (REST polling 3s) |
| **Telegram alerts** | ✅ | entry / exit / stop / crash from the paper engine |
| **Guardrails** | ✅ | config validation at every entry point, risk ≤ 1%/trade, SL mandatory, max 5 positions + 2/correlation-cluster, no martingale |

### What is NOT available (FUTURE / gated)

| Component | Status | Why |
|---|---|---|
| **Live order execution** | ❌ **not implemented** | Fase 4, gated behind paper-trading gate (≥10 closed trades + 8 weeks). No `execution/` folder, no order-submission code exists anywhere in this repo. |
| **LLM filter** | ❌ disabled skeleton | Fase 3, gated behind Fase 2. `llm_filter.enabled: false` — never called. |
| **Order submission from the web** | ❌ never | Hard product boundary (PLAN §9): the web has no order path, and Bitget key usage is allowlisted to read-only endpoints. |
| **Discipline Benchmark simulation** | ❌ not built | Listed in roadmap only. |
| **VPS/Docker deployment** (`deploy/`) | ❌ prepared, never run | Images have not been built; current deployment is Vercel + GitHub Actions + Supabase. |

---

## Safety properties (verified in code, not just claims)

- **The paper engine never sends orders.** It only reads public market data and writes to its
  own SQLite database.
- **The web never sends orders.** `monitoring/web/lib/bitget.ts` allows exactly two read-only
  endpoints (`account/assets`, `trade/fills`); there is no order endpoint anywhere in the app.
- **Your Bitget API key is read-only by design.** It is validated on submission, stored
  AES-GCM-encrypted in Supabase, and used only to fetch your fills so deviations from *your*
  strategy can be detected.
- **`execution.mode = "live"` is rejected** by config validation; `cli.py live` refuses to run
  without `--dry-run`.
- Every position sizing calculation enforces **risk ≤ 1%** and a **mandatory stop loss**;
  **no martingale / averaging-down** exists in any form.

---

## Architecture

```
Python engine                                Web product (Vercel)
──────────────                               ────────────────────
Bitget public data (ccxt)                    Browser → Next.js 16 (proxy.ts auth gate)
  → backtest/strategy.py                       → server components + 14 API routes
  → paper_trading/live_signal.py                 → Supabase Postgres (RLS, service role)
  → SQLite db/paper_trading.db                 → Bitget REST (user's read-only key:
  → Telegram alerts                               fills + assets only)
  → sync → /api/cron/paper-sync → Supabase
  → git commit (state + backup)
```

Full detail with diagrams: **[`ARCHITECTURE.md`](ARCHITECTURE.md)**.
Repository inventory & audit evidence: **[`REPO_MAP.md`](REPO_MAP.md)**.

### Stack

- **Engine:** Python 3.11+, `ccxt`, `pandas`, SQLite, Telegram Bot API
- **Web:** Next.js 16 (App Router), TypeScript, Tailwind, Recharts, Supabase (Auth + Postgres), Stripe (gated)
- **Jobs:** GitHub Actions (daily paper run, daily user-sync, manual data fetch)

### Deployment (current)

| Piece | Where |
|---|---|
| Web app | Vercel — Root Directory `monitoring/web`, runtime SSR + Supabase (**not** a static export) |
| Database | Supabase (Postgres) — schema in `supabase/migrations/` |
| Paper engine | GitHub Actions `paper-trading.yml` (01:00 UTC) + SQLite committed back to the repo |
| User fill ingest | GitHub Actions `trendsentry-daily-sync.yml` (01:30 UTC) → `/api/cron/daily-sync` |
| VPS / Docker | `deploy/` prepared for a future cutover — **not active** |

---

## Backtest reference metrics — canonical source decision pending

Our 6-year 10-pair backtest is summarized by two slightly different metric snapshots
(return +149.59% / DD −26.19% vs +152.0% / −26.45%; Sharpe 0.82, 94 trades, win rate 36.17%
agree across both). **No snapshot has been chosen as canonical yet** — see
[`ARCHITECTURE.md` §16](ARCHITECTURE.md) ("Reference metric discrepancy — see canonical
source decision pending"). Do not treat either set of numbers as final, and note that
backtest ≠ future performance: survivorship bias and wide confidence intervals apply
(details in `backtest/reports/decision_log.md` and `/disclaimer`).

---

## Quick start (development)

```bash
git clone https://github.com/Nomssky/TrendSentry.git
cd TrendSentry

# Engine
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # Telegram token etc. — never commit .env
python -m pytest tests/         # 64 tests

# Backtest
python backtest/run_backtest.py

# Paper engine (one-shot, local)
python paper_trading/live_signal.py

# Web
cd monitoring/web && npm install
npm run dev                     # http://localhost:3000
npm run typecheck && npm run lint && npm run build
npm run test:e2e                # Playwright (needs local server + fixtures)
```

---

## Status

**Fase 2 — Paper trading active** since 2026-08-25 (daily GitHub Actions run, no crashes).
Waiting for the Phase 2 gate (≥ 10 closed trades, 8 weeks) before any Fase 3/Fase 4 work.
See `TASKS.md` for gate criteria and `PLAN.md` for the roadmap.

Web: [trendsentry.vercel.app](https://trendsentry.vercel.app)

## License

[AGPL-3.0](LICENSE) — source-available. You may read, learn, and self-host. Commercial SaaS
use requires a separate license. Contact: [nomssky](https://github.com/Nomssky)
