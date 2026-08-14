"""Backtest runner: jalankan strategi Donchian+ATR di data historis multi-pair.

Simulasi portfolio spot long-only, 2 posisi maks (1 per pair), eksekusi di
open hari berikutnya setelah sinyal close (anti look-ahead). Fee + slippage
dibebankan di tiap transaksi. Output: equity curve, daftar trade, dan metrik
(win rate, avg R, max drawdown, Sharpe/Sortino, vs buy-and-hold) ke reports/.
"""

import logging
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import yaml

from strategy import atr, donchian_high, donchian_low, position_size

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("run_backtest")

ROOT = Path(__file__).resolve().parent.parent
REPORTS = Path(__file__).resolve().parent / "reports"


def load_config() -> dict:
    with open(ROOT / "config.yaml") as f:
        return yaml.safe_load(f)


def load_ohlcv(symbol: str, timeframe: str) -> pd.DataFrame:
    csv = ROOT / "data" / "historical" / f"{symbol.replace('/', '_')}_{timeframe}.csv"
    df = pd.read_csv(csv, parse_dates=["date"]).set_index("date")
    df["atr"] = atr(df, 14)
    df["don_hi"] = donchian_high(df, 20)
    df["don_lo"] = donchian_low(df, 10)
    return df


def run_backtest(dfs: dict[str, pd.DataFrame], cfg: dict) -> tuple[pd.DataFrame, pd.DataFrame]:
    strat = cfg["strategy"]
    risk = cfg["risk"]
    bt = cfg["backtest"]
    fee = bt["fee_pct"] / 100.0
    slip = bt["slippage_pct"] / 100.0
    cash = bt["initial_capital_usd"]
    equity = cash
    dates = sorted(set().union(*[set(df.index) for df in dfs.values()]))
    curve: list[dict] = []
    trades: list[dict] = []
    pos = {}  # symbol -> {"units": float, "entry": float, "stop": float, "risk_amount": float}

    for d in dates:
        for symbol, df in dfs.items():
            if d not in df.index:
                continue
            i = df.index.get_loc(d)
            close = df["close"].iloc[i]
            if symbol in pos:  # cek exit: donchian exit atau kena stop
                p = pos[symbol]
                if close <= p["stop"] or close < df["don_lo"].iloc[i]:
                    proceeds = p["units"] * close * (1 - fee - slip)
                    pnl = proceeds - p["units"] * p["entry"]
                    trades.append(
                        {
                            "symbol": symbol,
                            "entry_date": p["entry_date"],
                            "exit_date": d.date(),
                            "entry": round(p["entry"], 2),
                            "exit": round(close, 2),
                            "units": round(p["units"], 6),
                            "pnl": round(pnl, 2),
                            "r_multiple": round(pnl / p["risk_amount"], 3) if p["risk_amount"] else 0.0,
                            "exit_reason": "stop_loss" if close <= p["stop"] else "donchian_exit",
                        }
                    )
                    cash += proceeds
                    del pos[symbol]
            else:  # cek entry: breakout di close kemarin -> eksekusi open hari ini
                prev = df.iloc[i - 1] if i > 0 else None
                if prev is not None and prev["close"] > prev["don_hi"] and len(pos) < risk["max_concurrent_positions"]:
                    entry_price = df["open"].iloc[i] * (1 + slip)
                    stop = prev["close"] - strat["atr_stop_multiplier"] * prev["atr"]
                    units = position_size(equity, entry_price, stop, risk["risk_per_trade_pct"])
                    cost = units * entry_price * (1 + fee)
                    if cost > cash:
                        units = (cash / (entry_price * (1 + fee))) if entry_price > 0 else 0.0
                    if units > 0:
                        cash -= cost
                        pos[symbol] = {
                            "units": units,
                            "entry": entry_price,
                            "stop": stop,
                            "risk_amount": units * (entry_price - stop),
                            "entry_date": d.date(),
                        }
            # kurangi posisi yang stop-nya terlewati di open (gap)
            if symbol in pos and df["open"].iloc[i] <= pos[symbol]["stop"]:
                p = pos[symbol]
                proceeds = p["units"] * df["open"].iloc[i] * (1 - fee - slip)
                pnl = proceeds - p["units"] * p["entry"]
                trades.append(
                    {
                        "symbol": symbol,
                        "entry_date": p["entry_date"],
                        "exit_date": d.date(),
                        "entry": round(p["entry"], 2),
                        "exit": round(df["open"].iloc[i], 2),
                        "units": round(p["units"], 6),
                        "pnl": round(pnl, 2),
                        "r_multiple": round(pnl / p["risk_amount"], 3) if p["risk_amount"] else 0.0,
                        "exit_reason": "gap_stop",
                    }
                )
                cash += proceeds
                del pos[symbol]

        mtm = cash + sum(
            p["units"] * dfs[symbol]["close"].iloc[dfs[symbol].index.get_loc(d)]
            for symbol, p in pos.items()
        )
        equity = mtm
        curve.append({"date": d, "equity": round(equity, 2)})

    return pd.DataFrame(curve).set_index("date"), pd.DataFrame(trades)


