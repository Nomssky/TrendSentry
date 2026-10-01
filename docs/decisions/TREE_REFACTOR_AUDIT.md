# TREE REFACTOR AUDIT — Structural Forensics (Read-Only)

> **Scope:** directory/tree cleanup planning only. No architecture implementation, no strategy
> refactor, no trading-methodology change, no behavior change.
> **Method:** every claim below was verified against HEAD (files, imports, workflows, tests),
> not against documentation. Documentation is reported separately in Step 5 as *references*,
> never as *evidence of current structure*.

| Item | Value |
|---|---|
| HEAD | `d728ec891036a62f142d98ade8913a0e86176370` (branch `main`) |
| Worktree | `/home/kresna/project` (single worktree, `git worktree list` → only this one) |
| Tracked files | 208 |
| Tracked `.py` | 19 source + 9 tests = 28 |
| Tracked `.md` | 36 (19 root, 12 web/deploy/backtest, 5 elsewhere) |
| Untracked at audit time | 6 files, all `OD3…OD8_*.md` (decision records, **OD-6 in flight**) |
| Working tree diff vs HEAD | 0 tracked changes (`git status --porcelain` shows only the 6 untracked `OD*`) |
| Audit-side verification runs | `pytest` (read-only), `tsc --noEmit` (read-only), grep/`git ls-files` |

**Hard-stop compliance:** this audit moved, renamed, created, deleted, edited, formatted,
committed or pushed nothing except this one document. Verification commands executed were
read-only (`git status/ls-files/log/check-ignore`, `grep`, `find`, `pytest`, `tsc --noEmit
--incremental false`). No backtest was re-run (see Step 13 — Snapshot B reproduction must be
done in an isolated worktree, not in this tree while OD-6 is open).

---

## STEP 1 — CURRENT TREE

Tracked tree from HEAD (`git ls-files`), with role classification. Runtime-generated and
ignored files are listed separately below the tree.

```text
.
├── README.md AGENTS.md PLAN.md TASKS.md RULES.md AUDIT.md            [DOCUMENTATION — living]
│   ARCHITECTURE.md REPO_MAP.md SECURITY-ACTIONS.md PHASE2_SOURCE_OF_TRUTH.md
├── OD2_ENTRY_EXECUTION_STOP_DECISION.md                              [DOCUMENTATION — decision, closed]
├── OD3…OD8_*.md  (6 files, UNTRACKED)                                [DOCUMENTATION — decision, IN FLIGHT]
├── PHASE2B2_AUDIT.md PHASE2C_SECURITY_REPRODUCIBILITY_AUDIT.md       [DOCUMENTATION — historical audit]
│   PHASE2C2_TEMPLATE_SEED_BLOCKER.md PHASE2D_PRODUCT_REALITY_AUDIT.md
│   PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md PHASE2F_TARGET_ARCHITECTURE.md
│   PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md PHASE2H_…_VALIDITY_AUDIT.md
│
├── cli.py                                                             [PYTHON ENGINE — local CLI entrypoint]
├── config.yaml                                                        [CONFIG — SoT strategy/risk params]
├── requirements.txt                                                   [CONFIG — full deps (incl. unused vectorbt)]
├── requirements-engine.txt                                            [CONFIG — slim Docker engine deps]
├── .env.example .gitignore .dockerignore LICENSE                      [CONFIG / meta]
│
├── backtest/                                                          [BACKTEST — engine]
│   ├── __init__.py            (empty; makes `backtest` a package)
│   ├── strategy.py            indicators + position_size (SHARED w/ paper trading)
│   ├── run_backtest.py        portfolio sim + metrics + report writer (script identity)
│   ├── DESIGN.md              backtest design notes
│   ├── research/                                                      [RESEARCH — 7 scripts, not in CI]
│   │   ├── correlation_mitigation.py  fetch_funding.py  portfolio_size_experiment.py
│   │   ├── regime_segmentation.py  run_capital_efficiency.py
│   │   ├── run_longshort_backtest.py  sharpe_benchmark.py
│   └── reports/                                                       [GENERATED+COMMITTED — evidence]
│       ├── metrics.md  decision_log.md  bh_*.md  sharpe_*.md
│       ├── correlation_mitigation_experiment.md  portfolio_size_experiment.md
│       ├── regime_segmentation_analysis.md
│       ├── presets/{rsi,sma}/metrics.md            (+ .csv/.png = ignored, present locally)
│       └── research/{capital_efficiency,longshort}/{comparison.md,.csv,.png}
│
├── paper_trading/                                [PAPER TRADING — daily engine]
│   ├── live_signal.py          single-file daily engine (594 lines)
│   └── logs/                   (ignored, present locally)
│
├── risk_manager/                                  [PYTHON ENGINE — guardrails]
│   ├── __init__.py  guards.py  (validate_config, CircuitBreaker, re-export position_size)
│
├── llm_filter/filter.py                           [PYTHON ENGINE — Fase 3 skeleton, disabled]
├── monitoring/telegram_alert.py                   [PYTHON ENGINE — alert transport]
│
├── monitoring/web/                                [APPLICATION — Next.js 16 + Supabase SaaS]
│   ├── app/                    14 page.tsx + 16 route.ts (14 under app/api/, 2 under app/auth/)
│   │   ├── api/{account,api-keys,checkout,cron,deviation-log,discipline,events,prices,
│   │   │       strategies,templates,trades,webhooks}/
│   │   ├── app/ (auth'd dashboard) auth/ components/ papertrading/ pricing/ live/ proof/ start/
│   ├── lib/                    supabase/{admin,client,server}, bitget, stripe, csrf, env,
│   │                           reference.ts + backtest-reference.json (Snapshot B)
│   ├── e2e/                    auth.spec.ts free-tier-flow.spec.ts api-smoke-test.mjs
│   ├── proxy.ts                Next 16 middleware (`export default function proxy`)
│   ├── package.json package-lock.json tsconfig.json next.config.ts playwright.config.ts
│   ├── eslint.config.mjs postcss.config.mjs README.md AGENTS.md .env.example .gitignore
│   └── (NO public/ directory — see Step 4 Dockerfile.web row)
│
├── scripts/                                       [SCRIPT — orchestration]
│   ├── fetch_bitget_data.py                       OHLCV fetch → data/historical/
│   ├── sync_paper_to_supabase.py                  SQLite → POST /api/cron/paper-sync
│   └── compare_live_vs_backtest.py                Phase-2 gate evaluator (reads web JSON)
│
├── presets/                                       [CONFIG — 3 frozen preset packs]
│   ├── donchian_cluster_a2.yaml  sma_crossover.yaml  rsi_mean_reversion.yaml
│
├── db/                                            [DATABASE — SQLite state]
│   ├── schema.sql             DDL, executed on every engine start
│   ├── paper_trading.db       runtime state, COMMITTED by CI (accepted risk) + -wal/-shm ignored
│   ├── backup_db.sh           local cron backup (cron cancelled; script kept)
│   └── backups/               (ignored)
│
├── supabase/                                      [SUPABASE — Postgres schema SoT]
│   ├── config.toml            Supabase CLI config (project_id = "project")
│   ├── .gitignore             ignores .branches/.temp
│   └── migrations/            10 forward-only .sql files
│
├── data/                                          [DATA — inputs]
│   ├── historical/            13 CSV OHLCV (10 config pairs + BCH/LTC/PAXG research leftovers)
│   └── funding/               2 CSV funding (research)
│
├── deploy/                                        [DEPLOYMENT]
│   ├── Dockerfile.engine  Dockerfile.web  docker-compose.yml
│   ├── migrate.sh backup.sh restore.sh export-cloud.sh
│   ├── .env.example  RUNBOOK.md
│
├── tests/                                         [TEST — 9 pytest files, 70 tests]
│   ├── test_backtest_cash.py test_cli.py test_compare.py test_filter.py
│   ├── test_live_signal.py test_presets.py test_risk.py test_strategy.py
│   └── test_strategy_templates_seed.py
│
└── .github/workflows/                             [DEPLOYMENT/CI — 4 workflows]
    ├── paper-trading.yml      fetch-bitget-data.yml
    ├── trendsentry-daily-sync.yml   test-bitget-api.yml
```

### Role classification summary

