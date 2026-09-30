"""Phase E: final MVP ship gate (E1..E4 + kontrak penerimaan E8).

E1 vertical slice memakai control-plane loopback + exchange palsu — ini BUKAN
live integration test terhadap Supabase/Vercel. Perbedaannya dinyatakan di sini
supaya tidak pernah dilaporkan sebagai verifikasi produksi (lihat laporan akhir:
CODE/TEST ACCEPTANCE vs ENVIRONMENT INTEGRATION).

Gerbang build (E5) dan kebersihan repo (E6) dijalankan manual di luar pytest;
kontrak keamanan (E4) dan dokumen (E7) dikunci otomatis di file ini.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "paper_trading"))
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import config_source as cs  # noqa: E402
import run_deployment as rd  # noqa: E402
import sync_paper_to_supabase as sync  # noqa: E402
from test_deployment_dashboard import _read  # noqa: E402
from test_runtime_hardening import (  # noqa: E402
    DEPLOYMENT_ID,
    ControlPlane,
    dump_state,
    fast_engine,
    ro,
    runtime_db,
    sandbox,
)

WEB = ROOT / "monitoring" / "web"
DB_SRC = WEB / "lib" / "db-supabase.ts"
DASH_PAGE = WEB / "app" / "app" / "deployments" / "[id]" / "page.tsx"
SELECTOR = WEB / "app" / "app" / "deployments" / "[id]" / "DeploymentSelector.tsx"


# ── E1. full vertical slice ────────────────────────────────────────────────


def test_e1_vertical_slice_penuh(monkeypatch, tmp_path):
    """control-plane config -> fetch ber-Bearer -> injeksi engine -> sinyal
    Donchian -> risiko -> fill simulasi -> SQLite -> payload sync -> query
    dashboard. Satu test, satu alur, tanpa jalan pintas."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)  # spike candle -> pastikan Donchian benar-benar entry
    try:
        rc = rd.main()
    finally:
        cp.stop()

    # (1..3) config versioned -> diambil dengan token -> divalidasi -> di-cache
    assert rc == 0
    cache = cs.cache_path(DEPLOYMENT_ID)
    on_disk = json.loads(cache.read_text(encoding="utf-8"))
    assert on_disk["deployment_id"] == DEPLOYMENT_ID
    assert on_disk["config_version"] == cp.payload["config_version"]

    # (4..6) engine jalan dan state hidup di SQLite per deployment
    db = runtime_db(tmp_path)
    assert db.name == f"{DEPLOYMENT_ID}.db" and db.parent.name == "deployments"
    state = dump_state(db)
    assert state["meta"]["deployment_id"] == str(DEPLOYMENT_ID)
    assert state["meta"]["config_version"] == str(cp.payload["config_version"])
    assert float(state["meta"]["paper_cash"]) > 0

    entries = [s for s in state["signals"] if s["signal"] == "LONG_ENTRY"]
    assert entries, "Donchian harus menghasilkan sinyal entry pada skenario spike"
    assert state["positions"], "sinyal harus menghasilkan fill simulasi (bukan eksekusi riil)"

    # (7) risk + stop loss: setiap posisi punya SL di bawah entry dan risk
    # terikat pada jarak stop (formula frozen: units = risk / (entry - stop)).
    for p in state["positions"]:
        assert p["units"] > 0
        assert 0 < p["stop_price"] < p["entry_price"], "setiap order wajib punya stop loss"
        expected = p["units"] * (p["entry_price"] - p["stop_price"])
        assert abs(p["risk_amount"] - expected) <= max(0.05, 0.02 * p["risk_amount"]), (
            "risk_amount harus = units x (entry - stop)"
        )

    # (8) payload sinkron membawa identitas deployment + fill_key
    data, _wm, _eq = sync.collect_payload(ro(db), db)
    assert data["deployment_id"] == DEPLOYMENT_ID
    assert data["positions"], "payload wajib membawa posisi"
    assert all(p["side"] == "buy" for p in data["positions"])
    assert all(p["fill_key"] for p in data["positions"])

    # (8b) sisi cloud: hanya field whitelist yang masuk, kunci perselisihan
    # memuat deployment_id — id autoincrement lokal tidak pernah jadi identitas.
    route = (WEB / "app" / "api" / "cron" / "paper-sync" / "route.ts").read_text(encoding="utf-8")
    pos_fields = next(l for l in route.splitlines() if l.startswith("const POSITION_FIELDS"))
    assert '"id"' not in pos_fields
    assert '"fill_key"' in pos_fields and '"side"' in pos_fields
    assert 'onConflict: "deployment_id,fill_key"' in route
    assert 'onConflict: "deployment_id,candle_date,pair"' in route

    # (9) dashboard hanya bisa membaca stream yang sama lewat filter deployment_id
    src = DB_SRC.read_text(encoding="utf-8")
    assert src.count('.eq("deployment_id", deploymentId)') == 6

    # (10) lifecycle ter-observasi tanpa mematikan engine
    assert cp.statuses == ["running", "stopped"]
    assert alerts, "fill harus memicu alert Telegram (paper-only, tetap satu-satunya kanal)"


