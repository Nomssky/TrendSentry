"""Phase D: operational hardening — startup, restart/idempotency, klasifikasi
kegagalan, alerting, atribusi versi config, dan hygiene runtime (D1..D8).

Dua lapis pembuktian, konsisten dengan konvensi repo:

  1. PERILAKU NYATA — `run_deployment.main()` dijalankan sungguhan terhadap
     control-plane loopback (route contract Phase A/B: Bearer, /config + /status),
     dengan engine memakai exchange palsu dan seluruh artefakt runtime diarahkan
     ke tmp_path. Bukan live integration test terhadap Supabase — lihat catatan
     environment di laporan akhir.
  2. KONTRAK KONTRAK sumber — untuk hal yang hanya bisa diverifikasi dengan
     membaca kode (bound alert, gitignore, jendela refresh config).

KLASIFIKASI KEGAGALAN (deterministik, dipertahankan oleh test di file ini):

  FATAL (run berhenti, status `failed` / exit != 0, alert dikirim)
    - config tidak tersedia / tidak valid saat start  -> fail closed, exit 1
    - sumber market data total putus (load_markets)   -> keluar dari engine
    - SQLite tidak bisa dibuka                        -> crash -> status failed
    - kode engine non-nol                             -> status failed

  NON-FATAL (run tetap aman, data SQLite tetap truth)
    - market data satu pair putus (fetch_ohlcv)       -> skip pair + log.warning
    - heartbeat/status endpoint putus                 -> warning + alert, rc 0
    - Telegram putus / belum dikonfigurasi            -> send_alert -> False
    - sinkronisasi Supabase putus                     -> exit 1 TANPA maju watermark
    - cache config tidak ada saat remote rusak        -> fail closed (bukan fallback)
"""

import json
import sqlite3
import sys
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "paper_trading"))
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import config_source as cs  # noqa: E402
import live_signal as ls  # noqa: E402
import run_deployment as rd  # noqa: E402
import sync_paper_to_supabase as sync  # noqa: E402
from test_deployments_contract import _valid_bundle  # noqa: E402
from test_live_signal import FakeExchange, make_candles  # noqa: E402

TOKEN = "token-rahasia-yang-tidak-boleh-bocor"
DEPLOYMENT_ID = 7


# ── harness: control plane loopback (juga dipakai tests/test_mvp_ship_gate.py) ─


class _Handler(BaseHTTPRequestHandler):
    """Kontrak route Phase A/B: GET /<id>/config + POST /<id>/status, Bearer wajib."""

    def log_message(self, *args):  # senyap — jangan berisik di output pytest
        return

    @property
    def state(self):
        return self.server.state

    def _reply(self, status: int, raw: bytes):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        st = self.state
        if self.path != f"/api/deployments/{st.deployment_id}/config":
            return self._reply(404, b'{"error":"not found"}')
        if self.headers.get("Authorization", "") != f"Bearer {st.token}":
            return self._reply(401, b'{"error":"unauthorized"}')
        raw = st.raw_body if st.raw_body is not None else json.dumps(st.payload).encode()
        return self._reply(200, raw)

    def do_POST(self):
        st = self.state
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n).decode() if n else ""
        if (
            self.path != f"/api/deployments/{st.deployment_id}/status"
            or self.headers.get("Authorization", "") != f"Bearer {st.token}"
        ):
            st.denied += 1
            return self._reply(401, b'{"error":"unauthorized"}')
        if st.status_code != 200:
            st.denied += 1
            return self._reply(st.status_code, b'{"error":"control plane sakit"}')
        st.status_calls.append(body)
        return self._reply(200, b'{"ok":true}')


class ControlPlane:
    """Server loopback untuk satu deployment. Bukan live Supabase."""

    def __init__(self, deployment_id: int = DEPLOYMENT_ID, token: str = TOKEN):
        self.deployment_id = deployment_id
        self.token = token
        # Bentuk persis jawaban route Phase A: {deployment_id, config_version, config}.
        self.config_version = 1
        self.payload = {
            "deployment_id": deployment_id,
            "config_version": self.config_version,
            "config": _valid_bundle(deployment_id=deployment_id, config_version=self.config_version),
        }
        self.raw_body: bytes | None = None
        self.status_code = 200
        self.status_calls: list[str] = []
        self.denied = 0
        self._srv = ThreadingHTTPServer(("127.0.0.1", 0), _Handler)
        self._srv.state = self
        self._thread = threading.Thread(target=self._srv.serve_forever, daemon=True)
        self.config_url = (
            f"http://127.0.0.1:{self._srv.server_address[1]}"
            f"/api/deployments/{deployment_id}/config"
        )

    def start(self) -> "ControlPlane":
        self._thread.start()
        return self

    def stop(self) -> None:
        self._srv.shutdown()
        self._srv.server_close()

    @property
    def statuses(self) -> list[str]:
        return [json.loads(b).get("status") for b in self.status_calls if b.strip() != "{}"]


