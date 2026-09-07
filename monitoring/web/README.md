# TrendSentry — Web Dashboard

> Read-only monitoring dashboard for TrendSentry paper trading.  
> Deployed at [trendsentry.vercel.app](https://trendsentry.vercel.app)

Built with Next.js (static export) + Tailwind + Recharts.  
Data is read from `db/paper_trading.db` at build time — no runtime database access.

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build  # outputs static export to out/
```

## Stack

Next.js · Tailwind · Recharts · SQLite (build-time only)

