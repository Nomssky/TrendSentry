# OD-7 — REPRODUCIBILITY DECISION RECORD (Canonical Dataset & Canonical Simulation)

> **Type:** Owner Decision sheet (DECISION / AUDIT only).
> **Prepared:** 2026-09-27 · HEAD `9791707e9dd556a68813d98a905007f81e847f59` (`main`).
> **Companion (not modified):** `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md` — the
> Phase-2G forensic audit whose register is also numbered `OD-7.1 … OD-7.12`.
> **Status of this document:** answers are recorded here only. No commit, no push.
> **Sequence position:** OD-2 → OD-3 → OD-4 → OD-5 → OD-6 → **OD-7 (this sheet)** → `ARCHITECTURE.md` §16
> → Canonical Methodology Freeze → implementation → canonical rerun.

---

## 1. Scope

Freeze the **reproducibility protocol** required so that the eventual canonical dataset and the
eventual canonical simulation can be independently reproduced by a second clean environment.

In scope:

1. Canonical dataset identity · 2. raw-data preservation · 3. deterministic normalization ·
4. dataset manifest · 5. rebuild-determinism levels · 6. fetch-window behavior ·
7. completeness verification · 8. dataset acceptance gate · 9. source drift ·
10. Git-vs-outside-Git provenance · 11. reproducibility tiers · 12. independent-rerun test ·
13. environment pinning · 14. failure policy · 15. relationship with OD-5 ·
16. relationship with OD-6 · 17. canonical-run provenance · 18. no-back-fitting attestation.

Out of scope (explicit):

- Any implementation: no source, config, data, CSV, DB, report, test or workflow is modified.
- Any choice conditioned on an expected result. Snapshot A (149.59% / −26.19%) and Snapshot B
  (152.00% / 0.82 / −26.45% / 94 / 2520.02) remain **ENGINEERING snapshots — EVIDENCE ONLY, NOT
  TARGETS**.
- Re-deciding any OD-2 / OD-3 / OD-4 / OD-5 / OD-6 outcome. Those records are not altered.
- Choosing the canonical A/B snapshot — that stays with `ARCHITECTURE.md` §16, which follows this sheet.
- Wave 1 structural refactoring (`TREE_REFACTOR_AUDIT.md` Step 10.2/12) — not started here.

Source hierarchy applied: **`PPT > Owner Decision > Audit > Implementation`.** Where a lower-ranked
source contradicts a higher-ranked one, the contradiction is **recorded**, never silently resolved.

---

## 2. Evidence inspected

| # | Artifact / command | Purpose |
|---|---|---|
| E1 | `git log --oneline -5`, `git rev-parse HEAD`, `git status --porcelain` | HEAD = `9791707` (Wave 0 refactors audits → `docs/audit/`); 7 untracked files, 0 tracked changes |
| E2 | `scripts/fetch_bitget_data.py` (full, 164 lines) | the only OHLCV generator in the repo; pagination, retry, gap handling, output schema |
| E3 | `backtest/run_backtest.py` :30–99, :225–284 | config load + `PRESET` overlay, `load_ohlcv`, `reports_dir`/`REPORT_SUBDIR`, `save_report` |
| E4 | `requirements.txt`, `requirements-engine.txt`, `venv/pyvenv.cfg`, `venv/bin/pip list`, `venv/bin/pip check` | declared vs installed environment |
| E5 | `.github/workflows/fetch-bitget-data.yml`, `paper-trading.yml`, `test-bitget-api.yml` | CI Python versions, unpinned installs, data auto-commit |
| E6 | `.gitignore` + `git check-ignore -v` probes | what is ignored vs committable (`backtest/reports/*.csv` = top-level only) |
| E7 | `git ls-files data`, `git ls-files backtest/reports`, `git ls-files scripts` | 15 tracked data CSVs, 23 tracked report files, 3 scripts |
| E8 | `tests/` (9 files, no `conftest.py`), suite run | reproducibility-relevant test coverage |
| E9 | `OD5_DATA_INTEGRITY_REBUILD_DECISION.md` §10, §22, §23, §24, §25, §26, §27, §29 | rebuild spec, T01–T14, freeze sequence, blocked external verification |
| E10 | `OD6_BENCHMARK_METRICS_STATISTICAL_VALIDITY_DECISION.md` §4 (P1–P10), §27 register, §28 freeze sequence, §29 limitations | every input OD-7 must make reproducible |
| E11 | `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md` §4, §6, §7, §13–§16, §19, §21, §23–§28, §30 | register OD-7.1…7.12, diagnostics D1–D15, tiers R0–R4 |
| E12 | `TREE_REFACTOR_AUDIT.md` (full) | Wave 0 done; Wave 1/2 gated; path contracts; where OD* docs live long-term |
| E13 | `ARCHITECTURE.md` §16 | Source-of-Truth map + pending canonical-metric procedure |
| E14 | `AGENTS.md`, `PLAN.md` §5 (rules), `config.yaml` | hard rules: frozen params, no result-driven tuning |
| E15 | `docs/audit/*` (9 moved Phase-2 audits), `README.md`, `REPO_MAP.md` | closed-audit baseline, documented commands |

---

## 3. Current reproducibility reality

All findings are `VERIFIED` against HEAD unless marked otherwise. No file was modified to obtain them.