| Category | Directories / files |
|---|---|
| APPLICATION (SaaS) | `monitoring/web/` |
| PYTHON ENGINE | `cli.py`, `backtest/strategy.py`, `risk_manager/`, `monitoring/telegram_alert.py`, `llm_filter/` |
| BACKTEST | `backtest/run_backtest.py`, `backtest/DESIGN.md`, `backtest/reports/` |
| PAPER TRADING | `paper_trading/` |
| RESEARCH | `backtest/research/`, `backtest/reports/research/`, `data/funding/` |
| DATA | `data/historical/` (production pairs), `data/funding/` (research) |
| DATABASE | `db/` (SQLite) |
| SUPABASE | `supabase/` |
| TEST | `tests/`, `monitoring/web/e2e/` |
| SCRIPT | `scripts/`, `db/backup_db.sh`, `deploy/*.sh` |
| DOCUMENTATION | 19 root `.md`, `monitoring/web/{README,AGENTS}.md`, `backtest/DESIGN.md`, `deploy/RUNBOOK.md` |
| DEPLOYMENT/CI | `.github/workflows/`, `deploy/` |
| CONFIG | `config.yaml`, `presets/`, `requirements*.txt`, `.env.example`, `.dockerignore`, `.gitignore` |
| GENERATED/RUNTIME | `backtest/reports/*.{csv,png}` (ignored), `paper_trading/logs/`, `db/backups/`, SQLite `-wal/-shm` |
| LEGACY | none identified as dead-by-path; `requirements.txt` `vectorbt` line is dead weight (0 imports, documented) |
| UNKNOWN | ownership of `monitoring/` as a *directory* (Python alert + Next.js SaaS share one name) — see Step 8 |

### Excluded/generated directories (present locally, not tracked, not part of any move decision)

| Path | Why excluded |
|---|---|
| `venv/` | Python venv (gitignored) |
| `__pycache__/` (8 dirs), `.pytest_cache/` | interpreter/test caches (gitignored) |
| `monitoring/web/node_modules/`, `.next/`, `tsconfig.tsbuildinfo`, `next-env.d.ts`, `test-results/` | npm/Next/Playwright build output (gitignored) |
| `.vercel/` (root), `monitoring/web/.vercel/` | Vercel link state (gitignored) |
| `supabase/.temp/` | Supabase CLI state (gitignored) |
| `db/backups/`, `db/paper_trading.db-wal`, `-shm` | runtime DB artifacts (gitignored) |
| `paper_trading/logs/` | engine logs (gitignored) |
| `backtest/reports/{equity_curve.csv,trades.csv,equity_drawdown.png,presets/*/*.{csv,png},regime_segmentation.png}` | regenerated by `run_backtest.py` (gitignored) |
| `.env`, `.env.local`, `monitoring/web/.env{,.local}` | secrets (gitignored) |
| `monitoring/web/e2e/.auth/` | Playwright storage state (gitignored) |

Note: `db/paper_trading.db` **is tracked** (CI force-adds it) — it is state, not generated
noise, and is explicitly in the DO-NOT-TOUCH set.

---

## STEP 2 — ENTRYPOINT INVENTORY

### 2.1 Python entrypoints

| # | Entrypoint | Invoked by | CWD sensitivity | Anchor |
|---|---|---|---|---|
| P1 | `backtest/run_backtest.py` | `python backtest/run_backtest.py` (README), `cli.py backtest` (subprocess), research scripts (`from run_backtest import …`) | **None** for data/config (`__file__`-anchored) | `ROOT = parent.parent`, `REPORTS = parent/reports` |
| P2 | `paper_trading/live_signal.py` | **CI cron** `.github/workflows/paper-trading.yml`, `cli.py paper|live --dry-run`, Docker `CMD`, local cron docstring (`… ./venv/bin/python paper_trading/live_signal.py`) | **None** (`__file__`-anchored) | `ROOT = parent.parent`, `sys.path` ← `ROOT`, `ROOT/backtest`, `ROOT/monitoring` |
| P3 | `cli.py <backtest\|paper\|live\|watcher\|doctor>` | `python cli.py …` (tests run it with `cwd=ROOT`); `prog="trendsentry"` | Subprocess inherits CWD, but P1/P2 are `__file__`-anchored → safe | `ROOT = Path(__file__).parent` |
| P4 | `scripts/fetch_bitget_data.py [pair]` | **CI** `fetch-bitget-data.yml` (workflow_dispatch) | Writes via `__file__` anchor; workflow's `git add data/historical/` **is** CWD-dependent (repo root) | `ROOT = parent.parent` |
| P5 | `scripts/sync_paper_to_supabase.py` | **CI** `paper-trading.yml` with `DB_PATH: db/paper_trading.db` | **CWD-DEPENDENT**: `DB_PATH = os.environ.get("DB_PATH", "db/paper_trading.db")` — relative default | env override in CI |
| P6 | `scripts/compare_live_vs_backtest.py` | manual / gate evaluation | None | `ROOT`, reads `db/paper_trading.db` + `monitoring/web/lib/backtest-reference.json` |
| P7 | `backtest/research/*.py` (7 scripts) | manual only (never CI) | None (`__file__`-anchored) | `ROOT = parent.parent.parent`, `sys.path.insert(backtest/)`, `OUT = parent.parent/reports/research/…`, `data/funding` |
| P8 | `python -m pytest tests/ -v` | **CI** `paper-trading.yml` (gates the daily run) | `python -m` puts CWD on `sys.path` (masks an import defect — see Step 3.2) | rootdir-less (no `pytest.ini`/`pyproject.toml`/`conftest.py` exist) |
| P9 | `python tests/test_live_signal.py --real` | documented in the file's own docstring (Telegram delivery check) | CWD-independent | `ROOT = parent.parent` |
| P10 | `db/backup_db.sh` | local cron (comment says cancelled) | **CWD-DEPENDENT by design**: `cd "$(dirname "$0")/.."` then `db/paper_trading.db` | script-relative; comment hardcodes `/home/kresna/project` |

### 2.2 Next.js entrypoints

| Kind | Count | Notes |
|---|---|---|
| `package.json` scripts | 6 | `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test:e2e` (`playwright test`) — all assume CWD = `monitoring/web` |
| App Router pages (`page.tsx`) | 14 | marketing + `/app/*` (auth-gated) + `/papertrading/*` + `/pricing` etc. |
| Route handlers (`route.ts`) | 16 | 14 under `app/api/**` (incl. `cron/daily-sync`, `cron/paper-sync`, `webhooks/stripe`), 2 under `app/auth/{callback,signout}` |
| Server actions | 0 | no `use server` anywhere in `monitoring/web` |
| Middleware | 1 | `proxy.ts` — Next 16 `proxy()` export, auth gate for `/app`, `/auth` |
| Playwright | 2 specs + 1 smoke | `testDir: "./e2e"` (relative to config), `webServer: npm run start` (port 3000) |
| Standalone script | 1 | `node monitoring/web/e2e/api-smoke-test.mjs` — absolute `https://` URLs only, no repo paths |

### 2.3 Database entrypoints

| Entrypoint | Path assumption |
|---|---|
| Supabase CLI (`supabase/config.toml` + `supabase/migrations/*.sql`) | **Directory-name convention**: CLI resolves `supabase/` relative to invocation dir (repo root). `deploy/migrate.sh` loops `$ROOT/supabase/migrations/*.sql` |
| SQLite schema | `db/schema.sql`, `executescript` on **every** engine start (`live_signal.connect()`), anchored via `ROOT` |
| SQLite state | `db/paper_trading.db` — created by engine, committed back by CI (`git add -f`) |
| Local backup | `db/backup_db.sh` → `db/backups/paper_trading_<date>.db` |
| Migration ordering guard | `tests/test_strategy_templates_seed.py` reads **exact filenames** in `supabase/migrations/` and asserts forward-only ordering |

### 2.4 CI/CD entrypoints (`.github/workflows/*`)

All four workflows run at **repo root**; none declares `working-directory`, `defaults:`, or `paths:` filters.

