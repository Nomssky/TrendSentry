"""Contract test Phase A: deployment + config version (control plane).

Sama seperti tests/test_strategy_templates_seed.py, test ini TANPA database —
ia membaca sumber migration SQL dan sumber TypeScript secara langsung, karena
repo ini tidak punya runner unit-test untuk TS (lihat monitoring/web/AGENTS.md §8:
Playwright hanya untuk e2e yang butuh environment hidup).

Yang dikunci:
  1. migration ordering/struktur + RLS owner-only + imutabilitas config version
  2. route POST menulis config version 1 dan menscope kepemilikan strategi
  3. token baca config disimpan sebagai hash, dibaca session-free + timing-safe
  4. penolakan hard-reject ada di DUA ujung (skema TS + engine validate_config)

Titik lemah yang disadari: kepatuhan runtime zod tidak bisa dieksekusi dari
pytest, jadi sisi TS diuji sebagai kontrak sumber. Kecocokan SHAPE-nya sendiri
dibuktikan lewat validate_config() Python (test_mvp_bundle_accepted_by_engine),
yang merupakan batas sebenarnya antara kontrol-eksekusi dan engine.
"""

import json
import re
from pathlib import Path

import yaml

from risk_manager.guards import validate_config

ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "supabase" / "migrations"
WEB = ROOT / "monitoring" / "web"

MIGRATION = MIGRATIONS / "20260928120000_add_deployments_and_config_versions.sql"
REMOTE_SCHEMA = MIGRATIONS / "20260909120000_remote_schema.sql"
RLS_FIX = MIGRATIONS / "20260909130000_fix_rls_policies.sql"
TEMPLATE_SEED = MIGRATIONS / "20260922120000_insert_builtin_strategy_templates.sql"

DEPLOYMENT_ROUTE = WEB / "app" / "api" / "deployments" / "route.ts"
CONFIG_ROUTE = WEB / "app" / "api" / "deployments" / "[id]" / "config" / "route.ts"
BUNDLE_TS = WEB / "lib" / "deployment-config.ts"
CONSTANTS_TS = WEB / "lib" / "constants.ts"
CONFIG_YAML = ROOT / "config.yaml"

# Mapping params template Donchian -> kunci yang dibaca engine (config.yaml).
# Nama berbeda di dua sisi; inilah satu-satunya "translation" yang diizinkan.
ENGINE_PARAM_MAP = {
    "donchian_entry_period": 'num("entry_period")',
    "donchian_exit_period": 'num("exit_period")',
    "atr_period": 'num("atr_period")',
    "atr_stop_multiplier": 'num("atr_stop_multiplier")',
    "direction": 'resolved(args.params, props, "direction")',
    "risk_per_trade_pct": 'num("risk_per_trade_pct")',
    "max_concurrent_positions": 'num("max_concurrent")',
}

# Default template Donchian (id 1) -> posisi di config.yaml.
TEMPLATE_DEFAULT_MAP = {
    "entry_period": ("strategy", "donchian_entry_period"),
    "exit_period": ("strategy", "donchian_exit_period"),
    "atr_period": ("strategy", "atr_period"),
    "atr_stop_multiplier": ("strategy", "atr_stop_multiplier"),
    "direction": ("strategy", "direction"),
    "max_concurrent": ("risk", "max_concurrent_positions"),
    "risk_per_trade_pct": ("risk", "risk_per_trade_pct"),
}


# ── helpers ──────────────────────────────────────────────────────────────────


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _sql() -> str:
    return _read(MIGRATION)


def _body() -> str:
    """SQL tanpa komentar `--` (komentar boleh memuat kata UPDATE/DELETE/dll)."""
    return "\n".join(line.split("--", 1)[0] for line in _sql().splitlines())


def _post_route() -> str:
    return _read(DEPLOYMENT_ROUTE)


def _config_route() -> str:
    return _read(CONFIG_ROUTE)


def _bundle_ts() -> str:
    return _read(BUNDLE_TS)


def _config() -> dict:
    return yaml.safe_load(CONFIG_YAML.read_text(encoding="utf-8"))


