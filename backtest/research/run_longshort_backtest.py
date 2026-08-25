"""RISET (tidak dipakai paper trading): long-short vs long-only vs short-only.

Strategi simetris Turtle: short entry = close < lowest low 20-hari (sebelumnya),
exit = close > highest high 10-hari ATAU stop di entry + 2xATR. Sizing 1% risk,
leverage 1x (cap equity). Biaya funding perp Binance yang NYATA dibebankan ke
posisi short tiap hari (rate positif = short TERIMA, negatif = short BAYAR).

Output: backtest/reports/research/longshort/ (perbandingan 3 konfigurasi + chart).
Engine Fase 1 (run_backtest.py) tidak disentuh — paper trading bergantung padanya.
"""

import logging
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "backtest"))
from run_backtest import compute_metrics, load_config, load_ohlcv  # noqa: E402
from strategy import position_size  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("longshort")

OUT = Path(__file__).resolve().parent.parent / "reports" / "research" / "longshort"
FUNDING_DIR = ROOT / "data" / "funding"


def position_size_short(equity: float, entry_price: float, stop_price: float, risk_pct: float) -> float:
    """Mirror position_size untuk short: stop di ATAS entry. Cap 1x equity."""
    if entry_price <= 0 or stop_price <= entry_price:
        raise ValueError(f"invalid short stop: entry={entry_price}, stop={stop_price}")
    risk_amount = equity * risk_pct / 100.0
    units = risk_amount / (stop_price - entry_price)
    return min(units, equity / entry_price)


def selfcheck() -> None:
    # sizing short: 1% dari 1000 = 10, stop distance 2 -> 5 unit; cap 10 unit tidak aktif
    assert abs(position_size_short(1000, 100, 102, 1.0) - 5.0) < 1e-9
    assert abs(position_size_short(1000, 100, 101, 10.0) - 10.0) < 1e-9  # cap equity
    for bad in [(100, 100), (100, 90)]:
        try:
            position_size_short(1000, bad[0], bad[1], 1.0)
            raise AssertionError("harusnya raise")
        except ValueError:
            pass
    log.info("selfcheck OK")


def load_funding(symbol: str) -> pd.Series:
    csv = FUNDING_DIR / f"{symbol.replace('/', '')}_daily.csv"
    df = pd.read_csv(csv, parse_dates=["date"]).set_index("date")
    return df["daily_rate"]


def run_two_sided(dfs: dict, cfg: dict, allow_long: bool, allow_short: bool) -> tuple[pd.DataFrame, pd.DataFrame]:
    strat, risk, bt = cfg["strategy"], cfg["risk"], cfg["backtest"]
    fee, slip = bt["fee_pct"] / 100.0, bt["slippage_pct"] / 100.0
    cash = float(bt["initial_capital_usd"])
    equity = cash  # sizing pakai TOTAL equity (cash + MTM posisi), konsisten dgn engine Fase 1
    dates = sorted(set().union(*[set(df.index) for df in dfs.values()]))
    curve, trades = [], []
    funding_by_symbol = {s: load_funding(s) for s in dfs}
    pos = {}  # symbol -> dict(units, entry, stop, risk_amount, entry_date, funding_paid)

    for d in dates:
        for symbol, df in dfs.items():
            if d not in df.index:
                continue
            i = df.index.get_loc(d)
            close = df["close"].iloc[i]
            if symbol in pos:
                p = pos[symbol]
                exit_price, reason = None, None
                if p["side"] == "short":
                    if close >= p["stop"]:
                        exit_price, reason = close, "stop_loss"
                    elif close > df["don_hi"].iloc[i]:
                        exit_price, reason = close, "donchian_exit"
                else:  # long
                    if close <= p["stop"]:
                        exit_price, reason = close, "stop_loss"
                    elif close < df["don_lo"].iloc[i]:
                        exit_price, reason = close, "donchian_exit"
                if exit_price is not None:
                    if p["side"] == "short":  # collateral balik + gross pnl, fee hanya di leg exit
                        proceeds = p["units"] * (2 * p["entry"] - exit_price) - p["units"] * exit_price * fee
                    else:
                        proceeds = p["units"] * exit_price * (1 - fee - slip)
                    pnl = proceeds - p["units"] * p["entry"] - p["funding_paid"]
                    trades.append({
                        "symbol": symbol, "side": p["side"], "entry_date": p["entry_date"], "exit_date": d.date(),
                        "entry": round(p["entry"], 2), "exit": round(exit_price, 2),
                        "units": round(p["units"], 6), "funding": round(p["funding_paid"], 2),
                        "pnl": round(pnl, 2),
                        "r_multiple": round(pnl / p["risk_amount"], 3) if p["risk_amount"] else 0.0,
                        "exit_reason": reason,
                    })
                    cash += proceeds
                    del pos[symbol]
            else:
                prev = df.iloc[i - 1] if i > 0 else None
                if prev is not None and len(pos) < risk["max_concurrent_positions"] and not pd.isna(prev["atr"]):
                    entry_long = allow_long and prev["close"] > prev["don_hi"]
                    entry_short = allow_short and prev["close"] < prev["don_lo"]
                    if entry_long or entry_short:
                        if entry_long:
                            entry_price = df["open"].iloc[i] * (1 + slip)
                            stop = prev["close"] - strat["atr_stop_multiplier"] * prev["atr"]
                            units = position_size(equity, entry_price, stop, risk["risk_per_trade_pct"])
                            side = "long"
                        else:
                            entry_price = df["open"].iloc[i] * (1 - slip)  # jual ke bid
                            stop = prev["close"] + strat["atr_stop_multiplier"] * prev["atr"]
                            units = position_size_short(equity, entry_price, stop, risk["risk_per_trade_pct"])
                            side = "short"
                        if units > 0:
                            cost = units * entry_price * (1 + fee)
                            cash -= cost
                            pos[symbol] = {
                                "side": side, "units": units, "entry": entry_price, "stop": stop,
                                "risk_amount": units * abs(entry_price - stop),
                                "entry_date": d.date(), "funding_paid": 0.0,
                            }
            # funding harian untuk posisi short (rate positif -> short terima -> funding_paid negatif)
            if symbol in pos and pos[symbol]["side"] == "short":
                rate = funding_by_symbol[symbol].get(d, 0.0)
                notional = pos[symbol]["units"] * close
                pos[symbol]["funding_paid"] += -notional * rate
            # gap stop di open (mirip engine)
            if symbol in pos and (
                (pos[symbol]["side"] == "long" and df["open"].iloc[i] <= pos[symbol]["stop"])
                or (pos[symbol]["side"] == "short" and df["open"].iloc[i] >= pos[symbol]["stop"])
            ):
                p = pos[symbol]
                exit_price = df["open"].iloc[i]
                if p["side"] == "short":
                    proceeds = p["units"] * (2 * p["entry"] - exit_price) - p["units"] * exit_price * fee
                else:
                    proceeds = p["units"] * exit_price * (1 - fee - slip)
                pnl = proceeds - p["units"] * p["entry"] - p["funding_paid"]
                trades.append({
                    "symbol": symbol, "side": p["side"], "entry_date": p["entry_date"], "exit_date": d.date(),
                    "entry": round(p["entry"], 2), "exit": round(exit_price, 2),
                    "units": round(p["units"], 6), "funding": round(p["funding_paid"], 2),
                    "pnl": round(pnl, 2),
                    "r_multiple": round(pnl / p["risk_amount"], 3) if p["risk_amount"] else 0.0,
                    "exit_reason": "gap_stop",
                })
                cash += proceeds
                del pos[symbol]

        mtm = cash + sum(
            (p["units"] * (2 * p["entry"] - dfs[s]["close"].iloc[dfs[s].index.get_loc(d)]) if p["side"] == "short"
             else p["units"] * dfs[s]["close"].iloc[dfs[s].index.get_loc(d)])
            for s, p in pos.items()
        )
        equity = mtm
        curve.append({"date": d, "equity": round(mtm, 2), "deployed_usd": round(
            sum(p["units"] * dfs[s]["close"].iloc[dfs[s].index.get_loc(d)] for s, p in pos.items()), 2)})

    return pd.DataFrame(curve).set_index("date"), pd.DataFrame(trades)


