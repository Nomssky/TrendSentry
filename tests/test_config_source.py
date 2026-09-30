"""Phase B: config source + kontrak endpoint config (workstream 3, 4, 16, 17).

Dua lapis pembuktian:

  1. PERILAKU NYATA — ConfigSource dijalankan melawan HTTP server lokal yang
     meniru kontrak route Next.js (Bearer wajib, id/token salah -> 401, hanya
     config version saat ini yang dikembalikan). Ini uji benar-benar lewat
     jaringan (loopback), bukan baca teks sumber.
  2. KONTRAK SUMBER route TS — repo tidak punya runner unit-test untuk TS
     (monitoring/web/AGENTS.md §8: Playwright hanya untuk e2e berenvironment
     hidup), jadi sisi TypeScript dikunci sebagai kontrak baca, persis pola
     tests/test_deployments_contract.py.

Tidak ada token asli yang dicetak ke log mana pun di file ini.
"""

import hashlib
import json
import re
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "paper_trading"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config_source import ConfigSource, ConfigUnavailable, ConfigError  # noqa: E402
from test_deployments_contract import _valid_bundle  # noqa: E402

WEB = ROOT / "monitoring" / "web"
CONFIG_ROUTE = WEB / "app" / "api" / "deployments" / "[id]" / "config" / "route.ts"
STATUS_ROUTE = WEB / "app" / "api" / "deployments" / "[id]" / "status" / "route.ts"
LIST_ROUTE = WEB / "app" / "api" / "deployments" / "route.ts"
PAGES_ROUTE = WEB / "app" / "app" / "deployments" / "page.tsx"

DEPLOYMENT_ID = 1
TOKEN_OK = "runtime-token-deployment-1"
TOKEN_OTHER_DEPLOYMENT = "runtime-token-deployment-2"


# ── server lokal yang meniru kontrak route config ───────────────────────────


class _ConfigHandler(BaseHTTPRequestHandler):
    """Tiruan kontrak GET /api/deployments/[id]/config.

    Identik dengan route asli: path salah -> 404; token kosong / tidak cocok
    dengan hash milik id itu -> 401 (id tidak ditebak dari beda kode respons);
    sukses -> hanya {deployment_id, config_version, config} versi saat ini.
    """

    def log_message(self, *args):  # senyap: jangan tulis request ke stderr pytest
        return

    def _send(self, status: int, raw: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):  # noqa: N802 - nama method dari BaseHTTPRequestHandler
        srv = self.server
        if self.path != f"/api/deployments/{srv.deployment_id}/config":
            return self._send(404, json.dumps({"error": "not found"}).encode())

        header = self.headers.get("Authorization", "")
        presented = header[7:] if header.startswith("Bearer ") else ""
        # Token dicocokkan terhadap id yang diminta: token milik deployment lain
        # = 401, sama seperti sha256(presented) != config_token_hash di route.
        if not presented or presented != srv.tokens.get(srv.deployment_id):
            return self._send(401, json.dumps({"error": "unauthorized"}).encode())

        srv.last_request_path = self.path
        srv.last_authorization = header
        body = srv.raw_body
        if body is None:
            body = json.dumps(
                srv.payload
                or {
                    "deployment_id": srv.deployment_id,
                    "config_version": srv.current_version,
                    "config": srv.config,
                }
            ).encode()
        return self._send(200, body)


@pytest.fixture
def server():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _ConfigHandler)
    srv.deployment_id = DEPLOYMENT_ID
    srv.tokens = {DEPLOYMENT_ID: TOKEN_OK, 2: TOKEN_OTHER_DEPLOYMENT}
    srv.current_version = 2
    srv.config = _valid_bundle(deployment_id=DEPLOYMENT_ID, config_version=2)
    srv.payload = None
    srv.raw_body = None
    srv.last_request_path = None
    srv.last_authorization = None
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        yield srv
    finally:
        srv.shutdown()
        srv.server_close()


def _url(srv, deployment_id: int = DEPLOYMENT_ID) -> str:
    return f"http://127.0.0.1:{srv.server_address[1]}/api/deployments/{deployment_id}/config"


