"""Config source: ambil config bundle VERSIONED dari control plane (Phase B).

Satu-satunya jalur komunikasi execution plane -> control plane untuk konfigurasi
adalah GET /api/deployments/<id>/config dengan `Authorization: Bearer <token>`
per-deployment. Runtime TIDAK PERNAH menyentuh Supabase (bukan SDK, bukan
PostgREST, bukan SQL) — endpoint itu satu-satunya pintunya.

Alur pertama kali (TIDAK ada cache valid):

    remote -> cek payload -> validate_config() -> tulis cache atomik -> jalan
    gagal  -> FAIL CLOSED (ConfigUnavailable)   # tidak pernah menebak default

Alur run berikutnya:

    remote gagal + cache valid -> pakai cache + alert -> jalan terus
    remote sukses (versi baru) -> validate -> ganti cache atomik -> pakai baru

Token datang dari environment (TREND_SENTRY_CONFIG_TOKEN) dan TIDAK PERNAH
ikut ditulis ke cache maupun ke log — cache hanya memuat deployment_id,
config_version, config, fetched_at.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from risk_manager.guards import validate_config  # noqa: E402

log = logging.getLogger("config_source")

# Cache per deployment, bukan satu file global: config A tidak boleh terbaca
# sebagai config B kalau dua runtime berjalan di mesin yang sama.
CACHE_DIR = ROOT / "db" / "deployments"


class ConfigError(Exception):
    """Config remote/cache tidak bisa dipercaya (payload salah, validasi gagal)."""


class ConfigUnavailable(ConfigError):
    """Startup tanpa config valid -> runtime gagal-tertutup, bukan menebak."""


@dataclass(frozen=True)
class ConfigSnapshot:
    """Konfigurasi yang SAH dipakai engine + asal-usulnya."""

    deployment_id: int
    config_version: int
    config: dict
    fetched_at: str
    origin: str  # "remote" | "cache"


def cache_path(deployment_id: int) -> Path:
    """db/deployments/<deployment_id>/config.json — satu cache per deployment."""
    return CACHE_DIR / str(deployment_id) / "config.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_payload(payload: object, expected_deployment_id: int) -> tuple[int, dict]:
    """Cek bentuk payload endpoint config + jalankan validate_config() engine.

    Membuang payload yang salah deployment, versi invalid, atau config yang
    ditolak engine (mode=live, exchange≠bitget, direction≠long_only, risk>1%,
    max_concurrent>5, ATR stop<=0, dst). Return (config_version, config).
    """
    if not isinstance(payload, dict):
        raise ConfigError("payload config bukan objek")

    dep = payload.get("deployment_id")
    if dep != expected_deployment_id:
        raise ConfigError(
            f"deployment_id payload {dep!r} tidak cocok dengan runtime {expected_deployment_id}"
        )

    version = payload.get("config_version")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise ConfigError(f"config_version tidak valid: {version!r}")

    config = payload.get("config")
    if not isinstance(config, dict):
        raise ConfigError("config bukan objek")

    errors = validate_config(config)
    if errors:
        raise ConfigError("config ditolak validate_config(): " + "; ".join(errors))

    return version, config


class ConfigSource:
    """Fetcher + cache last-known-good untuk SATU deployment.

    `alert` opsional (callable dipanggil dengan satu string). Default None =
    hanya log; entrypoint runtime yang mengoper `send_alert` supaya alert
    Telegram dipakai, dan test bisa meng-capture tanpa menyentuh jaringan.
    """

    def __init__(
        self,
        deployment_id: int,
        config_url: str,
        token: str,
        *,
        cache_file: Path | str | None = None,
        timeout: float = 15.0,
        alert=None,
    ):
        if not isinstance(deployment_id, int) or deployment_id <= 0:
            raise ValueError("deployment_id harus bilangan positif")
        if not config_url:
            raise ValueError("config_url wajib diisi")
        if not token:
            raise ValueError("token wajib diisi")
        self.deployment_id = deployment_id
        self.config_url = config_url
        self._token = token
        self.cache_file = Path(cache_file) if cache_file else cache_path(deployment_id)
        self.timeout = timeout
        self._alert = alert

    # ── public ──────────────────────────────────────────────────────────────

    def load(self) -> ConfigSnapshot:
        """Ambil config: remote dulu, cache sebagai fallback, kalau keduanya
        kosong/gagal -> ConfigUnavailable (FAIL CLOSED)."""
        try:
            snapshot = self._fetch_remote()
        except Exception as exc:  # noqa: BLE001 - satu pintu penanganan gagal fetch
            cached = self.read_cache()
            if cached is None:
                message = (
                    f"[deployment {self.deployment_id}] config TIDAK tersedia dan tidak ada "
                    f"cache valid — FAIL CLOSED, runtime tidak jalan ({exc})"
                )
                self._notify(message)
                raise ConfigUnavailable(message) from exc
            self._notify(
                f"[deployment {self.deployment_id}] config remote gagal ({exc}) — "
                f"lanjut dengan cache v{cached.config_version} dari {cached.fetched_at}"
            )
            return replace(cached, origin="cache")

        self._write_cache(snapshot)
        return snapshot

    def read_cache(self) -> ConfigSnapshot | None:
        """Cache last-known-good. Return None kalau hilang/rusak/salah milik/
        tidak lolos validasi — cache yang meragukan tidak pernah dipakai."""
        path = self.cache_file
        if not path.exists():
            return None
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            log.warning("cache config tidak terbaca (%s) — diabaikan", exc)
            return None
        if not isinstance(raw, dict):
            log.warning("cache config bukan objek — diabaikan")
            return None
        if raw.get("config_token") is not None or raw.get("token") is not None:
            log.error("cache config mengandung token — DIBUANG, jangan pernah disimpan")
            return None
        if raw.get("deployment_id") != self.deployment_id:
            log.warning(
                "cache config milik deployment %r, runtime %s — diabaikan",
                raw.get("deployment_id"),
                self.deployment_id,
            )
            return None
        try:
            version, config = validate_payload(raw, self.deployment_id)
        except ConfigError as exc:
            log.warning("cache config gagal validasi (%s) — diabaikan", exc)
            return None
        return ConfigSnapshot(
            deployment_id=self.deployment_id,
            config_version=version,
            config=config,
            fetched_at=str(raw.get("fetched_at") or ""),
            origin="cache",
        )

    # ── internals ───────────────────────────────────────────────────────────

    def _fetch_remote(self) -> ConfigSnapshot:
        # Token SELALU di header, tidak pernah di URL (URL bisa ter-log).
        request = urllib.request.Request(
            self.config_url,
            headers={
                "Authorization": f"Bearer {self._token}",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                status = getattr(response, "status", None) or response.getcode()
                body = response.read()
        except urllib.error.HTTPError as exc:
            raise ConfigError(f"config endpoint HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ConfigError(f"config endpoint tidak terjangkau: {exc}") from exc

        if status != 200:
            raise ConfigError(f"config endpoint HTTP {status}")
        try:
            payload = json.loads(body)
        except (ValueError, UnicodeDecodeError) as exc:
            raise ConfigError("response config bukan JSON valid") from exc

        version, config = validate_payload(payload, self.deployment_id)
        return ConfigSnapshot(
            deployment_id=self.deployment_id,
            config_version=version,
            config=config,
            fetched_at=now_iso(),
            origin="remote",
        )

    def _write_cache(self, snapshot: ConfigSnapshot) -> None:
        """Tulis cache ATOMIK (tmp lalu os.replace) — pembaca tidak pernah
        melihat file setengah tulis. Gagal menulis tidak mematikan run:
        cache hanya penyangga ketersediaan, config hasil fetch tetap valid."""
        payload = {
            "deployment_id": snapshot.deployment_id,
            "config_version": snapshot.config_version,
            "config": snapshot.config,
            "fetched_at": snapshot.fetched_at,
        }
        path = self.cache_file
        tmp = path.with_name(path.name + ".tmp")
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
            os.replace(tmp, path)
        except OSError as exc:
            log.warning("gagal menulis cache config (%s) — run tetap lanjut", exc)
            try:
                tmp.unlink(missing_ok=True)
            except OSError:
                pass

    def _notify(self, message: str) -> None:
        log.warning("%s", message)
        if self._alert is None:
            return
        try:
            self._alert(message)
        except Exception:  # noqa: BLE001 - notifikasi tidak boleh menjatuhkan runtime
            log.exception("alert config gagal terkirim")
