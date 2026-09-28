# 2 OCTOBER CLOSURE PLAN — TrendSentry

> **Type:** Closure contract (planning record). Not an audit, not a methodology decision.
> **Prepared:** 2026-09-28 · HEAD `9dac30f` · `origin/main` = `d728ec8` · local ahead 2.
> **Deadline:** 2 October 2026.
> **Inputs already accepted:** Phase 2E/2F product direction, `TREE_REFACTOR_AUDIT.md` (Wave 0 done in
> `9791707`), OD-2…OD-7 decision records, `ARCHITECTURE.md`.
> **This document changes nothing by itself.** No code, config, test, data, schema or audit file was
> modified to produce it, and nothing is committed by it.

---

## 1. FINAL PRODUCT DEFINITION

**TrendSentry is an automated crypto trading product.** A user signs up, selects the Donchian
strategy, configures risk, and deploys it. A deployment is a versioned configuration bundle consumed
by an isolated execution runtime that reads public market data from Bitget, computes signals, applies
risk checks, produces simulated fills, writes results back, and shows them on a dashboard with a
single failure alert. The product sells **automation, reliability and operational convenience** —
there is **no profit guarantee**, and the system does not claim one. Control plane = Supabase
(auth, templates, user strategies, deployments, entitlements); execution plane = per-deployment
runtime consuming a config bundle at startup with low-frequency run-boundary refresh, never
per-tick queries to Supabase. Self-hosted/free first; managed VPS later as a *paid convenience
layer*, not as a change of architecture. No Kubernetes.

**MVP = the first vertical slice only:**
signup → Donchian selection → risk configuration → deploy validation → deployment record + config
version → input-driven runtime → public market data → signal → risk check → simulated fills →
write-back → dashboard → one failure alert. **Ship gate:** two independent deployments using the
same pair/date must remain isolated.

**Explicitly NOT MVP:** live order execution (absent and guarded — stays guarded), AI/LLM
(LLM filter is a disabled skeleton, not a feature), multi-exchange (Bitget only), managed VPS
(later paid layer), Kubernetes, additional executable strategies beyond Donchian, profit claims.
The 8 strategy templates are **configuration templates**, not 8 executable strategies.

---

## 2. KEEP

Authoritative or useful as-is — no changes planned in this closure.

| Component | Why it stays |
|---|---|
| `config.yaml` + `presets/*.yaml` | Frozen strategy/risk parameters; single source for strategy config (ARCH §16); `test_presets.py` locks the values |
| `backtest/` engine (`run_backtest.py`, `strategy.py`) | Working, deterministic backtest + the only implemented trading logic (Donchian) |
| Donchian strategy | First (and only) executable strategy for MVP |
| `risk_manager/` (sizing, circuit breaker, `validate_config`) | Enforces hard rules (1% risk, stop mandatory, no martingale); runtime safety for MVP |
| Paper trading (`paper_trading/`, SQLite `db/paper_trading.db`) | The MVP fill model: simulated fills are the product's execution plane for now |
| Supabase (`supabase/migrations/`, auth, `user_strategies`, `strategy_templates`) | Control plane source of truth; auth already works |
| Web app (`monitoring/web/`) — auth, templates, fill/deviation/discipline dashboard | Read-only display layer + signup flow; already usable |
| `scripts/sync_paper_to_supabase.py` | Existing SQLite → Supabase write-back path (needs per-deployment scoping later) |
| `monitoring/telegram_alert.py` | The MVP's "one failure alert" (location changes in Wave 1, component does not) |
| `scripts/compare_live_vs_backtest.py` + `backtest/reference.json` family | Live-vs-backtest comparison gate (dependency *direction* is fragile — see §4) |
| `backtest/research/` + `backtest/reports/` + `docs/audit/` | Research/thesis track, **separate from the product**, retained as evidence |
| `tests/` (9 files, 70 tests) | Regression safety for strategy/risk/policy — must keep passing through every wave |
| `cli.py`, `deploy/`, `.github/workflows/` | Entrypoints, container images, CI (pins and data workflow need attention — see §4/§5) |
| `data/historical/` (10 pair CSVs) | Backtest/paper input until the canonical rebuild (tracked by OD-5, not by this plan) |

