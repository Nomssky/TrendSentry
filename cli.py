"""TrendSentry CLI (gratis) — thin wrapper di atas engine yang sudah ada.

Perintah memanggil script yang sama dipakai Fase 2 (tanpa ubah perilaku):
- `backtest` -> backtest/run_backtest.py (butuh data/historical/*.csv)
- `paper` / `live --dry-run` -> paper_trading/live_signal.py (eksekusi paper di data live)
- `live` (tanpa --dry-run) DITOLAK: order riil Fase 4 belum ada.
- `watcher` -> tampilkan posisi open + sinyal terakhir dari SQLite lokal (read-only).
- `doctor` -> cek deps, config guardrail, dan DB lokal.

Kunci API exchange tidak pernah dibaca/dikirim tool ini — semua milik mesin user.
"""

import argparse
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_DEFAULT = ROOT / "db" / "paper_trading.db"
CONFIG_DEFAULT = ROOT / "config.yaml"


def _run(script: str) -> int:
    proc = subprocess.run([sys.executable, str(ROOT / script)])
    return proc.returncode


def cmd_backtest(_args: argparse.Namespace) -> int:
    return _run("backtest/run_backtest.py")


def cmd_paper(_args: argparse.Namespace) -> int:
    return _run("paper_trading/live_signal.py")


def cmd_live(args: argparse.Namespace) -> int:
    from rich.console import Console

    console = Console()
    if not args.dry_run:
        console.print(
            "[bold red]DITOLAK:[/] eksekusi order riil (Fase 4) belum tersedia.\n"
            "Gunakan [green]trendsentry live --dry-run[/] (= engine paper di data live) "
            "atau [green]trendsentry paper[/]."
        )
        return 2
    console.print("[yellow]dry-run:[/] eksekusi paper di data live (tanpa order riil).")
    return _run("paper_trading/live_signal.py")


def _connect_ro(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    return conn


def cmd_watcher(args: argparse.Namespace) -> int:
    from rich.console import Console
    from rich.table import Table

    console = Console()
    db_path = Path(args.db)
    if not db_path.exists():
        console.print(f"[red]DB tidak ada:[/] {db_path} — jalankan `trendsentry paper` dulu.")
        return 1
    conn = _connect_ro(db_path)
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {"positions", "signals", "equity_log"} <= tables:
        console.print("[red]Schema DB tidak lengkap[/] — jalankan `trendsentry paper` dulu.")
        return 1

    t = Table(title="Open positions")
    t.add_column("Pair"); t.add_column("Entry", justify="right"); t.add_column("Stop", justify="right")
    t.add_column("Units", justify="right"); t.add_column("Risk USD", justify="right")
    for pair, entry, units, stop, risk in conn.execute(
        "SELECT pair, entry_price, units, stop_price, risk_amount FROM positions WHERE status='open'"
    ):
        t.add_row(pair, f"{entry:.2f}", f"{stop:.2f}", f"{units:.4f}", f"{risk:.2f}")
    console.print(t)

    t2 = Table(title="Sinyal terakhir (10)")
    t2.add_column("Tanggal"); t2.add_column("Pair"); t2.add_column("Signal")
    t2.add_column("Keputusan"); t2.add_column("Alasan")
    for row in conn.execute(
        "SELECT candle_date, pair, signal, decision, reason FROM signals ORDER BY id DESC LIMIT 10"
    ):
        t2.add_row(*[str(c) for c in row])
    console.print(t2)

    eq = conn.execute(
        "SELECT date, cash, positions_mtm, n_open, total_equity FROM equity_log ORDER BY date DESC LIMIT 1"
    ).fetchone()
    if eq:
        console.print(f"[bold]Equity {eq[0]}:[/] cash={eq[1]:.2f} mtm={eq[2]:.2f} open={eq[3]} total={eq[4]:.2f}")
    conn.close()
    return 0


def cmd_doctor(_args: argparse.Namespace) -> int:
    from rich.console import Console
    from rich.table import Table

    console = Console()
    ok = True
    rows: list[tuple[str, str, str]] = []

    def check(name: str, passed: bool, detail: str = "") -> None:
        nonlocal ok
        rows.append((name, "OK" if passed else "GAGAL", detail))
        ok = ok and passed

    try:
        import ccxt  # noqa: F401
        import pandas  # noqa: F401
        import yaml  # noqa: F401

        check("deps python", True, "ccxt+pandas+yaml")
    except ImportError as e:
        check("deps python", False, str(e))

    try:
        import yaml

        from risk_manager.guards import validate_config

        cfg = yaml.safe_load(CONFIG_DEFAULT.read_text())
        errs = validate_config(cfg)
        guard = len(errs) == 0
        check("config guardrail", guard, "; ".join(errs) if errs else f"risk={cfg['risk']['risk_per_trade_pct']}% mode={cfg['execution']['mode']}")
    except Exception as e:  # noqa: BLE001 - doctor harus tahan semua error config
        check("config guardrail", False, str(e))

    if DB_DEFAULT.exists():
        try:
            conn = _connect_ro(DB_DEFAULT)
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            check("db lokal", {"positions", "signals", "equity_log"} <= tables, str(DB_DEFAULT))
            conn.close()
        except Exception as e:  # noqa: BLE001
            check("db lokal", False, str(e))
    else:
        check("db lokal", True, "belum ada (dibuat saat paper pertama)")

    t = Table(title="trendsentry doctor")
    t.add_column("Cek"); t.add_column("Status"); t.add_column("Detail")
    for name, status, detail in rows:
        t.add_row(name, f"[green]{status}[/]" if status == "OK" else f"[red]{status}[/]", detail)
    console.print(t)
    return 0 if ok else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="trendsentry", description="TrendSentry CLI — gratis, lokal, tanpa kustodi.")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("backtest", help="backtest di data historis lokal").set_defaults(fn=cmd_backtest)
    sub.add_parser("paper", help="engine paper di data live (tanpa order riil)").set_defaults(fn=cmd_paper)
    live = sub.add_parser("live", help="eksekusi live (wajib --dry-run selama Fase 4 belum ada)")
    live.add_argument("--dry-run", action="store_true")
    live.set_defaults(fn=cmd_live)
    watcher = sub.add_parser("watcher", help="tampilkan posisi open + sinyal terakhir (read-only)")
    watcher.add_argument("--db", default=str(DB_DEFAULT))
    watcher.set_defaults(fn=cmd_watcher)
    sub.add_parser("doctor", help="cek kesehatan instalasi lokal").set_defaults(fn=cmd_doctor)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