| # | Finding | Evidence |
|---|---|---|
| R1 | **No manifest, no checksum, no metadata sidecar, no saved fetch log anywhere in the repo** | repo grep `sha256|checksum|manifest|md5` → 0 hits outside `*.md` docs and `monitoring/web/lib/bitget.ts` (HMAC) |
| R2 | **Raw candle timestamps are destroyed at fetch**: `df = df.drop(columns=["ts"])` | `scripts/fetch_bitget_data.py:91-92` |
| R3 | **Gap/duplicate detection is stdout-only and never fatal**: `print("WARN … cek gap sebelum backtest")` | `scripts/fetch_bitget_data.py:104-110` |
| R4 | **Duplicates are silently dropped (`keep='first'`)** — contradicts approved acceptance test T05/sheet OD-5.8=`A` | `scripts/fetch_bitget_data.py:112` vs `OD5` §24 T05 |
| R5 | **Fetch window has no `endTime`, no `candles[0] >= since` sanity check, and terminates with bare `break` on exception/empty** | `scripts/fetch_bitget_data.py:41-46, 74-76, 82-83` |
| R6 | **The historical failure mode is real and signature-locked**: first hole = `since + 300 days` exactly, three times, grouped by batch `since` → 1.635 missing bars in synchronized runs | `OD5` §10.1–§10.3 (`CAUSE UNKNOWN`, class "request-window + missing sanity-check" `STRONGLY SUPPORTED`) |
| R7 | **CI fetch commits data with zero verification**: `pip install ccxt pandas pyyaml` (unpinned) on Python **3.11**, then `git add data/historical/ && git commit && git push` | `.github/workflows/fetch-bitget-data.yml:24,27,41-44` |
| R8 | **Two incompatible CSV schemas in one folder** (`open,high,low,close,volume,date` vs `date,close,high,low,open,volume`); 3 of 13 files (BCH/LTC/PAXG) have **no generator in the repo** | `OD5` §4.3; `data/historical/*.csv` headers |
| R9 | **Environment is range-pinned only, no lockfile, four Python versions in play**: 3.11 (fetch CI), 3.12 (paper-trading CI, `test-bitget-api` CI, `deploy/Dockerfile.engine:3`), 3.14.6 (`venv/pyvenv.cfg`), 3.14.7 (runtime drift per audit §14) | E4, E5, `OD7 audit` §14 |
| R10 | **Declared pins violated / deps undeclared**: installed `pytest 9.1.1` vs declared `pytest>=8.0,<9`; `scipy 1.18.0` and `yfinance 1.7.0` are used by research code but absent from `requirements.txt`; `vectorbt` declared with 0 imports | E4; `OD6` §29; `OD7 audit` §14 |
| R11 | **Run outputs carry no run identity**: `metrics.md` has no timestamp, commit, config hash, `PRESET` name, data end-date or versions | `backtest/run_backtest.py:270-277`; committed `backtest/reports/metrics.md` |
| R12 | **Reference numbers are hand-maintained and already disagree**: `backtest-reference.json` (152.0/−26.45/4.35/−0.85/2.27) vs committed `metrics.md` (149.59/−26.19/4.31/−0.84/2.26) — 5 of 13 fields differ; neither records which run produced it | `monitoring/web/lib/backtest-reference.json`; `backtest/reports/metrics.md`; `ARCHITECTURE.md` §16 |
| R13 | **No test touches data, checksums, golden outputs, determinism or versions** — 70 tests cover strategy/risk/policy logic only | `tests/` (9 files); grep for `checksum|sha256|golden|snapshot|data/` → 0 |
| R14 | **The engine is deterministic by construction**: no RNG, no clock, no network in the simulation path; audit ran Snapshot B twice byte-identical, from `/tmp`, and from a fresh clone | grep `random|seed|datetime.now` in `backtest/**.py` → only `fetch_funding.py:41 date.today()` (fetch loop bound, not simulation); `OD7 audit` D2/D3/D5 |
| R15 | **Canonical-run ledgers are gitignored**: `.gitignore:15 backtest/reports/*.csv` (top-level only) → the Snapshot B ledger was never stored (G4) | E6; `OD7 audit` §11–§12 |
| R16 | **External source verification is blocked** — exchange domains resolve to an ISP filter page | `OD5` §26; `OD6` §29 |
| R17 | **Iteration order is order-dependent and not yet canonical**: `for symbol, df in dfs.items()` follows `config.yaml` pairs order (BTC,ETH,SOL,BNB,XRP,AVAX,LINK,DOGE,ADA,HYPE — not alphabetical), while sheet OD-4.8=`A` froze alphabetical ordering | `backtest/run_backtest.py:85`; `config.yaml:5-15` |
| R18 | **Canonical-capable artifacts are committable today without `.gitignore` changes**: subdirectory CSVs are not ignored | `git check-ignore -v backtest/reports/canonical/curve.csv` → `NOT IGNORED`; tracked examples `backtest/reports/research/longshort/curve_*.csv` |

**Net status:** reading-reproducible (`R2`) for the dataset, `R3` for Snapshot B headline metrics,
`R0` for the raw B ledger, `R1` for the environment, `R0` for regeneration from source.
**Nothing is `R4`.** (`OD7 audit` §19, re-verified here.)

---

## 4. Numbered decision questions — OD-7.1 … OD-7.18

> Letter answers are owner decisions. Rationale cites mechanism/evidence or higher-ranked documents
> only — never an expected result.

### OD-7.1 — What *is* a canonical dataset? (identity definition)

- **A** = Identity is declared by a **machine-readable manifest** frozen in OD-7.4 (provider, venue,
  market type, instrument IDs, timeframe, canonical period, timezone, endpoint, tool versions,
  checksums). Filename and git history are *pointers*, not identity.
- **B** = Identity = git path + filename + commit that last touched it (status quo).
- **C** = Identity = content hash alone (`sha256` of the CSV).

**Decision: `OD-7.1 = A`.**
Rationale: B already failed — two schemas share one folder (R8), three files have no generator (R8),
and the committed period label `2020-08..2026-08` does not match the data `2020-11-09..2026-09-02`
(`OD7 audit` §25 C3, owned by OD-5.5). C has no semantics: a hash cannot tell a reader the venue,
the period or the universe. A is exactly the operational form of owner answer **sheet OD-5.11 = `A`**
(manifest with sha256 written at generation).
Rejected: B (proven insufficient), C (uninterpretable on its own).

### OD-7.2 — Raw-data preservation: required, or recommended?

- **A** = **Required.** Store the raw provider response payloads (per request window, verbatim) plus
  raw millisecond timestamps, for every canonical rebuild.
- **B** = Recommended only; store normalized rows + fetch log, payloads optional.
- **C** = Not stored; normalized CSV is the primary artifact.

**Decision: `OD-7.2 = A`.**
Rationale: raw payloads are the *only* artifact that separates **source drift** from **transform
drift** (OD-7.9) — without them, "the provider changed history" and "our code changed output" are
indistinguishable, which is precisely the `CAUSE UNKNOWN` trap recorded in `OD5` §10.3. Cost is
bounded and small: the whole canonical universe is ≈19k daily candles (≈1.5–2.2k rows × 10 pairs),
i.e. single-digit MB of JSON. Raw payloads also make the fetch-window failure mode (R5/R6) auditable
after the fact. This is the concrete content of owner answer **sheet OD-5.12 = `A`** (retain raw +
fetch logs).
Rejected: B/C — both leave source drift unfalsifiable; "recommended" gates never fire.

### OD-7.3 — Deterministic normalization (raw → canonical CSV)

**Decision: `OD-7.3 = A`** — normalization is a **pure, frozen function** `raw → canonical CSV`,
specified once and never edited in place:

1. **Raw retention:** original candle timestamp (ms, epoch UTC) preserved in the raw artifact; the
   canonical row derives `date` = UTC calendar date at 00:00 (owner answer **sheet OD-5.10 = `C`**).