| File | Trigger | Commands | Paths touched | Artifacts | Env assumptions |
|---|---|---|---|---|---|
| `paper-trading.yml` | cron `0 1 * * *` + dispatch | `pip install ccxt pandas pyyaml pytest rich` → `python -m pytest tests/ -v` → `python paper_trading/live_signal.py` → `python scripts/sync_paper_to_supabase.py` → `git add -f db/paper_trading.db` + commit/push → failure: Telegram curl | `tests/`, `paper_trading/`, `scripts/`, `db/paper_trading.db` (implicit: `config.yaml`, `db/schema.sql`, `data/historical/` read by engine, `presets/` not used) | commits DB state back to `main` | `TELEGRAM_*`, `CRON_SECRET`, `DB_PATH=db/paper_trading.db`; git identity must be the owner (Vercel rejects bot identity) |
| `fetch-bitget-data.yml` | dispatch (optional `pair` input) | `pip install ccxt pandas pyyaml` → `python scripts/fetch_bitget_data.py [pair]` → `git add data/historical/` + commit/push | `scripts/fetch_bitget_data.py`, `data/historical/`, `config.yaml` (read) | commits CSVs to `main` | GitHub token with `contents: write`; Python 3.11 |
| `trendsentry-daily-sync.yml` | cron `30 1 * * *` + dispatch | `curl` → `https://trendsentry.vercel.app/api/cron/daily-sync` | **none** (no checkout) | none | `CRON_SECRET` |
| `test-bitget-api.yml` | dispatch only | inline `python - <<EOF` heredoc (`requests`, `ccxt`) | **none** (no checkout) | none | none |

### 2.5 Non-CI deployment entrypoints

| Entrypoint | Path assumption |
|---|---|
| `deploy/Dockerfile.engine` | build context = **repo root** (`context: ..`); `COPY backtest/ … paper_trading/ … monitoring/telegram_alert.py config.yaml db/schema.sql`; `CMD ["python","paper_trading/live_signal.py"]` |
| `deploy/Dockerfile.web` | `COPY monitoring/web/ ./`; `COPY --from=build /app/public ./public` — **`monitoring/web/public/` does not exist in the repo** (pre-existing latent break; deploy has never been built per `REPO_MAP.md`) |
| `deploy/docker-compose.yml` | `volumes: ../db:/srv/trendsentry/db`, `../data:/srv/trendsentry/data:ro` |
| `deploy/migrate.sh` / `backup.sh` / `restore.sh` / `export-cloud.sh` | `migrate.sh` → `$ROOT/supabase/migrations/*.sql`; others are URL/DB-target only |
| Vercel | **no `vercel.json`**; deploy root is configured *outside the repo* (dashboard setting + `monitoring/web/.vercel/project.json` → project `trendsentry`) |

---

## STEP 3 — IMPORT / DEPENDENCY GRAPH

### 3.1 Python — verified edges

```text
                    ┌────────────────────────────────────────────────────────┐
   PACKAGE IDENTITY │  import backtest.strategy   (needs repo root on sys.path)│
                    └───────────────┬────────────────────────────────────────┘
                                    ├── risk_manager/guards.py   (re-export position_size)
                                    ├── tests/test_strategy.py
                                    └── tests/test_risk.py

                    ┌────────────────────────────────────────────────────────┐
   SCRIPT IDENTITY  │  import strategy   (needs <root>/backtest on sys.path)   │
                    └───────────────┬────────────────────────────────────────┘
                                    ├── backtest/run_backtest.py   (script dir auto-added)
                                    ├── paper_trading/live_signal.py   (explicit sys.path insert)
                                    └── backtest/research/run_longshort_backtest.py

backtest/run_backtest.py  ◄── backtest/research/{correlation_mitigation, regime_segmentation,
                                                portfolio_size_experiment, run_capital_efficiency,
                                                sharpe_benchmark, run_longshort_backtest}
paper_trading/live_signal.py ──► monitoring/telegram_alert.py  (as top-level `telegram_alert`)
                              ──► risk_manager.guards          (lazy, in startup validation)
                              ──► llm_filter.filter            (lazy, config-gated `llm_filter.enabled`)
                              ──► config.yaml, db/schema.sql, db/paper_trading.db   (files)

cli.py ──► risk_manager.guards (doctor) ; subprocess ► backtest/run_backtest.py,
                                                        paper_trading/live_signal.py

scripts/compare_live_vs_backtest.py ──► monitoring/web/lib/backtest-reference.json   (FILE edge, engine→web)
scripts/fetch_bitget_data.py ──► config.yaml, data/historical/*.csv
scripts/sync_paper_to_supabase.py ──► db/paper_trading.db, Supabase HTTP API (no project imports)

tests:
  test_strategy.py, test_risk.py          → backtest.strategy, risk_manager.guards  (package identity)
  test_backtest_cash.py                   → sys.path += <root>/backtest → run_backtest
  test_live_signal.py                     → sys.path += <root>/paper_trading, <root>/monitoring → live_signal
  test_filter.py                          → sys.path += <root> → llm_filter.filter
  test_compare.py                         → sys.path += <root>/scripts → compare_live_vs_backtest
  test_presets.py                         → reads <root>/presets/*.yaml          (no import)
  test_strategy_templates_seed.py         → reads <root>/supabase/migrations/*.sql (no import)
  test_cli.py                             → subprocess `cli.py`, `cwd=<root>`
```

**Circular dependencies: none.** `backtest/` does not import `risk_manager/`, `paper_trading/`,
`llm_filter/` or anything under `scripts/`; `risk_manager/` → `backtest.strategy` is a single
one-way edge; `monitoring/web` imports nothing from Python.

### 3.2 Undesirable / fragile dependencies (REPORT ONLY — not fixed here)

1. **Dual module identity for one file.** `backtest/strategy.py` is importable both as
   `backtest.strategy` (package) and as `strategy` (script-dir). Verified empirically:

   ```text
   same module object:  False
   same function object: False     # position_size is not position_size
   a: /home/kresna/project/backtest/strategy.py
   b: /home/kresna/project/backtest/strategy.py
   ```

   Consequence: in one process, `risk_manager.guards.position_size` (package identity) and
   `paper_trading.live_signal`'s `position_size` (script identity) are **different function
   objects bound to the same source file**. Today they are identical code, so behavior is
   correct; the `test_risk.py` "single source of truth" assertion (`position_size is strat_size`)
   only proves non-drift *within one identity*. Any future `if x is position_size` or
   `isinstance`/registry check across the engine becomes a latent bug.
2. **Test suite is import-order dependent.** Verified:

   | Command | Result |
   |---|---|
   | `pytest tests/` from repo root | **70 passed** |
   | `python -m pytest tests/ -v` (CI form) | **70 passed** |
   | `cd /tmp && pytest /home/kresna/project/tests` | **70 passed** |
   | `pytest tests/test_strategy.py` (repo root) | **ERROR: No module named 'backtest'** |
   | `cd /tmp && pytest …/tests/test_strategy.py` | **ERROR: No module named 'backtest'** |
   | `pytest tests/test_filter.py tests/test_strategy.py` | 26 passed |

   Mechanism: no `conftest.py`, no `pytest.ini`/`pyproject.toml`; the repo root only reaches
   `sys.path` because `tests/test_filter.py` executes `sys.path.insert(0, str(ROOT))` during
   collection, and alphabetically precedes `test_risk.py`/`test_strategy.py`. CI additionally
   masks it via `python -m` (which prepends CWD). **Moving any of `backtest/`, `tests/`, or
   `llm_filter/` will silently change this ordering contract.**
3. **`monitoring/` is two unrelated systems.** `monitoring/telegram_alert.py` (engine Python)
   and `monitoring/web/` (SaaS) share a directory name; `live_signal.py` and
   `tests/test_live_signal.py` must put `monitoring/` on `sys.path` to reach the alert module.
4. **Engine → web file dependency.** `scripts/compare_live_vs_backtest.py` reads
   `monitoring/web/lib/backtest-reference.json` (Snapshot B). The engine gate depends on a
   file inside the frontend tree.
5. **Research depends on script identity, not package identity.** All 7 research scripts
   mutate `sys.path` to import `run_backtest`/`strategy` as top-level modules. They are not
   importable as `backtest.research.*` today (`backtest/research/` has no `__init__.py`).
6. **Depth-locked file.** `monitoring/telegram_alert.py` resolves `.env` as
   `Path(__file__).parent.parent / ".env"` — it must remain exactly one directory below repo root.

### 3.3 TypeScript graph

```text
app/**/page.tsx  ──► @/lib/{supabase/server,site,csrf,validations,constants,reference,…}
app/**/route.ts  ──► @/lib/{supabase/{server,admin,client},stripe,bitget,rate-limit,deviation,
                   │        db-supabase,telegram,encryption,env,validations,csrf,reference}
app/components/**──► ../components/marketing/* , @/app/components/AnalyticsBeacon (mixed styles)
lib/reference.ts ──► ./backtest-reference.json      (resolveJsonModule; Snapshot B)
lib/supabase/*   ──► @supabase/{ssr,supabase-js}
proxy.ts         ──► @/lib/supabase/server-ish client creation (auth gate)
e2e/*.spec.ts    ──► @playwright/test only (BASE_URL from env; AUTH_FILE relative to CWD)
```

