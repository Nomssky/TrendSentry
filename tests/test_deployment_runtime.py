"""Phase B: runtime entry point per-deployment (workstream 5, 9, 10, 18, 20).

Mengunci perilaku `paper_trading/run_deployment.py` yang bisa dieksekusi dari
pytest (env parsing, path SQLite, heartbeat) plus kontrak sumber untuk hal yang
tidak bisa dijalankan tanpa Supabase hidup.

Yang PALING dipertaruhkan di sini: runtime tetap PAPER ONLY — tidak ada jalur
order, tidak ada Supabase di dalam engine, dan secret tidak pernah bocor ke
log/URL/error message.
"""

import json
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "paper_trading"))
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import run_deployment as rd  # noqa: E402
import sync_paper_to_supabase as sync  # noqa: E402
from config_source import ConfigSource, ConfigUnavailable  # noqa: E402
from risk_manager.guards import validate_config  # noqa: E402
from test_deployments_contract import _valid_bundle  # noqa: E402

TOKEN = "token-rahasia-yang-tidak-boleh-bocor"


# ── env parsing ─────────────────────────────────────────────────────────────


def _env(**overrides):
    env = {
        "TREND_SENTRY_DEPLOYMENT_ID": "7",
        "TREND_SENTRY_CONFIG_URL": "https://trendsentry.example/api/deployments/7/config",
        "TREND_SENTRY_CONFIG_TOKEN": TOKEN,
    }
    env.update(overrides)
    return env


def test_read_env_ok():
    parsed = rd.read_env(_env())
    assert parsed == {
        "deployment_id": 7,
        "config_url": "https://trendsentry.example/api/deployments/7/config",
        "config_token": TOKEN,
    }


def test_read_env_memprioritaskan_nama_variabel_bukan_nilai():
    """Env yang belum lengkap -> pesan menyebut NAMA variabel, tanpa nilai."""
    with pytest.raises(RuntimeError) as exc:
        rd.read_env(_env(TREND_SENTRY_CONFIG_TOKEN=""))
    assert "TREND_SENTRY_CONFIG_TOKEN" in str(exc.value)
    assert TOKEN not in str(exc.value)


def test_read_env_tidak_mengekspos_nilai_lain():
    with pytest.raises(RuntimeError) as exc:
        rd.read_env(_env(TREND_SENTRY_DEPLOYMENT_ID=""))
    assert "TREND_SENTRY_DEPLOYMENT_ID" in str(exc.value)
    assert TOKEN not in str(exc.value)
    assert "https://trendsentry.example" not in str(exc.value)


@pytest.mark.parametrize("bad", ["0", "-1", "abc", "1.5", ""])
def test_read_env_menolak_deployment_id_tidak_valid(bad):
    with pytest.raises(RuntimeError):
        rd.read_env(_env(TREND_SENTRY_DEPLOYMENT_ID=bad))


@pytest.mark.parametrize("bad", ["ftp://x/config", "trendsentry.example/api/config", ""])
def test_read_env_menolak_url_bukan_http(bad):
    with pytest.raises(RuntimeError):
        rd.read_env(_env(TREND_SENTRY_CONFIG_URL=bad))


# ── path SQLite per deployment ──────────────────────────────────────────────


def test_db_path_terisolasi_per_deployment():
    a, b = rd.db_path_for(1), rd.db_path_for(2)
    assert a != b
    assert a.parent.name == b.parent.name == "deployments"
    assert a.name == "1.db" and b.name == "2.db"
    assert rd.db_path_for(1) == rd.db_path_for(1)  # deterministik
    # Runtime A tidak mungkin menulis file milik B: path-nya berbeda per id.
    assert str(a) != str(b)


def test_db_path_mengikuti_struktur_repo():
    assert rd.db_path_for(3) == ROOT / "db" / "deployments" / "3.db"


def test_deployment_id_diturunkan_dari_path_sync():
    """Sync menurunkan identitas dari PATH, jadi payload tidak bisa salah-tagging."""
    assert sync.deployment_id_for(ROOT / "db" / "deployments" / "12.db") == 12
    assert sync.deployment_id_for("db/deployments/3.db") == 3
    assert sync.deployment_id_for("/srv/app/db/deployments/9.db") == 9
    assert sync.deployment_id_for(ROOT / "db" / "paper_trading.db") == 0
    assert sync.deployment_id_for("paper.db") == 0
    assert sync.deployment_id_for("/tmp/anything/99.db") == 0
    # Nama direktori 'deployments' saja tidak cukup tanpa id numerik.
    assert sync.deployment_id_for("deployments/latest.db") == 0