2. **Column order, exactly:** `open,high,low,close,volume,date` (single schema for all 10 pairs —
   the second schema in R8 is retired by the rebuild, not by editing history).
3. **Numeric precision:** values written as received, **no rounding**, using Python's shortest
   round-trip decimal form for `float64`; read-back must equal the raw value bit-for-bit.
4. **Sorting:** strictly ascending by raw timestamp; no reordering anywhere else.
5. **Duplicate handling:** duplicate timestamp → **error, fail the build** (never `keep='first'`).
   This overrides implementation R4 and matches owner answer **sheet OD-5.8 = `A`** / T05.
6. **Validation/rejection:** T01–T05, T07, T13, T14 (OD-7.7) are checked **before** the file is
   written; any violation aborts.
7. **No filling, no synthetic bars, no interpolation** — owner answers **sheet OD-5.6 = `D`** and
   **sheet OD-5.13 = `A`**.
8. **Determinism contract:** a second run over the same stored raw payloads in the pinned
   environment produces a **byte-identical** canonical CSV (level L2, OD-7.5).

Rejected: (i) "normalize on load" — makes every consumer a second implementation of the transform;
(ii) rounding prices to 2–8 dp for neatness — changes values and breaks bit-identity; (iii) repairing
duplicates by first-wins (R4) — silently discards evidence.

### OD-7.4 — Dataset manifest: frozen field list

**Decision: `OD-7.4 = A`** — the manifest is **mandatory, machine-readable (JSON), written by the
generator at generation time** (never hand-edited), one manifest per dataset build. Frozen fields:

| Group | Fields |
|---|---|
| Identity | `manifest_schema_version` · `provider` · `venue` · `market_type` · `instrument_ids[]` (symbol + venue id + spot flag + listing date + listing-date source) · `timeframe` · `timezone` · `canonical_period{start_utc,end_utc}` + per-instrument `source_first`/`source_last` |
| Source | `endpoint` — captured from `ccxt` `exchange.describe()` **at fetch time** (the literal REST path is not recorded anywhere today; capturing it is deterministic and requires no guesswork) · `universe[]` (the frozen 10 pairs, sheet OD-5.2=`A`) |
| Toolchain | `python_version` (exact patch) · `ccxt` · `pandas` · `numpy` · `PyYAML` versions · `lockfile_sha256` |
| Timing | `retrieval_started_utc` · `retrieval_finished_utc` (exact timestamps) |
| Content | `row_counts{file: n}` · `missing_counts{file: n}` + per-classification totals (`PRESENT` / `DATA GAP` / `PRE-LISTING` / `POST-LISTING` / `UNKNOWN`=0) · `checksums{file: sha256}` · `raw_checksums{window: sha256}` |
| Lineage | `transform_commit` (git HEAD of the fetch/normalize code) · `config_commit` (git HEAD of `config.yaml`) · `dataset_parent` (id of the raw build this derives from) |

- **A** = all fields above mandatory · **B** = minimal subset (checksum + period + row counts) ·
  **C** = fields optional per build.
**Decision: `OD-7.4 = A`.** Rejected: B recreates the "which run produced this?" ambiguity of R11/R12;
C makes manifests incomparable across builds.
Note: retrieval timestamps make the **manifest** differ per run by design — the manifest is
*provenance*, never part of the determinism comparison target (OD-7.5).

### OD-7.5 — What "reproducible" means: determinism levels

**Decision: `OD-7.5 = A`** — adopt five explicit levels; each has its own acceptance rule, and a
claim of "reproducible" must name the level:

| Level | Definition | Acceptance rule |
|---|---|---|
| **L1 source-identical** | Refetch returns byte-identical raw payloads to the stored raw | **Check-and-record, NOT required.** The provider controls its own history; gating on an uncontrolled input would make the gate unsatisfiable. Any diff → `SOURCE DRIFT` record (OD-7.9). |
| **L2 transform-identical** | Same stored raw → byte-identical normalized CSV | **REQUIRED** (offline, no network needed) |
| **L3 dataset-identical** | Rebuilt rows/timestamps/values == frozen canonical dataset (exact match) | **REQUIRED** — operationalizes owner answer **sheet OD-5.14 = `A`** |
| **L4 simulation-identical** | Same canonical data + frozen config + pinned env + same commit → identical simulation output | **REQUIRED**, scoped as: byte-identical `equity_curve.csv` and `trades.csv`; **exact numeric equality** of parsed `metrics.md` values; **PNG excluded from byte comparison** (rasterization depends on freetype/matplotlib build — gating on PNG bytes is an unsatisfiable gate) |
| **L5 publication-identical** | Thesis tables/figures == canonical run artifacts | **REQUIRED** via OD-7.17 |

Rejected: (i) "byte-identical raw required" (L1 as a hard gate) — unsatisfiable, and it would force
either silence or data substitution; (ii) a single undifferentiated "reproducible = yes/no" — that is
what allowed `R2`/`R3` artifacts to be described as reproducible without saying which kind.

### OD-7.6 — Fetch-window behavior (the failure mode that must be impossible)

**Decision: `OD-7.6 = A`** — pagination contract, frozen:

1. Every request specifies **both** `since` and `endTime` (today: only `since`, `limit=1000`, no end —
   R5).
2. **Sanity assertion on the response:** `candles[0].ts >= since` **and** `candles[-1].ts <= endTime`
   **and** `len(candles) > 0`; a window that starts later than requested (except genuine pre-listing)
   is an **error**, not a warning. This is the exact check whose absence `OD5` §10.3 identifies as the
   surviving candidate cause of the `since+300` signature (R6).
3. **No silent termination:** `break` on exception/empty is forbidden. Bounded retries with backoff,
   then **halt with non-zero exit and a written error record**; a partial window never reaches disk.
4. **Cross-page continuity:** page *n+1* must begin at `page_n.last + 1 day`; any inter-page gap →
   error.
5. **Per-window raw + log retained** (OD-7.2) with the request bounds recorded.
6. **Resume is verification-based:** a resumed run re-verifies already-fetched windows by checksum
   instead of appending blindly.

Rejected: current behavior (R3/R5) — warnings printed to stdout, `break` on empty, no `candles[0]`
check, then a CI commit with no gate (R7). Also rejected: treating an empty response at a retry date
as "the asset didn't exist yet" without an explicit pre-listing classification (owner answer
**sheet OD-5.5 = `A`** requires every day to carry a status).

### OD-7.7 — Completeness verification: the required assertion set

**Decision: `OD-7.7 = A`** — all assertions below run **before write**; any failure aborts the build
(no output file is produced):