- Alias `@/*` → `monitoring/web/*` (`tsconfig.json paths`); `include: **/*.ts, **/*.tsx`
  scoped to the web directory.
- **No TypeScript import crosses into Python/research areas.** The only cross-tree edge in the
  whole repo is the reverse file read in §3.1 (Python → `lib/backtest-reference.json`).
- **No circular imports** in TypeScript either.
- Cosmetic: three coexisting import styles (`@/lib/…`, `../components/…`, `@/app/components/…`).

---

## STEP 4 — PATH-SENSITIVE CODE

| File | Current assumption | Would break if moved? | Severity |
|---|---|:--:|:--:|
| `backtest/run_backtest.py` | `ROOT=parent.parent` → `config.yaml`, `data/historical/*.csv`; `REPORTS=parent/reports`; `from strategy import` → script-dir identity | **YES** | **HIGH** |
| `paper_trading/live_signal.py` | `sys.path` ← `ROOT`, `ROOT/backtest`, `ROOT/monitoring`; `ROOT/config.yaml`, `ROOT/db/schema.sql`, `ROOT/db/paper_trading.db` | **YES** | **HIGH** |
| `risk_manager/guards.py` | `from backtest.strategy import position_size` → package identity + `backtest/` name | **YES** | **HIGH** |
| `cli.py` | `ROOT/backtest/run_backtest.py`, `ROOT/paper_trading/live_signal.py`, `ROOT/db/paper_trading.db`, `ROOT/config.yaml` | **YES** | **HIGH** |
| `monitoring/telegram_alert.py` | `.env` = `Path(__file__).parent.parent/.env` (depth = exactly 1) | **YES** | **HIGH** |
| `backtest/research/*.py` (7) | `ROOT=parent.parent.parent`; `sys.path.insert(backtest/)`; `OUT=parent.parent/reports/research/…`; `data/funding` | **YES** | **HIGH** |
| `tests/*.py` (all 9) | `ROOT=parent.parent` + explicit `sys.path.insert` targets (`backtest`, `paper_trading`, `monitoring`, `scripts`, `llm_filter`) | **YES** | **HIGH** |
| `tests/test_presets.py` | `ROOT/presets/*.yaml` + frozen parameter values | **YES** | MEDIUM |
| `tests/test_strategy_templates_seed.py` | `ROOT/supabase/migrations/<exact filenames>`, asserts file ordering | **YES** | MEDIUM |
| `tests/test_cli.py` | `ROOT/cli.py`, `cwd=ROOT` | **YES** | MEDIUM |
| `.github/workflows/paper-trading.yml` | `tests/`, `paper_trading/live_signal.py`, `scripts/sync_paper_to_supabase.py`, `db/paper_trading.db`, `DB_PATH` relative to repo root | **YES** | **HIGH** |
| `.github/workflows/fetch-bitget-data.yml` | `scripts/fetch_bitget_data.py`, `git add data/historical/` (repo-root CWD) | **YES** | **HIGH** |
| `deploy/Dockerfile.engine` | `COPY backtest/ paper_trading/ monitoring/telegram_alert.py config.yaml db/schema.sql`; `CMD python paper_trading/live_signal.py` | **YES** | **HIGH** |
| `deploy/docker-compose.yml` | `context: ..`, `volumes: ../db`, `../data` | **YES** | **HIGH** |
| `deploy/Dockerfile.web` | `COPY monitoring/web/`; `COPY --from=build /app/public` (dir currently missing) | **YES** | MEDIUM |
| `deploy/migrate.sh` | `$ROOT/supabase/migrations/*.sql` | **YES** | **HIGH** |
| `db/backup_db.sh` | `cd "$(dirname $0)/.."`; `db/paper_trading.db`, `db/backups/`; hardcoded `/home/kresna/project` in its cron comment | **YES** | MEDIUM |
| `scripts/sync_paper_to_supabase.py` | **default relative `db/paper_trading.db`** → depends on CWD (CI sets `DB_PATH`) | YES if CWD or dir changes | MEDIUM |
| `scripts/fetch_bitget_data.py` | `ROOT=parent.parent` → `config.yaml`, `data/historical/` | **YES** | MEDIUM |
| `scripts/compare_live_vs_backtest.py` | `ROOT/db/paper_trading.db` + `ROOT/monitoring/web/lib/backtest-reference.json` | **YES** | MEDIUM |
| `.gitignore` | `backtest/reports/*.{csv,png}`, `backtest/reports/presets/*/*`, `db/*.db*`, `paper_trading/logs/`, `db/backups/`, `monitoring/web/e2e/.auth/`, `!monitoring/web/.env.example` | YES (paths become dead) | MEDIUM |
| `.dockerignore` | `db/*.db*`, `data/`, `backtest/reports/`, `**/node_modules`, `**/.next` | YES (leaks state into images) | MEDIUM |
| `monitoring/web/tsconfig.json` | `@/*` → `./*`; `include: **/*.ts,*.tsx` scoped to web root | YES (internal moves) | MEDIUM |
| `monitoring/web/playwright.config.ts` | `testDir: "./e2e"` (config-relative), `webServer: npm run start` (CWD = web root) | YES | MEDIUM |
| `monitoring/web/e2e/free-tier-flow.spec.ts` | `AUTH_FILE = "e2e/.auth/user.json"` → **relative to process CWD**, not to the spec file | YES if invoked from another CWD | MEDIUM |
| `monitoring/web/lib/reference.ts` | `import ref from "./backtest-reference.json"` | YES | MEDIUM |
| `supabase/config.toml` + `supabase/migrations/` | Supabase CLI convention: `supabase/` at invocation dir; `deploy/migrate.sh` depends on it | **YES** | **HIGH** |
| `.github/workflows/*.yml` | implicit repo-root CWD (no `working-directory` declared anywhere) | YES if repo layout changes root-level dirs | MEDIUM |
| Vercel (external) | deploy root configured in dashboard, mirrored by `monitoring/web/.vercel/project.json` | YES if `monitoring/web` moves | **HIGH** |
| `monitoring/web/e2e/api-smoke-test.mjs` | absolute `https://trendsentry.vercel.app` URLs; path only in its usage comment | NO | LOW |
| `.github/workflows/{trendsentry-daily-sync,test-bitget-api}.yml` | no repo paths at all | NO | LOW |

**Summary:** 27 distinct path contracts; **20 HIGH**. Every HIGH row is rooted either in
`Path(__file__).parent…` arithmetic, `sys.path` mutation, CI CWD, Docker `COPY`/`CMD`, or a
framework convention (`supabase/`, Vercel root).

---

## STEP 5 — DOCUMENTATION REFERENCES

Count of repo-path-like references (`<dir>/<file>` patterns) per document:

| Document | Path refs | Class | Must update on move? |
|---|---:|---|---|
| `REPO_MAP.md` | 218 | living map | **Yes** — it *is* the inventory (§2 tree, §10 file list, Lampiran A) |
| `ARCHITECTURE.md` | 41 | living | **Yes** — §2 boundaries table, §3 file table, §16 SoT table |
| `TASKS.md` | 22 | living | Yes (checklist references `backtest/reports/…`, `presets/…`, workflows) |
| `AUDIT.md` | 15 | living backlog | Yes |
| `README.md` | 14 | living | Yes (Quick start commands) |
| `PLAN.md` | 14 | living roadmap (§4 structure is documented as **stale**) | Yes, but only as annotation |
| `AGENTS.md` | 9 | living rules (§5 says: follow ARCHITECTURE/REPO_MAP, not PLAN §4) | Yes |
| `SECURITY-ACTIONS.md` | 8 | living | Yes |
| `RULES.md` | 4 | living | Yes |
| `deploy/RUNBOOK.md` | 6 | living ops | Yes (`docker exec engine python paper_trading/live_signal.py`, `./deploy/*.sh`) |
| `monitoring/web/README.md`, `monitoring/web/AGENTS.md` | 4 / 4 | living (web-local) | Only if `monitoring/web` moves |
| `backtest/DESIGN.md` | 7 | historical design (some stale numbers) | Only if `backtest/` moves |
| `PHASE2G_…AUDIT.md` | 106 | **historical evidence** | No — do not rewrite records |
| `OD7_…AUDIT.md` | 65 | **historical evidence (in-flight series)** | No |
| `PHASE2_SOURCE_OF_TRUTH.md` | 57 | **historical evidence** | No |
| `PHASE2D…`, `PHASE2F…`, `PHASE2B2…`, `PHASE2H…`, `PHASE2E…`, `PHASE2C…`, `PHASE2C2…` | 45/28/25/24/24/22/9 | **historical evidence** | No |
| `OD5…`, `OD2…`, `OD8…`, `OD6…`, `OD4…`, `OD3…` | 15/7/6/6/5/5 | **decision records (OD-6 open)** | No |

