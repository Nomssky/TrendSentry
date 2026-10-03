"""Phase C: dashboard per-deployment + kepemilikan + visibilitas lifecycle (C1..C8).

Lapis pembuktian, mengikuti konvensi repo (monitoring/web/AGENTS.md §8 — tidak ada
runner unit-test TS; Playwright hanya untuk e2e berenvironment hidup):

  1. KONTRAK SUMBER route/page TS — bahwa filtering, gerbang kepemilikan, dan
     larangan membocorkan token tertulis di kode yang benar-benar dirender.
  2. Kontrak migrasi/RLS — bahwa kepemilikan juga dijaga di database, bukan
     hanya di UI.
  3. Kontrak Python — bahwa payload sinkron yang menyuplai halaman ini memang
     ter-scope per deployment (dipadu dengan uji perilaku di
     tests/test_two_deployments_isolation.py).

Ini BUKAN live integration test: tidak ada Supabase yang dijalankan (lihat
E7/environment limitation di laporan akhir).
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "paper_trading"))
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import sync_paper_to_supabase as sync  # noqa: E402

WEB = ROOT / "monitoring" / "web"
PAGE = WEB / "app" / "app" / "deployments" / "[id]" / "page.tsx"
SELECTOR = WEB / "app" / "app" / "deployments" / "[id]" / "DeploymentSelector.tsx"
LIST_PAGE = WEB / "app" / "app" / "deployments" / "page.tsx"
DB_SRC = WEB / "lib" / "db-supabase.ts"
LIST_ROUTE = WEB / "app" / "api" / "deployments" / "route.ts"
MIGRATION = ROOT / "supabase" / "migrations" / "20260928120000_add_deployments_and_config_versions.sql"
PAPER_PAGE = WEB / "app" / "papertrading" / "page.tsx"


def _read(path: Path) -> str:
    """Sumber TANPA komentar — semua uji kontrak membaca kode yang benar-benar
    dirender, bukan docstring yang sekadar MENYEBUT aturan."""
    src = path.read_text(encoding="utf-8")
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"^\s*//.*$", "", src, flags=re.M)
    return src


# ── C1. selector + filtering ───────────────────────────────────────────────


def test_selector_hanya_navigasi_tidak_pernah_membaca_data():
    """Selector = pemilih id saja. Data dibaca halaman tujuan, sudah di-filter
    dan sudah lewat verifikasi kepemilikan — jadi tidak ada jalur pendek yang
    melewati server."""
    sel = _read(SELECTOR)
    assert "router.push(`/app/deployments/${e.target.value}`)" in sel
    for forbidden in ("getDashboardData", "db-supabase", "paper_signals", "paper_positions"):
        assert forbidden not in sel, f"selector membaca data langsung: {forbidden}"


def test_page_membaca_data_dengan_id_route_bukan_default():
    """`getDashboardData(id)` — id berasal dari route, bukan default 0."""
    src = _read(PAGE)
    assert "getDashboardData(id)" in src
    # Tidak ada pemanggilan tanpa argumen (yang akan jatuh ke stream legacy 0).
    assert "getDashboardData()" not in src
    assert "getDashboardData(0)" not in src
    # id <= 0 (termasuk stream legacy) tidak pernah jadi dashboard deployment.
    assert "if (!Number.isInteger(id) || id <= 0) notFound()" in src


def test_semua_tabel_paper_di_filter_deployment_id():
    """C5: keenam tabel mirror di-filter dengan identitas deployment yang benar."""
    src = _read(DB_SRC)
    assert "getDashboardData(deploymentId = 0)" in src  # default legacy tetap 0
    for table in (
        "paper_signals",
        "paper_positions",
        "paper_equity_log",
        "paper_meta",
        "paper_slippage_log",
        "paper_yield_log",
    ):
        block = next(line for line in src.splitlines() if f'from("{table}")' in line)
        assert '.eq("deployment_id", deploymentId)' in block, f"{table} tidak ter-scope"
    # Tidak ada filter yang mengunci stream 0 di dalam fungsi scoping.
    assert '.eq("deployment_id", 0)' not in src


def test_deployment_id_tidak_diturunkan_dari_user_atau_strategy():
    """C5: identitas stream = id deployment dari route, bukan user/strategy."""
    src = _read(PAGE)
    assert "getDashboardData(user" not in src
    assert "getDashboardData(strategy" not in src
    assert "getDashboardData(0" not in src
    # Tidak ada filter paper yang dikunci ke user/strategy sebagai pengganti
    # deployment_id (pemakaian `deployment_id` yang ada hanya untuk membaca
    # snapshot config milik id yang sama).
    assert '.eq("deployment_id", user' not in src
    assert '.eq("deployment_id", strategy' not in src
    assert '.eq("deployment_id", id)' in src


def test_jalur_legacy_tetap_memakai_stream_nol():
    """C8.8: /papertrading (publik) tetap memanggil tanpa argumen -> stream 0."""
    assert "getDashboardData()" in _read(PAPER_PAGE)
    assert "getDashboardData(deploymentId = 0)" in _read(DB_SRC)


# ── C2. kepemilikan ────────────────────────────────────────────────────────


def test_page_memakai_session_client_bukan_service_role():
    """Kepemilikan harus lewat session (RLS aktif); service role akan melewati
    semua policy dan membuat cek `eq(user_id)` satu-satunya penghalang."""
    src = _read(PAGE)
    assert 'from "@/lib/supabase/server"' in src
    assert "createAdminClient" not in src
    assert 'from "@/lib/supabase/admin"' not in src


def test_kepemilikan_diverifikasi_sebelum_data_diambil():
    """Urutan wajib: auth -> parse id -> eq(user_id) -> notFound -> getDashboardData.

    Membalik urutan auth/id membocorkan keberadaan deployment lewat beda jawaban
    (404 vs redirect login) untuk user yang belum login."""
    src = _read(PAGE)
    i_auth = src.index('if (!user) redirect("/auth/login")')
    i_id = src.index("const { id: rawId } = await params")
    i_owner = src.index('.eq("user_id", user.id)')
    i_notfound = src.index("if (!deployment) notFound()")
    i_data = src.index("getDashboardData(id)")
    assert i_auth < i_id < i_owner < i_notfound < i_data
    assert src.index('.eq("id", id)') < i_notfound


def test_tidak_ada_memorandum_keberadaan_deployment():
    """Deployment tidak ada dan milik orang lain = jawaban 404 yang sama;
    tidak ada kode 403/401 yang membedakan keduanya setelah auth."""
    src = _read(PAGE)
    assert src.count("notFound()") >= 2  # id tidak sah + bukan milik peminta
    assert "403" not in src
    assert "forbidden" not in src.lower()
    # Config version juga lewat gerbang yang sama (RLS pewarisan kepemilikan).
    assert 'from("deployment_config_versions")' in src


def test_rls_deployment_ownership_ada_di_migrasi():
    """Kepemilikan bukan hanya di UI: policy SELECT owner-only di database."""
    sql = _read(MIGRATION)
    assert "enable row level security" in sql
    assert "deployments_select_self" in sql
    assert "(select auth.uid()) = user_id" in sql
    # Tidak ada policy tulis -> user tidak bisa membuat/mengubah deployment sendiri.
    assert 'on public.deployments\n  for select' in sql or "for select to authenticated" in sql
    assert re.search(r'policy "[^"]*" on public\.deployments\s*\n\s*for (insert|update|delete)', sql) is None


# ── C3. lifecycle & heartbeat ──────────────────────────────────────────────


def test_status_dan_heartbeat_tampil_di_dashboard():
    src = _read(PAGE)
    assert "deployment.status" in src
    assert "deployment.last_heartbeat" in src
    # Gaya tiap state tinggal di komponen bersama StatusBadge (app/components/ui.tsx);
    # halaman wajib memakainya (bukan style lokal per halaman).
    assert "StatusBadge" in src
    assert "status={deployment.status}" in src
    shared = _read(WEB / "app" / "components" / "ui.tsx")
    for state in ("created", "running", "stopped", "failed"):
        assert f"{state}:" in shared, f"state {state} tidak punya gaya tampilan"


def test_stale_heartbeat_diakui_pakai_timestamp_bukan_skor():
    """D5: stale = timestamp eksplisit, bukan angka kesehatan arbitrer."""
    src = _read(PAGE)
    assert "HEARTBEAT_STALE_MS" in src
    assert "hbAge" in src
    # Hanya status `running` yang bisa dianggap stale — stopped/failed tidak
    # pernah diganti labelnya jadi sehat.
    assert "deployment.status === \"running\"" in src.replace("'", '"')


def test_runtime_hanya_melaporkan_tiga_state():
    """`created` tetap state awal control-plane; runtime tidak bisa mengirimnya."""
    status_src = _read(WEB / "app" / "api" / "deployments" / "[id]" / "status" / "route.ts")
    assert 'z.enum(["running", "stopped", "failed"])' in status_src
    rd_src = (ROOT / "paper_trading" / "run_deployment.py").read_text(encoding="utf-8")
    assert 'REPORTABLE_STATUSES = ("running", "stopped", "failed")' in rd_src


# ── C4. visibilitas config tanpa membocorkan rahasia ───────────────────────


def test_config_yang_ditampilkan_hanya_metadata_aman():
    """Strategy/pairs/timeframe/risk/mode/config version boleh; rahasia tidak."""
    src = _read(PAGE)
    for field in (
        "cfg.strategy?.pairs",
        "cfg.strategy?.timeframe",
        "cfg.risk?.risk_per_trade_pct",
        "cfg.risk?.max_concurrent_positions",
        "cfg.execution?.mode",
        "deployment.current_config_version",
    ):
        assert field in src, f"metadata config tidak ditampilkan: {field}"


def test_config_page_tidak_menyinggung_token_sama_sekali():
    """Halaman tidak pernah menyebut token/hash sama sekali — metadata config
    yang ditampilkan berasal dari snapshot config, bukan dari kredensial."""
    src = _read(PAGE)
    for needle in ("config_token", "token", "hash", "secret", "password"):
        assert needle not in src.lower(), f"halaman menyebut {needle}"


def test_config_snapshot_sendiri_tidak_mengandung_rahasia():
    """Snapshot config = data engine saja. Tidak ada key rahasia yang bisa
    tersimpan di jsonb dan ikut terbaca halaman."""
    from test_deployments_contract import _valid_bundle

    bundle = _valid_bundle()
    text = str(bundle).lower()
    for needle in ("token", "secret", "password", "api_key", "apikey"):
        assert needle not in text, f"config bundle membawa {needle}"


def test_list_endpoint_hanya_mengembalikan_deployment_milik_sendiri():
    """C2 di sisi daftar: tanpa session -> 401, dan baris di-filter user_id."""
    src = _read(LIST_ROUTE)
    assert 'if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })' in src
    assert '.eq("user_id", user.id)' in src
    assert ".select(COLUMNS)" in src


# ── C7. integrasi control plane ────────────────────────────────────────────


def test_dashboard_membaca_versi_config_yang_sedang_aktif_saja():
    """Tidak ada riwayat versi yang ditampilkan — hanya current_config_version,
    konsisten dengan endpoint config yang hanya menyajikan versi saat ini."""
    src = _read(PAGE)
    assert '.eq("version", deployment.current_config_version)' in src
    assert 'from("deployment_config_versions")' in src
    # Tidak ada SELECT * terhadap tabel versi (riwayat tidak ikut terbawa).
    assert 'from("deployment_config_versions").select("*")' not in src


def test_list_link_menuju_dashboard_deployment():
    src = _read(LIST_PAGE)
    assert "Link" in src
    assert "href={`/app/deployments/${d.id}`}" in src


# ── C6. kesiapan migrasi (statik — tidak ada Supabase lokal yang bisa dijalankan) ──
#
# Tidak ada Supabase lokal/CLI di environment ini, jadi migrasi TIDAK pernah
# dieksekusi. Yang bisa dibuktikan tanpa berpura-pura jadi live test: struktur
# SQL, kontrak identitas, dan kecocokannya dengan kode baca/tulis. Eksekusi
# nyata tetap ENVIRONMENT INTEGRATION: PENDING.

SYNC_MIGRATION = ROOT / "supabase" / "migrations" / "20260929120000_add_deployment_id_to_paper_tables.sql"
SYNC_ROUTE = WEB / "app" / "api" / "cron" / "paper-sync" / "route.ts"
SQLITE_SCHEMA = ROOT / "db" / "schema.sql"
PAPER_TABLES = {
    "paper_signals",
    "paper_positions",
    "paper_equity_log",
    "paper_meta",
    "paper_slippage_log",
    "paper_yield_log",
}


def _migration_sql() -> str:
    return SYNC_MIGRATION.read_text(encoding="utf-8")


def _paper_tables_in(text: str) -> set[str]:
    return set(re.findall(r"paper_[a-z_]+", text))


def _altered_tables(sql: str) -> set[str]:
    return set(
        re.findall(
            r"alter table public\.(paper_[a-z_]+)\s+add column if not exists deployment_id",
            sql,
        )
    )


def test_c6_semua_tabel_mirror_dapat_kolom_deployment_id():
    sql = _migration_sql()
    altered = _altered_tables(sql)
    assert altered == PAPER_TABLES, f"tabel tanpa kolom identitas: {PAPER_TABLES - altered}"
    # Default 0 = stream legacy: baris lama tidak berubah arti, dan identitasnya
    # sama dengan turunan path sync untuk db/paper_trading.db.
    added = re.findall(
        r"alter table public\.paper_[a-z_]+\s+add column if not exists "
        r"deployment_id bigint not null default 0",
        sql,
    )
    assert len(added) == 6
    import sync_paper_to_supabase as _sync

    assert _sync.deployment_id_for(ROOT / "db" / "paper_trading.db") == 0


def test_c6_key_unik_semua_mengandung_deployment_id():
    sql = _migration_sql()
    pairs = re.findall(
        r"alter table public\.(paper_[a-z_]+)\s+add constraint (\w+_sync_key)\s+"
        r"unique \((deployment_id, [^)]+)\)",
        sql,
    )
    assert {t for t, _, _ in pairs} == PAPER_TABLES, pairs
    assert len(pairs) == 6, f"key unik baru tidak lengkap: {pairs}"
    assert all(cols.startswith("deployment_id,") for _, _, cols in pairs)
    # Tidak ada key bisnis murni yang ditambahkan kembali.
    assert "unique (candle_date, pair)" not in sql
    assert "unique (pair, entry_date)" not in sql
    # PK berbasis id sengaja tidak disentuh (dipilih Phase B) — tetap ada.
    for pk in ("paper_signals_pkey", "paper_positions_pkey", "paper_slippage_log_pkey"):
        assert pk in sql


def test_c6_fill_key_backfill_identik_dengan_python():
    sql = _migration_sql()
    assert "pair || '|' || entry_date" in sql
    assert "fill_key text" in sql
    assert "alter column fill_key set not null" in sql
    assert "add column if not exists side text not null default 'buy'" in sql
    import sync_paper_to_supabase as _sync

    assert _sync.fill_key_for("BTC/USDT", "2026-09-01") == "BTC/USDT|2026-09-01"


def test_c6_blok_verifikasi_melempar_kegagalan_parsial():
    sql = _migration_sql()
    assert "do $$" in sql
    assert "raise exception" in sql
    # Sweep harus mencakup keenam tabel dan menolak sisa key tanpa deployment_id.
    for table in PAPER_TABLES:
        assert f"'{table}'" in sql, f"{table} tidak masuk sweep verifikasi"
    assert "con.contype in ('u', 'p')" in sql
    assert "attname = 'deployment_id'" in sql


def test_c6_forward_only_dan_tidak_menyentuh_rls_maupun_migrasi_lama():
    sql = _migration_sql().lower()
    assert "drop table" not in sql
    assert "drop column" not in sql
    assert "drop policy" not in sql
    assert "enable row level security" not in sql  # RLS phase A tetap utuh
    assert "references public.deployments" not in sql  # penanda, bukan FK (legacy = 0)
    # Migrasi Phase A tetap terpisah dan tidak pernah dimodifikasi oleh Phase B.
    migrations = ROOT / "supabase" / "migrations"
    assert (migrations / "20260928120000_add_deployments_and_config_versions.sql").exists()
    assert (migrations / "20260910120000_fix_paper_positions_upsert_and_dedupe.sql").exists()


def test_c6_enam_tabel_sama_di_migrasi_route_dan_dashboard():
    """C5/C6 bersama: tabel yang dikunci migrasi == yang ditulis route sync ==
    yang dibaca dashboard. Kalau satu berbeda, ada data yang tidak akan pernah
    muncul (atau tidak bisa di-scope) di UI."""
    sql_tables = _altered_tables(_migration_sql())
    route = SYNC_ROUTE.read_text(encoding="utf-8")
    route_tables = set(re.findall(r'\.from\("(paper_[a-z_]+)"\)', route))
    dash_tables = set(re.findall(r'from\("(paper_[a-z_]+)"\)', DB_SRC.read_text(encoding="utf-8")))
    assert sql_tables == PAPER_TABLES, sql_tables
    assert route_tables == PAPER_TABLES, route_tables
    assert dash_tables == PAPER_TABLES, dash_tables


def test_c6_skema_sqlite_tanpa_kolom_deployment_id():
    """Isolasi di SQLite lewat file-per-deployment, bukan kolom: satu file = satu
    deployment, jadi tidak mungkin baris B masuk ke file A."""
    schema = SQLITE_SCHEMA.read_text(encoding="utf-8")
    assert "deployment_id" not in schema
    # Tabel lokal yang dipakai engine memang tabel yang sama yang disinkronkan.
    local_tables = set(re.findall(r"CREATE TABLE IF NOT EXISTS (\w+)", schema)) - {"sync_state"}
    assert {"signals", "positions", "equity_log", "slippage_log", "yield_log", "meta"} <= local_tables


# ── C8. identitas sinkron yang menyuplai dashboard ─────────────────────────


def test_payload_sinkron_membawa_identitas_deployment():
    """Halaman hanya sebagus payload yang masuk — kunci sync harus ter-scope."""
    src = (ROOT / "scripts" / "sync_paper_to_supabase.py").read_text(encoding="utf-8")
    assert 'data["deployment_id"] = deployment_id' in src
    assert 'row["fill_key"] = fill_key_for(' in src
    assert sync.deployment_id_for("db/deployments/7.db") == 7
    assert sync.deployment_id_for("db/paper_trading.db") == 0