1. `first_ts` / `last_ts` equal the manifest's canonical period and per-instrument source bounds.
2. **Every calendar day inside the presence window is classified** — `PRESENT` / `DATA GAP
   (classified)` / `PRE-LISTING` / `POST-LISTING`; **`UNKNOWN` count must be 0** (sheet OD-5.5=`A`).
   Unexplained gaps must be 0 — *classified* gaps are allowed, because sheet OD-5.6=`D` keeps gaps.
3. Duplicates = 0 · timestamps strictly monotonic increasing · zero out-of-order rows.
4. OHLC validity: `high >= max(open,close)`, `low <= min(open,close)`, `high >= low`,
   `price > 0`, `volume >= 0`, no `NaN`/`Inf` (T02/T03).
5. Price/volume plausibility: extremes retained unless proven to be a source error (sheet
   OD-5.9=`A`) — recorded, never silently clipped.
6. Pre/post-listing boundaries recorded with their source (listing dates are currently `UNKNOWN`
   because external verification is blocked, R16 — that stays `UNKNOWN`, not guessed).
7. T13: the last row is not an in-progress candle · T14: no portfolio-level all-absent day.

**Decision: fail-closed, not warn-and-continue.**
Rejected: the status quo of R3 (`print("WARN …")` and continue) — it produced 1.635 unhandled missing
bars and a dataset that fails T04/T06/T07/T10/T11/T12 (`OD5` §24).

### OD-7.8 — When does a dataset become CANONICAL?

**Decision: `OD-7.8 = A`** — a dataset is **reconstruction/evidence data** until *all* of the
following are true, in order:

1. Rebuilt under owner answer **sheet OD-5.3 = `A`** (Option B+C, spec `OD5` §23) from an unfiltered
   network (prerequisite recorded in `OD5` §26), in the pinned environment (OD-7.13).
2. Manifest written **at generation** with every field of OD-7.4.
3. T01–T12 **plus** T13/T14 all PASS as machine-checked output (owner approved that battery:
   **sheet OD-5.8 = `A`**).
4. sha256 recorded at generation **and** verified on every load (owner answer **sheet OD-5.11 = `A`**).
5. An independent clean-environment rerun passes OD-7.12.
6. The freeze record is signed (owner sign-off, dated, referencing the manifest id).
7. The data-layer freeze gate stays armed (owner answer **sheet OD-5.15 = `A`**): any subsequent
   change to data, transform, toolchain or config **drops canonical status** until the gate is
   re-passed and the dataset gets a new id.

Until (1)–(7) hold, no number derived from the dataset may be presented as a thesis result.
Rejected: "git-tracked ⇒ canonical" (that is how the current 15 CSVs are being cited while failing
T07/T10/T11/T12).

### OD-7.9 — Source drift (provider revisions, listings/delistings, library changes)

**Decision: `OD-7.9 = A`** — three separate rules:

- **Provider revises history:** the **stored raw payloads are the authority for the frozen
  canonical build**; a later refetch that differs is recorded as a `SOURCE DRIFT` event with both
  checksums, the diff summary and the timestamp. Canonical data is **never** silently replaced; only
  an explicit owner decision may re-freeze, and then the period/metrics consequences are disclosed.
- **Listing/delisting changes:** the universe is frozen (owner answer **sheet OD-5.2 = `A`**) — a
  delisting never removes an instrument from historical data; listing/delisting is recorded as
  instrument metadata with its source. Since listing dates are currently `UNKNOWN` (R16), they are
  recorded as `UNKNOWN`, not inferred from first candle unless sheet OD-5.1's availability rule
  applies.
- **Library/toolchain changes:** any change to `ccxt`/`pandas`/`numpy`/Python is a **toolchain
  version change** → new manifest → **new dataset id**, never an in-place edit. `ccxt` changes matter
  because it constructs the request (endpoint/pagination), not because it computes numbers.

Rejected: (i) "freeze forever, never refetch" — leaves L1 untested and hides real drift;
(ii) "auto-refresh on change" — silently moves the goalposts mid-thesis.

### OD-7.10 — Provenance: what goes in Git vs outside Git

**Decision: `OD-7.10 = A`** —

| Artifact | Policy |
|---|---|
| Canonical dataset CSVs (10 pairs) | **In Git** (already tracked; small, and they are the thesis input) |
| Manifest + checksums + fetch logs (text) | **In Git — mandatory** |
| Raw payloads (bounded: ≈19k candles, single-digit MB) | **In Git — mandatory**, stored under a dedicated raw directory. **Ceiling: 50 MB total**; above that, out-of-band object storage with the sha256 committed to Git and the location recorded in the manifest. (`ponytail:` ceiling = 50 MB; upgrade path = external object store + committed hash.) |
| Canonical-run ledgers (`equity_curve.csv`, `trades.csv`), `metrics.md`, derived statistics | **In Git — mandatory** (answers repo register item **OD-7.10**: retain the raw trade/equity ledger per canonical run). Note `.gitignore:15` ignores only `backtest/reports/*.csv` at top level; `git check-ignore` confirms a subdirectory path is committable **without any `.gitignore` change** (R18) |
| Environment lockfile, config snapshot, run manifest | **In Git — mandatory** |
| Non-canonical / exploratory runs, PNGs, `paper_trading/logs/`, SQLite | **Out of Git** (unchanged `.gitignore` behavior), written to a throwaway `REPORT_SUBDIR` |

Rejected: (i) un-ignoring all top-level report CSVs — would start committing every exploratory run;
(ii) leaving canonical ledgers ignored (status quo) — this is exactly why Snapshot B's ledger does
not exist (`OD7 audit` G4, repo register OD-7.10 `OWNER DECISION REQUIRED`).

### OD-7.11 — Reproducibility tiers: adopt, or don't?

- **A** = introduce a new four-tier scheme (source / transformation / simulation / publication).
- **B** = **do not invent a second vocabulary**; adopt the existing **R0–R4** from
  `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md` §19 as the sole status vocabulary, and
  define `R4` as *requiring* L2+L3+L4+L5 all satisfied.
- **C** = no tiers at all.

**Decision: `OD-7.11 = B`.**
Rationale: R0–R4 already exists, is already cited by the audit and by the readiness assessment, and
answers "how complete is the *evidence*". OD-7.5's L1–L5 answer a different question — "which
*mechanical* equivalence holds". Two overlapping taxonomies would recreate, at the vocabulary level,
the exact one-number-two-sources problem this series exists to remove (`ARCHITECTURE.md` §16, R12).
Tiers do materially clarify the project — so adopt the existing one and *state the cross-mapping*
(`R4 ⇔ L2 ∧ L3 ∧ L4 ∧ L5 ∧ manifest present ∧ lockfile present`).
Rejected: A (duplicate vocabulary, migration cost, no new information); C (removes the only honest
way to say "reproducible, but only at level X").

