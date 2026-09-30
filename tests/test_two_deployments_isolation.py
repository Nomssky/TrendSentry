"""SHIP GATE Phase B — dua deployment terisolasi penuh (workstream 12, 13, 14, 15).

Satu property yang dibuktikan di sini:

    Dua deployment Donchian independen bisa menjalankan market yang SAMA dengan
    konfigurasi BERBEDA, memakai engine yang SAMA, tanpa berbagi state runtime.

Ini uji perilaku, bukan baca sumber: `live_signal.main(cfg=..., db_path=...)`
benar-benar dieksekusi dua kali pada dua file SQLite terpisah dengan candle yang
identik dan `risk_per_trade_pct` berbeda (0.5 vs 1.0), lalu kedua database dan
kedua payload sinkronisasi dibaca dan dibandingkan.

Exchange dipalsukan (FakeExchange) — tidak ada jaringan, tidak ada Bitget, tidak
menyentuh `db/paper_trading.db` produksi. Semua database uji ada di tmp_path dan
tidak pernah ikut ter-commit.
"""

import sqlite3
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "paper_trading"))
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import live_signal as ls  # noqa: E402
import sync_paper_to_supabase as sync  # noqa: E402
from test_deployments_contract import _valid_bundle  # noqa: E402
from test_live_signal import FakeExchange, make_candles  # noqa: E402

WEB = ROOT / "monitoring" / "web"
MIGRATIONS = ROOT / "supabase" / "migrations"
SYNC_ROUTE = WEB / "app" / "api" / "cron" / "paper-sync" / "route.ts"
SYNC_MIGRATION = MIGRATIONS / "20260929120000_add_deployment_id_to_paper_tables.sql"

CANDLES = make_candles(40, spike=True)


# ── helpers ─────────────────────────────────────────────────────────────────


def bundle(deployment_id: int, *, risk_pct: float, pairs=("BTC/USDT",)) -> dict:
    """Bundle sah (lolos validate_config) dengan SATU parameter risiko berbeda."""
    cfg = _valid_bundle(deployment_id=deployment_id, config_version=1)
    cfg["strategy"]["pairs"] = list(pairs)
    cfg["risk"]["risk_per_trade_pct"] = risk_pct
    return cfg


def rows(db_path: Path, sql: str, params=()) -> list[dict]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]
    finally:
        conn.close()


def payload_for(db_path: Path) -> dict:
    """Payload sinkronisasi untuk satu DB (tanpa menyentuh jaringan)."""
    conn = sqlite3.connect(db_path)
    try:
        data, _watermarks, _eq = sync.collect_payload(conn, db_path)
        return data
    finally:
        conn.close()


@pytest.fixture
def two(tmp_path, monkeypatch) -> SimpleNamespace:
    """Jalankan engine dua kali: deployment 1 (risk 0.5) lalu deployment 2 (risk 1.0)."""
    monkeypatch.setattr(ls, "make_exchange", lambda cfg: FakeExchange(CANDLES))
    monkeypatch.setattr(ls, "send_alert", lambda message: True)

    dep_dir = tmp_path / "deployments"
    cfg_a = bundle(1, risk_pct=0.5)
    cfg_b = bundle(2, risk_pct=1.0)
    db_a = dep_dir / "1.db"
    db_b = dep_dir / "2.db"

    # Urutan di sini membuktikan A tidak pernah membuat/menulis file milik B.
    assert not db_b.exists()
    assert ls.main(cfg=cfg_a, db_path=db_a) == 0
    assert not db_b.exists(), "deployment A membentuk file milik deployment B"
    assert ls.main(cfg=cfg_b, db_path=db_b) == 0

    return SimpleNamespace(
        cfg_a=cfg_a, cfg_b=cfg_b, db_a=db_a, db_b=db_b, dep_dir=dep_dir, tmp=tmp_path
    )


# ── 1. isolasi config ───────────────────────────────────────────────────────