---

## 3. REFACTOR

Only what lands at/before the 2 October closure. Nothing here is a new architecture decision.

### 3.1 Wave 1 — structural fixes (repository hygiene)

1. **Add `tests/conftest.py`** — put repo root on `sys.path` once. Removes the hidden
   collection-order contract (`tests/test_filter.py` currently does `sys.path.insert` during
   collection, so running a single test file can fail with `ModuleNotFoundError: backtest`).
   Prerequisite for every later Python move.
2. **Unify Python import identity** — make `backtest.strategy` importable through exactly one path
   so `risk_manager/guards.py` (`from backtest.strategy import …`) and the script-dir imports in
   `backtest/run_backtest.py` / `backtest/research/*` resolve to **one** module object.
   *Scope note:* `TREE_REFACTOR_AUDIT.md` listed this under Wave 2, but the 2 October acceptance
   checklist (§8) requires the defect **closed**, not documented — so it is pulled forward into this
   closure. Recorded here rather than changed silently in the audit.
3. **Move `monitoring/telegram_alert.py` → `alerting/telegram_alert.py`** and repair the touched
   references (`paper_trading/live_signal.py` sys.path, `tests/test_live_signal.py` sys.path,
   `deploy/Dockerfile.engine` COPY, `.env` depth lookup, ARCHITECTURE §3 / REPO_MAP / README).
   Result: `monitoring/` stops mixing a Python alert module with the Next.js app.
4. **Repair documentation/path drift** — stale "64 tests" → 70, `REPO_MAP` "8 test files" → 9,
   `PLAN.md` §4 structure annotation, any path pointing at a moved file.
5. **Do NOT broadly move Python source.** `backtest/`, `paper_trading/`, `risk_manager/`, `tests/`,
   `scripts/`, `config.yaml`, `data/` stay put. Optional `data/` research/production split waits for
   OD-5 rebuild.

### 3.2 Product-MVP integration (only what the slice needs)

1. **Deployment record + config version** — persist (deployment id, config snapshot/version, status)
   so a deployment is reproducible from its own record.
2. **Deploy validation** — reuse `risk_manager.validate_config` + entitlement check before a
   deployment can start.
3. **Config bundle at startup** — execution runtime reads a versioned bundle at boot and refreshes
   only at run boundaries. **No per-tick Supabase queries.**
4. **`template_id` → engine dispatch (Donchian only)** — currently absent; user strategies are
   configuration-only with no runtime link to the engine.
5. **Input-driven runtime** — runtime consumes deployment config instead of the repo-wide
   `config.yaml` for pairs/risk (engine params stay frozen; only *which* config is loaded changes).
6. **Write-back scoped per deployment** — existing sync path extended so two deployments cannot see
   each other's rows.
7. **Dashboard reads deployment-scoped data** + **one failure alert** wired to a deployment.
8. **Ship-gate test:** two deployments, same pair and same date, asserted isolated.

**Explicitly not promised for 2 October:** anything in §9 "Later" waves, live execution, VPS,
entitlements beyond the gate needed for deploy validation, template/marketplace breadth.

---

## 4. DELETE / DEPRECATE

No file is deleted as part of this plan's preparation. Actions below are the *recommended closure
action*, and anything needing sign-off is marked rather than decided.