def main() -> int:
    selfcheck()
    cfg = load_config()
    dfs = {s: load_ohlcv(s, cfg["strategy"]["timeframe"]) for s in ["BTC/USDT", "ETH/USDT"]}
    OUT.mkdir(parents=True, exist_ok=True)

    configs = {
        "long_only": (True, False),
        "short_only": (False, True),
        "long_short": (True, True),
    }
    results = {}
    for name, (al, as_) in configs.items():
        curve, trades = run_two_sided(dfs, cfg, al, as_)
        metrics = compute_metrics(curve, trades, dfs, cfg)
        results[name] = {"curve": curve, "trades": trades, "metrics": metrics}
        curve.to_csv(OUT / f"curve_{name}.csv")
        trades.to_csv(OUT / f"trades_{name}.csv", index=False)
        log.info("[%s] return=%.1f%% sharpe=%.2f dd=%.1f%% trades=%d", name,
                 metrics["total_return_pct"], metrics["sharpe"], metrics["max_drawdown_pct"], metrics["n_trades"])

    # Tabel perbandingan
    keys = ["total_return_pct", "cagr_pct", "sharpe", "sortino", "max_drawdown_pct", "n_trades",
            "win_rate_pct", "avg_r_multiple", "profit_factor", "buy_hold_return_pct"]
    lines = ["# Riset: Long-Short vs Long-Only (Donchian 20/10 + ATR x2, funding nyata)", "",
             f"Periode: {results['long_only']['curve'].index[0].date()} .. {results['long_only']['curve'].index[-1].date()}",
             "Fee 0.1% + slippage 0.05% (asumsi konservatif utk futures), funding perp nyata dibebankan ke short.", ""]
    lines.append("| Metrik | " + " | ".join(configs) + " |")
    lines.append("|---|" + "---|" * len(configs))
    for k in keys:
        row = []
        for name in configs:
            v = results[name]["metrics"].get(k)
            row.append("∞" if v is None else f"{v}")
        lines.append(f"| {k} | " + " | ".join(row) + " |")
    total_funding_short = sum(
        results[n]["trades"]["funding"].sum() for n in configs if "short" in n and not results[n]["trades"].empty
    )
    lines.append("")
    lines.append(f"Total funding yang diterima posisi short (semua konfigurasi ber-short): ${total_funding_short:,.2f}")
    (OUT / "comparison.md").write_text("\n".join(lines))

    fig, ax = plt.subplots(figsize=(11, 5))
    for name in configs:
        ax.plot(results[name]["curve"].index, results[name]["curve"]["equity"], label=name, lw=1.4)
    ax.legend()
    ax.set_ylabel("USD")
    ax.set_title("Long-only vs Short-only vs Long-Short (modal $1000)")
    fig.tight_layout()
    fig.savefig(OUT / "comparison.png", dpi=110)
    log.info("laporan -> %s", OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