# ── E2. two-deployment ship gate (tambahan di atas test_two_deployments_isolation) ──


def test_e2_dua_deployment_lifecycle_tidak_terkontaminasi(monkeypatch, tmp_path):
    """A `running` lalu B `stopped` — status, berkas, dan identitas tidak
    pernah bercampur walau keduanya memakai candle dan config yang sama."""
    cp_a = ControlPlane(deployment_id=7).start()
    cp_b = ControlPlane(deployment_id=9).start()
    try:
        sandbox(monkeypatch, tmp_path, cp_a.config_url, deployment_id=7)
        fast_engine(monkeypatch)
        assert rd.main() == 0
        state_a = dump_state(runtime_db(tmp_path, 7))

        sandbox(monkeypatch, tmp_path, cp_b.config_url, deployment_id=9)
        assert rd.main() == 0
    finally:
        cp_a.stop()
        cp_b.stop()

    # Lifecycle terpisah per control plane.
    assert cp_a.statuses == ["running", "stopped"]
    assert cp_b.statuses == ["running", "stopped"]
    # B tidak pernah menyentuh file A.
    assert dump_state(runtime_db(tmp_path, 7)) == state_a
    assert runtime_db(tmp_path, 7) != runtime_db(tmp_path, 9)
    assert cs.cache_path(7) != cs.cache_path(9)

    # Sync: bisnis key boleh identik, identitas cloud tetap berbeda.
    data_a, _, _ = sync.collect_payload(ro(runtime_db(tmp_path, 7)), runtime_db(tmp_path, 7))
    data_b, _, _ = sync.collect_payload(ro(runtime_db(tmp_path, 9)), runtime_db(tmp_path, 9))
    keys_a = {p["fill_key"] for p in data_a["positions"]}
    keys_b = {p["fill_key"] for p in data_b["positions"]}
    assert keys_a and keys_a == keys_b, "pasangan pair+tanggal memang sengaja beririsan"
    assert data_a["deployment_id"] != data_b["deployment_id"], (
        "kunci cloud (deployment_id, fill_key) tetap terpisah"
    )


def test_e2_memilih_deployment_hanya_menampilkan_deployment_itu():
    """Dashboard: selector hanya memilih id; filtering terjadi di server dan
    tidak pernah jatuh ke stream 0 ketika id deployment dipilih."""
    src = _read(DASH_PAGE)
    assert "getDashboardData(id)" in src
    assert "getDashboardData()" not in src
    assert "getDashboardData(0)" not in src
    assert 'if (!Number.isInteger(id) || id <= 0) notFound()' in src

    db_src = DB_SRC.read_text(encoding="utf-8")
    assert "getDashboardData(deploymentId = 0)" in db_src  # default legacy tetap 0
    assert db_src.count('.eq("deployment_id", deploymentId)') == 6
    assert '.eq("deployment_id", 0)' not in db_src

    selector = _read(SELECTOR)
    assert "router.push(`/app/deployments/${e.target.value}`)" in selector
    for forbidden in ("getDashboardData", "db-supabase", "paper_signals"):
        assert forbidden not in selector


# ── E3. legacy compatibility gate ──────────────────────────────────────────


