"""RISET: capital efficiency — seberapa sering modal idle, dan cara sah untuk memakainya.

1. Deployment historis (2 pair, baseline): rata-rata/max % modal yang terpakai
2. Yield di idle cash: skenario 0/5/8% APY pada cash (approximation tanpa feedback compounding ke sizing)
3. Tambah pair (SOL/BNB/XRP): re-backtest long-only 5 pair, max_concurrent 2/3/5
4. Korelasi antar pair (diversifikasi nyata atau ilusi?)
Output: backtest/reports/research/capital_efficiency/
"""

import logging
import sys
from copy import deepcopy
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "backtest"))
from run_backtest import compute_metrics, load_config, load_ohlcv, run_backtest  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("capeff")

OUT = Path(__file__).resolve().parent.parent / "reports" / "research" / "capital_efficiency"
BASE_PAIRS = ["BTC/USDT", "ETH/USDT"]
EXTRA_PAIRS = ["SOL/USDT", "BNB/USDT", "XRP/USDT"]


def add_yield(curve: pd.DataFrame, apy_pct: float) -> pd.Series:
    """Interest harian di cash (equity - deployed). Aproksimasi: sizing tidak di-feedback ulang."""
    cash = (curve["equity"] - curve["deployed_usd"]).clip(lower=0)
    daily_rate = apy_pct / 100.0 / 365.0
    interest = cash * daily_rate
    return (curve["equity"] + interest.cumsum()).round(2)


def deployment_stats(curve: pd.DataFrame) -> dict:
    dep_pct = curve["deployed_usd"] / curve["equity"] * 100
    return {
        "avg_deployment_pct": round(dep_pct.mean(), 1),
        "max_deployment_pct": round(dep_pct.max(), 1),
        "days_fully_cash_pct": round((curve["deployed_usd"] == 0).mean() * 100, 1),
    }


def metrics_row(name: str, curve: pd.DataFrame, trades: pd.DataFrame, dfs: dict, cfg: dict, apy: float = 0.0) -> dict:
    if apy > 0:
        c = curve.copy()
        c["equity"] = add_yield(curve, apy)
    else:
        c = curve
    m = compute_metrics(c, trades, dfs, cfg)
    dep = deployment_stats(curve)
    return {"config": name, **{k: m[k] for k in ["total_return_pct", "cagr_pct", "sharpe", "max_drawdown_pct", "n_trades"]},
            "avg_deploy_pct": dep["avg_deployment_pct"], "days_cash_pct": dep["days_fully_cash_pct"]}


def main() -> int:
    cfg = load_config()
    OUT.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []

    # --- Baseline 2 pair ---
    dfs2 = {s: load_ohlcv(s, cfg["strategy"]["timeframe"]) for s in BASE_PAIRS}
    curve2, trades2 = run_backtest(dfs2, cfg)
    rows.append(metrics_row("2 pair, max 2 (baseline)", curve2, trades2, dfs2, cfg))

    # --- Yield di idle cash (baseline) ---
    for apy in (5.0, 8.0):
        rows.append(metrics_row(f"2 pair + yield {apy:.0f}% APY", curve2, trades2, dfs2, cfg, apy=apy))

    # --- 5 pair ---
    dfs5 = {**dfs2, **{s: load_ohlcv(s, cfg["strategy"]["timeframe"]) for s in EXTRA_PAIRS}}
    for maxpos in (3, 5):
        cfg_n = deepcopy(cfg)
        cfg_n["risk"]["max_concurrent_positions"] = maxpos
        curve5, trades5 = run_backtest(dfs5, cfg_n)
        rows.append(metrics_row(f"5 pair, max {maxpos}", curve5, trades5, dfs5, cfg_n))
        if maxpos == 5:
            rows.append(metrics_row("5 pair, max 5 + yield 8% APY", curve5, trades5, dfs5, cfg_n, apy=8.0))
            curve5.to_csv(OUT / "curve_5pair.csv")

    # --- Korelasi harian antar pair ---
    rets = pd.concat({s: df["close"].pct_change() for s, df in dfs5.items()}, axis=1).dropna()
    corr = rets.corr().round(2)
    tri = [corr.iloc[i, j] for i in range(len(corr)) for j in range(i + 1, len(corr))]
    avg_corr = sum(tri) / len(tri)

    # --- Laporan ---
    lines = ["# Riset: Capital Efficiency", "",
             f"Periode: {curve2.index[0].date()} .. {curve2.index[-1].date()} · modal awal $1000 · long-only · risk 1%",
             "", "| Konfigurasi | Return % | CAGR % | Sharpe | MaxDD % | Trades | Avg deploy % | Hari full-cash % |",
             "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['config']} | {r['total_return_pct']} | {r['cagr_pct']} | {r['sharpe']} | "
                     f"{r['max_drawdown_pct']} | {r['n_trades']} | {r['avg_deploy_pct']} | {r['days_cash_pct']} |")
    lines += ["", f"**Korelasi rata-rata return harian antar 5 pair: {avg_corr:.2f}** (0=diversifikasi sempurna, 1=satu aset saja)", "",
              "Catatan: yield = interest harian di cash, aproksimasi tanpa feedback compounding ke sizing; ",
              "risiko platform earn/stable TIDAK dimodelkan di sini."]
    (OUT / "comparison.md").write_text("\n".join(lines))

    # Chart deployment: baseline vs 5 pair
    fig, ax = plt.subplots(figsize=(11, 4.5))
    ax.fill_between(curve2.index, curve2["deployed_usd"] / curve2["equity"] * 100, alpha=0.4, label="2 pair")
    ax.fill_between(curve5.index, curve5["deployed_usd"] / curve5["equity"] * 100, alpha=0.4, label="5 pair, max 5")
    ax.set_ylabel("Deployment %")
    ax.legend()
    ax.set_title("Modal terpakai per hari")
    fig.tight_layout()
    fig.savefig(OUT / "deployment.png", dpi=110)

    for r in rows:
        log.info("%s: return=%.1f%% sharpe=%.2f deploy=%.0f%%", r["config"], r["total_return_pct"], r["sharpe"], r["avg_deploy_pct"])
    log.info("avg korelasi antar pair: %.2f", avg_corr)
    log.info("laporan -> %s", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