Key findings:

- **Total ≈ 800 path mentions across 27 documents.** ~130 of them live in the *living* doc
  set (README/ARCHITECTURE/PLAN/TASKS/AGENTS/RULES/AUDIT/SECURITY-ACTIONS/REPO_MAP/RUNBOOK/web docs).
- **Cross-links exist only inside the living set.** Verified: the only relative markdown links
  between project documents are `README → ARCHITECTURE, REPO_MAP`; `PLAN → ARCHITECTURE,
  REPO_MAP`; `ARCHITECTURE/REPO_MAP/TASKS/AGENTS/RULES/AUDIT/PHASE2_SOURCE_OF_TRUTH →` each
  other by bare filename. **No document links to any `PHASE2*` or `OD*` file, and no code,
  workflow, config or test references them** (grep over `*.py/*.ts/*.tsx/*.yml/*.yaml/*.json/*.sh`
  → 0 hits, except one prose mention inside `e2e/free-tier-flow.spec.ts` comment).
- Stale-but-out-of-scope references observed (reported, not fixed): `README`/`AGENTS` say
  "64 tests" (actual **70**); `REPO_MAP` §10.3 says 8 test files (actual 9); `PLAN.md` §4
  folder structure marked stale; `db/migrations/`, `backtest/fetch_data.py`,
  `monitoring/telegram_bot.py`, `llm_filter/deepseek_client.py`,
  `risk_manager/position_sizing.py` appear only as *explicit "does not exist"* notes.

---

## STEP 6 — TEST PATH DEPENDENCIES

| Test | Depends on path? | Depends on import path? | Move risk |
|---|:--:|:--:|:--:|
| `tests/test_strategy.py` | no fixtures | **yes** — `backtest.strategy` (needs repo root on `sys.path`, currently supplied by *another test file*) | **HIGH** |
| `tests/test_risk.py` | no | **yes** — `backtest.strategy` + `risk_manager.guards`; asserts `position_size is strat_size` (identity-sensitive) | **HIGH** |
| `tests/test_backtest_cash.py` | no | **yes** — `sys.path += ROOT/backtest` → `run_backtest` | **HIGH** |
| `tests/test_live_signal.py` | no | **yes** — `sys.path += ROOT/paper_trading`, `ROOT/monitoring` → `live_signal` (which itself re-inserts 3 paths); also `--real` mode needs root `.env` | **HIGH** |
| `tests/test_filter.py` | no | **yes** — `sys.path += ROOT` → `llm_filter.filter` (**also the hidden provider of repo root for the whole suite**) | **HIGH** |
| `tests/test_compare.py` | no | **yes** — `sys.path += ROOT/scripts` → `compare_live_vs_backtest` (that module reads `monitoring/web/lib/backtest-reference.json` at **import time**) | **HIGH** |
| `tests/test_cli.py` | **yes** — `ROOT/cli.py`, `cwd=ROOT` | subprocess only | MEDIUM |
| `tests/test_presets.py` | **yes** — `ROOT/presets/*.yaml` (frozen values) | no | MEDIUM |
| `tests/test_strategy_templates_seed.py` | **yes** — `ROOT/supabase/migrations/<2 exact filenames>` + ordering assertion | no | MEDIUM |
| Playwright `e2e/auth.spec.ts` | CWD-relative config (`./e2e`) | `@playwright/test` | MEDIUM |
| Playwright `e2e/free-tier-flow.spec.ts` | **yes** — `AUTH_FILE="e2e/.auth/user.json"` relative to **process CWD** | `@playwright/test` | MEDIUM |
| `e2e/api-smoke-test.mjs` | no (absolute URLs) | none | LOW |

Additional facts:

- **No `conftest.py`, no `pytest.ini`, no `pyproject.toml`, no `setup.cfg`** exist → pytest
  discovery relies entirely on per-file `sys.path` surgery and (in CI) on `python -m`.
- Test data locations: `presets/`, `supabase/migrations/`, `monitoring/web/lib/backtest-reference.json`
  (via module import), plus synthetic in-test frames/SQLite temp DBs (no repo fixtures).
- No `subprocess` calls inside tests other than `test_cli.py` (`cli.py` at `ROOT`) and the
  documented `--real` mode.

---

## STEP 7 — GITHUB / CI DEPENDENCIES

Exact repository paths used by workflows (nothing else is referenced):

| Workflow | Paths | Working directory |
|---|---|---|
| `paper-trading.yml` | `tests/` (pytest), `paper_trading/live_signal.py`, `scripts/sync_paper_to_supabase.py`, `db/paper_trading.db` (env `DB_PATH`, then `git add -f`), implicit `config.yaml` + `db/schema.sql` | repo root (implicit; no `working-directory` key exists in any workflow) |
| `fetch-bitget-data.yml` | `scripts/fetch_bitget_data.py`, `git add data/historical/`, implicit `config.yaml` | repo root (implicit) |
| `trendsentry-daily-sync.yml` | none (no `actions/checkout`) | n/a |
| `test-bitget-api.yml` | none (no `actions/checkout`; inline heredoc) | n/a |

Scheduled jobs: `0 1 * * *` (paper trading), `30 1 * * *` (Vercel daily-sync trigger),
`workflow_dispatch` ×2. Only `paper-trading.yml` and `fetch-bitget-data.yml` can **write to
the repo** (`contents: write`) — both hardcode pathspecs (`db/paper_trading.db`,
`data/historical/`) in their commit steps. Renaming either directory silently breaks persistence.

Dependency installs are also inline: `paper-trading.yml` pins `ccxt pandas pyyaml pytest rich`
(comment records a past outage when `rich` was missing), `fetch-bitget-data.yml` pins
`ccxt pandas pyyaml` — **not** `requirements.txt` (which additionally carries `vectorbt`,
`matplotlib`, `requests`, `numpy`, and lacks `scipy`/`yfinance` used by research scripts).

---

## STEP 8 — DIRECTORY OWNERSHIP MATRIX