def test_e3_jalur_legacy_masih_utuh():
    """`live_signal.main()` tanpa argumen tetap = jalur paper legacy:
    config.yaml + db/paper_trading.db + identitas sync 0."""
    src = (ROOT / "paper_trading" / "live_signal.py").read_text(encoding="utf-8")
    assert "def main(cfg: dict | None = None, db_path: Path | str | None = None) -> int:" in src
    assert "if cfg is None:" in src
    assert "cfg = load_config()" in src
    # Injected bundle TIDAK pernah diterjemahkan — engine membaca config yang sama.
    assert "ALL perilaku engine" in src or "cfg=snapshot.config" in (
        ROOT / "paper_trading" / "run_deployment.py"
    ).read_text(encoding="utf-8")
    # Stream global legacy tetap ada dan tetap terpisah dari deployment.
    assert sync.deployment_id_for(ROOT / "db" / "paper_trading.db") == 0
    assert "db/deployments/" in (ROOT / ".gitignore").read_text(encoding="utf-8")


def test_e3_tidak_ada_perubahan_kontrak_config_route():
    """Endpoint config Phase A adalah kontrak yang dikonsumsi runtime — tidak
    boleh melemah selama C/D/E."""
    src = (WEB / "app" / "api" / "deployments" / "[id]" / "config" / "route.ts").read_text(
        encoding="utf-8"
    )
    assert "timingSafeEqual" in src
    assert "createHash" in src
    assert "config_token_hash" in src
    assert "status: 401" in src
    # Hanya versi saat ini yang dikembalikan.
    assert "current_config_version" in src


# ── E4. security gate ──────────────────────────────────────────────────────