def compute_metrics(curve: pd.DataFrame, trades: pd.DataFrame, dfs: dict[str, pd.DataFrame], cfg: dict) -> dict:
    bt = cfg["backtest"]
    init = bt["initial_capital_usd"]
    total_return = curve["equity"].iloc[-1] / init - 1
    years = (curve.index[-1] - curve.index[0]).days / 365.25
    cagr = (curve["equity"].iloc[-1] / init) ** (1 / years) - 1 if years > 0 else float("nan")

    daily = curve["equity"].pct_change().dropna()
    sharpe = daily.mean() / daily.std() * (365**0.5) if daily.std() > 0 else 0.0
    downside = daily[daily < 0]
    sortino = daily.mean() / downside.std() * (365**0.5) if len(downside) > 0 and downside.std() > 0 else 0.0

    roll_max = curve["equity"].cummax()
    dd = curve["equity"] / roll_max - 1
    max_dd = dd.min()

    wins = trades[trades["pnl"] > 0]
    losses = trades[trades["pnl"] < 0]
    win_rate = len(wins) / len(trades) if len(trades) else 0.0
    avg_r = trades["r_multiple"].mean() if len(trades) else 0.0
    avg_win_r = wins["r_multiple"].mean() if len(wins) else 0.0
    avg_loss_r = losses["r_multiple"].mean() if len(losses) else 0.0
    profit_factor = wins["pnl"].sum() / abs(losses["pnl"].sum()) if len(losses) and losses["pnl"].sum() != 0 else float("inf")

    # Benchmark buy-and-hold: 50/50 modal awal, tanpa rebalancing
    bench = 0.0
    for symbol, df in dfs.items():
        start, end = df["close"].iloc[0], df["close"].iloc[-1]
        bench += (init / len(dfs)) * (end / start)
    bh_return = bench / init - 1

    return {
        "total_return_pct": round(total_return * 100, 2),
        "cagr_pct": round(cagr * 100, 2),
        "sharpe": round(sharpe, 2),
        "sortino": round(sortino, 2),
        "max_drawdown_pct": round(max_dd * 100, 2),
        "n_trades": len(trades),
        "win_rate_pct": round(win_rate * 100, 2),
        "avg_r_multiple": round(avg_r, 2),
        "avg_win_r": round(avg_win_r, 2),
        "avg_loss_r": round(avg_loss_r, 2),
        "profit_factor": round(profit_factor, 2) if profit_factor != float("inf") else None,
        "buy_hold_return_pct": round(bh_return * 100, 2),
        "final_equity": round(curve["equity"].iloc[-1], 2),
        "period_days": int(years * 365.25),
    }


def save_report(curve: pd.DataFrame, trades: pd.DataFrame, metrics: dict, dfs: dict[str, pd.DataFrame]) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    curve.to_csv(REPORTS / "equity_curve.csv")
    trades.to_csv(REPORTS / "trades.csv", index=False)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 7), sharex=True)
    ax1.plot(curve.index, curve["equity"], label="Strategy equity")
    for symbol, df in dfs.items():
        norm = df["close"] / df["close"].iloc[0] * 500
        ax1.plot(df.index, norm, "--", alpha=0.6, label=f"{symbol} B&H (scaled)")
    ax1.set_ylabel("USD")
    ax1.legend(loc="upper left")
    roll_max = curve["equity"].cummax()
    dd = (curve["equity"] / roll_max - 1) * 100
    ax2.fill_between(curve.index, dd, 0, color="red", alpha=0.4)
    ax2.set_ylabel("Drawdown %")
    fig.suptitle("Donchian 20/10 + ATR(14)x2, long-only, 1% risk")
    fig.tight_layout()
    fig.savefig(REPORTS / "equity_drawdown.png", dpi=110)

    lines = ["# Backtest Report — Donchian 20/10 + ATR(14)x2, long-only", ""]
    lines.append(f"| Metrik | Nilai |")
    lines.append(f"|---|---|")
    for k, v in metrics.items():
        lines.append(f"| {k} | {v} |")
    lines.append("")
    lines.append("Keterangan: eksekusi di open hari berikutnya setelah sinyal close (anti look-ahead), fee 0.1% + slippage 0.05% per transaksi.")
    (REPORTS / "metrics.md").write_text("\n".join(lines))


def main() -> int:
    cfg = load_config()
    dfs = {s: load_ohlcv(s, cfg["strategy"]["timeframe"]) for s in cfg["strategy"]["pairs"]}
    curve, trades = run_backtest(dfs, cfg)
    metrics = compute_metrics(curve, trades, dfs, cfg)
    save_report(curve, trades, metrics, dfs)
    for k, v in metrics.items():
        log.info("%s = %s", k, v)
    return 0


if __name__ == "__main__":
    sys.exit(main())