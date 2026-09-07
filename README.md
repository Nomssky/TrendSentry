# TrendSentry

> AI-augmented trend-following system — built by traders, for traders.

**TrendSentry** is a discipline execution layer for systematic crypto trading. It runs your strategy, logs every decision, and holds you accountable — no emotion, no deviation, no FOMO.

---

## Why TrendSentry?

Most traders fail not because their strategy is wrong, but because they can't execute it consistently. TrendSentry removes the human from the loop: it checks the signals, sizes the positions, and sends the alerts. You just review the log.

**Cluster-A2** — our own 6-year backtested Donchian system running live on 10 pairs (Sharpe 0.82, max DD -26.19%, +149% return across a full bull-bear cycle). It's not for sale — it's our dogfood. We eat our own cooking.

---

## What It Does

| Feature | Status |
|---|---|
| **Paper trading engine** — live market, no capital risk | ✅ Active |
| **Telegram alerts** — entry/exit/stop/crash notifications | ✅ Active |
| **Real-time dashboard** — equity curve, open positions, live PnL | ✅ [Live](https://trendsentry.vercel.app) |
| **Cluster-based risk management** — correlation-aware position limits | ✅ Cluster-A2 |
| **Discipline Benchmark** — simulate your own strategy's execution fidelity vs actual results | 🔜 Coming soon |
| **LLM filter layer** — sanity-check signals with AI reasoning | 🔜 Fase 3 |

---

## Architecture

```
Data (ccxt) → Signal Engine → Risk Manager → Paper/Live Execution → DB + Alerts
                          ↘                    ↙
                     Monitoring Dashboard (read-only)
```

- **Backtest & signal**: Python — Donchian breakout, ATR sizing, cluster limits
- **Execution**: Python (paper), Node.js (live, Fase 4)
- **Dashboard**: Next.js static export → Vercel
- **Alerts**: Telegram Bot API
- **Data**: SQLite (paper), PostgreSQL (live, future)

---

## Quick Start (Development)

```bash
git clone https://github.com/Nomssky/TrendSentry.git
cd TrendSentry
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your Telegram token
python -m pytest tests/
```

---

## Stack

Python · ccxt · pandas · Next.js · Tailwind · SQLite · Telegram Bot API

---

## Status

**Private Beta** — the `main` branch powers our own live paper trading. We're validating the discipline model before opening up user accounts.

Dashboard: [trendsentry.vercel.app](https://trendsentry.vercel.app)

---

## License

[AGPL-3.0](LICENSE) — source-available. You may read, learn, and self-host. Commercial SaaS use requires a separate license. Contact: [nomssky](https://github.com/Nomssky)