| Directory | Primary system | Owner responsibility | Consumers | Move safety |
|---|---|---|---|---|
| `backtest/` (engine: `strategy.py`, `run_backtest.py`) | PYTHON ENGINE | Backtest sim + **shared** indicator/sizing SoT | `paper_trading/`, `risk_manager/`, `tests/`, research scripts, CLI, CI | **DO NOT MOVE YET** — shared across backtest+paper under two import identities; any move requires package-identity decision (Wave 2) |
| `backtest/research/` | RESEARCH | Reproducible research scripts | none in runtime/CI; writes `backtest/reports/research/` | **DO NOT MOVE YET** — ownership unresolved, research-only, `sys.path`-coupled to `backtest/` |
| `backtest/reports/` | GENERATED+COMMITTED (evidence) | Gate evidence + Snapshot A metrics | docs, `ARCHITECTURE.md §16`, decision records | **DO NOT MOVE YET** — writers (`REPORTS`, research `OUT`) are `__file__`-anchored; Snapshot B reproducibility |
| `paper_trading/` | PAPER TRADING | Daily signal engine + SQLite state | CI, CLI, Docker engine, `tests/test_live_signal.py` | **DO NOT MOVE YET** — CI + Docker + CLI path contract |
| `risk_manager/` | PYTHON ENGINE | Guardrails / config validation / circuit breaker | `live_signal` (lazy), `cli.py doctor`, `tests/test_risk.py` | **CONDITIONAL** — 4 import sites, but identity coupling to `backtest.strategy` must be resolved first |
| `llm_filter/` | PYTHON ENGINE (future Fase 3) | Filter contract skeleton | `live_signal` (config-gated), `tests/test_filter.py` (**provides repo root to the suite**) | **CONDITIONAL** — moving it breaks the hidden `sys.path` order contract |
| `monitoring/telegram_alert.py` | PYTHON ENGINE | Telegram transport | `live_signal`, `test_live_signal`, Docker `COPY`, docs | **CONDITIONAL** — depth-locked `.env` + 3 code touchpoints + Docker |
| `monitoring/web/` | APPLICATION (SaaS) | Next.js product, read-only display + product backend | Vercel (external root), `scripts/compare_live_vs_backtest.py` (JSON), Dockerfile.web, `.gitignore`, ~15 docs | **DO NOT MOVE YET** — external Vercel root-dir setting is not in the repo |
| `scripts/` | SCRIPT | Data fetch, sync, gate evaluation | CI (2 files), `tests/test_compare.py`, CLI (indirect) | **CONDITIONAL** — path-anchored; safe only with coordinated CI update |
| `presets/` | CONFIG | Frozen preset packs (locked by test) | `run_backtest` (env `PRESET`), `tests/test_presets.py`, docs | **DO NOT MOVE YET** — frozen artifacts under AGENTS rule #2; values are also frozen by test |
| `config.yaml` | CONFIG | SoT for all strategy/risk params | engine, CLI, fetch script, Docker, CI | **DO NOT MOVE** — root-level SoT referenced by `ROOT/config.yaml` in 3 modules |
| `db/` | DATABASE | SQLite schema + committed state | engine (every start), CI (commit), CLI, backup script, Docker volume | **DO NOT MOVE** — CI commit pathspec + Docker volume + `.gitignore` patterns |
| `supabase/` | SUPABASE | Postgres schema SoT | Supabase CLI convention, `deploy/migrate.sh`, `tests/test_strategy_templates_seed.py` | **DO NOT MOVE** — framework convention + ordering test |
| `data/` | DATA | Historical/funding CSV inputs | `run_backtest`, fetch script, research, Docker volume | **DO NOT MOVE YET** — OD-5 (data integrity/rebuild) decisions are open; `data/historical` is also a CI write pathspec |
| `deploy/` | DEPLOYMENT | Docker/VPS assets | Docker build context `..`, RUNBOOK | **DO NOT MOVE** — `context: ..` and `../db` volume anchors assume `deploy/` is one level below root |
| `tests/` | TEST | pytest suite | CI gate | **DO NOT MOVE YET** — 9/9 files compute `ROOT = parent.parent`; no `conftest.py` |
| `.github/workflows/` | DEPLOYMENT/CI | Schedulers + persistence | GitHub | **DO NOT MOVE** — platform-fixed location |
| `cli.py` | PYTHON ENGINE | Local CLI wrapper | `tests/test_cli.py`, README quick start | **DO NOT MOVE** — root anchor for `db/`/`config.yaml`; benefit of moving ≈ 0 |
| Root `*.md` (living 10) | DOCUMENTATION | Governance + roadmap | each other (relative links), agents (auto-read `AGENTS.md`) | **DO NOT MOVE** — root is the convention for agent-visible docs |
| Root `*.md` (PHASE2\*, 9 tracked) | DOCUMENTATION (historical audit) | Closed forensic records | **0 code refs, 0 inbound links** | **SAFE** — see Step 10 |
| Root `*.md` (OD\*, 1 tracked + 6 untracked) | DOCUMENTATION (decision log) | Active decision series (OD-6 open) | 0 code refs, 0 inbound links | **SAFE technically, NOT YET** — wait until OD series closes |

---

## STEP 9 — PROPOSED TARGET TREE

One recommended target. It preserves the requested conceptual boundaries and adds exactly one
new directory (`docs/audit/`) that existing code justifies: 16 forensic documents currently
compete with entrypoints and living governance docs at repo root.

```text
.
├── README.md AGENTS.md PLAN.md TASKS.md RULES.md AUDIT.md          ← living docs: STAY at root
│   ARCHITECTURE.md REPO_MAP.md SECURITY-ACTIONS.md PHASE2_SOURCE_OF_TRUTH.md
│
├── docs/
│   └── audit/                 ← MOVED (Wave 0): closed forensic records only
│       ├── PHASE2_SOURCE_OF_TRUTH.md PHASE2B2_AUDIT.md PHASE2C_SECURITY_REPRODUCIBILITY_AUDIT.md
│       ├── PHASE2C2_TEMPLATE_SEED_BLOCKER.md PHASE2D_PRODUCT_REALITY_AUDIT.md
│       ├── PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md PHASE2F_TARGET_ARCHITECTURE.md
│       ├── PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md
│       ├── PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md
│       └── (OD2…OD8 move here LATER, when the OD series closes — not now)
│
├── cli.py                     ← STAY (root CLI entrypoint)
├── config.yaml                ← STAY (root SoT, read as ROOT/config.yaml)
├── requirements.txt requirements-engine.txt .env.example .gitignore .dockerignore LICENSE
│
├── backtest/                  ← STAY (engine + research + reports — one bounded context)
│   ├── __init__.py strategy.py run_backtest.py DESIGN.md
│   ├── research/              ← STAY (research scripts coupled to run_backtest script identity)
│   └── reports/               ← STAY (writers are __file__-anchored; Snapshot A/B evidence)
│
├── paper_trading/             ← STAY (CI + Docker + CLI path contract)
├── risk_manager/              ← STAY (imports backtest.strategy; identity resolution = Wave 2)
├── llm_filter/                ← STAY (Fase 3 skeleton; supplies repo root to pytest today)
│
├── monitoring/                ← STAY (boundary documented, not restructured)
│   ├── telegram_alert.py      ← STAY now (Wave 1 candidate: move to alerting/ with 3 touchpoints)
│   └── web/                   ← STAY now (Wave 2 candidate: top-level web/ — needs Vercel change)
│
├── scripts/                   ← STAY
├── presets/                   ← STAY (frozen values + frozen by test)
├── db/                        ← STAY (schema + committed state + CI pathspec)
├── data/                      ← STAY (OD-5 decisions still open; CI writes data/historical/)
├── supabase/                  ← STAY (CLI convention: supabase/migrations)
├── deploy/                    ← STAY (docker context .. + ../db, ../data volumes)
├── tests/                     ← STAY (+ Wave 1 enabler: tests/conftest.py, not a move)
└── .github/workflows/         ← STAY (platform-fixed)
```

Explicitly **not** created (no existing code justifies them): `execution/`, `strategy/`,
`portfolio/`, `services/`, `domain/`, `core/`, `api/`, `packages/`, `backend/`, `frontend/`,
`engine/`, `lib/` at root, `docs/api/`, `archive/`.

---

## STEP 10 — MOVE MAP

### 10.1 Approved candidates (Wave 0 — no runtime imports or behavior touched)

All nine files below are **tracked**, **closed**, referenced by **zero** code/workflow/test
files and linked from **zero** other documents (verified by grep over `*.py/*.ts/*.tsx/*.yml/
*.yaml/*.json/*.sh` and by extracting every `](…)` markdown link in every project `.md`).

```text
PHASE2_SOURCE_OF_TRUTH.md
    -> docs/audit/PHASE2_SOURCE_OF_TRUTH.md
    -> REASON: historical forensic record; root must expose entrypoints + living governance
    -> DEPENDENCIES TO UPDATE: none (no inbound code refs, no inbound links; internal prose
       references to `REPO_MAP.md` etc. stay as readable text, not links)
    -> RISK: LOW

PHASE2B2_AUDIT.md                         -> docs/audit/PHASE2B2_AUDIT.md                      -> (same) -> none -> LOW
PHASE2C_SECURITY_REPRODUCIBILITY_AUDIT.md  -> docs/audit/…                                     -> none -> LOW
PHASE2C2_TEMPLATE_SEED_BLOCKER.md          -> docs/audit/…                                     -> none -> LOW
PHASE2D_PRODUCT_REALITY_AUDIT.md           -> docs/audit/…                                     -> none -> LOW
PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md   -> docs/audit/…                                     -> none -> LOW
PHASE2F_TARGET_ARCHITECTURE.md             -> docs/audit/…                                     -> none -> LOW
PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md  -> docs/audit/…  (2 prose mentions of REPO_MAP.md)    -> none -> LOW
PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md -> docs/audit/…                       -> none -> LOW
```

**Deferred by design (same target, later wave):**

```text
OD2_ENTRY_EXECUTION_STOP_DECISION.md
OD3…OD8_*.md (6 files; OD6 is being written right now)
    -> docs/audit/
    -> REASON (later): decision records are a SERIES; splitting OD2 from OD3–OD8 creates two homes
    -> DEPENDENCIES: none (same verification as above), but the working set must not move under an
       active OD (OD-6) run
    -> RISK: LOW technically / TIMING-sensitive — wait for the OD series to close
```

### 10.2 Conditional candidates (Wave 1 — require coordinated reference updates)