def test_config_isolation(two):
    assert two.cfg_a["deployment_id"] == 1
    assert two.cfg_b["deployment_id"] == 2
    assert two.cfg_a["risk"]["risk_per_trade_pct"] == 0.5
    assert two.cfg_b["risk"]["risk_per_trade_pct"] == 1.0
    # Konfigurasi tidak saling bocor: bundle dibaca apa adanya per runtime.
    assert two.cfg_a["risk"] != two.cfg_b["risk"]
    assert two.cfg_a["strategy"] == two.cfg_b["strategy"]  # hanya risiko yang beda


def test_engine_membaca_config_injeksi_bukan_config_yaml(two):
    """config.yaml memakai risk 1.0; deployment A (0.5) harus menghasilkan
    ukuran posisi BEDA — membuktikan bundle yang dipakai, bukan file fallback."""
    import yaml

    yaml_risk = float(yaml.safe_load((ROOT / "config.yaml").read_text())["risk"]["risk_per_trade_pct"])
    assert yaml_risk == 1.0  # config.yaml tidak diubah oleh Phase B
    units_a = rows(two.db_a, "SELECT units FROM positions")
    units_b = rows(two.db_b, "SELECT units FROM positions")
    assert units_a and units_b
    assert units_b[0]["units"] == pytest.approx(units_a[0]["units"] * 2, rel=1e-3)


# ── 2. isolasi SQLite ───────────────────────────────────────────────────────


def test_sqlite_isolation(two):
    assert two.db_a != two.db_b
    assert two.db_a.parent == two.db_b.parent == two.dep_dir
    assert two.db_a.exists() and two.db_b.exists()

    meta_a = {r["key"]: r["value"] for r in rows(two.db_a, "SELECT key, value FROM meta")}
    meta_b = {r["key"]: r["value"] for r in rows(two.db_b, "SELECT key, value FROM meta")}
    # Kas berbeda karena sizing berbeda -> state runtime benar-benar terpisah.
    assert meta_a["paper_cash"] != meta_b["paper_cash"]
    assert float(meta_a["paper_cash"]) > float(meta_b["paper_cash"])  # risk 0.5 -> keluar lebih sedikit


def test_tidak_ada_pembacaan_silang_antar_file(two):
    """Nilai khas masing-masing deployment tidak muncul di database lawannya."""
    units_a = {r["units"] for r in rows(two.db_a, "SELECT units FROM positions")}
    units_b = {r["units"] for r in rows(two.db_b, "SELECT units FROM positions")}
    assert units_a and units_b
    assert not units_a & units_b

    # Market date sama persis, tapi barisnya tidak pernah berpindah file.
    dates_a = {r["candle_date"] for r in rows(two.db_a, "SELECT candle_date FROM signals")}
    dates_b = {r["candle_date"] for r in rows(two.db_b, "SELECT candle_date FROM signals")}
    assert dates_a == dates_b and len(dates_a) == 1

    cash_a = rows(two.db_a, "SELECT value FROM meta WHERE key='paper_cash'")[0]["value"]
    cash_b = rows(two.db_b, "SELECT value FROM meta WHERE key='paper_cash'")[0]["value"]
    assert cash_a != cash_b
    # Kas milik B tidak pernah tercatat sebagai kas milik A (dan sebaliknya).
    assert rows(two.db_a, "SELECT 1 FROM meta WHERE key='paper_cash' AND value=?", (cash_b,)) == []
    assert rows(two.db_b, "SELECT 1 FROM meta WHERE key='paper_cash' AND value=?", (cash_a,)) == []


# ── 3. isolasi sinyal ───────────────────────────────────────────────────────