def _source(srv, tmp_path, *, token: str = TOKEN_OK, deployment_id: int = DEPLOYMENT_ID) -> ConfigSource:
    return ConfigSource(
        deployment_id,
        _url(srv, deployment_id),
        token,
        cache_file=tmp_path / f"config-{deployment_id}.json",
        timeout=5.0,
    )


def _dead_url(deployment_id: int = DEPLOYMENT_ID) -> str:
    """URL ke port yang baru saja dilepas -> koneksi ditolak, tanpa menunggu timeout."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return f"http://127.0.0.1:{port}/api/deployments/{deployment_id}/config"


# ── 1. perilaku: endpoint sungguhan lewat loopback ──────────────────────────


def test_valid_token_returns_current_config_version(server, tmp_path):
    snap = _source(server, tmp_path).load()
    assert snap.origin == "remote"
    assert snap.config_version == server.current_version == 2
    assert snap.config["risk"]["risk_per_trade_pct"] == _valid_bundle()["risk"]["risk_per_trade_pct"]


def test_token_dikirim_di_header_bukan_url(server, tmp_path):
    _source(server, tmp_path).load()
    assert server.last_authorization == f"Bearer {TOKEN_OK}"
    assert TOKEN_OK not in server.last_request_path
    assert "?" not in server.last_request_path


def test_invalid_token_rejected_and_fails_closed(server, tmp_path):
    with pytest.raises(ConfigUnavailable):
        _source(server, tmp_path, token="token-salah").load()
    # Gagal pertama kali = tidak ada config sama sekali -> cache tidak dibuat.
    assert not (tmp_path / f"config-{DEPLOYMENT_ID}.json").exists()


def test_missing_blank_token_rejected(server, tmp_path):
    """Tanpa Bearer sama sekali = 401; di Python ini tampil sebagai token kosong."""
    src = ConfigSource(
        DEPLOYMENT_ID, _url(server), "   ", cache_file=tmp_path / "c.json", timeout=5.0
    )
    with pytest.raises(ConfigUnavailable):
        src.load()


def test_wrong_deployment_token_rejected(server, tmp_path):
    """Token milik deployment 2 tidak membuka config deployment 1."""
    with pytest.raises(ConfigUnavailable):
        ConfigSource(
            DEPLOYMENT_ID, _url(server), TOKEN_OTHER_DEPLOYMENT,
            cache_file=tmp_path / "c.json", timeout=5.0,
        ).load()


def test_old_version_never_returned(server, tmp_path):
    """Versi lama tidak pernah disajikan endpoint: selalu resolve ke saat ini."""
    cache = tmp_path / "config.json"
    cache.write_text(
        json.dumps(
            {
                "deployment_id": DEPLOYMENT_ID,
                "config_version": 1,
                "config": _valid_bundle(deployment_id=DEPLOYMENT_ID, config_version=1),
                "fetched_at": "2026-01-01T00:00:00+00:00",
            }
        )
    )
    src = ConfigSource(
        DEPLOYMENT_ID, _url(server), TOKEN_OK, cache_file=cache, timeout=5.0
    )
    snap = src.load()
    assert snap.config_version == 2
    on_disk = json.loads(cache.read_text())
    assert on_disk["config_version"] == 2
    assert on_disk["config"]["config_version"] != 1


def test_first_startup_fails_closed_when_remote_unreachable(tmp_path):
    src = ConfigSource(
        DEPLOYMENT_ID, _dead_url(), TOKEN_OK, cache_file=tmp_path / "c.json", timeout=2.0
    )
    with pytest.raises(ConfigUnavailable):
        src.load()
    assert not (tmp_path / "c.json").exists()


def test_last_known_good_cache_used_during_outage(tmp_path):
    """Cache valid + remote mati -> lanjut paper execution dengan config lama."""
    cache = tmp_path / "config.json"
    cache.write_text(
        json.dumps(
            {
                "deployment_id": DEPLOYMENT_ID,
                "config_version": 7,
                "config": _valid_bundle(deployment_id=DEPLOYMENT_ID, config_version=7),
                "fetched_at": "2026-01-01T00:00:00+00:00",
            }
        )
    )
    src = ConfigSource(
        DEPLOYMENT_ID, _dead_url(), TOKEN_OK, cache_file=cache, timeout=2.0
    )
    snap = src.load()
    assert snap.origin == "cache"
    assert snap.config_version == 7
    assert snap.config["execution"]["mode"] == "paper"


def test_cache_replaced_atomically_when_version_changes(server, tmp_path):
    src = _source(server, tmp_path)
    src.load()
    assert json.loads((tmp_path / f"config-{DEPLOYMENT_ID}.json").read_text())["config_version"] == 2

    server.current_version = 3
    server.config = _valid_bundle(deployment_id=DEPLOYMENT_ID, config_version=3, risk={**_valid_bundle()["risk"], "risk_per_trade_pct": 0.4})
    snap = src.load()
    assert snap.config_version == 3

    cache = tmp_path / f"config-{DEPLOYMENT_ID}.json"
    on_disk = json.loads(cache.read_text())
    assert on_disk["config_version"] == 3
    assert on_disk["config"]["risk"]["risk_per_trade_pct"] == 0.4
    # Tidak boleh ada file .tmp tersisa — tulisannya atomik (tmp lalu replace).
    assert list(tmp_path.glob("*.tmp")) == []


def test_cache_never_contains_token(server, tmp_path):
    src = _source(server, tmp_path)
    snap = src.load()
    text = (tmp_path / f"config-{DEPLOYMENT_ID}.json").read_text()
    assert TOKEN_OK not in text
    assert json.loads(text) == {
        "deployment_id": snap.deployment_id,
        "config_version": snap.config_version,
        "config": snap.config,
        "fetched_at": snap.fetched_at,
    }


def test_cache_milik_deployment_lain_diabaikan(server, tmp_path):
    """Cache deployment 2 tidak bisa dipakai deployment 1 (fail closed)."""
    other = tmp_path / "config.json"
    other.write_text(
        json.dumps(
            {
                "deployment_id": 2,
                "config_version": 5,
                "config": _valid_bundle(deployment_id=2, config_version=5),
                "fetched_at": "2026-01-01T00:00:00+00:00",
            }
        )
    )
    src = ConfigSource(DEPLOYMENT_ID, _dead_url(), TOKEN_OK, cache_file=other, timeout=2.0)
    with pytest.raises(ConfigUnavailable):
        src.load()


def _write_cache(tmp_path: Path, deployment_id: int, config: dict, version: int) -> Path:
    """Tulis cache last-known-good valid dengan bentuk yang sama seperti tulisan
    ConfigSource._write_cache (deployment_id, config_version, config, fetched_at)."""
    path = tmp_path / f"config-{deployment_id}.json"
    path.write_text(
        json.dumps(
            {
                "deployment_id": deployment_id,
                "config_version": version,
                "config": config,
                "fetched_at": "2026-01-01T00:00:00+00:00",
            }
        )
    )
    return path


# ── 1b. D1: matriks startup A..G — TIDAK ADA yang jatuh ke config.yaml ─────
#
#   A remote valid, tanpa cache        -> test_valid_token_returns_current_config_version
#   B remote mati, cache valid         -> test_last_known_good_cache_used_during_outage
#   C remote mati, tanpa cache         -> test_first_startup_fails_closed_when_remote_unreachable
#   D remote rusak, cache valid        -> test_startup_D_remote_malformed_cache_valid
#   E remote = config deployment lain  -> test_startup_E_... + ..._fail_closed tanpa cache
#   F cache = deployment lain          -> test_cache_milik_deployment_lain_diabaikan
#   G cache ditolak engine             -> test_startup_G_cache_ditolak_engine


def test_startup_D_remote_malformed_cache_valid(server, tmp_path):
    """D: remote membalas bukan-JSON + cache valid -> lanjut dari cache,
    dan cache yang gagal tidak ditimpa oleh payload sampah."""
    cache = _write_cache(
        tmp_path,
        DEPLOYMENT_ID,
        _valid_bundle(deployment_id=DEPLOYMENT_ID, config_version=7),
        7,
    )
    server.raw_body = b"<html>halaman filter ISP</html>"
    snap = ConfigSource(DEPLOYMENT_ID, _url(server), TOKEN_OK, cache_file=cache, timeout=5.0).load()
    assert snap.origin == "cache"
    assert snap.config_version == 7
    assert json.loads(cache.read_text())["config_version"] == 7


def test_startup_E_remote_config_deployment_lain_cache_valid(server, tmp_path):
    """E: remote membawa config milik deployment 999 -> DITOLAK, cache milik
    sendiri yang dipakai. Tanpa cache, kasus yang sama fail closed (lihat
    test_wrong_deployment_id_in_payload_fails_closed)."""
    cache = _write_cache(
        tmp_path,
        DEPLOYMENT_ID,
        _valid_bundle(deployment_id=DEPLOYMENT_ID, config_version=7),
        7,
    )
    server.payload = {
        "deployment_id": 999,
        "config_version": 2,
        "config": _valid_bundle(deployment_id=999, config_version=2),
    }
    snap = ConfigSource(DEPLOYMENT_ID, _url(server), TOKEN_OK, cache_file=cache, timeout=5.0).load()
    assert snap.origin == "cache"
    assert snap.deployment_id == DEPLOYMENT_ID
    assert snap.config_version == 7
    assert snap.config["deployment_id"] == DEPLOYMENT_ID
    assert json.loads(cache.read_text())["config_version"] == 7


def test_startup_G_cache_ditolak_engine(tmp_path):
    """G: cache berisi config yang ditolak engine (mode=live) -> DIBUANG, bukan
    dipakai; tanpa remote valid -> fail closed."""
    cache = _write_cache(
        tmp_path,
        DEPLOYMENT_ID,
        _valid_bundle(
            deployment_id=DEPLOYMENT_ID,
            config_version=7,
            execution={"mode": "live", "exchange": "bitget"},
        ),
        7,
    )
    src = ConfigSource(DEPLOYMENT_ID, _dead_url(), TOKEN_OK, cache_file=cache, timeout=2.0)
    with pytest.raises(ConfigUnavailable):
        src.load()
    # File ditolak tetap ada di disk (bukan cache yang menulis), tapi tidak pernah dipakai.
    assert cache.exists()


def test_malformed_response_fails_closed(server, tmp_path):
    server.raw_body = b"<html>halaman filter ISP</html>"
    with pytest.raises(ConfigUnavailable):
        _source(server, tmp_path).load()
    assert not (tmp_path / f"config-{DEPLOYMENT_ID}.json").exists()


def test_wrong_deployment_id_in_payload_fails_closed(server, tmp_path):
    server.payload = {"deployment_id": 999, "config_version": 2, "config": _valid_bundle()}
    with pytest.raises(ConfigUnavailable):
        _source(server, tmp_path).load()


def test_config_rejected_by_engine_fails_closed(server, tmp_path):
    """mode=live tidak pernah sampai ke engine walau lolos HTTP 200."""
    server.config = _valid_bundle(execution={"mode": "live", "exchange": "bitget"})
    with pytest.raises(ConfigUnavailable) as exc:
        _source(server, tmp_path).load()
    assert "validate_config" in str(exc.value)
    assert not (tmp_path / f"config-{DEPLOYMENT_ID}.json").exists()


def test_validate_payload_rejects_each_engine_guard():
    """Enam hard-reject engine tidak bisa lolos dari payload manapun."""
    cases = [
        (_valid_bundle(execution={"mode": "live", "exchange": "bitget"}), "execution.mode"),
        (_valid_bundle(execution={"mode": "paper", "exchange": "binance"}), "execution.exchange"),
        (_valid_bundle(strategy={**_valid_bundle()["strategy"], "direction": "long_short"}), "strategy.direction"),
        (_valid_bundle(risk={**_valid_bundle()["risk"], "risk_per_trade_pct": 1.5}), "risk.risk_per_trade_pct"),
        (_valid_bundle(risk={**_valid_bundle()["risk"], "max_concurrent_positions": 6}), "risk.max_concurrent_positions"),
        (_valid_bundle(strategy={**_valid_bundle()["strategy"], "atr_stop_multiplier": 0}), "strategy.atr_stop_multiplier"),
    ]
    from config_source import validate_payload

    for bundle, needle in cases:
        with pytest.raises(ConfigError) as exc:
            validate_payload({"deployment_id": 1, "config_version": 1, "config": bundle}, 1)
        assert needle in str(exc.value), needle

    # Dan sebaliknya: bundle sah diterima.
    version, config = validate_payload(
        {"deployment_id": 1, "config_version": 4, "config": _valid_bundle()}, 1
    )
    assert version == 4
    assert config["llm_filter"]["enabled"] is False


# ── 2. kontrak sumber route TypeScript ──────────────────────────────────────


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_config_route_requires_bearer_and_answer_401():
    src = _read(CONFIG_ROUTE)
    assert 'header.startsWith("Bearer ")' in src
    assert 'if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 })' in src
    # Id tidak dikenal juga 401 (bukan 404) -> id tidak bisa ditebak.
    assert 'if (!deployment) return NextResponse.json({ error: "unauthorized" }, { status: 401 })' in src
    assert "timingSafeEqual(presented, deployment.config_token_hash)" in src


def test_config_route_returns_current_version_only():
    src = _read(CONFIG_ROUTE)
    assert '.eq("version", deployment.current_config_version)' in src
    # Tidak ada penyajian riwayat versi di endpoint ini.
    assert 'from("deployment_config_versions")' in src
    assert ".order(" not in src
    tail = src[src.rindex("return NextResponse.json") :]
    assert "config_token_hash" not in tail, "hash secret tidak boleh ikut di response"
    assert "configToken" not in tail


def test_hash_disimpan_server_plaintext_dikirim_sekali():
    src = _read(LIST_ROUTE)
    assert 'crypto.createHash("sha256").update(configToken).digest("hex")' in src
    # Plaintext keluar persis satu kali, di response POST.
    assert re.search(
        r"return NextResponse\.json\(\{\s*\.\.\.deployment,\s*config_token: configToken\s*\}\)", src
    ), "config_token hanya boleh keluar sekali sebagai field response POST"


def test_listing_tidak_membocorkan_config_token_hash():
    src = _read(LIST_ROUTE)
    match = re.search(r"const COLUMNS\s*=\s*\n?\s*\"([^\"]+)\"", src)
    assert match, "COLUMNS deklarasi tidak ditemukan"
    assert "config_token_hash" not in match.group(1)
    # GET membaca kolom lewat COLUMNS (allowlist), bukan select("*") yang tak terbatas.
    assert ".select(COLUMNS)" in src
    assert '.select("*")' not in src


def test_plaintext_token_beda_dengan_hash_tersimpan():
    """Token plaintext ≠ hash tersimpan (uji properti, bukan sekadar deklarasi)."""
    src = _read(LIST_ROUTE)
    token = "contoh-token-plaintext"
    stored = hashlib.sha256(token.encode()).hexdigest()
    assert stored != token
    assert len(stored) == 64
    # Route benar-benar membandingkan SHA-256, bukan token mentah.
    assert 'crypto.createHash("sha256").update(token).digest("hex")' in _read(CONFIG_ROUTE)


def test_token_tidak_disimpan_di_localstorage_url_atau_log():
    src = _read(PAGES_ROUTE)
    # Pemakaian API penyimpanan browser — bukan sekadar penyebutan kata di komentar.
    assert "localStorage." not in src
    assert "sessionStorage." not in src
    assert "console." not in src
    # Token tidak pernah masuk query string / hash URL.
    assert "location.search" not in src
    assert "#config_token" not in src
    # Panel sekali-tampil benar-benar membuang state saat ditutup.
    assert "setIssued(null)" in src


def test_status_route_hanya_menerima_3_state_runtime():
    src = _read(STATUS_ROUTE)
    assert 'z.enum(["running", "stopped", "failed"])' in src
    assert '"created"' not in src, "runtime tidak boleh mengembalikan state ke created"
    assert "timingSafeEqual(presented, deployment.config_token_hash)" in src
    # Token dikirim di header, bukan di URL.
    assert "searchParams" not in src
