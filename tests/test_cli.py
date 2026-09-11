"""Check CLI wrapper: help, doctor, watcher, dan penolakan live non-dry-run."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLI = [sys.executable, str(ROOT / "cli.py")]


def run(*args: str):
    return subprocess.run([*CLI, *args], capture_output=True, text=True, cwd=ROOT)


def test_help_lists_commands():
    p = run("--help")
    assert p.returncode == 0
    for cmd in ("backtest", "paper", "live", "watcher", "doctor"):
        assert cmd in p.stdout


def test_live_without_dry_run_refused():
    p = run("live")
    assert p.returncode == 2
    assert "DITOLAK" in p.stdout


def test_doctor_ok():
    p = run("doctor")
    assert p.returncode == 0, p.stdout + p.stderr


def test_watcher_reads_local_db():
    p = run("watcher")
    assert p.returncode == 0, p.stdout + p.stderr
