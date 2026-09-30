"""Runtime entry point per-deployment (Phase B) — PAPER / SIMULATED ONLY.

Dijalankan di mesin self-hosted milik user (cron/runit sendiri), satu proses
untuk SATU deployment:

    TREND_SENTRY_DEPLOYMENT_ID=1 \\
    TREND_SENTRY_CONFIG_URL=https://<host>/api/deployments/1/config \\
    TREND_SENTRY_CONFIG_TOKEN=<token dari POST /api/deployments, sekali tampil> \\
    python paper_trading/run_deployment.py

Batasan keras (PLAN.md §9 + scope MVP):
  - execution.mode = 'paper'. Tidak ada satu pun penerbitan/pembatalan order,
    tidak ada API privat Bitget, tidak ada credential exchange sama sekali.
  - Supabase TIDAK PERNAH disentuh runtime. Hanya dua panggilan kontrol-eksekusi:
      GET  /api/deployments/<id>/config   -> config bundle versioned
      POST /api/deployments/<id>/status   -> heartbeat + lifecycle
    Keduanya memakai token per-deployment di header, tidak pernah di URL.
  - Runtime truth = SQLite per deployment (db/deployments/<id>.db).
    Supabase tetap mirror, diisi lewat scripts/sync_paper_to_supabase.py.
  - Tidak ada scheduler, tidak ada query strategi/user per tick, tidak ada LLM.

Lifecycle (4 state yang sudah ada di Phase A, tidak ditambah):
    created -> running -> stopped       (run bersih)
    running -> failed                   (crash / return != 0)
"""

from __future__ import annotations

import json
import logging
import os
import sys
import traceback
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(ROOT / "paper_trading") not in sys.path:
    sys.path.insert(0, str(ROOT / "paper_trading"))

from alerting.telegram_alert import send_alert  # noqa: E402
from config_source import ConfigSource, ConfigUnavailable  # noqa: E402
import live_signal  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger("run_deployment")

ENV_DEPLOYMENT_ID = "TREND_SENTRY_DEPLOYMENT_ID"
ENV_CONFIG_URL = "TREND_SENTRY_CONFIG_URL"
ENV_CONFIG_TOKEN = "TREND_SENTRY_CONFIG_TOKEN"

DEPLOYMENTS_DIR = ROOT / "db" / "deployments"
# Lifecycle yang boleh dilaporkan runtime. `created` sengaja TIDAK ada di sini:
# status awal ditetapkan control plane saat pembuatan, runtime hanya memindahnya
# ke running/stopped/failed.
REPORTABLE_STATUSES = ("running", "stopped", "failed")


def read_env(environ: dict | None = None) -> dict:
    """Baca konfigurasi runtime dari environment. Hanya NAMA variabel yang boleh
    muncul di pesan error — nilai token tidak pernah ikut ke log/exception."""
    env = os.environ if environ is None else environ
    required = (ENV_DEPLOYMENT_ID, ENV_CONFIG_URL, ENV_CONFIG_TOKEN)
    missing = [name for name in required if not str(env.get(name) or "").strip()]
    if missing:
        raise RuntimeError("env wajib belum diset: " + ", ".join(missing))

    raw_id = str(env[ENV_DEPLOYMENT_ID]).strip()
    if not raw_id.isdigit() or int(raw_id) <= 0:
        raise RuntimeError(f"{ENV_DEPLOYMENT_ID} harus bilangan positif")

    config_url = str(env[ENV_CONFIG_URL]).strip()
    if not config_url.startswith(("http://", "https://")):
        raise RuntimeError(f"{ENV_CONFIG_URL} harus URL http(s)")

    return {
        "deployment_id": int(raw_id),
        "config_url": config_url,
        "config_token": str(env[ENV_CONFIG_TOKEN]),
    }


def db_path_for(deployment_id: int) -> Path:
    """db/deployments/<deployment_id>.db — satu file, satu deployment.

    Isolasi file (bukan kolom deployment_id di satu DB bersama) yang memberi
    batas keras: runtime A tidak mungkin membaca/menulis file milik B.
    """
    return DEPLOYMENTS_DIR / f"{deployment_id}.db"