### OD-7.12 — Independent-rerun acceptance test

**Decision: `OD-7.12 = A`** — the acceptance test for
*"a second clean environment rebuilds the canonical dataset and obtains the same simulation
inputs/results"* is **all five steps, executed once before thesis freeze, with its own log +
checksums committed as evidence**:

1. **Clean environment:** fresh clone to a *new path*, new venv created from the committed lockfile,
   no reuse of `venv/`, no local state.
2. **Dataset rebuild (L2/L3):** regenerate the canonical CSVs from the stored raw payloads →
   `sha256` must equal the frozen manifest. Network is **not** required for L2/L3 (raw is committed,
   OD-7.2), so this step is executable even while source access is blocked (R16); the L1 refetch
   check runs only when an unfiltered network exists.
3. **Simulation (L4):** run the authoritative command (repo register **OD-7.2**, decided in §5 below)
   **twice** into throwaway `REPORT_SUBDIR`s → `equity_curve.csv` and `trades.csv` byte-identical,
   parsed `metrics.md` values exactly equal, and equal to the frozen canonical run.
4. **Publication (L5):** every number in the derived statistics files recomputed from the committed
   ledger equals the committed value.
5. **Hygiene:** `pytest` green (70 tests today) and `git status --porcelain` clean after the rerun —
   the reproduction must not mutate tracked files.

Rejected: "rerun on the same machine with the same venv" — that is what already passes today (R14)
and is precisely *not* an independent rerun; "byte-compare the PNG" — unsatisfiable (OD-7.5 L4).

### OD-7.13 — Environment pinning: exactly what must be pinned

**Decision: `OD-7.13 = A`** — pin, and record in the manifest:

| Item | Requirement |
|---|---|
| Python | **Exact patch version of the interpreter used for the canonical run**, committed as `.python-version` **and** recorded in the manifest. **The numeric value is not chosen in this sheet** — evidence conflicts (3.14.6 in `venv/pyvenv.cfg` vs 3.14.7 runtime drift; CI at 3.11 and 3.12; Docker at 3.12). It is a *recording obligation* at canonical-run time, not an open methodology question. **All four locations must converge to one value** (implementation item). |
| Dependencies | A committed **lockfile with exact `==` pins** produced by `pip freeze` from the canonical environment (today: `ccxt 4.5.73`, `pandas 3.0.5`, `numpy 2.5.2`, `PyYAML 6.0.3`, `pytest 9.1.1`, `scipy 1.18.0`, `matplotlib 3.11.1`, …). Declared ranges (`requirements.txt`) are **not** a pin. |
| Undeclared-but-used deps | `scipy` (paired test — an OD-6 primary input) and `yfinance` (research) must be **declared** or explicitly scoped out; `pytest>=8.0,<9` vs installed `9.1.1` must be reconciled (R10). |
| CI installs | Workflows must install from the lockfile, not bare `pip install ccxt pandas pyyaml` (R7). |
| Git | Exact HEAD commit, and a **clean tree** required for a canonical run (dirty tree → run is not canonical). |
| Timezone/locale | UTC everywhere; no reliance on host local time in the simulation path. |
| Runtime assumptions | No RNG, no network, no wall-clock in the simulation path (R14 — re-verified, must stay a tested invariant); single-threaded deterministic iteration order (OD-4.8 = `A`, alphabetical — R17). |
| OS | No OS-specific behavior required for numeric outputs; OS/platform recorded for completeness only (PNG byte-identity is explicitly *not* required, OD-7.5). |

Rejected: leaving ranges (an unpinned `pandas>=3.0,<4` can silently change float formatting or
groupby order), and "pin only ccxt because that's the data source" (the *transform* is pandas/numpy).

### OD-7.14 — Failure policy

**Decision: `OD-7.14 = A`** — **fail closed, never partial, never substitute:**

| Failure | Response |
|---|---|
| Source unavailable | Abort; existing canonical dataset untouched; record attempt (timestamp, endpoint, error) in the fetch log. **No alternate source may be substituted** — owner answer **sheet OD-5.4 = `C`** fixed Bitget; a source change is a new owner decision. |
| Source returns incomplete data | Abort at the completeness gate (OD-7.7) before writing. **No imputation** (sheet OD-5.6=`D`, sheet OD-5.13=`A`). Note: `backtest/research/fetch_funding.py:61-64` imputes missing months with a trailing 30-day mean — that is **research-only and explicitly excluded from the canonical dataset path**. |
| Page/window malformed | Bounded retry + backoff → then non-zero exit with a written error record; **never** `break` silently (OD-7.6). |
| Checksum mismatch at load | **Hard error — refuse to run.** The loader verifies sha256 before the backtest reads a single row. |
| Provider changed historical data | `SOURCE DRIFT` record (OD-7.9); canonical untouched unless an explicit owner re-freeze decision. |
| Library produces different normalized output | Toolchain change → new dataset id + disclosure (OD-7.9); the old canonical is never edited in place. |
| Automated data commit | **Forbidden unless the gate passed** — `.github/workflows/fetch-bitget-data.yml:41-44` currently commits with zero verification (R7); that is a required implementation change. |

Rejected: "warn and continue" (status quo, R3) — it is the mechanism behind the 1.635 missing bars.

### OD-7.15 — Relationship with OD-5

**Decision: `OD-7.15 = A`** — **OD-5 is normative for WHAT; OD-7 is normative for HOW.** No OD-7
decision may change an OD-5 outcome; on any conflict, the OD-5 owner answer wins and the conflict is
recorded here.

OD-7 **operationalizes** (does not re-decide) these owner answers:

| OD-5 owner answer (sheet) | What OD-7 does with it |
|---|---|
| 5.4 = `C` Bitget (source) | pins provider/venue in the manifest (OD-7.1); forbids substitution (OD-7.14) |
| 5.3 = `A` rebuild (§22 Option B+C, spec §23) | supplies the fetch contract (OD-7.6) and the acceptance gate (OD-7.8) |
| 5.5 = `A` continuity + presence-window taxonomy | becomes assertion set #2 (OD-7.7) |
| 5.6 = `D` keep gaps + explicit semantics | forbids filling (OD-7.3/#7); `UNKNOWN` must be 0 rather than gaps being 0 |
| 5.8 = `A` reject NaN/Inf/dup/OHLC violations | becomes the pre-write gate (OD-7.7) |
| 5.10 = `C` raw ts + normalized date (UTC 00:00) | normalization step #1 (OD-7.3) |
| 5.11 = `A` manifest + sha256 at generation | manifest schema (OD-7.4) + gate step 2/4 (OD-7.8) |
| 5.12 = `A` retain raw + fetch logs | raw policy (OD-7.2) |
| 5.13 = `A` deterministic normalization, no fill | normalization contract (OD-7.3) |
| 5.14 = `A` exact row/timestamp/value match | level L3 (OD-7.5) |
| 5.15 = `A` data-layer freeze gate | gate step 7 (OD-7.8) |
| T01–T12 + T13/T14 approved | gate step 3 (OD-7.8) |

**Divergence recorded (not silently resolved):** `OD5` §23 draft item 8 says *"total missing bar = 0
atau terdaftar dengan approval"*, written before the owner answered **sheet OD-5.6 = `D`** (keep
gaps, explicit semantics). The **owner answer governs**: gaps are permitted when classified;
`UNKNOWN = 0` is the hard invariant. The §23 draft text is stale on this point.