```text
monitoring/telegram_alert.py
    -> alerting/telegram_alert.py          (or keep-name equivalent)
    -> REASON: splits two unrelated systems currently sharing the `monitoring/` name;
               removes the need for `sys.path.insert(ROOT/"monitoring")`
    -> DEPENDENCIES: paper_trading/live_signal.py (sys.path line 33),
                     tests/test_live_signal.py (sys.path line 19),
                     deploy/Dockerfile.engine (COPY path),
                     docs: ARCHITECTURE §3, REPO_MAP §2/§10, README (≈18 mentions),
                     .env anchor must be re-checked (currently `parent.parent/.env` —
                     `alerting/` is also depth 1, so behavior is preserved)
    -> RISK: MEDIUM (3 code touchpoints + Docker + docs; CI unaffected)

tests/conftest.py  (NEW FILE — not a move, but the enabler for any later move)
    -> REASON: removes the hidden cross-test sys.path order contract (Step 3.2 #2)
    -> DEPENDENCIES: none at import sites; changes only "can a subset run standalone"
    -> RISK: LOW-MEDIUM (it is a test-infrastructure change → needs owner sign-off + recorded
             in TASKS.md; CI already runs the full suite so CI behavior is unchanged)

data/historical/{BCH,LTC,PAXG}_USDT_1d.csv + data/funding/
    -> data/research/
    -> REASON: separate research leftovers from production input (REPO_MAP Lampiran A)
    -> DEPENDENCIES: any research loader of those pairs, backtest/research/fetch_funding.py
                     (OUT_DIR), .gitignore/.dockerignore (they target `data/` wholesale →
                     still fine), docs (REPO_MAP §10.4, ARCHITECTURE), possibly OD-5 outcome
    -> RISK: MEDIUM-HIGH — BLOCKED by open OD-5 data-integrity decisions and by
             REPO_MAP §18.14 (do not delete research CSVs)
    -> VERDICT: do not do this in the first cleanup
```

### 10.3 Explicit non-moves (see Step 8 for the reasoning)

No Python source file has an approved move. Specifically **not** proposed now:
`backtest/strategy.py`, `backtest/run_backtest.py`, `backtest/research/*`, `paper_trading/`,
`risk_manager/`, `llm_filter/`, `scripts/*`, `presets/*`, `db/*`, `supabase/*`, `deploy/*`,
`tests/*`, `cli.py`, `config.yaml`, `monitoring/web/*`, `.github/workflows/*`, `data/*`.

---

## STEP 11 — DO NOT OVER-REFactor

Files that look messy but whose **architectural role is unresolved** — unknown ownership is a
reason to preserve, not to move:

| Item | Why it looks messy | Why it must NOT move now |
|---|---|---|
| `backtest/research/*.py` (7) | ad-hoc `sys.path.insert`, no `__init__.py`, duplicated `OUT`/`ROOT` arithmetic | research ownership is under PHASE2F/PHASE2G/OD-8 review; they are bound to `backtest/` script identity and to `backtest/reports/research/` writers |
| `backtest/reports/**` (23 tracked evidence files) | mixes engine metrics, decision log, CSVs/PNGs, research subfolders | Snapshot A evidence + `REPORTS`/`OUT` writers are `__file__`-anchored; REPO_MAP §18.13 forbids touching |
| `monitoring/telegram_alert.py` vs `monitoring/web/` | one directory, two systems | the split only pays off together with a `monitoring/web` → `web/` decision, which needs Vercel-side change (Wave 2) |
| `llm_filter/` (49-line skeleton, disabled) | looks like dead code | Fase 3 gate — REPO_MAP §18.18 explicitly: not dead |
| `deploy/**` | never built (RUNBOOK only) | Fase 4 / VPS prep — REPO_MAP §18.18 |
| `requirements.txt` `vectorbt` line | dead dependency | dependency change, not structure; already tracked as backlog (PHASE2B2 §3) |
| `data/historical/{BCH,LTC,PAXG}*` | "leftover" pairs mixed with production | OD-5 (data integrity/rebuild) is open — these files may be *recreated*, not moved |
| `db/backup_db.sh` | cron cancelled, hardcoded `/home/kresna/project` comment | decision pending (archival vs reactivation) — REPO_MAP §17 step 12 |
| `.github/workflows/test-bitget-api.yml` | one-off probe workflow | archival decision pending — same backlog item |
| `OD2…OD8_*.md` at root | root clutter | active decision series (OD-6 running); moving a live record breaks the reviewer's context |
| `monitoring/web/e2e/api-smoke-test.mjs` | sits next to Playwright specs but isn't one | unclear whether it belongs to e2e or CI; no cost to leaving it |
| `cli.py` at root | root-level Python file | it is the advertised local entrypoint (`prog="trendsentry"`); moving it buys nothing |
| `PHASE2_*`, `AUDIT.md`, `SECURITY-ACTIONS.md` naming | inconsistent doc naming | renaming is content/semantics, not structure; out of scope for a directory cleanup |

---

## STEP 12 — CLEANUP WAVES

### Wave 0 — no risk (runtime imports and behavior untouched)

1. Create `docs/audit/`; `git mv` the nine closed `PHASE2*` documents into it (Step 10.1).
2. Nothing else. No code, no config, no CI, no tests, no `.gitignore` edits.

### Wave 1 — package/documentation structure (controlled reference updates, no behavior change)

Requires owner sign-off, one commit each, each verified by Step 13 checks:

1. `tests/conftest.py` — put the repo root on `sys.path` once, so test imports stop depending
   on collection order. **Prerequisite for every later Python move.** (Not a directory move.)
2. `monitoring/telegram_alert.py` → `alerting/telegram_alert.py` (3 code touchpoints + Docker
   + docs). Independent of Wave 0.
3. Documentation drift fixes that reference paths (README/AGENTS "64 tests" → 70, `PLAN.md` §4
   annotation) — doc-only, but explicitly *after* the move set is frozen so it is done once.
4. Optional, only after OD-5 closes: `data/` research/production split.

### Wave 2 — architectural boundary (DO NOT IMPLEMENT YET)

Wait for the product/execution architecture (PHASE2F) and the OD series to close:

1. Unify Python import identity: make `backtest.strategy` the *only* identity (or introduce a
   real package layout). Touches `live_signal.py`, `run_backtest.py`, research scripts, all
   tests — i.e. this is the point where `backtest/` could finally move.
2. `monitoring/web/` → top-level `web/` (needs Vercel root-directory change + `.gitignore`,
   `.dockerignore`, `Dockerfile.web`, `scripts/compare_live_vs_backtest.py`, ~15 docs).
3. `risk_manager/` + shared engine module placement, `backtest/reports/` vs research artifact
   split, `db/` relocation.
4. Any `execution/`-plane layout — **do not create the directory before the code exists**.

---

## STEP 13 — ACCEPTANCE TESTS (for a FUTURE directory-only refactor)

Run in this order; **do not run in this tree while OD-6 is open** — use two throwaway worktrees
(pre-move and post-move) so Snapshot B reproduction never writes into the audited tree.

### Python

```bash
python -m pytest tests/ -v                     # must stay 70 passed (baseline: 70 passed, 8.08s)
pytest tests/ -q                               # console-script form, repo root
pytest tests/test_strategy.py -q               # subset form: currently FAILS; must PASS once
                                               # tests/conftest.py (Wave 1) exists
cd /tmp && pytest <repo>/tests -q              # absolute-path form, foreign CWD
python - <<'EOF'                               # import smoke: every identity, both directions
import sys; sys.path[:0] = [".", "backtest"]
import backtest.strategy, strategy, risk_manager.guards, llm_filter.filter
import run_backtest  # after sys.path += backtest
EOF
python cli.py --help && python cli.py doctor   # CLI smoke (needs deps + config guardrail OK)
python backtest/run_backtest.py                # backtest reproduction (see Snapshot B below)
python -c "import paper_trading.live_signal" 2>/dev/null || \
  python paper_trading/live_signal.py --help   # paper-trading startup/import validation
```

### Snapshot B reproducibility (byte-for-byte)

```bash
# in the PRE-move worktree and in the POST-move worktree, separately:
python backtest/run_backtest.py
diff -r --brief <pre>/backtest/reports <post>/backtest/reports      # metrics.md, decision_log.md,
                                                                    # presets/*/metrics.md identical
cmp <pre>/monitoring/web/lib/backtest-reference.json \
    <post>/monitoring/web/lib/backtest-reference.json               # must be untouched
git status --porcelain                                              # no tracked file modified
```

Constraint: `backtest-reference.json` and `backtest/reports/metrics.md` must remain
**byte-identical** until methodology/data freeze changes them (OD-6 owns that decision — this
audit must not perturb it). If the two worktrees disagree, the move changed behavior: abort.