| Item | Recommended action | Status |
|---|---|---|
| Duplicate hand-maintained metric copies (`monitoring/web/lib/backtest-reference.json` + `lib/reference.ts` mirror + committed `backtest/reports/metrics.md`) | **DEPRECATE the hand-sync**: make one generated source the only writer, mark the others read-only copies | **DEFERRED / OWNER DECISION** — the choice of canonical source belongs to `ARCHITECTURE.md` §16 (thesis track), not to this closure |
| Engine → `monitoring/web/lib/backtest-reference.json` dependency (fragile cross-tree contract) | **DEPRECATE the direction**: engine must not import from the web tree; keep the file, move the read behind a neutral path | Wave 2 — needs the same canonical-source decision first |
| `backtest/research/*` scripts that crash at HEAD (`KeyError 'donchian_entry_period'`) | **DEPRECATE as product code**, retain as research artifacts; label them "research track — not maintained for MVP" | Marked deprecated in docs only. **Do NOT delete** (research artifacts, thesis evidence) |
| `vectorbt` in `requirements.txt` (0 imports anywhere) | Remove the pin | **DEFERRED / OWNER DECISION** (dependency/config edit, out of this task's rules) |
| Dead `lookback_years` in `config.yaml` (0 reads) | Remove or clarify | **DEFERRED / OWNER DECISION** — config edit; also tracked as `repo OD-7.5` implementation |
| `.github/workflows/fetch-bitget-data.yml` auto-commit with zero verification | Gate it behind the OD-7 data checks, or disable | **DEFERRED / OWNER DECISION** — fixing it is OD-7 implementation, which is gated and explicitly out of scope here |
| `deploy/Dockerfile.web` `COPY --from=build /app/public` (target directory does not exist) | Fix or drop the line when `monitoring/web` is next touched | Wave 2 (coordinated with any `monitoring/web` move) |
| `db/backup_db.sh` hard-coded path/cron, `test-bitget-api.yml`, `api-smoke-test.mjs` placement, `npm run lint` 2 known errors | Decide archival/placement | **DEFERRED / OWNER DECISION** (pending items already logged in `TREE_REFACTOR_AUDIT.md`) |
| Historical audit records (`docs/audit/*`, `OD*`, `TREE_REFACTOR_AUDIT.md`) | **Keep** | Not deletable, not movable in this closure |
| 8 strategy templates in Supabase + `tests/test_strategy_templates_seed.py` | **Keep** | Not deletable; they are configuration templates, and a seed-drift test guards them |
| LLM filter (`llm_filter/`, `tests/test_filter.py`) | **Keep as disabled skeleton**, documented as not-MVP | Not deletable; removing it would break the test suite for no product gain |

---

## 5. DO NOT TOUCH

1. **Thesis/statistical methodology** — every OD-6 definition (benchmark, Sharpe, MDD, paired test,
   correlation, regime) and PPT requirement P1–P10.
2. **OD-6 unresolved sub-gates (3)** — VaRSR formula/confidence/horizon/method (Deng 2013),
   Sharpe CI estimator method, deterministic cash-day classification rule. Open; untouched.
3. **OD-7 conflicts (5)** — sheet-vs-register ID collision, `OD5` §23#8 divergence, implementation
   vs acceptance-test gaps, environment pin inconsistency, `repo OD-7.1` → `ARCH §16`. Open;
   untouched. Also `repo OD-2.4`, `repo OD-2.7`.
4. **Canonical dataset rebuild** (OD-5) and any refetch of market data.
5. **Trading behavior / risk formulas** — Donchian periods, ATR multiplier, risk %, stop anchor,
   sizing identity — unless an already-approved product decision explicitly requires it (none does
   for 2 October).
6. **Historical audit records** — `docs/audit/*`, `OD2`–`OD8`, `TREE_REFACTOR_AUDIT.md`: never
   rewritten to make current docs agree with them.
7. **Untracked files** `OD3_…`, `OD4_…`, `OD5_…`, `OD6_…`, `OD7_THESIS_…`, `OD8_…`,
   `TREE_REFACTOR_AUDIT.md` — not modified, moved, committed or deleted.
8. **Managed-VPS credential policy conflict from Phase 2F** — open, VPS is post-MVP; no resolution
   here.
9. **Anything requiring a new architecture decision** — new components, execution-plane layout,
   DB relocation, `monitoring/web → web` (Vercel impact must be handled explicitly), shared
   engine/risk placement, reports split. All Wave 2 or later, each with its own sign-off.

---

## 6. MVP GAP

Smallest concrete list of what is still missing for the first real vertical slice.

**Control plane**
- Deployment record (id, owner, config version, status, timestamps).
- Versioned configuration bundle + config-version history for a deployment.
- Deploy validation step (risk config + entitlement + template allow-list = Donchian only).
- Entitlement enforcement at deploy time (Stripe plumbing exists; enforcement incomplete).

**Execution plane**
- Runtime that consumes a config bundle at startup, with run-boundary refresh only.
- `template_id` → engine dispatch (Donchian) — **does not exist**.
- Per-deployment isolation of state (two deployments, same pair/date, no shared rows/counters).
- Runtime wiring from deployment config to the existing signal/risk/paper engine (today the engine
  reads repo `config.yaml` and has **no runtime link to Supabase `user_strategies`**).

**Integration**
- Public market data read path per deployment (Bitget, read-only — sufficient; live orders absent
  and guarded).
- Simulated fill generation driven by deployment inputs.
- Write-back scoped per deployment (existing sync path is single-DB, unscoped).
- Signup → template selection → risk config → deploy hand-off as one flow.

**Observability**
- Dashboard reads deployment-scoped results (currently global fill/deviation view).
- One failure alert per deployment via `telegram_alert`.
- Run-boundary log/heartbeat so a stalled deployment is visible.

**Safety**
- Risk check executed in the runtime path (config validation + circuit breaker + stop mandatory).
- Hard isolation: no cross-deployment leakage (the ship gate).
- Live-execution guard remains in place and is asserted by tests.
- No profit messaging anywhere in product copy.

**Testing**
- `tests/conftest.py` (removes collection-order dependency) + proof tests run standalone.
- Single import identity test for `backtest.strategy`.
- Ship-gate isolation test (2 deployments × same pair/date).
- Deploy-validation tests (bad risk config rejected, entitlement enforced).
- Existing 70 tests stay green through every wave.

---

## 7. REFACTOR WAVES

**Wave 0 — COMPLETE** (`9791707`): the nine closed Phase-2 audits moved to `docs/audit/`. Zero code,
config or behavior change. Verified by `git diff --diff-filter=M` empty at the time.

**Wave 1 — immediate repository cleanup (this closure):**
`tests/conftest.py` → unify Python import identity → move `monitoring/telegram_alert.py` to
`alerting/` → repair affected docs/paths. No broad Python source moves. Optional `data/` split
deferred to OD-5. Gate: 70 tests pass as a full suite **and** standalone.

**Wave 2 — MVP integration (bounded by the 2 October slice, then continued after):**
deployment record + config version → deploy validation → config-bundle runtime → `template_id`
dispatch (Donchian) → per-deployment write-back → deployment-scoped dashboard + one alert →
ship-gate isolation test. Structural items that belong here and are **not** in Wave 1:
`monitoring/web → web` (only with explicit Vercel/deploy impact handling), shared engine/risk
placement, `backtest/reports` split, DB relocation, `Dockerfile.web` public-dir fix. Execution-plane
directory layout is created **only when real execution code exists**.

**Later (explicitly out of scope):** managed VPS as a paid convenience layer (including the Phase 2F
credential policy question), multi-exchange, additional executable strategies beyond Donchian,
AI/LLM features, live order execution (requires the Phase-4 risk gate: risk manager + circuit
breaker proven + small capital), Kubernetes (never), marketplace/strategy breadth.

---

## 8. 2 OCTOBER ACCEPTANCE CHECKLIST

Each item is testable. "Owner" = needs sign-off, not automatic.

| # | Check | How it is verified |
|---|---|---|
| 1 | Working tree status is understood | `git status -sb` shows only the known untracked `OD3…OD8` + `TREE_REFACTOR_AUDIT.md`; tracked modifications = only the files this closure intentionally produced; `origin/main` lag documented (`d728ec8`, ahead 2) |
| 2 | Python import identity is unified | Single test asserting `backtest.strategy` resolves to one module object regardless of import path (no duplicate `sys.modules` entries) |
| 3 | Tests pass as full suite | `python -m pytest tests/ -q` → 70 passed (or more, never fewer without an explained reason) |
| 4 | Tests pass standalone | `python -m pytest tests/test_strategy.py -q` (and `test_risk`, `test_backtest_cash`) → pass **without** relying on another file having run first |
| 5 | pytest does not depend on collection order | `tests/conftest.py` exists; no test module mutates `sys.path` during import; reversed/shuffled file order still passes |
| 6 | Alerting location/path is coherent | `alerting/telegram_alert.py` exists; grep shows no stale `monitoring/telegram_alert` import/COPY reference in code, tests, Dockerfile or docs |
| 7 | No stale documentation points to moved files | Grep docs for every moved path → 0 hits; test counts/paths in README, AGENTS, REPO_MAP, PLAN match reality |
| 8 | Product docs consistently describe automated trading as the product | README/PLAN/ARCH and web copy describe TrendSentry as automated crypto trading (automation/reliability/convenience), no profit guarantee |
| 9 | No document claims 8 executable strategies | Grep templates/strategy docs → templates described as configuration templates; "Donchian = first executable strategy" stated explicitly |
| 10 | No document claims live execution exists if it does not | Any live-execution mention states it is absent and guarded; `cli.py live` still refuses without `--dry-run` (existing test asserts it) |
| 11 | No document claims AI/LLM is part of MVP | LLM filter described as disabled skeleton / not-MVP; `llm_filter.enabled: false` reflected in docs |
| 12 | MVP boundaries are explicit | §1 "MVP = first vertical slice" and "NOT MVP" list survive editing; no Later-wave item is described as implemented |
| 13 | Unresolved thesis decisions remain isolated from product refactor | `git diff` for this closure touches no thesis/OD/statistics file; §5 list intact; OD-6 sub-gates and OD-7 conflicts still recorded as OPEN |
| 14 | No known structural contradiction is introduced | The three known defects (dual module identity, collection-order dependency, `monitoring/` mixing) are closed or explicitly recorded as Wave 2 with a reason — never silently half-fixed |
| 15 | Nothing planned is described as done | Wave 2 / Later items are worded as planned; grep this document for "implemented"/"exists" against reality before signing off |

---

## 9. OPEN ITEMS AFTER 2 OCTOBER

**A. Product implementation work**
- Live order execution (create/cancel/close) — gated on the Phase-4 risk gate; currently absent and guarded.
- Full entitlement enforcement across the app (beyond deploy-time gate).
- Managed VPS packaging as a paid convenience layer.
- `monitoring/web → web` migration (with Vercel root-directory change), shared engine/risk placement,
  `backtest/reports` split, DB relocation, `Dockerfile.web` public-dir repair.
- Data-layer research/production split (waits for OD-5 rebuild).
- Per-deployment secrets/credential handling for the execution plane.

**B. Thesis / research work**
- `ARCHITECTURE.md` §16 canonical snapshot decision (also owns `repo OD-7.1`, `repo OD-7.6`).
- OD-5 canonical dataset rebuild (blocked on unfiltered network) + data-layer freeze gate.
- OD-6 statistical freeze: the 3 sub-gates (VaRSR, Sharpe CI, cash-day rule) then the single canonical rerun.
- Phase 2H OD-11 (errata) and OD-12 (sensitivity presentation).
- Research scripts repair is research-track work, not product work.

**C. Owner decisions**
- `repo OD-2.4` (fixed vs dynamic stop) · `repo OD-2.7` (stop-execution cost treatment).
- Canonical metric source (one generated file vs hand-synced copies).
- Fetch workflow gating / auto-commit policy (OD-7 implementation).
- `vectorbt` pin removal · dead `lookback_years` removal (config edits).
- Pending `TREE_REFACTOR_AUDIT` items: `db/backup_db.sh` archival, `test-bitget-api.yml` archival,
  `api-smoke-test.mjs` placement, `monitoring/` directory ownership.
- Phase 2F managed-VPS credential policy conflict.
- When to untrack/move the `OD3…OD8` + `TREE_REFACTOR_AUDIT.md` files (the audit says: only after the
  OD series closes).
- Whether/when to push the local branch (`origin/main` is `d728ec8`, local ahead 2).

---

*Prepared as a planning record only. No commit, no push, no source/config/test/data change.
The only file created is `docs/2_OCTOBER_CLOSURE_PLAN.md`.*