# ── heartbeat / lifecycle ───────────────────────────────────────────────────


def test_status_url_diturunkan_dari_config_url():
    assert (
        rd.status_url_for("https://x/api/deployments/7/config")
        == "https://x/api/deployments/7/status"
    )
    # Bentuk tak dikenal -> dilewatkan, bukan menebak URL.
    assert rd.status_url_for("https://x/weird") is None


class _CaptureHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        return

    def do_POST(self):  # noqa: N802
        srv = self.server
        length = int(self.headers.get("Content-Length", 0))
        srv.last = {
            "path": self.path,
            "auth": self.headers.get("Authorization"),
            "body": self.rfile.read(length).decode(),
        }
        raw = b'{"ok":true}'
        self.send_response(srv.reply_status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


@pytest.fixture
def status_server():
    srv = ThreadingHTTPServer(("127.0.0.1", 0), _CaptureHandler)
    srv.reply_status = 200
    srv.last = None
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        yield srv
    finally:
        srv.shutdown()
        srv.server_close()


def _status_url(srv) -> str:
    return f"http://127.0.0.1:{srv.server_address[1]}/api/deployments/7/status"


def test_report_status_mengirim_token_di_header_bukan_url(status_server):
    ok = rd.report_status(_status_url(status_server), TOKEN, "running", timeout=5.0)
    assert ok is True
    captured = status_server.last
    assert captured["path"] == "/api/deployments/7/status"
    assert TOKEN not in captured["path"]
    assert captured["auth"] == f"Bearer {TOKEN}"
    assert json.loads(captured["body"]) == {"status": "running"}


def test_report_status_kosong_hanya_heartbeat(status_server):
    assert rd.report_status(_status_url(status_server), TOKEN, timeout=5.0) is True
    assert json.loads(status_server.last["body"]) == {}


@pytest.mark.parametrize("status", ["running", "stopped", "failed"])
def test_report_status_menerima_tiga_state(status_server, status):
    assert rd.report_status(_status_url(status_server), TOKEN, status, timeout=5.0) is True
    assert json.loads(status_server.last["body"]) == {"status": status}


def test_report_status_menolak_state_tambahan(status_server):
    """`created` (dan state lain) tidak pernah dilaporkan runtime."""
    with pytest.raises(ValueError):
        rd.report_status(_status_url(status_server), TOKEN, "created", timeout=5.0)
    with pytest.raises(ValueError):
        rd.report_status(_status_url(status_server), TOKEN, "paused", timeout=5.0)
    assert status_server.last is None  # tidak ada request yang terkirim


def test_report_status_gagal_tidak_menjatuhkan_runtime(status_server):
    """Control plane down = warning + alert, bukan exception: SQLite tetap truth."""
    alerts = []
    status_server.reply_status = 500
    ok = rd.report_status(
        _status_url(status_server), TOKEN, "stopped", timeout=5.0, alert=alerts.append
    )
    assert ok is False
    assert alerts and "stopped" in alerts[0]
    # Token tidak ikut ke pesan alert.
    assert TOKEN not in alerts[0]


def test_report_status_tanpa_url_return_false():
    assert rd.report_status(None, TOKEN, "running") is False


def test_report_status_respons_non_http_tetap_tidak_menjatuhkan_runtime():
    """Control plane/proxy yang membalas bukan-HTTP (halaman error, portal tamu)
    = warning + alert, BUKAN exception yang membunuh paper run sebelum engine
    sempat jalan. `report_status` by contract selalu best-effort."""
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]

    def junk():
        conn, _ = srv.accept()
        try:
            conn.recv(4096)
            conn.sendall(b"<html>gateway error</html>")
            # Tutup sisi tulis saja, koneksi dibuka: klien membaca sampah itu
            # bersih dan melempar http.client.BadStatusLine (bukan OSError).
            conn.shutdown(socket.SHUT_WR)
            while conn.recv(4096):
                pass
        except OSError:
            pass
        finally:
            conn.close()

    threading.Thread(target=junk, daemon=True).start()
    try:
        alerts = []
        ok = rd.report_status(
            f"http://127.0.0.1:{port}/api/deployments/7/status",
            TOKEN,
            "running",
            timeout=5.0,
            alert=alerts.append,
        )
        assert ok is False
        assert alerts and "running" in alerts[0]
        assert TOKEN not in alerts[0]
    finally:
        srv.close()