def sandbox(monkeypatch, tmp_path, config_url, token=TOKEN, deployment_id=DEPLOYMENT_ID):
    """Arahkan artefakt runtime ke tmp + kumpulkan semua alert ke satu list.

    Kembali: (alerts, cfg) — cfg = tuple env yang sudah diset.
    """
    alerts: list[str] = []
    monkeypatch.setenv("TREND_SENTRY_DEPLOYMENT_ID", str(deployment_id))
    monkeypatch.setenv("TREND_SENTRY_CONFIG_URL", config_url)
    monkeypatch.setenv("TREND_SENTRY_CONFIG_TOKEN", token)
    # Struktur identik dengan repo (db/deployments/<id>.db) supaya
    # sync.deployment_id_for() tetap mengenali identitas dari path.
    artifacts = tmp_path / "db" / "deployments"
    monkeypatch.setattr(cs, "CACHE_DIR", artifacts)
    monkeypatch.setattr(rd, "DEPLOYMENTS_DIR", artifacts)
    monkeypatch.setattr(rd, "send_alert", lambda m: alerts.append(m) or True)
    monkeypatch.setattr(ls, "send_alert", lambda m: alerts.append(m) or True)
    return alerts


def fast_engine(monkeypatch, candles=None):
    """Exchange palsu + tanpa jeda retry — uji klasifikasi, bukan timing jaringan."""
    candles = make_candles(spike=True) if candles is None else candles
    monkeypatch.setattr(ls, "make_exchange", lambda cfg: FakeExchange(candles))
    monkeypatch.setattr(ls, "fetch_retry", lambda fn, *args, **kwargs: fn())


def runtime_db(tmp_path, deployment_id=DEPLOYMENT_ID) -> Path:
    return tmp_path / "db" / "deployments" / f"{deployment_id}.db"


def dead_url() -> str:
    """URL ke port yang baru saja dilepas -> koneksi ditolak tanpa menunggu timeout."""
    import socket

    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return f"http://127.0.0.1:{port}/api/deployments/{DEPLOYMENT_ID}/config"


