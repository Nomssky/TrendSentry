#!/usr/bin/env python3
"""Perbandingan paper trading (live-paper) vs referensi backtest — Fase 2.

Sumber angka referensi = Cluster-A2 (mirror monitoring/web/lib/reference.ts):
10 pair Bitget 2020-08..2026-08, Donchian 20/10, ATR14x2, long-only, risk 1%,
cluster limit 2/cluster. Jangan ubah angka ini tanpa re-run backtest +
catatan di PLAN.md (hard rule AGENTS.md #2).

Gate: evaluasi (PASS/FLAG) HANYA setelah >=10 trade tertutup. Sebelum itu
script hanya mencetak snapshot + status LOCKED — tidak ada penilaian,
sesuai kriteria sukses Fase 2 di TASKS.md.
"""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / "db" / "paper_trading.db"
REFERENCE_JSON = ROOT / "monitoring" / "web" / "lib" / "backtest-reference.json"

# SATU sumber: monitoring/web/lib/backtest-reference.json (dipakai juga oleh
# web/lib/reference.ts). Jangan hardcode angka di sini.
with open(REFERENCE_JSON) as _f:
    _ref = json.load(_f)

REF = {
    "win_rate_pct": _ref["winRatePct"],
    "avg_win_r": _ref["avgWinR"],
    "avg_loss_r": _ref["avgLossR"],
    "avg_r": _ref["avgR"],
    "profit_factor": _ref["profitFactor"],
}
EVAL_MIN_TRADES = _ref["evalMinTrades"]
WIN_RATE_TOLERANCE_PP = _ref["winRateTolerancePp"]
AVG_R_FLOOR = _ref["avgRFloor"]
SLIPPAGE_ASSUMPTION_PCT = _ref["slippageAssumptionPct"]
SLIPPAGE_ALERT_MULT = _ref["slippageAlertMult"]


def realized_stats(conn: sqlite3.Connection) -> dict:
    rows = conn.execute(
        "SELECT pnl, r_multiple FROM positions WHERE status='closed'"
    ).fetchall()
    rs = [float(r[1] or 0.0) for r in rows]
    pnls = [float(r[0] or 0.0) for r in rows]
    wins = [r for r in rs if r > 0]
    losses = [r for r in rs if r < 0]
    slips = [r[0] for r in conn.execute("SELECT spread_pct FROM slippage_log").fetchall()]
    return {
        "n_closed": len(rows),
        "wins": len([p for p in pnls if p > 0]),
        "win_rate_pct": (len([p for p in pnls if p > 0]) / len(rows) * 100) if rows else None,
        "avg_r": (sum(rs) / len(rs)) if rs else None,
        "avg_win_r": (sum(wins) / len(wins)) if wins else None,
        "avg_loss_r": (sum(losses) / len(losses)) if losses else None,
        "slip_avg": (sum(slips) / len(slips)) if slips else None,
        "slip_max": max(slips) if slips else None,
        "slip_n": len(slips),
    }


def evaluate(s: dict, ref: dict = REF) -> dict:
    """Bandingkan statistik realisasi vs referensi. Pure function (unit-tested).

    Return {'locked': bool, 'checks': {metric: (status, detail)}} dengan
    status PASS | FLAG | NA. Gate <10 trade -> locked, tanpa penilaian.
    """
    if s["n_closed"] < EVAL_MIN_TRADES:
        return {"locked": True, "checks": {}}
    checks: dict[str, tuple[str, str]] = {}
    wr, ar = s["win_rate_pct"], s["avg_r"]
    if wr is None or ar is None:
        return {"locked": True, "checks": {}}
    d_wr = abs(wr - ref["win_rate_pct"])
    checks["win_rate"] = (
        ("PASS", f"{wr:.1f}% vs ref {ref['win_rate_pct']:.1f}% (Δ{d_wr:.1f}pp ≤ {WIN_RATE_TOLERANCE_PP}pp)")
        if d_wr <= WIN_RATE_TOLERANCE_PP
        else ("FLAG", f"{wr:.1f}% vs ref {ref['win_rate_pct']:.1f}% (Δ{d_wr:.1f}pp > {WIN_RATE_TOLERANCE_PP}pp) — investigasi overfitting/slippage")
    )
    checks["avg_r"] = (
        ("PASS", f"{ar:+.2f}R ≥ floor {AVG_R_FLOOR}R (ref {ref['avg_r']:+.2f}R)")
        if ar >= AVG_R_FLOOR
        else ("FLAG", f"{ar:+.2f}R < floor {AVG_R_FLOOR}R — investigasi, bukan otomatis gagal")
    )
    if s["slip_avg"] is not None:
        limit = SLIPPAGE_ASSUMPTION_PCT * SLIPPAGE_ALERT_MULT
        checks["slippage"] = (
            ("PASS", f"avg {s['slip_avg']:.4f}% ≤ {limit:.2f}% (n={s['slip_n']})")
            if s["slip_avg"] <= limit
            else ("FLAG", f"avg {s['slip_avg']:.4f}% > {limit:.2f}% — revisi sizing + re-run backtest")
        )
    else:
        checks["slippage"] = ("NA", "belum ada sampel slippage")
    return {"locked": False, "checks": checks}


def main() -> int:
    ap = argparse.ArgumentParser(description="Bandingkan live-paper vs referensi backtest (Fase 2).")
    ap.add_argument("--db", default=str(DEFAULT_DB))
    args = ap.parse_args()
    if not Path(args.db).exists():
        print(f"DB tidak ditemukan: {args.db}")
        return 1
    conn = sqlite3.connect(args.db)
    s = realized_stats(conn)
    conn.close()
    print(f"Closed trades: {s['n_closed']}/{EVAL_MIN_TRADES} | wins: {s['wins']}")
    if s["n_closed"]:
        print(f"win rate: {s['win_rate_pct']:.1f}% (ref {REF['win_rate_pct']:.1f}%) | "
              f"avg R: {s['avg_r']:+.2f} (ref {REF['avg_r']:+.2f})")
    print(f"slippage: {s['slip_avg']:.4f}% avg / {s['slip_max']:.4f}% max (n={s['slip_n']}, asumsi {SLIPPAGE_ASSUMPTION_PCT}%)"
          if s["slip_avg"] is not None else "slippage: belum ada sampel")
    res = evaluate(s)
    if res["locked"]:
        print(f"\nSTATUS: LOCKED — evaluasi dibuka setelah ≥{EVAL_MIN_TRADES} trade tertutup "
              f"(kurang {EVAL_MIN_TRADES - s['n_closed']}). Flat/menunggu = normal untuk trend-following.")
        return 0
    print("\nSTATUS: EVALUATED")
    failed = False
    for metric, (status, detail) in res["checks"].items():
        print(f"  [{status}] {metric}: {detail}")
        failed |= status == "FLAG"
    return 0  # FLAG = investigasi, bukan failure (exit selalu 0; keputusan di tangan owner)


if __name__ == "__main__":
    sys.exit(main())