### TypeScript

```bash
cd monitoring/web
npx tsc --noEmit --incremental false     # baseline at audit time: exit 0
npm run lint                             # baseline: exit 1 with 2 known errors (tracked in AUDIT.md) — unchanged
npm run build                            # must succeed; NOTE monitoring/web/public/ is missing
                                         # (Dockerfile.web COPY) — pre-existing, do not "fix" here
npm run test:e2e                         # needs local server + fixtures; AUTH_FILE depends on CWD
```

### CI

```bash
# verify every path assumption in .github/workflows/*.yml still resolves from repo root:
test -f paper_trading/live_signal.py
test -f scripts/sync_paper_to_supabase.py
test -f scripts/fetch_bitget_data.py
test -d tests && test -f db/paper_trading.db && test -f db/schema.sql && test -f config.yaml
test -d data/historical
# then: workflow_dispatch paper-trading.yml (manual trigger) as the real end-to-end proof
```

### Docker / deploy

```bash
docker build -f deploy/Dockerfile.engine .     # COPY paths still resolve (context = repo root)
docker compose -f deploy/docker-compose.yml config
./deploy/migrate.sh --dry                      # only against a scratch DATABASE_URL
```

### Git

```bash
git status --porcelain                         # only the intended renames
git diff --stat --diff-filter=M                # ZERO modified files in a directory-only commit
git diff --stat --diff-filter=D                # every deletion has a matching rename
git ls-files | wc -l                           # count unchanged (moves, not add+delete)
git check-ignore -v backtest/reports/trades.csv db/backups/x monitoring/web/e2e/.auth/y \
                     paper_trading/logs/z      # ignore rules still bite
```

### Reproducibility gate

- Pre/post worktree report diff (above) is empty → Snapshot B still reproducible byte-for-byte.
- `python -m pytest tests/ -v` must not gain or lose a test (70).
- No new tracked file outside the intended `docs/audit/` renames.

---

## STEP 14 — FINAL VERDICT

## TREE REFACTOR VERDICT

**1. Is a directory cleanup justified now?**
Partially — and much less than the repository's appearance suggests. The engine/backtest/paper/
scripts/presets/db/supabase/deploy/tests layout is already the layout `ARCHITECTURE.md` and
`REPO_MAP.md` document, and it is the layout the code, CI, Docker and framework conventions
assume. The *only* unambiguous structural debt at root is **document sprawl**: 19 tracked
markdown files compete with `cli.py` and `config.yaml`, mixing living governance, closed
forensic audits and an open decision series. Fixing that costs zero code risk. Everything else
is either medium-risk with low payoff or must wait for an architectural decision.

**2. What should be moved first?**
The nine closed `PHASE2*` audit documents → `docs/audit/`. Verified: zero code/workflow/test
references, zero inbound markdown links, all tracked, all closed. Then (separately, Wave 1)
`monitoring/telegram_alert.py` → `alerting/`, and `tests/conftest.py` as the import-path
enabler. `OD2…OD8` move only after the OD series closes (OD-6 is running now).

**3. What should NOT be moved?**
`backtest/` (engine+research+reports), `paper_trading/`, `risk_manager/`, `llm_filter/`,
`scripts/`, `presets/`, `db/`, `supabase/`, `deploy/`, `tests/`, `cli.py`, `config.yaml`,
`monitoring/web/`, `.github/workflows/`, `data/`, and the living root docs. These are anchored
by `Path(__file__)` arithmetic, `sys.path` mutation, CI pathspecs, Docker `COPY`/`CMD`/volumes,
Supabase/Vercel conventions, or frozen-artifact tests (Steps 4, 6, 7, 8).

**4. What should wait until product/execution architecture is implemented?**
(a) Python import-identity unification — the prerequisite for ever moving `backtest/`;
(b) `monitoring/web/` → `web/` (requires the out-of-repo Vercel root-directory change);
(c) `backtest/reports/` vs research-artifact split and any `db/` relocation;
(d) `data/` research-vs-production split (blocked by open OD-5);
(e) anything named `execution/` — do not create directories for code that does not exist.

**5. What is the smallest safe first structural commit?**
`git mv` of the nine `PHASE2*` documents into `docs/audit/`. One purpose (root decluttering),
no content edits, no code, no config, no CI, no tests, no `.gitignore` change, reversible by a
single reverse `git mv`.

**6. What files are high-risk to relocate?**
`backtest/run_backtest.py`, `backtest/strategy.py`, `paper_trading/live_signal.py`,
`risk_manager/guards.py`, `monitoring/telegram_alert.py`, `cli.py`, all 9 `tests/*.py`, both
data/sync scripts, `deploy/Dockerfile.engine`, `deploy/docker-compose.yml`,
`deploy/migrate.sh`, `.github/workflows/paper-trading.yml`,
`.github/workflows/fetch-bitget-data.yml`, `supabase/`, `config.yaml`, `db/paper_trading.db`,
`monitoring/web/` (Vercel). 20 of 27 path contracts in Step 4 are HIGH severity.

**7. What checks must pass before merging?**
Step 13 in full: 70 pytest tests (all three invocation forms), import smoke covering **both**
module identities, CLI smoke, backtest reproduction with byte-identical Snapshot B + untouched
`backtest-reference.json`, `tsc --noEmit` (baseline exit 0), `npm run build`, workflow path
assumptions, Docker build, `git diff --diff-filter=M` empty, ignore rules still biting — in two
separate worktrees, never in the tree where OD-6 is running.

## PROPOSED FIRST COMMIT

```text
Purpose:      move closed forensic audit documents out of the repository root.
Type:         directory-only (pure rename/move). No content edits.
Message:      [docs] consolidate closed Phase-2 audit reports under docs/audit/

Contents (9 file moves, 0 modifications):
  git mv PHASE2_SOURCE_OF_TRUTH.md                    docs/audit/
  git mv PHASE2B2_AUDIT.md                            docs/audit/
  git mv PHASE2C_SECURITY_REPRODUCIBILITY_AUDIT.md    docs/audit/
  git mv PHASE2C2_TEMPLATE_SEED_BLOCKER.md            docs/audit/
  git mv PHASE2D_PRODUCT_REALITY_AUDIT.md             docs/audit/
  git mv PHASE2E_PRODUCT_ARCHITECTURE_DECISION.md     docs/audit/
  git mv PHASE2F_TARGET_ARCHITECTURE.md               docs/audit/
  git mv PHASE2G_RESEARCH_THESIS_FORENSIC_AUDIT.md    docs/audit/
  git mv PHASE2H_THESIS_METHODOLOGY_AND_BACKTEST_VALIDITY_AUDIT.md docs/audit/

Deliberately excluded from this commit:
  - strategy changes      : none (no .py touched)
  - risk changes          : none (config.yaml, presets/, guards untouched)
  - methodology changes   : none (backtest/reports/, research/, backtest-reference.json untouched)
  - database changes      : none (db/, supabase/migrations untouched)
  - product behavior      : none (monitoring/web untouched)
  - the OD* decision series (OD-6 in flight — do not move a live record)
  - the living docs, which keep their root-relative links working as-is

Precondition:  run after OD-6 closes (or independently — the 9 files are already closed),
               because the commit must not interleave with an open OD-series working set.
Verification:  git diff --stat --diff-filter=M  → empty
               git ls-files '*.md' | wc -l      → 36 (unchanged; 19 root → 10 root)
               python -m pytest tests/ -v       → 70 passed
               npx tsc --noEmit --incremental false → exit 0
```

---

## AUDIT EXECUTION REPORT

```text
HEAD:           d728ec891036a62f142d98ade8913a0e86176370 (main)
WORKTREE:       /home/kresna/project (single worktree)
FILES MODIFIED: 0
FILES CREATED:  1
FILES MOVED:    0
FILES DELETED:  0
COMMITS:        0
PUSH:           0
TESTS RUN:      python -m pytest tests/ -q      → 70 passed (8.08s)
                venv pytest tests/ -q           → 70 passed (7.31s)
                pytest tests/ (console script)  → 70 passed (7.31s)
                cd /tmp && pytest <abs>/tests   → 70 passed (8.57s)
                pytest tests/test_strategy.py    → FAILED (ModuleNotFoundError: backtest)
                                                     — documented defect, not touched
                npx tsc --noEmit --incremental false → exit 0 (no file writes)
                next build / backtest re-run     → NOT run (OD-6 in flight; Step 13 defines them)
```