# ── paper-only / secret hygiene (kontrak sumber) ────────────────────────────


def _paper_sources() -> str:
    return "\n".join(p.read_text(encoding="utf-8") for p in sorted((ROOT / "paper_trading").glob("*.py")))


def test_runtime_tidak_memiliki_jalur_order_live():
    """Tidak ada satu pun pemanggilan order batal/isi di execution plane."""
    src = _paper_sources()
    for needle in (
        "createOrder", "create_order", "cancelOrder", "cancel_order",
        "fetch_balance", "set_leverage", "api_key", "apiKey", "secret",
    ):
        assert needle not in src, f"jalur order/credential live ditemukan: {needle}"


def test_engine_tidak_menyentuh_supabase():
    """Runtime = SQLite + dua endpoint kontrol-eksekusi saja; tanpa klien Supabase."""
    src = _paper_sources()
    for needle in ("createClient", "SUPABASE_URL", "SERVICE_ROLE_KEY", "postgrest", "create_client"):
        assert needle not in src, f"engine menyentuh Supabase: {needle}"


def test_config_bundle_mengunci_mode_paper():
    """Skema config menolak mode live — literal 'paper' di dua ujung."""
    ts = (ROOT / "monitoring" / "web" / "lib" / "deployment-config.ts").read_text(encoding="utf-8")
    assert 'mode: z.literal("paper")' in ts
    assert 'exchange: z.literal("bitget")' in ts
    assert 'enabled: z.literal(false)' in ts  # llm_filter tetap mati
    assert validate_config(_valid_bundle(execution={"mode": "live", "exchange": "bitget"}))


def test_runtime_melaporkan_lifecycle_pada_jalur_yang_benar():
    src = (ROOT / "paper_trading" / "run_deployment.py").read_text(encoding="utf-8")
    # created -> running -> stopped / failed, tanpa state tambahan.
    assert 'REPORTABLE_STATUSES = ("running", "stopped", "failed")' in src
    assert '"running", alert=send_alert' in src
    assert '"stopped", alert=send_alert' in src
    assert '"failed", alert=send_alert' in src
    # Alert memakai modul alerting yang sudah ada — bukan sistem kedua.
    assert "from alerting.telegram_alert import send_alert" in src
    # Fail closed: config tidak tersedia -> keluar sebelum engine disentuh.
    assert "ConfigUnavailable" in src
    assert "return 1" in src


def test_token_tidak_pernah_menginap_di_papan_atau_log():
    src = (ROOT / "paper_trading" / "run_deployment.py").read_text(encoding="utf-8")
    assert "TREND_SENTRY_CONFIG_TOKEN" in src  # dibaca dari env
    # Tidak ada penyimpanan token ke file/DB.
    for needle in ("write_text", "INSERT INTO", "json.dump("):
        assert needle not in src, f"runtime tidak boleh menulis token: {needle}"


def test_runtime_tidak_query_template_atau_user_strategy():
    """Bundle dibawa utuh dari control plane; runtime tidak query per tick."""
    src = _paper_sources()
    for needle in ("strategy_templates", "user_strategies", "createClient"):
        assert needle not in src


def test_fail_closed_tidak_pernah_jatuh_ke_config_yaml(tmp_path):
    """ConfigSource yang gagal mengangkat ConfigUnavailable, bukan jatuh ke config.yaml."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    src = ConfigSource(
        7,
        f"http://127.0.0.1:{port}/api/deployments/7/config",
        TOKEN,
        cache_file=tmp_path / "config.json",
        timeout=2.0,
    )
    with pytest.raises(ConfigUnavailable):
        src.load()
    # Tidak ada cache tercipta, dan run_deployment keluar sebelum menyentuh engine.
    assert not (tmp_path / "config.json").exists()
    runtime_src = (ROOT / "paper_trading" / "run_deployment.py").read_text(encoding="utf-8")
    assert "load_config()" not in runtime_src, "runtime tidak boleh fallback ke config.yaml"