# Pola dengan nilai tinggi & FP rendah. Sumber yang discan = kode produksi
# (bukan tests/, bukan node_modules).
SECRET_PATTERNS = [
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----")),
    ("aws key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("github token", re.compile(r"\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40}\b")),
    ("openai-style key", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    ("slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("google api key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("jwt literal", re.compile(r"\beyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("sha256 literal", re.compile(r"""["'][0-9a-f]{64}["']""")),
]

SCAN_DIRS = [
    ROOT / "paper_trading",
    ROOT / "scripts",
    ROOT / "alerting",
    ROOT / "backtest",
    ROOT / "risk_manager",
    ROOT / "supabase",
    WEB / "app",
    WEB / "lib",
]
SCAN_FILES = [ROOT / "config.yaml", ROOT / ".env.example"]
SCAN_SUFFIXES = {".py", ".ts", ".tsx", ".sql", ".yaml", ".yml", ".mjs", ".json"}
SKIP_PARTS = {"node_modules", ".next", "__pycache__", "venv", "dist", "e2e"}


def _scan_files():
    files = [f for f in SCAN_FILES if f.exists()]
    for d in SCAN_DIRS:
        files += [
            f
            for f in d.rglob("*")
            if f.is_file()
            and f.suffix in SCAN_SUFFIXES
            and not (set(f.parts) & SKIP_PARTS)
        ]
    return files


def test_e4_tidak_ada_credential_hardcoded():
    hits = []
    for f in _scan_files():
        text = f.read_text(encoding="utf-8", errors="ignore")
        for name, pattern in SECRET_PATTERNS:
            if pattern.search(text):
                hits.append(f"{f.relative_to(ROOT)}: {name}")
    assert not hits, "credential literal terdeteksi:\n" + "\n".join(hits)


def test_e4_env_tergitignore_dan_tidak_ter_track():
    ig = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "\n.env\n" in ig or ig.startswith(".env")
    assert "!.env.example" in ig
    assert "db/deployments/" in ig
    if shutil.which("git"):
        tracked = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files", ".env", ".env.*"],
            capture_output=True, text=True, check=False,
        ).stdout.split()
        assert tracked == [".env.example"], f".env tidak boleh ter-track: {tracked}"


def test_e4_token_runtime_hanya_dari_environment():
    """Token runtime hidup di env + header request saja: tidak pernah dibuka
    dari file, tidak pernah ditulis ke mana pun, tidak pernah jadi bagian URL."""
    src = (ROOT / "paper_trading" / "run_deployment.py").read_text(encoding="utf-8")
    assert "environ" in src
    assert "write_text" not in src
    assert not re.search(r"(?<![A-Za-z_])open\(", src)  # urlopen = HTTP, bukan file
    assert "os.environ\"" not in src.replace("os.environ.get", "")
    # Bearer selalu di header; token tidak pernah jadi query string.
    assert '"Authorization"' in src
    assert "?" not in src.split("Authorization")[0].split("f\"Bearer")[-1][:80]
    assert "config_token=" not in src


def test_e4_token_satu_kali_tidak_disimpan_ui():
    src = _read(WEB / "app" / "app" / "deployments" / "page.tsx")
    # Token memang ditampilkan PERSIS SATU KALI di panel (by design), tapi tidak
    # pernah persist atau berpindah lewat URL.
    assert "localStorage" not in src
    assert "sessionStorage" not in src
    assert "?token=" not in src
    assert "history.pushState" not in src
    assert "setIssued(null)" in src  # panel ditutup = hilang permanen
    assert "issued" in src


def test_e4_snapshot_config_dan_db_tidak_membawa_rahasia(monkeypatch, tmp_path):
    """Cache config + SQLite runtime yang dirender saat run sukses bersih."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    try:
        assert rd.main() == 0
    finally:
        cp.stop()
    cache_raw = cs.cache_path(DEPLOYMENT_ID).read_text(encoding="utf-8")
    db = runtime_db(tmp_path)
    meta = dump_state(db)["meta"]
    assert "token" not in cache_raw.lower()
    assert "token" not in json.dumps(meta).lower()
    assert "token" not in "\n".join(alerts).lower()


def test_e4_hanya_mode_paper_yang_bisa_dikonfigurasi():
    """E8 (Security/Scope): tidak ada jalur eksekusi riil yang bisa diminta
    lewat config maupun schema control plane."""
    schema = (WEB / "lib" / "deployment-config.ts").read_text(encoding="utf-8")
    assert 'mode: z.literal("paper")' in schema
    validations = (WEB / "lib" / "validations.ts").read_text(encoding="utf-8")
    assert '"live"' not in validations
    guards = (ROOT / "risk_manager" / "guards.py").read_text(encoding="utf-8")
    assert 'mode' in guards and "Fase 4 belum tersedia" in guards
    for f in (ROOT / "paper_trading" / "live_signal.py",
              ROOT / "paper_trading" / "run_deployment.py"):
        text = f.read_text(encoding="utf-8")
        for needle in ("createOrder", "create_order", "cancelOrder", "cancel_order",
                       "fetch_balance", "set_leverage"):
            assert needle not in text, f"{f.name} memuat jalur order riil: {needle}"


# ── E7. kebenaran dokumentasi ──────────────────────────────────────────────


def test_e7_dokumentasi_tidak_mengklaim_kapabilitas_masa_depan():
    """Kalimat yang menyatakan kemampuan BELUM ADA (live, managed VPS,
    multi-exchange, AI) tidak boleh muncul sebagai klaim present tense."""
    arch = (ROOT / "ARCHITECTURE.md").read_text(encoding="utf-8")
    forbidden_claims = [
        r"(?i)live execution (is|telah) (available|tersedia|implemented|diimplementasi)",
        r"(?i)managed VPS (is|telah|sudah)",
        r"(?i)multi[- ]exchange support (is|telah|sudah)",
        r"(?i)(AI|LLM) (execution|trading) (is|telah|sudah)",
        r"(?i)kompatibel dengan .*strategi apa pun",
    ]
    for claim in forbidden_claims:
        assert not re.search(claim, arch), f"klaim dokumentasi terlalu kuat: {claim}"
    # Eksekusi tetap paper di dokumentasi.
    assert "execution.mode" in arch or "paper" in arch.lower()


def test_e7_mvp_hanya_menyebut_donchian_sebagai_strategi_eksekusi():
    src = (ROOT / "ARCHITECTURE.md").read_text(encoding="utf-8").lower()
    # Tidak ada klaim bahwa 8 template = 8 strategi eksekusi.
    assert "8 strategi eksekusi" not in src
    assert "delapan strategi eksekusi" not in src