def _template_defaults() -> dict:
    """Default params template Donchian, diekstrak dari seed migration (tanpa duplikasi)."""
    match = re.search(
        r"\(1, 'Donchian Breakout', '.*?', '(\{.*?\})'::jsonb\)",
        _read(TEMPLATE_SEED),
        re.DOTALL,
    )
    assert match, "template Donchian (id 1) tidak ditemukan di seed migration"
    return {k: v["default"] for k, v in json.loads(match.group(1))["properties"].items()}


def _valid_bundle(**overrides) -> dict:
    """Bentuk persis output buildDonchianBundle() pada nilai default template."""
    c = _config()
    bundle = {
        "deployment_id": 1,
        "user_strategy_id": 1,
        "config_version": 1,
        "strategy": {
            "model": "donchian",
            "pairs": list(c["strategy"]["pairs"]),
            "timeframe": c["strategy"]["timeframe"],
            "donchian_entry_period": c["strategy"]["donchian_entry_period"],
            "donchian_exit_period": c["strategy"]["donchian_exit_period"],
            "atr_period": c["strategy"]["atr_period"],
            "atr_stop_multiplier": c["strategy"]["atr_stop_multiplier"],
            "direction": c["strategy"]["direction"],
            "max_positions_per_cluster": c["strategy"]["max_positions_per_cluster"],
        },
        "risk": {
            "risk_per_trade_pct": c["risk"]["risk_per_trade_pct"],
            "max_concurrent_positions": c["risk"]["max_concurrent_positions"],
            "max_drawdown_circuit_breaker_pct": c["risk"]["max_drawdown_circuit_breaker_pct"],
        },
        "backtest": {
            "fee_pct": c["backtest"]["fee_pct"],
            "slippage_pct": c["backtest"]["slippage_pct"],
            "initial_capital_usd": c["backtest"]["initial_capital_usd"],
        },
        "execution": {"mode": c["execution"]["mode"], "exchange": c["execution"]["exchange"]},
        "paper_trading": {
            "data_source": c["paper_trading"]["data_source"],
            "yield_apy_idle_cash": c["paper_trading"]["yield_apy_idle_cash"],
        },
        "llm_filter": {"enabled": False},
    }
    bundle.update(overrides)
    return bundle


# ── 1. migration ordering / structure ────────────────────────────────────────


def test_migration_added_last_and_ordered():
    names = sorted(p.name for p in MIGRATIONS.glob("*.sql"))
    assert MIGRATION.name in names
    # forward-only: menempel setelah migration terakhir yang sudah ada sebelum Phase A
    assert names[names.index(MIGRATION.name) - 1] == TEMPLATE_SEED.name
    assert re.fullmatch(r"\d{14}_[a-z0-9_]+\.sql", MIGRATION.name)
    assert int(MIGRATION.name[:14]) > 20260922120000


def test_migration_table_structure():
    body = _body()
    assert re.search(r"create table public\.deployments \(", body)
    assert re.search(r"create table public\.deployment_config_versions \(", body)
    # kepemilikan user + strategi
    assert re.search(
        r"user_id\s+uuid\s+not null\s+references\s+auth\.users\s*\(\s*id\s*\)\s+on delete cascade",
        body,
    )
    assert re.search(
        r"user_strategy_id\s+bigint\s+not null\s+references\s+public\.user_strategies\s*\(\s*id\s*\)",
        body,
    )
    # PK komposit (deployment_id, version)
    assert re.search(r"primary key \(deployment_id, version\)", body)
    assert re.search(r"config\s+jsonb not null", body)


def test_migration_forward_only_existing_tables_untouched():
    body = _body()
    touched = set(re.findall(r"\b(?:alter|drop)\s+table\s+(?:public\.)?(\w+)", body))
    assert touched <= {"deployments", "deployment_config_versions"}, touched
    assert not re.search(r"\binsert\s+into\b", body)
    assert not re.search(r"\bupdate\s+public\.", body)
    assert not re.search(r"\bdrop\s+(policy|column|constraint|function|table)\b", body)