**Implementation gaps recorded (not decisions):** R4 (`drop_duplicates` vs T05), R5/R6 (no
`candles[0]` check vs §23 item 4), R2 (raw ts destroyed vs §23 item 3), R1/R7 (no manifest/log/CI
gate). These are why the current dataset stays *evidence data* under OD-7.8.

### OD-7.16 — Relationship with OD-6 (can the protocol reproduce every OD-6 input?)

**Decision: `OD-7.16 = A`** — **every OD-6 statistic must have (i) a committed generator, (ii)
pinned inputs (canonical dataset + config-resident constants), (iii) a committed output artifact
carrying the run id (OD-7.17). A statistic without a working generator is not citable in the thesis.**

| OD-6 input | Reproduced from | Status under this protocol |
|---|---|---|
| Strategy return series | committed `equity_curve.csv` from the canonical run (OD-7.10) | reproducible **after** the frozen OD-2…OD-4 semantics are implemented (see §6) |
| B&H return series | same canonical CSVs under OD-6.1/6.2/6.3/6.4/6.5 (equal-dollar, $100 slots, no rebalancing, same cost/gap policy) | **generator does not exist yet** → required by this decision, `OPEN` implementation item |
| Sharpe (OD-6.7: rf=0, ×√365, ddof=1) | series + **config-resident constants** | reproducible once rf/√365/α leave hardcoded position (repo register OD-7.5, §5 below) |
| MDD (OD-6.9) | canonical curve with OD-5 semantics | same generator as Sharpe |
| Paired test (OD-6.11, pre-registered `d_t`, exposure-matched subset) | aligned series + `scipy` | **`scipy` undeclared** (R10) → must be declared/pinned before it is citable |
| VaRSR (OD-6.16) | series + formula | **BLOCKED — sub-gate open** (Deng 2013 formula/confidence/horizon/method) |
| Correlation (OD-6.18), Regime (OD-6.19) | series + disclosed exploratory params | generators must exist and be pinned; both are exploratory, so they never gate the freeze |

Rejected: citing frozen report `.md` values with no working generator (status quo — 3 research
scripts crash at HEAD with `KeyError 'donchian_entry_period'`, `OD6` §29 / `OD7 audit` D9; **not
re-run here because running them writes to `backtest/reports/`**, which this phase may not modify).

### OD-7.17 — Canonical-run provenance (source → dataset → commit → config → simulation → metrics)

**Decision: `OD-7.17 = A`** — the canonical run **must** emit a `run_manifest.json` (and echo its id
into `metrics.md`) containing: git HEAD + dirty flag (must be clean), `sha256` of `config.yaml`, the
**fully resolved effective parameters** (including any `PRESET` overlay and the statistical constants
currently hardcoded), dataset manifest id + dataset checksums, toolchain versions, exact command +
relevant env vars (`REPORT_SUBDIR`, `PRESET`), start/end timestamps, and the artifact list with its
own sha256s. **Every thesis table/figure cites the run id + generator + commit + config + dataset id.**
This is repo register **OD-7.7** (figure/table provenance) and **OD-7.11** (statistical output
provenance) answered together, and it is the mechanism that makes repo **OD-7.6 / ARCH §16**'s
"rewrite ALL citations from one source" executable.

- **A** = run manifest mandatory + every thesis number cites it · **B** = extend `metrics.md` only ·
  **C** = optional.
