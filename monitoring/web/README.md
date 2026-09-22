# TrendSentry — Web (`monitoring/web/`)

The TrendSentry web product: marketing site, public paper-trading dashboard, and the
logged-in discipline app (strategies, read-only API key, deviation log, discipline score).

Deployed at [trendsentry.vercel.app](https://trendsentry.vercel.app) (Vercel, Root Directory
= `monitoring/web`).

> **Runtime data, not build-time data.** This is a server-rendered Next.js app. There is no
> static export, no `out/` directory, and the web app never reads `db/paper_trading.db`.
> Data comes from **Supabase at request time**.

## Request path

```
Browser
  → proxy.ts (Next.js 16 middleware convention: auth-gates /app/* and /auth/*)
  → server components (App Router pages, dynamic)  and/or  /api/* route handlers
  → Supabase
       · server client (session cookie → RLS)      for user data
       · admin client (service role)               for shared paper_* data
       · browser client (anon/publishable key)     for auth forms
  → Bitget REST (read-only):
       · /api/prices proxies public tickers (cache 30s, rate-limited)
       · user's encrypted key is used ONLY for /spot/account/assets and /spot/trade/fills
```

**There is no order-submission path in this app.** See `lib/bitget.ts`
(`USER_KEY_READ_ENDPOINTS` allowlist) and `PLAN.md` §9.

## Route categories

| Category | Routes | Data / auth |
|---|---|---|
| Marketing | `/`, `/start`, `/proof`, `/live`, `/pricing`, `/disclaimer` | public; server-rendered |
| Public dashboard | `/papertrading`, `/papertrading/log` | `paper_*` tables via admin client, `force-dynamic` |
| Auth | `/auth/signup`, `/auth/login`, `/auth/callback`, `/auth/signout` | Supabase Auth (OTP `token_hash` flow) |
| App (user) | `/app/dashboard`, `/app/strategies(/new)`, `/app/deviation-log`, `/app/settings` | session cookie + RLS |
| API | 14 handlers under `/api/` | see below |

### API routes

- **Sync:** `POST /api/cron/paper-sync` (SQLite mirror upsert, `CRON_SECRET`),
  `GET /api/cron/daily-sync` (per-user fill ingest → deviation → discipline score, `CRON_SECRET`)
- **Product:** `/api/strategies` (CRUD + guardrails), `/api/trades`, `/api/deviation-log`,
  `/api/discipline`, `/api/templates`, `/api/api-keys` (read-only key verification + AES-GCM)
- **Infra:** `/api/prices` (Bitget proxy, rate limit), `/api/events` (analytics beacon, CSRF + rate limit)
- **Billing:** `/api/checkout`, `/api/webhooks/stripe` (gated by `PAYMENTS_ENABLED`)
- **Account:** `/api/account/password`, `/api/account/delete` (both require re-auth)

Mutating routes validate origin (`lib/csrf.ts`); cron routes use timing-safe `CRON_SECRET`
comparison with fail-fast behavior.

## Stack

Next.js **16** (App Router, `proxy.ts` instead of `middleware.ts`), React 19, TypeScript,
Tailwind v4, Recharts, Supabase (`@supabase/ssr`), Stripe, Zod. **No static export.**

Data layer: `lib/db-supabase.ts` (paper dashboard aggregation), `lib/supabase/*` (three
clients), `lib/deviation.ts` (rules + discipline score), `lib/validations.ts` (Zod +
strategy guardrails), `lib/reference.ts` + `lib/backtest-reference.json` (backtest reference
metrics — canonical-source decision pending, see root `ARCHITECTURE.md` §16).

## Dev

```bash
npm install
npm run dev          # http://localhost:3000 (needs .env: NEXT_PUBLIC_SUPABASE_URL,
                     #   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ENCRYPTION_KEY, CRON_SECRET)
```

## Checks

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .   (currently: 2 errors + 7 warnings — known, tracked in AUDIT.md)
npm run build        # next build
npm run test:e2e     # Playwright — see playwright.config.ts (destructive tests are disallowed)
```

## Tests

- **Playwright E2E:** `e2e/auth.spec.ts` (8) + `e2e/free-tier-flow.spec.ts` (26) = 34 tests.
- **Manual smoke:** `node e2e/api-smoke-test.mjs`.
- **No JS unit-test framework** (no vitest/jest) — unit tests for trading logic live in the
  Python suite at the repo root (`tests/`).