def status_url_for(config_url: str) -> str | None:
    """Endpoint lifecycle diturunkan dari config URL supaya tidak perlu env baru:
    .../api/deployments/<id>/config -> .../api/deployments/<id>/status.

    Kalau bentuk URL tidak dikenal, heartbeat DILEWATKAN (bukan menebak URL) —
    runtime tetap jalan karena SQLite, bukan control plane, yang jadi truth.
    """
    if config_url.endswith("/config"):
        return config_url[: -len("/config")] + "/status"
    log.warning("config URL tidak diakhiri '/config' — status/heartbeat dilewati")
    return None


def report_status(
    status_url: str | None,
    token: str,
    status: str | None = None,
    *,
    timeout: float = 10.0,
    alert=None,
) -> bool:
    """POST heartbeat (dan status opsional) ke control plane.

    Selalu best-effort: kegagalan jaringan/logic control plane TIDAK mematikan
    paper run — data trading sudah lengkap di SQLite. Gagal = warning + alert,
    bukan exception. Token hanya dikirim di header.
    """
    if status_url is None:
        return False
    if status is not None and status not in REPORTABLE_STATUSES:
        raise ValueError(f"status tidak dikenal: {status!r}")

    body: dict = {}
    if status is not None:
        body["status"] = status
    request = urllib.request.Request(
        status_url,
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            ok = (getattr(response, "status", None) or response.getcode()) == 200
    except Exception as exc:  # noqa: BLE001 - best-effort by contract: proxy/gateway
        # yang membalas bukan-HTTP (http.client.HTTPException) bukan OSError dan
        # akan bocor keluar, mematikan run SEBELUM engine sempat jalan. Heartbeat
        # tidak pernah boleh lebih penting dari paper run -> semua kegagalan
        # dikumpulkan jadi warning + alert. ValueError sengaja tetap di luar
        # (status tak dikenal = bug pemanggil, harus keras).
        # Pesan exception dari urlopen tidak memuat isi header -> token aman.
        ok = False
        log.warning("status '%s' gagal dikirim: %s", status, exc)

    if not ok and alert is not None:
        try:
            alert(f"[deployment] status '{status}' gagal dilaporkan ke control plane")
        except Exception:  # noqa: BLE001 - notifikasi tidak boleh menjatuhkan run
            log.exception("alert status gagal terkirim")
    return ok


def main() -> int:
    try:
        env = read_env()
    except RuntimeError as exc:
        # Nama variabel saja di pesan; nilai token tidak pernah ikut.
        log.error("%s", exc)
        send_alert(f"[deployment] runtime GAGAL start: {exc}")
        return 1

    deployment_id = env["deployment_id"]
    status_url = status_url_for(env["config_url"])

    source = ConfigSource(
        deployment_id,
        env["config_url"],
        env["config_token"],
        alert=send_alert,
    )
    try:
        snapshot = source.load()
    except ConfigUnavailable as exc:
        # ConfigSource sudah mengirim alert (FAIL CLOSED: tanpa config valid
        # tidak ada engine yang boleh jalan — config.yaml tidak dipakai sebagai
        # tebakan cadangan).
        log.error("%s", exc)
        return 1

    db_path = db_path_for(deployment_id)
    log.info(
        "deployment %s: config v%s (%s) | sqlite %s",
        deployment_id,
        snapshot.config_version,
        snapshot.origin,
        db_path,
    )

    report_status(status_url, env["config_token"], "running", alert=send_alert)

    try:
        rc = live_signal.main(cfg=snapshot.config, db_path=db_path)
    except Exception:
        log.exception("deployment %s: runtime crash", deployment_id)
        send_alert(
            f"[deployment {deployment_id}] runtime CRASH\n" + traceback.format_exc()[-1200:]
        )
        report_status(status_url, env["config_token"], "failed", alert=send_alert)
        return 1

    if rc != 0:
        send_alert(f"[deployment {deployment_id}] run selesai dengan kode {rc}")
        report_status(status_url, env["config_token"], "failed", alert=send_alert)
        return rc if isinstance(rc, int) and rc != 0 else 1

    report_status(status_url, env["config_token"], "stopped", alert=send_alert)
    log.info("deployment %s: selesai bersih", deployment_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