def ro(db_path: Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def dump_state(db_path: Path) -> dict:
    conn = ro(db_path)
    try:
        return {
            "signals": [dict(r) for r in conn.execute(
                "SELECT candle_date, pair, signal, decision FROM signals ORDER BY candle_date, pair"
            )],
            "positions": [dict(r) for r in conn.execute(
                "SELECT pair, entry_date, entry_price, units, stop_price, risk_amount, pnl, status "
                "FROM positions ORDER BY pair, entry_date"
            )],
            "equity": [dict(r) for r in conn.execute(
                "SELECT date, cash, total_equity FROM equity_log ORDER BY date"
            )],
            "meta": {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM meta")},
            "sync": {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM sync_state")},
        }
    finally:
        conn.close()


# ── D1 (tingkat runtime): remote rusak tetap tidak jatuh ke config.yaml ─────


def test_runtime_remote_rusak_pakai_cache_lalu_engine_tetap_jalan(monkeypatch, tmp_path):
    """D: remote balas sampah + cache valid -> pakai cache, run sukses, dan
    `config_version` yang tercatat di SQLite = versi cache (bukan versi remote)."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    cp.raw_body = b"<html>halaman filter ISP</html>"
    cache = cs.cache_path(DEPLOYMENT_ID)
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({
        "deployment_id": DEPLOYMENT_ID,
        "config_version": 9,
        "config": _valid_bundle(deployment_id=DEPLOYMENT_ID, config_version=9),
        "fetched_at": "2026-01-01T00:00:00+00:00",
    }))
    fast_engine(monkeypatch)
    try:
        rc = rd.main()
    finally:
        cp.stop()
    assert rc == 0
    meta = dump_state(runtime_db(tmp_path))["meta"]
    assert meta["config_version"] == "9"
    assert meta["deployment_id"] == str(DEPLOYMENT_ID)
    # Remote rusak tidak menggoyang cache: gagal validasi = jangan menulis.
    assert json.loads(cache.read_text())["config_version"] == 9
    # Kegagalan config tetap harus terlihat (bukan senyap).
    assert any("config" in a.lower() for a in alerts)


def test_runtime_tanpa_cache_dan_remote_mati_gagal_closed(monkeypatch, tmp_path):
    """C: remote tak terjangkau + tanpa config valid -> exit 1, TANPA status
    running, dan engine tidak pernah jalan (file DB tidak dibuat)."""
    alerts = sandbox(monkeypatch, tmp_path, dead_url())
    rc = rd.main()
    assert rc == 1
    assert alerts, "config unavailable harus menghasilkan alert"
    assert not runtime_db(tmp_path).exists(), "engine tidak boleh jalan tanpa config"


def test_config_diambil_tepat_sekali_per_run(monkeypatch, tmp_path):
    """D6: refresh config hanya di run boundary — tidak ada polling per tick."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)

    calls = {"n": 0}
    real_source = rd.ConfigSource

    class CountingSource(real_source):  # type: ignore[misc, valid-type]
        def load(self):
            calls["n"] += 1
            return super().load()

    monkeypatch.setattr(rd, "ConfigSource", CountingSource)
    try:
        rc = rd.main()
    finally:
        cp.stop()
    assert rc == 0
    assert calls["n"] == 1


# ── D2: restart / idempotency ──────────────────────────────────────────────


def test_restart_run_kedua_tidak_menduplikasi_state(monkeypatch, tmp_path):
    """Run 2x di candle yang sama persis -> sinyal, posisi, fill, equity, cash
    identik. Idempotency berasal dari UNIQUE(candle_date,pair) + upsert harian,
    BUKAN dari penghapusan data."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    try:
        assert rd.main() == 0
        first = dump_state(runtime_db(tmp_path))
        assert first["positions"], "skenario spike harus menghasilkan fill dulu"
        assert rd.main() == 0
        second = dump_state(runtime_db(tmp_path))
    finally:
        cp.stop()

    assert second["signals"] == first["signals"]
    assert second["positions"] == first["positions"]
    assert second["equity"] == first["equity"]
    assert second["meta"]["paper_cash"] == first["meta"]["paper_cash"]
    assert len(second["signals"]) == len(set(
        (s["candle_date"], s["pair"]) for s in second["signals"]
    )), "tidak boleh ada sinyal ganda"


def test_watermark_sync_tidak_maju_hanya_karena_payload_dikumpulkan(monkeypatch, tmp_path):
    """D2: payload identik saat diulang -> kirim ulang aman (upsert idempoten),
    dan pengumpulan payload tidak pernah menulis watermark."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    try:
        assert rd.main() == 0
    finally:
        cp.stop()

    db = runtime_db(tmp_path)
    before = dump_state(db)["sync"]
    _one, wm_one, _eq_one = sync.collect_payload(ro(db), db)
    _two, wm_two, _eq_two = sync.collect_payload(ro(db), db)
    assert _one == _two and wm_one == wm_two
    assert dump_state(db)["sync"] == before, "collect_payload harus read-only"
    assert _one["deployment_id"] == DEPLOYMENT_ID
    fills = [p["fill_key"] for p in _one["positions"]]
    assert fills, "positions payload harus membawa fill_key deployment-scoped"
    # Identitas cloud = (deployment_id, fill_key); fill_key sendiri sengaja bebas
    # deployment sehingga dua deployment boleh beririsan tanpa saling menimpa.
    assert all("|" in k for k in fills)
    assert set(fills) == set(p["fill_key"] for p in _two["positions"])


# ── D3: klasifikasi kegagalan ──────────────────────────────────────────────


def test_market_data_per_pair_putus_tidak_mematikan_run(monkeypatch, tmp_path):
    """NON-FATAL: OHLCV satu pair gagal -> pair dilewati, run tetap selesai 0."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)

    class NoOhlcv(FakeExchange):
        def fetch_ohlcv(self, pair, timeframe="1d", limit=None):
            raise RuntimeError("market data down")

    monkeypatch.setattr(ls, "make_exchange", lambda cfg: NoOhlcv(make_candles(spike=True)))
    monkeypatch.setattr(ls, "fetch_retry", lambda fn, *a, **k: fn())
    try:
        rc = rd.main()
    finally:
        cp.stop()
    assert rc == 0
    assert dump_state(runtime_db(tmp_path))["meta"]["paper_cash"]  # cash tetap terbaca
    assert cp.statuses[:1] == ["running"]
    assert cp.statuses[-1] == "stopped"  # selesai bersih, bukan failed


def test_sumber_data_total_putus_dipetakan_ke_failed(monkeypatch, tmp_path):
    """FATAL: load_markets gagal -> exception bocor ke run_deployment yang
    memetakannya ke status `failed` + alert ber-stack-trace terbatas."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)

    class NoMarkets(FakeExchange):
        def load_markets(self):
            raise RuntimeError("exchange unreachable")

    monkeypatch.setattr(ls, "make_exchange", lambda cfg: NoMarkets(make_candles(spike=True)))
    try:
        rc = rd.main()
    finally:
        cp.stop()
    assert rc == 1
    assert cp.statuses == ["running", "failed"]
    crash = [a for a in alerts if "CRASH" in a]
    assert crash, "crash harus menghasilkan alert"
    assert f"deployment {DEPLOYMENT_ID}" in crash[0]
    assert max(len(a) for a in alerts) <= 1500, "stack trace wajib dibatasi"


def test_sqlite_tidak_terbuka_dipetakan_ke_failed(monkeypatch, tmp_path):
    """FATAL: file SQLite tidak bisa dibuat (parent bukan direktori)."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    blocker = tmp_path / "bukan-direktori"
    blocker.write_text("x")
    monkeypatch.setattr(rd, "DEPLOYMENTS_DIR", blocker)
    try:
        rc = rd.main()
    finally:
        cp.stop()
    assert rc == 1
    assert cp.statuses == ["running", "failed"]
    assert any("CRASH" in a for a in alerts)


def test_heartbeat_putus_tidak_mematikan_run(monkeypatch, tmp_path):
    """NON-FATAL: control plane menolak status -> run tetap sukses (engine jalan
    sampai selesai), alert menyebut deployment + kategori, tanpa token."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    cp.status_code = 401
    try:
        rc = rd.main()
    finally:
        cp.stop()
    assert rc == 0
    assert runtime_db(tmp_path).exists(), "data trading tetap tersimpan walau heartbeat gagal"
    assert cp.denied >= 1
    status_alerts = [a for a in alerts if "gagal dilaporkan" in a]
    assert status_alerts, "kegagalan heartbeat harus menghasilkan alert"
    assert any(f"deployment {DEPLOYMENT_ID}" in a for a in status_alerts)
    assert all(TOKEN not in a for a in alerts)
    # Bounded: satu run = kegagalan running + stopped saja, bukan per tick/per pair.
    assert len(status_alerts) <= 3


def test_telegram_putus_tidak_menjatuhkan_apapun(monkeypatch):
    """NON-FATAL: send_alert tidak pernah melempar — selalu return bool."""
    from alerting.telegram_alert import send_alert

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "bot-token-uji")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "999")
    monkeypatch.setattr(urllib.request, "urlopen", lambda *a, **k: (_ for _ in ()).throw(OSError("down")))
    assert send_alert("ping") is False


def test_sync_putus_keluar_1_dan_watermark_tidak_maju(monkeypatch, tmp_path):
    """NON-FATAL untuk data: payload gagal kirim -> exit 1 + watermark tidak
    pernah disentuh, jadi sync berikutnya akan mengulang payload yang sama."""
    import io

    db = tmp_path / "paper.db"
    conn = sqlite3.connect(db)
    conn.executescript((ROOT / "db" / "schema.sql").read_text())
    conn.execute("INSERT INTO meta (key, value) VALUES ('paper_cash', '1000')")
    conn.execute(
        "INSERT INTO signals (candle_date, pair, close_price, signal, decision, reason, processed_at)"
        " VALUES ('2026-01-01','BTC/USDT',100.0,'HOLD','IGNORE','x','2026-01-01')"
    )
    conn.commit()
    conn.close()
    monkeypatch.setattr(sync, "DB_PATH", str(db))
    monkeypatch.setattr(sync, "CRON_SECRET", "uji-bukan-secret-asli")
    monkeypatch.setattr(
        urllib.request, "urlopen",
        lambda *a, **k: (_ for _ in ()).throw(
            urllib.error.HTTPError("http://x", 500, "boom", {}, io.BytesIO(b"err"))
        ),
    )
    with pytest.raises(SystemExit) as exc:
        sync.main()
    assert exc.value.code == 1
    assert sync.get_watermark(ro(db), "signals") == 0


def test_pemetaan_kegagalan_terpusat_di_run_deployment():
    """Kontrak dokumentasi: pemetaan exception -> `failed` ada di run_deployment
    (satu tempat), sehingga klasifikasi FATAL tidak bergantung pada caller, dan
    runtime tidak pernah melaporkan `created`."""
    src = (ROOT / "paper_trading" / "run_deployment.py").read_text(encoding="utf-8")
    assert src.count("report_status(") >= 4  # running, failed(crash), failed(rc), stopped
    assert '"created"' not in src
    assert '"failed"' in src and '"stopped"' in src
    assert "except Exception" in src


# ── D4: alerting lewat alerting/telegram_alert.py saja ─────────────────────


def test_tidak_ada_sistem_alerting_baru():
    src = (ROOT / "paper_trading" / "run_deployment.py").read_text(encoding="utf-8")
    assert "from alerting.telegram_alert import send_alert" in src
    # Tidak ada kanal alternatif (slack/discord/smtp/webhook) yang disuntikkan.
    for extra in ("slack", "discord", "smtp", "webhook", "smtplib", "requests.post"):
        assert extra not in src.lower(), f"jalur alerting tambahan: {extra}"


def test_alert_satu_run_dibatasi_bukan_storm(monkeypatch, tmp_path):
    """Satu run yang sukses menyapu 10 pair sekalipun tidak membanjiri Telegram:
    alert engine hanya untuk fill, alert control-plane hanya untuk kegagalan."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    try:
        assert rd.main() == 0
    finally:
        cp.stop()
    # Sukses = tidak ada alert level control plane.
    assert not [a for a in alerts if "gagal dilaporkan" in a or "CRASH" in a]
    # Fill (ENTER/EXIT) memang harus ter-alert — itu sinyal aksi, bukan spam tick.
    assert all(TOKEN not in a for a in alerts)
    assert all(len(a) <= 1500 for a in alerts)


# ── D6: atribusi deployment + versi config ─────────────────────────────────


def test_run_menyimpan_atribusi_deployment_dan_versi_config(monkeypatch, tmp_path):
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    try:
        assert rd.main() == 0
    finally:
        cp.stop()
    meta = dump_state(runtime_db(tmp_path))["meta"]
    assert meta["deployment_id"] == str(DEPLOYMENT_ID)
    assert meta["config_version"] == str(cp.payload["config_version"])


def test_jalur_legacy_tidak_menulis_atribusi(monkeypatch, tmp_path):
    """config.yaml tidak punya deployment_id/config_version -> jalur legacy tidak
    menambah key apa pun (DB lama tetap persis seperti semula)."""
    alerts: list[str] = []
    monkeypatch.setattr(ls, "DB_PATH", tmp_path / "paper.db")
    monkeypatch.setattr(ls, "send_alert", lambda m: alerts.append(m) or True)
    fast_engine(monkeypatch)
    monkeypatch.setattr(ls, "make_exchange", lambda cfg: FakeExchange(make_candles()))
    assert ls.main() == 0
    meta = dump_state(tmp_path / "paper.db")["meta"]
    assert "deployment_id" not in meta
    assert "config_version" not in meta


# ── D7: hygiene file/runtime ───────────────────────────────────────────────


def test_artefakt_runtime_tergitignore():
    ig = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "db/deployments/" in ig
    # Cache config + SQLite per deployment sama-sama berada di bawah itu.
    assert str(cs.CACHE_DIR).endswith("db/deployments")
    assert str(rd.DEPLOYMENTS_DIR).endswith("db/deployments")


def test_cache_config_tidak_pernah_menyimpan_token(monkeypatch, tmp_path):
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    try:
        assert rd.main() == 0
    finally:
        cp.stop()
    cache = cs.cache_path(DEPLOYMENT_ID)
    assert cache.exists(), "jalur sukses harus mengisi cache last-known-good"
    raw = cache.read_text(encoding="utf-8")
    assert TOKEN not in raw
    assert "config_token" not in raw
    assert "TELEGRAM" not in raw
    # Artefak runtime ditulis HANYA di sandbox tmp, bukan di db/ repo.
    assert str(runtime_db(tmp_path).parent).startswith(str(tmp_path))
    assert cache.is_relative_to(tmp_path)
    assert all(TOKEN not in a for a in alerts)


def test_pesan_exception_status_tidak_membawa_header(monkeypatch, tmp_path):
    """Pesan alert dari kegagalan HTTP tidak boleh memuat nilai Bearer."""
    cp = ControlPlane().start()
    alerts = sandbox(monkeypatch, tmp_path, cp.config_url)
    fast_engine(monkeypatch)
    cp.status_code = 500
    try:
        rd.main()
    finally:
        cp.stop()
    assert alerts
    joined = "\n".join(alerts)
    assert TOKEN not in joined
    assert "Bearer" not in joined