def test_signal_isolation(two):
    sig_a = rows(two.db_a, "SELECT candle_date, pair, signal, decision FROM signals")
    sig_b = rows(two.db_b, "SELECT candle_date, pair, signal, decision FROM signals")
    # Pasangan (tanggal, pair) identik — market memang sama.
    assert sig_a == sig_b
    assert len(sig_a) == 1
    assert sig_a[0]["pair"] == "BTC/USDT"
    assert sig_a[0]["signal"] == "LONG_ENTRY"
    assert sig_a[0]["decision"] == "ENTER"
    # Tapi keduanya hanya hidup di file miliknya masing-masing (dibuktikan
    # test_sqlite_isolation + test_tidak_ada_pembacaan_silang_antar_file).


# ── 4. isolasi posisi ───────────────────────────────────────────────────────


def test_position_isolation(two):
    pos_a = rows(two.db_a, "SELECT pair, entry_date, entry_price, units, stop_price, status FROM positions")
    pos_b = rows(two.db_b, "SELECT pair, entry_date, entry_price, units, stop_price, status FROM positions")
    assert len(pos_a) == len(pos_b) == 1
    assert pos_a[0]["status"] == pos_b[0]["status"] == "open"
    # Stop sama (engine identik), ukuran posisi beda (config beda).
    assert pos_a[0]["stop_price"] == pos_b[0]["stop_price"]
    assert pos_a[0]["units"] != pos_b[0]["units"]
    assert pos_b[0]["units"] == pytest.approx(pos_a[0]["units"] * 2, rel=1e-3)


# ── 5. isolasi fill ─────────────────────────────────────────────────────────


def test_fill_isolation(two):
    pos_a = rows(two.db_a, "SELECT pair, entry_date FROM positions")
    pos_b = rows(two.db_b, "SELECT pair, entry_date FROM positions")
    # Identitas bisnis memang sama (pair + tanggal yang sama)...
    fill_a = sync.fill_key_for(pos_a[0]["pair"], pos_a[0]["entry_date"])
    fill_b = sync.fill_key_for(pos_b[0]["pair"], pos_b[0]["entry_date"])
    assert fill_a == fill_b

    # ...tapi key sync cloud = (deployment_id, fill_key) -> tidak pernah tabrakan.
    pay_a, pay_b = payload_for(two.db_a), payload_for(two.db_b)
    keys_a = {(pay_a["deployment_id"], r["fill_key"]) for r in pay_a["positions"]}
    keys_b = {(pay_b["deployment_id"], r["fill_key"]) for r in pay_b["positions"]}
    assert len(keys_a) == len(keys_b) == 1
    assert keys_a.isdisjoint(keys_b)


# ── 6. isolasi state runtime saat config A berubah ──────────────────────────


def test_mengubah_config_a_tidak_mengubah_b(two):
    before_b_signals = rows(two.db_b, "SELECT candle_date, pair, signal FROM signals")
    before_b_equity = rows(two.db_b, "SELECT * FROM equity_log ORDER BY date")
    before_b_meta = {r["key"]: r["value"] for r in rows(two.db_b, "SELECT key, value FROM meta")}

    # Config A berubah: sekarang juga memantau ETH. B tidak disentuh sama sekali.
    cfg_a2 = bundle(1, risk_pct=0.5, pairs=("BTC/USDT", "ETH/USDT"))
    assert ls.main(cfg=cfg_a2, db_path=two.db_a) == 0

    after_a_signals = rows(two.db_a, "SELECT candle_date, pair FROM signals")
    after_b_signals = rows(two.db_b, "SELECT candle_date, pair, signal FROM signals")
    after_b_equity = rows(two.db_b, "SELECT * FROM equity_log ORDER BY date")
    after_b_meta = {r["key"]: r["value"] for r in rows(two.db_b, "SELECT key, value FROM meta")}

    # A bereaksi terhadap config barunya (ETH sekarang diproses)...
    assert len(after_a_signals) == 2
    assert {r["pair"] for r in after_a_signals} == {"BTC/USDT", "ETH/USDT"}
    # ...B tidak berubah sama sekali.
    assert after_b_signals == before_b_signals
    assert after_b_equity == before_b_equity
    assert after_b_meta == before_b_meta


# ── 7. isolasi identitas sinkronisasi ───────────────────────────────────────