def test_status_lifecycle_is_minimal_and_has_heartbeat():
    body = _body()
    # lifecycle persis 4 state, default = baru dibuat (belum jalan)
    match = re.search(
        r"status\s+text not null default 'created'\s+check \(status in \(([^)]+)\)\)", body
    )
    assert match, "status harus text default 'created' + CHECK 4 state"
    states = [s.strip().strip("'") for s in match.group(1).split(",")]
    assert states == ["created", "running", "stopped", "failed"]
    # health/status gap: cukup satu kolom heartbeat, bukan sistem monitoring
    assert re.search(r"last_heartbeat\s+timestamptz,", body)
    assert re.search(r"current_config_version\s+integer not null default 1", body)
    # token disimpan sebagai hash, bukan secret mentah
    assert re.search(r"config_token_hash\s+text not null", body)


# ── 2. imutabilitas + RLS ────────────────────────────────────────────────────


def test_config_version_immutable():
    body = _body()
    # trigger: UPDATE apapun melempar exception -> tidak ada jalur "silent"
    assert re.search(r"create trigger\s+trg_deployment_config_versions_immutable", body)
    assert "before update on public.deployment_config_versions" in body
    assert re.search(r"raise exception 'deployment_config_versions immutable", body)
    # RLS tidak punya policy UPDATE/DELETE sama sekali -> default deny
    policies = re.findall(
        r'create policy\s+"([^"]+)"\s+on\s+public\.(\w+)\s+for\s+(\w+)', body, re.S
    )
    assert policies, "harus ada policy RLS"
    assert all(op == "select" for _, _, op in policies), policies
    assert {tbl for _, tbl, _ in policies} == {"deployments", "deployment_config_versions"}


def test_rls_owner_only_and_not_publicly_readable():
    body = _body()
    assert "alter table public.deployments enable row level security" in body
    assert "alter table public.deployment_config_versions enable row level security" in body
    assert not re.search(r"\bto\s+anon\b", body)
    assert not re.search(r"\bto\s+public\b", body)
    assert "using (true)" not in body
    # deployments: owner-only select
    assert re.search(
        r'"deployments_select_self".*?using \(\(select auth\.uid\(\)\) = user_id\)', body, re.S
    )
    # config version: kepemilikan DIWARISI dari induknya
    assert re.search(
        r'"deployment_config_versions_select_self".*?d\.user_id = \(select auth\.uid\(\)\)',
        body,
        re.S,
    )


def test_cannot_create_deployment_from_another_users_strategy():
    route = _post_route()
    # baca strategi pakai session client (RLS aktif) + scoping eksplisit ke pemilik
    assert '"@/lib/supabase/server"' in route
    assert re.search(
        r'\.from\("user_strategies"\).*?\.eq\("user_id", user\.id\)', route, re.S
    )
    # tabel induk tetap dijaga policy lama (diperketat ke `authenticated`)
    assert 'create policy "user_strategies_self" on public.user_strategies' in _read(REMOTE_SCHEMA)
    assert 'ALTER POLICY "user_strategies_self" ON public.user_strategies TO authenticated;' in _read(RLS_FIX)
    # tulisan deployment/config version hanya lewat service role (tanpa INSERT policy)
    assert "createAdminClient" in route


# ── 3. POST: config version 1 ────────────────────────────────────────────────


def test_post_creates_deployment_with_config_version_1():
    route = _post_route()
    # deployment dibuat dengan current_config_version = 1
    assert re.search(
        r"\.insert\(\{\s*user_id: user\.id,.*?current_config_version: 1,", route, re.S
    ), "insert deployment wajib menyetel current_config_version: 1"
    # snapshot pertama ditulis dengan version 1
    assert re.search(
        r'from\("deployment_config_versions"\)\.insert\(\{\s*deployment_id: deployment\.id,\s*version: 1,',
        route,
        re.S,
    ), "config version pertama wajib version 1"
    # bundle divalidasi sebelum disimpan
    assert "ConfigBundleSchema.safeParse" in route
    # guardrail kebijakan yang sudah ada tetap dipanggil
    assert "checkStrategyGuardrails" in route
    # hanya Donchian yang boleh dideploy
    assert "DONCHIAN_TEMPLATE_NAME" in route
    # route ini kontrol-eksekusi saja: tidak memanggil layanan luar sama sekali
    # (tidak ada pemanggilan exchange, tidak ada scheduler, tidak ada SQLite)
    assert "fetch(" not in route
    assert "ccxt" not in route


