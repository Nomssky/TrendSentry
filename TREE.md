# TREE.md — Peta Direktori TrendSentry

> Satu layar. Detail arsitektur: [`ARCHITECTURE.md`](ARCHITECTURE.md).
> Inventaris file-per-file + bukti audit: [`docs/internal/REPO_MAP.md`](docs/internal/REPO_MAP.md).

```
TrendSentry/
├── README.md, ARCHITECTURE.md, TREE.md (+ AGENTS.md publik untuk kontributor AI)
│   └── Mulai di sini. Roadmap/checklist/aturan proses: docs/internal/ (PLAN, TASKS, RULES).
├── backtest/            # Engine strategi: strategy.py (Donchian/ATR/sizing), run_backtest.py
│   ├── research/        # Eksperimen arsip (bukan engine) — dep di requirements-research.txt
│   └── reports/         # Output backtest + bukti gate (jangan edit angka manual)
├── paper_trading/       # Engine paper harian: live_signal.py; run_deployment.py (runtime per-deployment)
├── risk_manager/        # validate_config + CircuitBreaker (dipakai engine tiap start)
├── alerting/            # Alert Telegram (entry/exit/stop/crash)
├── llm_filter/          # Skeleton Fase 3 — NONAKTIF (enabled: false)
├── scripts/             # sync SQLite→Supabase, fetch OHLCV, gate Fase 2
├── cli.py, config.yaml, presets/   # CLI + satu-satunya source parameter strategi/risk
├── data/historical/     # OHLCV 1D 10 pair config (+PAXG, dibaca riset korelasi)
├── research/data/       # Data khusus riset (funding, BCH/LTC) — bukan input engine
├── db/                  # schema.sql + paper_trading.db (state paper, di-commit CI harian)
│   └── backup_db.sh     # MANUAL-ONLY (cron dibatalkan)
├── supabase/migrations/ # SATU-SATUNYA source of truth skema Postgres
├── monitoring/web/      # Produk Next.js 16 + Supabase (read-only display + disiplin user)
├── deploy/              # Persiapan VPS/Docker — BELUM dijalankan
├── docs/
│   ├── audit/           # Audit historis Phase 2 (jangan ditulis ulang)
│   ├── decisions/       # Catatan keputusan OD2–OD8 + audit refactor (riwayat, byte-identik)
│   └── CLOSURE_NOTES_2026-10-01.md  # Berita acara closure + temuan terverifikasi
├── tests/               # 224 pytest (sizing & stop-loss = paling kritis)
└── .github/workflows/   # paper-trading (01:00 UTC), daily-sync (01:30), run-deployment (02:30), fetch-data (manual)
```

Yang TIDAK ada di repo (sengaja): folder `execution/` / order live (Fase 4, gated),
LLM aktif (Fase 3, gated), `db/migrations/`, kredensial (`.env` tidak pernah di-commit).