def test_sync_identity_isolation(two):
    pay_a, pay_b = payload_for(two.db_a), payload_for(two.db_b)
    dep_a, dep_b = pay_a["deployment_id"], pay_b["deployment_id"]
    assert (dep_a, dep_b) == (1, 2)

    def sig_keys(pay):
        return {(pay["deployment_id"], r["candle_date"], r["pair"]) for r in pay["signals"]}

    def eq_keys(pay):
        return {(pay["deployment_id"], r["date"]) for r in pay["equity_log"]}

    def meta_keys(pay):
        return {(pay["deployment_id"], k) for k in pay["meta"]}

    def pos_keys(pay):
        return {(pay["deployment_id"], r["fill_key"]) for r in pay["positions"]}

    # Kunci BISNIS sama persis antara A dan B (market yang sama)...
    assert {k[1:] for k in sig_keys(pay_a)} == {k[1:] for k in sig_keys(pay_b)}
    assert {k[1:] for k in eq_keys(pay_a)} == {k[1:] for k in eq_keys(pay_b)}
    assert {k[1:] for k in meta_keys(pay_a)} == {k[1:] for k in meta_keys(pay_b)}
    # ...tapi kunci SYNC (dengan deployment_id) seluruhnya berbeda.
    assert sig_keys(pay_a).isdisjoint(sig_keys(pay_b))
    assert eq_keys(pay_a).isdisjoint(eq_keys(pay_b))
    assert meta_keys(pay_a).isdisjoint(meta_keys(pay_b))
    assert pos_keys(pay_a).isdisjoint(pos_keys(pay_b))


def test_payload_sync_membawa_side_dan_fill_key(two):
    pay = payload_for(two.db_a)
    assert pay["positions"]
    for row in pay["positions"]:
        assert row["side"] == "buy"  # arah dibekukan long_only oleh validate_config
        assert row["fill_key"] == sync.fill_key_for(row["pair"], row["entry_date"])
    # `id` SQLite tetap ada untuk WATERMARK lokal, tapi TIDAK dipakai sebagai
    # identitas global di cloud (onConflict memakai deployment_id + fill_key).
    assert all(row["id"] > 0 for row in pay["positions"])


def test_stream_legacy_tetap_nol():
    """db/paper_trading.db tetap deployment_id 0 — perilaku sync lama tak berubah."""
    assert sync.deployment_id_for(ROOT / "db" / "paper_trading.db") == 0
    assert sync.deployment_id_for("db/deployments/5.db") == 5


# ── kontrak cloud: key unique memuat deployment_id ─────────────────────────


def test_cloud_sync_key_memuat_deployment_id():
    route = SYNC_ROUTE.read_text(encoding="utf-8")
    for key in (
        "deployment_id,candle_date,pair",
        "deployment_id,fill_key",
        "deployment_id,date",
        "deployment_id,timestamp,pair",
        "deployment_id,key",
    ):
        assert key in route, f"onConflict tidak memuat deployment_id: {key}"
    # Lama sudah dibuang — tidak boleh ada key tanpa deployment_id.
    for legacy in ('onConflict: "candle_date,pair"', 'onConflict: "date"', 'onConflict: "key"',
                   'onConflict: "id"', 'onConflict: "timestamp,pair"'):
        assert legacy not in route, f"key sync global masih dipakai: {legacy}"
    # deployment_id ditanamkan per baris dari satu nilai payload.
    assert "deployment_id: deploymentId" in route
    # `id` SQLite tidak lagi jadi kolom yang dikirim untuk positions.
    position_fields = next(
        line for line in route.splitlines() if line.startswith("const POSITION_FIELDS")
    )
    assert '"id"' not in position_fields
    assert '"fill_key"' in position_fields and '"side"' in position_fields
    # Tabel mirror tetap dibaca per-stream oleh dashboard (default 0 = lama persis).
    db_src = (WEB / "lib" / "db-supabase.ts").read_text(encoding="utf-8")
    assert "getDashboardData(deploymentId = 0)" in db_src
    assert db_src.count('.eq("deployment_id", deploymentId)') == 6