def test_get_scopes_deployments_to_owner_and_hides_token_hash():
    route = _post_route()
    get_block = route.split("export async function GET")[1].split("export async function POST")[0]
    assert re.search(r'\.eq\("user_id", user\.id\)', get_block)
    columns = re.search(r'const COLUMNS =\s*"(.*?)"', route)
    assert columns, "kolom select harus dideklarasikan terpusat"
    assert "config_token_hash" not in columns.group(1)
    # token hash tidak pernah terkirim ke client
    assert "config_token_hash" not in get_block


def test_config_token_hashed_and_returned_exactly_once():
    route = _post_route()
    assert "crypto.randomBytes(32)" in route
    assert 'createHash("sha256")' in route
    # plaintext hanya di response POST, tidak pernah disimpan
    assert route.count("config_token: configToken") == 1
    assert 'config_token_hash: configTokenHash' in route


# ── 4. config read endpoint ──────────────────────────────────────────────────


def test_config_endpoint_requires_bearer_without_session():
    route = _config_route()
    # session-free: tidak ada client cookie sama sekali
    assert "@/lib/supabase/server" not in route
    assert "createAdminClient" in route
    assert 'headers.get("authorization")' in route
    assert "Bearer " in route
    # perbandingan timing-safe atas hash (pola CRON_SECRET yang sudah ada)
    assert "timingSafeEqual" in route
    assert 'createHash("sha256")' in route
    # kegagalan apapun dijawab 401 -> id enumeration tidak bisa
    assert route.count('status: 401') >= 3


def test_config_endpoint_resolves_current_version_only():
    route = _config_route()
    # resolve lewat current_config_version, bukan literal 1
    assert '.eq("version", deployment.current_config_version)' in route
    # hanya satu baris (current) yang pernah dibaca
    assert route.count('from("deployment_config_versions")') == 1
    assert ".maybeSingle()" in route
    # tidak ada riwayat versi / list query
    assert not re.search(r'from\("deployment_config_versions"\).*?\.order\(', route, re.S)


# ── 5. kontrak config bundle ─────────────────────────────────────────────────


def test_bundle_schema_rejects_hard_violations():
    """Sisi kontrol-eksekusi: 6 penolakan wajib ada sebagai literal/batas skema."""
    ts = _bundle_ts()
    for declaration in (
        'mode: z.literal("paper")',  # execution.mode = live -> tolak
        'exchange: z.literal("bitget")',  # venue non-Bitget -> tolak
        'data_source: z.literal("bitget")',
        'direction: z.literal("long_only")',  # long_short -> tolak
        "risk_per_trade_pct: z.number().gt(0).max(1)",  # risk > 1% -> tolak
        "max_concurrent_positions: z.number().int().min(1).max(5)",  # > 5 -> tolak
        "atr_stop_multiplier: z.number().positive()",  # stop tidak valid -> tolak
        'model: z.literal("donchian")',  # hanya Donchian yang executable
        "llm_filter: z.object({ enabled: z.literal(false) })",  # AI/LLM di luar MVP
    ):
        assert declaration in ts, f"deklarasi hilang: {declaration}"