**Decision: `A`.** Rejected: B (a prose header is not machine-checkable — R11); C (guarantees a repeat
of R12's five-field drift between `backtest-reference.json` and `metrics.md`).

### OD-7.18 — No-back-fitting attestation

**Decision: `OD-7.18 = A`** — this sheet is certified free of result-conditioned choices:

- Every rationale in OD-7.1–OD-7.17 cites only (a) a mechanism/observed failure (R1–R18, `OD5` §10,
  `OD7 audit` D1–D15), (b) a higher-ranked document (PPT, an owner answer, an earlier OD record), or
  (c) cost/feasibility.
- **No decision references the value, sign, or desirability of any performance metric.** Snapshot A
  and Snapshot B appear only as *evidence about reproducibility status* (which artifact exists, which
  is byte-identical), never as anything to match, beat, or approximate.
- No determinism level, gate, checksum rule or tier was chosen because it would make the eventual
  backtest easier, faster, or better-looking. Notably: L1 is *deliberately not required* (it would be
  unsatisfiable), and `UNKNOWN` listing dates are *deliberately left `UNKNOWN`* (R16) rather than
  inferred — both choices sacrifice convenience for honesty.
- This attestation is part of the freeze record; if any later edit to this sheet introduces a
  result-conditioned choice, canonical status does not apply until re-reviewed.

**Decision: `OD-7.18 = A`** = adopt the attestation as written above.

---

## 5. Register reconciliation — repo `OD-7.1 … OD-7.12`

> The Phase-2G audit register uses the **same ID prefix** as this sheet for **different questions**.
> The collision is **recorded, not resolved** (verdict in §6).

| Repo ID | Repo question (audit §28) | Audit status | Disposition by this sheet |
|---|---|---|---|
| **repo OD-7.1** | Canonical thesis result provenance (snapshot A / B / new run) | `OWNER DECISION REQUIRED` | **STAYS OPEN → `ARCHITECTURE.md` §16.** Declared chain puts §16 *after* OD-7; deciding it here would jump the gate. Related to sheet OD-7.17 (which defines the provenance *record*, not the *snapshot choice*). |
| **repo OD-7.2** | Authoritative, non-destructive backtest command | `OWNER DECISION REQUIRED` | **ANSWERED HERE → `A`.** Single official command: `REPORT_SUBDIR=<run_id> python backtest/run_backtest.py`. Non-destructive by construction (writes only into `backtest/reports/<run_id>/`, which is un-ignored — R18); `metrics.md`/CSVs are promoted to the canonical path only by an explicit, recorded step. Verification reruns use a throwaway `REPORT_SUBDIR`. |
| **repo OD-7.3** | Dataset manifest/checksum requirement | `CARRIED → OD-5.9` | Closed by owner answers **sheet OD-5.11/5.12**; operationally specified in sheet **OD-7.2/OD-7.4/OD-7.8**. |
| **repo OD-7.4** | Environment reproducibility (lockfile, Python version, research deps) | `OWNER DECISION REQUIRED` | **ANSWERED HERE → sheet OD-7.13 = `A`.** |
| **repo OD-7.5** | Configuration single source (incl. hardcoded statistical constants; kill/clarify `lookback_years`) | `OWNER DECISION REQUIRED` | **ANSWERED HERE → `A`.** All thesis-critical parameters — including `rf`, annualization factor, α, VaR confidence/horizon, cash-day rule, and the dead `lookback_years` (0 reads, `C9`) — live in `config.yaml` (or an OD-recorded constants block) and are echoed into the run manifest resolved-values section. **Implementation-only, gated:** AGENTS.md §2 forbids changing strategy parameters; moving *where* a constant lives changes no value and must be verified by a value-equality check. |
| **repo OD-7.6** | Result artifact single source | `CARRIED → ARCH §16` | Remains carried; sheet OD-7.17 supplies the mechanism. |
| **repo OD-7.7** | Thesis table/figure provenance | `OWNER DECISION REQUIRED` | **ANSWERED HERE → sheet OD-7.17 = `A`.** |
| **repo OD-7.8** | Handling stale numeric claims | `CARRIED → Phase 2H OD-11` | Remains carried (errata), untouched. |
| **repo OD-7.9** | Deterministic asset ordering | `CARRIED → OD-4.8` | Already answered by owner: **OD-4.8 = `A`** (alphabetical). Recorded as an L4 prerequisite (R17). |
| **repo OD-7.10** | Raw trade/equity ledger retention | `OWNER DECISION REQUIRED` | **ANSWERED HERE → sheet OD-7.10 = `A`** (retain + commit canonical-run ledgers). |
| **repo OD-7.11** | Statistical output provenance | `OWNER DECISION REQUIRED` | **ANSWERED HERE → sheet OD-7.17 = `A`** (+ sheet OD-7.16 generator requirement). |
| **repo OD-7.12** | Final thesis evidence-chain freeze | `OWNER DECISION REQUIRED` | **ANSWERED HERE → `A`.** Criteria frozen now; the *freeze event itself* is executed **after** `ARCHITECTURE.md` §16 and the OD-6 statistical freeze — order is: OD-7 (this sheet) → ARCH §16 → Canonical Methodology Freeze → implementation → canonical run → evidence-chain freeze (repo OD-7.12 executed). |

**Repo register recap after this sheet:** the audit recorded **8** `OWNER DECISION REQUIRED`
(7.1, 7.2, 7.4, 7.5, 7.7, 7.10, 7.11, 7.12) and **4** `CARRIED`. Now: answered here = **7**
(7.2, 7.4, 7.5, 7.7, 7.10, 7.11, 7.12 — of which 7.12's *criteria* are frozen now and its *event*
runs after ARCH §16); still open elsewhere = **1** (**repo OD-7.1 → ARCH §16**); `CARRIED` unchanged
= **4** (7.3→OD-5.9, 7.6→ARCH §16, 7.8→Phase 2H OD-11, 7.9→OD-4.8). No register item is dropped.

---

## 6. Cross-decision consistency

### 6.1 Internal consistency (sheet OD-7.1 … OD-7.18)

- OD-7.4 (manifest) is the identity that OD-7.1 declares; OD-7.8 (gate) consumes OD-7.4 + OD-7.7 +
  OD-7.12; OD-7.5 (levels) defines what OD-7.12 tests; OD-7.17 (run manifest) extends OD-7.4's schema
  discipline to the simulation; OD-7.11 (tiers) maps onto OD-7.5 without a second vocabulary.
- No item decides another item's content; no item references a result value.
- Fail-closed appears three times on purpose (OD-7.6 fetch, OD-7.7 assertions, OD-7.14 failures) —
  same principle, three layers, no contradiction.

### 6.2 vs OD-5 — see OD-7.15 (table + recorded divergence on `OD5` §23 item 8).

### 6.3 vs OD-6 — see OD-7.16 (all eight inputs mapped; VaRSR blocked by its sub-gate).

### 6.4 Verdict

**`CONFLICT — OWNER REVIEW REQUIRED`**

Reasons (all recorded, none silently resolved):

1. **ID collision:** this sheet's `OD-7.1 … OD-7.18` and the audit register's `OD-7.1 … OD-7.12`
   share a prefix for different questions (e.g. sheet OD-7.1 = dataset identity vs repo OD-7.1 =
   canonical snapshot provenance; sheet OD-7.2 = raw preservation vs repo OD-7.2 = authoritative
   command). One of the two registers must eventually be renumbered — **owner's call, not this
   sheet's**.
2. **`OD5` §23 draft item 8 vs owner answer sheet OD-5.6 = `D`** (zero gaps vs kept-and-classified
   gaps) — stale draft text; owner answer governs (§6.2).
3. **Implementation contradicts approved acceptance tests:** `drop_duplicates` (R4) vs T05; no
   `candles[0]` check (R5) vs §23 item 4; raw timestamps destroyed (R2) vs §23 item 3; no manifest or
   saved log (R1) vs T10–T12; CI commits unverified data (R7) vs OD-7.14.
4. **Environment pinning is internally inconsistent in the repo today:** four Python versions, a
   violated declared pin (`pytest`), and two used-but-undeclared dependencies (R9/R10).
5. **`repo OD-7.1` remains undecided by design** — it is deferred to `ARCHITECTURE.md` §16, which
   follows this sheet in the declared chain.

---

## 7. Unresolved items (restated — still open after this sheet)

1. **`repo OD-2.4`** — fixed vs dynamic stop (PPT:189 "Stop loss dinamis: Entry − 2×ATR(14)" vs
   implementation) — **OPEN, owner**.
2. **`repo OD-2.7`** — stop-execution cost treatment — **OPEN, owner**.
3. **`ARCHITECTURE.md` §16** — canonical metric snapshot (A / B / new run) — **OPEN, next in chain**
   (also absorbs `repo OD-7.1` and `repo OD-7.6`).
4. **OD-6 statistical sub-gates (3), all blocking the statistical freeze:**
   (a) **VaRSR formula + confidence + horizon + method** from Deng 2013 (PPT:62/269–273) → OD-6.16;
   (b) **Sharpe uncertainty / CI estimator method** → OD-6.15;
   (c) **deterministic cash-day classification rule** → the pre-registered exposure-matched subset
   in OD-6.11.
5. **Phase 2H OD-11** (errata for stale/mislabelled numbers) and **Phase 2H OD-12** (sensitivity
   presentation) — carried, untouched.
6. **External source verification blocked** (ISP DNS hijack, `OD5` §26) — gates *execution* of the
   OD-5.3 rebuild and the L1 leg of OD-7.12; it does **not** block any decision in this sheet, and
   no external data was substituted.
7. **BCH / LTC / PAXG CSVs have no generator** (R8) — research-only; out of the frozen 10-pair
   universe (sheet OD-5.2 = `A`); Wave 1 data split is separately gated (`TREE_REFACTOR_AUDIT` §10.2).
8. **Listing dates `UNKNOWN`** for the universe (R16) — must stay `UNKNOWN` until a source proves
   them; not inferred here.

---

## 8. Acceptance criteria (when is OD-7 "done"?)

- [x] All 18 questions answered with an explicit letter + rationale.
- [x] Repo register `OD-7.1 … OD-7.12` reconciled item-by-item; carries preserved; no item silently
      dropped.
- [x] Every OD-7 decision cross-checked against OD-5 (§7.15 table) and OD-6 (§7.16 table) — no
      duplication, no contradiction, divergences recorded.
- [x] ID collisions and contradictions recorded with an explicit `CONFLICT — OWNER REVIEW REQUIRED`
      verdict (§6.4).
- [x] Still-open items restated (§7), including `repo OD-2.4`, `repo OD-2.7`, `ARCH §16`, and the
      three OD-6 sub-gates.
- [x] No-back-fitting attestation present (OD-7.18).
- [x] Exactly one new file; zero changes to source, config, data, reports, tests, workflows, or
      earlier OD records (verified in §9).
- [ ] *(postponed by design)* Execution of the freeze procedures above — happens only after
      `ARCHITECTURE.md` §16 and the Canonical Methodology Freeze.

---

## 9. Verification report

**Files inspected (read-only):**
`scripts/fetch_bitget_data.py` · `backtest/run_backtest.py` · `requirements.txt` ·
`requirements-engine.txt` · `venv/pyvenv.cfg` · `.github/workflows/{fetch-bitget-data,paper-trading,test-bitget-api}.yml` ·
`.gitignore` · `config.yaml` · `tests/` (9 files) · `data/` (15 CSVs, headers/first-last rows) ·
`ARCHITECTURE.md` (§16) · `AGENTS.md` · `OD5_DATA_INTEGRITY_REBUILD_DECISION.md` (§10, §22–§27, §29) ·
`OD6_BENCHMARK_METRICS_STATISTICAL_VALIDITY_DECISION.md` (§4, §27–§29) ·
`OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md` (§4, §6–§7, §13–§16, §19, §21, §23–§28, §30) ·
`TREE_REFACTOR_AUDIT.md` · `docs/audit/` (9 files) · `README.md` · `REPO_MAP.md` · `PLAN.md`.

**Commands run (read-only / non-mutating):**

| Command | Result |
|---|---|
| `git log --oneline -5` · `git rev-parse HEAD` · `git status --porcelain` | HEAD `9791707`; 7 untracked, 0 tracked changes (start and end identical) |
| `venv/bin/python -m pytest tests/ -q -p no:cacheprovider` | **70 passed in 7.45s** |
| `venv/bin/pip check` | `No broken requirements found.` |
| `venv/bin/pip list` (filtered) | ccxt 4.5.73 · pandas 3.0.5 · numpy 2.5.2 · PyYAML 6.0.3 · pytest 9.1.1 · scipy 1.18.0 · matplotlib 3.11.1 · vectorbt 1.1.0 · yfinance 1.7.0 |
| `git check-ignore -v` on `backtest/reports/canonical/curve.csv` / `backtest/reports/top.csv` | `NOT IGNORED` / ignored by `.gitignore:15` (probe files created and removed within the same command; tree left clean) |
| `git ls-files data` · `git ls-files backtest/reports` · `git ls-files scripts` | 15 · 23 · 3 |

**Not run, deliberately:** the three research generators (`sharpe_benchmark.py`,
`regime_segmentation.py`, `portfolio_size_experiment.py`) — they crash at HEAD per audit D9/`OD6`
§29 **and** a successful run would write into `backtest/reports/`, which this phase may not modify.
No refetch was attempted (blocked, R16).

| Question | Answer |
|---|---|
| Files changed | **0** (no source, no config, no data, no report, no test, no workflow, no earlier OD record) |
| Files created | **1** — `OD7_REPRODUCIBILITY_DECISION.md` (this file) |
| Files deleted | **0** |
| Any data / code / config changed? | **NO** |
| Any commit / push? | **NO** — nothing staged; `git diff HEAD` and `git diff --cached` empty |
| `git status --porcelain` | 8 untracked: `OD3_…`, `OD4_…`, `OD5_…`, `OD6_…`, `OD7_THESIS_REPRODUCIBILITY_RESULT_TRACEABILITY_AUDIT.md`, `OD8_…`, `TREE_REFACTOR_AUDIT.md`, **`OD7_REPRODUCIBILITY_DECISION.md`** |

**Exact unresolved sub-gates carried from OD-6:** three —
(1) **VaRSR formula / confidence / horizon / method** (Deng 2013, PPT:62/269–273) → OD-6.16;
(2) **Sharpe CI estimator method** → OD-6.15;
(3) **deterministic cash-day classification rule** for the pre-registered exposure-matched subset →
OD-6.11.
All three must close before the OD-6 statistical freeze and before the canonical run; none is
answered, advanced, or assumed by this sheet.

---

## 10. Final status

**`OWNER DECISION — ANSWERED (18/18), with recorded conflicts`.**

OD-7 is decided as a *protocol*: identity by manifest, raw payloads required, fail-closed fetch and
gates, five named determinism levels, one tier vocabulary (R0–R4), Git-vs-outside-Git policy, a
five-step independent-rerun test, environment pinning rules, drift and failure policies, and a
run-manifest chain that makes every future thesis number traceable source → dataset → commit → config
→ simulation → metrics.

It changes **no** prior decision, **no** code, **no** data. The next gate in the declared chain is
**`ARCHITECTURE.md` §16** (canonical snapshot), after which the Canonical Methodology Freeze governs
implementation and the single canonical rerun.

*No commit. No push. Only new artifact: `OD7_REPRODUCIBILITY_DECISION.md`.*
