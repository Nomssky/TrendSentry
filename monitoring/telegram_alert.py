"""Notifikasi minimal ke Telegram (dipakai Fase 2 untuk alert failure, Fase 4 untuk entry/exit).

Baca TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID dari .env (lihat .env.example).
Kalau belum dikonfigurasi, alert di-skip dengan log warning — bot tidak boleh
crash gara-gara notifikasi gagal.
"""

import json
import logging
import os
import urllib.request
from pathlib import Path

log = logging.getLogger("telegram_alert")


def load_env() -> None:
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def send_alert(message: str) -> bool:
    """Kirim 1 pesan ke chat Telegram. Return False kalau tidak terkonfigurasi/gagal."""
    load_env()
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        log.warning("TELEGRAM_BOT_TOKEN/CHAT_ID belum diset di .env — alert di-skip")
        return False
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": message}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception:
        log.exception("gagal kirim alert telegram")
        return False