def test_engine_rejects_same_hard_violations():
    """Sisi engine: validate_config() menolak bundle yang sama persis."""
    cases = {
        "mode live": (_valid_bundle(execution={"mode": "live", "exchange": "bitget"}), "execution.mode"),
        "exchange non-bitget": (
            _valid_bundle(execution={"mode": "paper", "exchange": "binance"}),
            "execution.exchange",
        ),
        "direction long_short": (
            _valid_bundle(strategy={**_valid_bundle()["strategy"], "direction": "long_short"}),
            "strategy.direction",
        ),
        "risk > 1%": (_valid_bundle(risk={**_valid_bundle()["risk"], "risk_per_trade_pct": 1.5}), "risk.risk_per_trade_pct"),
        "max concurrent > 5": (
            _valid_bundle(risk={**_valid_bundle()["risk"], "max_concurrent_positions": 6}),
            "risk.max_concurrent_positions",
        ),
        "atr stop <= 0": (
            _valid_bundle(strategy={**_valid_bundle()["strategy"], "atr_stop_multiplier": 0}),
            "strategy.atr_stop_multiplier",
        ),
    }
    for label, (bundle, needle) in cases.items():
        errors = validate_config(bundle)
        assert any(needle in e for e in errors), f"{label} harus ditolak, dapat: {errors}"


def test_mvp_bundle_accepted_by_engine():
    # Batas sebenarnya kontrol-eksekusi -> engine: bundle harus lolos utuh.
    assert validate_config(_valid_bundle()) == []


def test_template_defaults_align_with_engine_config():
    """Params template (yang dikirim user) harus default-nya sama dengan config.yaml."""
    defaults = _template_defaults()
    cfg = _config()
    for tpl_key, (section, engine_key) in TEMPLATE_DEFAULT_MAP.items():
        assert tpl_key in defaults, f"template params hilang: {tpl_key}"
        assert defaults[tpl_key] == cfg[section][engine_key], (
            f"default template {tpl_key}={defaults[tpl_key]!r} != "
            f"config.yaml {section}.{engine_key}={cfg[section][engine_key]!r}"
        )


def test_builder_maps_template_params_to_engine_keys():
    ts = _bundle_ts()
    for engine_key, expr in ENGINE_PARAM_MAP.items():
        assert re.search(rf"{engine_key}\s*:\s*{re.escape(expr)}", ts), (
            f"builder tidak memetakan {engine_key} <- {expr}"
        )


def test_engine_defaults_match_config_yaml():
    """Salinan web-side di MVP_ENGINE_DEFAULTS tidak boleh drift dari config.yaml."""
    cfg = _config()
    match = re.search(r"export const MVP_ENGINE_DEFAULTS = \{(.*?)\n\} as const", _bundle_ts(), re.S)
    assert match, "MVP_ENGINE_DEFAULTS tidak ditemukan"
    found: dict = {}
    for key, raw in re.findall(r'(\w+):\s*("[^"]*"|-?\d+(?:\.\d+)?)', match.group(1)):
        if raw.startswith('"'):
            found[key] = raw[1:-1]
        else:
            found[key] = float(raw) if "." in raw else int(raw)
    expected = {
        "timeframe": cfg["strategy"]["timeframe"],
        "max_positions_per_cluster": cfg["strategy"]["max_positions_per_cluster"],
        "max_drawdown_circuit_breaker_pct": cfg["risk"]["max_drawdown_circuit_breaker_pct"],
        "fee_pct": cfg["backtest"]["fee_pct"],
        "slippage_pct": cfg["backtest"]["slippage_pct"],
        "data_source": cfg["paper_trading"]["data_source"],
        "yield_apy_idle_cash": cfg["paper_trading"]["yield_apy_idle_cash"],
        "mode": cfg["execution"]["mode"],
        "exchange": cfg["execution"]["exchange"],
    }
    assert found == expected


def test_web_constants_match_config_yaml():
    """PAIRS / STARTING_CASH dipakai builder — wajib selaras config.yaml (ARCH §16)."""
    cfg = _config()
    constants = _read(CONSTANTS_TS)
    pairs = re.search(r"export const PAIRS = \[(.*?)\] as const", constants, re.S)
    assert pairs
    assert re.findall(r'"([^"]+)"', pairs.group(1)) == cfg["strategy"]["pairs"]
    cash = re.search(r"export const STARTING_CASH = ([\d_]+)", constants)
    assert cash
    assert int(cash.group(1).replace("_", "")) == cfg["backtest"]["initial_capital_usd"]