def test_migration_sync_identity_ada_dan_terverifikasi():
    sql = SYNC_MIGRATION.read_text(encoding="utf-8")
    for constraint in (
        "unique (deployment_id, candle_date, pair)",
        "unique (deployment_id, fill_key)",
        "unique (deployment_id, date)",
        "unique (deployment_id, timestamp, pair)",
        "unique (deployment_id, key)",
    ):
        assert constraint in sql, constraint
    # Backfill fill_key harus identik dengan fill_key_for() di Python.
    assert "pair || '|' || entry_date" in sql
    assert sync.fill_key_for("BTC/USDT", "2026-09-01") == "BTC/USDT|2026-09-01"
    # Gagal parsial harus melempar, bukan lolos diam-diam.
    assert "raise exception" in sql
    # Forward-only: migration Phase B tidak menghapus/mengubah tabel yang sudah ada.
    assert "drop table" not in sql.lower()
    assert "alter table public.deployments" not in sql
    # Migration Phase A tidak disentuh oleh Phase B (dikunci test contract Phase A).
    assert (MIGRATIONS / "20260928120000_add_deployments_and_config_versions.sql").exists()


# ── regresi jalur legacy ────────────────────────────────────────────────────


def test_jalur_legacy_tanpa_injeksi_masih_bekerja(tmp_path, monkeypatch):
    """`python paper_trading/live_signal.py` (config.yaml + DB global) tetap jalan."""
    monkeypatch.setattr(ls, "DB_PATH", tmp_path / "paper_trading.db")
    monkeypatch.setattr(ls, "make_exchange", lambda cfg: FakeExchange(CANDLES))
    monkeypatch.setattr(ls, "send_alert", lambda message: True)
    assert ls.main() == 0
    assert (tmp_path / "paper_trading.db").exists()
    assert rows(tmp_path / "paper_trading.db", "SELECT COUNT(*) AS n FROM signals")[0]["n"] > 0


def test_connect_membuat_direktori_induk(tmp_path):
    """db/deployments/<id>.db dibuat meski foldernya belum ada."""
    target = tmp_path / "deep" / "nested" / "42.db"
    conn = ls.connect(target)
    conn.close()
    assert target.exists()


def test_sync_main_maju_setelah_server_menerima(tmp_path, monkeypatch):
    """Regresi jalur sync legacy: `main()` harus selesai dan memajukan watermark.

    Dulu `main()` merujuk `positions` yang sudah tidak ada di scope-nya (pemisahan
    collect_payload) -> NameError SETELAH server menerima payload, jadi watermark
    tidak pernah maju dan tiap run mengirim ulang semuanya.
    """
    db_path = tmp_path / "paper_trading.db"
    conn = ls.connect(db_path)
    conn.execute(
        "INSERT INTO positions (pair, entry_date, entry_price, units, stop_price, risk_amount) "
        "VALUES ('BTC/USDT', '2026-09-01', 100.0, 1.0, 90.0, 10.0)"
    )
    conn.commit()
    conn.close()

    class _Accepted:
        status = 200

        def getcode(self):
            return 200

        def read(self):
            return b'{"synced":[]}'

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr(sync, "CRON_SECRET", "uji-bukan-secret-asli")
    monkeypatch.setattr(sync, "DB_PATH", str(db_path))
    monkeypatch.setattr(sync.urllib.request, "urlopen", lambda *a, **k: _Accepted())

    sync.main()  # dulu: NameError: name 'positions' is not defined

    conn = sqlite3.connect(db_path)
    wm = dict(conn.execute("SELECT key, value FROM sync_state").fetchall())
    max_id = conn.execute("SELECT MAX(id) FROM positions").fetchone()[0]
    conn.close()
    assert wm["last_id_positions"] == str(max_id)
