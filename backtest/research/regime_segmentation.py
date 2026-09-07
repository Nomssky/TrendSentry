"""Regime segmentation analysis: strategy performance across bull/bear/sideways markets.

Identifikasi rezim berdasarkan BTC rolling 90-day return, lalu bandingkan strategi vs B&H
di setiap rezim. Tidak perlu fetch data baru.

Usage: source venv/bin/activate && PYTHONPATH=. python backtest/research/regime_segmentation.py
"""

import logging
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from run_backtest import run_backtest, compute_metrics, load_ohlcv, load_config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("regime_segmentation")

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "data" / "historical"
TIMEFRAME = "1d"

ALL_ORIG = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
            "AVAX/USDT", "LINK/USDT", "DOGE/USDT", "ADA/USDT", "HYPE/USDT"]

# ── Regime definition ──
# Regimes are defined by BTC's rolling 90-day return:
#   BEAR: rolling 90d return < -20%
#   BULL: rolling 90d return > +40%
#   SIDEWAYS: everything else

ROLLING_WINDOW = 90
BEAR_THRESHOLD = -0.20
BULL_THRESHOLD = 0.40


def identify_regimes(btc_close: pd.Series) -> pd.Series:
    """Return Series of 'BEAR' / 'BULL' / 'SIDEWAYS' per date, same index as input."""
    ret = btc_close.pct_change(ROLLING_WINDOW)
    regimes = pd.Series("SIDEWAYS", index=btc_close.index)
    regimes[ret <= BEAR_THRESHOLD] = "BEAR"
    regimes[ret >= BULL_THRESHOLD] = "BULL"
    # Forward-fill regime label from the FIRST date the condition is met
    # (regimes should cover from the start of the period, not just after rolling window)
    regimes = regimes.ffill().fillna("SIDEWAYS")
    return regimes


def regime_label(regime: str) -> str:
    return {"BEAR": "Bear/Crash", "BULL": "Bull Rally", "SIDEWAYS": "Sideways"}.get(regime, regime)


def compute_metrics_in_period(curve: pd.DataFrame, trades: pd.DataFrame, start: str, end: str, init_equity: float) -> dict:
    """Compute metrics for a specific date range, using equity at start as initial capital."""
    mask = (curve.index >= start) & (curve.index <= end)
    if mask.sum() < 5:
        return None
    
    seg = curve[mask].copy()
    seg_init = float(curve.loc[:start].iloc[-1]["equity"]) if start in curve.index else init_equity
    # Actually, use the first equity in the segment
    seg_init = seg["equity"].iloc[0]
    seg_final = seg["equity"].iloc[-1]
    
    total_ret = seg_final / seg_init - 1
    years = (seg.index[-1] - seg.index[0]).days / 365.25
    cagr = (seg_final / seg_init) ** (1 / years) - 1 if years > 0 and seg_init > 0 else float("nan")
    
    daily = seg["equity"].pct_change().dropna()
    sharpe = daily.mean() / daily.std() * (365**0.5) if daily.std() > 0 else 0.0
    
    roll_max = seg["equity"].cummax()
    dd = seg["equity"] / roll_max - 1
    max_dd = dd.min()
    
    # Trades in this period
    seg_trades = trades[(trades["entry_date"] >= pd.Timestamp(start).date()) &
                        (trades["exit_date"] <= pd.Timestamp(end).date())] if len(trades) else trades
    n_trades = len(seg_trades)
    
    return {
        "return_pct": round(total_ret * 100, 2),
        "sharpe": round(sharpe, 2),
        "max_dd_pct": round(max_dd * 100, 2),
        "cagr_pct": round(cagr * 100, 2) if not np.isnan(cagr) else "N/A",
        "n_trades": n_trades,
    }


def main():
    # ── Load BTC close for regime identification ──
    btc_df = pd.read_csv(DATA / "BTC_USDT_1d.csv", parse_dates=["date"]).set_index("date")
    btc_close = btc_df["close"]
    
    regimes = identify_regimes(btc_close)
    
    # Summarize regimes
    regime_dates = {}
    for reg in ["BEAR", "BULL", "SIDEWAYS"]:
        label = regime_label(reg)
        dates_in_regime = regimes[regimes == reg].index
        if len(dates_in_regime) == 0:
            continue
        # Find contiguous blocks
        date_series = pd.Series(dates_in_regime, index=dates_in_regime)
        gaps = date_series.diff() > pd.Timedelta(days=2)
        block_ids = gaps.cumsum()
        for bid in block_ids.unique():
            block = date_series[block_ids == bid]
            start = block.iloc[0]
            end = block.iloc[-1]
            dur = (end - start).days
            btc_ret_local = (btc_close.loc[end] / btc_close.loc[start] - 1) * 100 if start in btc_close.index and end in btc_close.index else 0
            regime_dates.setdefault(reg, []).append({
                "start": start, "end": end, "duration_days": dur,
                "btc_return": round(btc_ret_local, 1),
            })
    
    log.info("=== Identified Regimes ===")
    for reg, blocks in regime_dates.items():
        for b in blocks:
            log.info("%s: %s to %s (%d days, BTC ret=%.1f%%)",
                     reg, b["start"].date(), b["end"].date(), b["duration_days"], b["btc_return"])
    
    # ── Run configs ──
    cfg_base = lambda pairs, max_conc: {
        "strategy": {"pairs": pairs, "timeframe": TIMEFRAME,
                     "donchian_entry_period": 20, "donchian_exit_period": 10,
                     "atr_period": 14, "atr_stop_multiplier": 2.0, "direction": "long_only"},
        "risk": {"risk_per_trade_pct": 1.0, "max_concurrent_positions": max_conc},
        "backtest": {"initial_capital_usd": 1000, "fee_pct": 0.1, "slippage_pct": 0.05},
    }
    
    # Also: Exp A2 from correlation experiment (2 pos/cluster)
    CLUSTERS = {"A": {"BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
                      "AVAX/USDT", "LINK/USDT", "DOGE/USDT", "ADA/USDT"},
                "B": {"HYPE/USDT"}}
    
    def run_cluster_config(pairs, cfg):
        """Run backtest with 2 positions per cluster (Exp A2)."""
        from run_backtest import run_backtest as vanilla_run
        return vanilla_run({s: load_ohlcv(s, TIMEFRAME) for s in pairs}, cfg)
    
    # We'll run these configs:
    configs = [
        ("2-pair (BTC+ETH, max_conc=1)", ALL_ORIG[:2], 1, None),
        ("10-pair vanilla (max_conc=5)", ALL_ORIG, 5, None),
        ("10-pair cluster-A2 (2pos/cluster)", ALL_ORIG, 5, "cluster"),
    ]
    
    results = {}  # config_name -> { "curve": df, "trades": df, "metrics": dict }
    
    for name, pairs, max_conc, mode in configs:
        log.info("Running: %s", name)
        cfg = cfg_base(pairs, max_conc)
        if mode is None:
            dfs = {s: load_ohlcv(s, TIMEFRAME) for s in pairs}
            curve, trades = run_backtest(dfs, cfg)
        elif mode == "cluster":
            # Use cluster-aware runner
            from correlation_mitigation import run_corr_aware
            dfs = {s: load_ohlcv(s, TIMEFRAME) for s in pairs}
            curve, trades = run_corr_aware(dfs, cfg, max_per_cluster=2)
        elif mode == "risk0.5_cluster":
            from correlation_mitigation import run_corr_aware
            cfg_r = {**cfg, "risk": {**cfg["risk"], "risk_per_trade_pct": 0.5}}
            dfs = {s: load_ohlcv(s, TIMEFRAME) for s in pairs}
            curve, trades = run_corr_aware(dfs, cfg_r, max_per_cluster=1)
        metrics = compute_metrics(curve, trades, {s: load_ohlcv(s, TIMEFRAME) for s in pairs}, cfg)
        results[name] = {"curve": curve, "trades": trades, "metrics": metrics}
        log.info("  Sharpe=%s  Ret=%s%%  DD=%s%%  Trades=%s",
                 metrics["sharpe"], metrics["total_return_pct"], metrics["max_drawdown_pct"], metrics["n_trades"])
    
    # ── Buy-and-hold benchmarks ──
    def buy_hold_equal_weight(pairs):
        closes = {}
        for s in pairs:
            df = pd.read_csv(DATA / f"{s.replace('/', '_')}_{TIMEFRAME}.csv", parse_dates=["date"]).set_index("date")
            closes[s] = df["close"]
        df = pd.DataFrame(closes)
        init_per_pair = 1000.0 / len(pairs)
        units = {}
        contributions = []
        for s in pairs:
            first_valid = df[s].first_valid_index()
            units[s] = init_per_pair / df.loc[first_valid, s]
            contributions.append(df[s] * units[s])
        values = pd.concat(contributions, axis=1).sum(axis=1)
        return values.to_frame(name="equity")
    
    bh2 = buy_hold_equal_weight(ALL_ORIG[:2])
    bh10 = buy_hold_equal_weight(ALL_ORIG)
    
    # ── Segment per regime BLOCK ──
    all_segments = []
    for reg, blocks in regime_dates.items():
        for block in blocks:
            s = block["start"]
            e = block["end"]
            seg_label = f"{regime_label(reg)} ({s.date()}..{e.date()})"
            
            row = {
                "regime": regime_label(reg),
                "start": s.date(),
                "end": e.date(),
                "duration_days": block["duration_days"],
                "btc_return": block["btc_return"],
            }
            
            # BH metrics
            bh_seg = bh2 if "2-pair" in seg_label else bh10
            # Actually compute BH per segment based on which config
            for bh_label, bh_curve in [("BH 2-pair", bh2), ("BH 10-pair", bh10)]:
                m = compute_metrics_in_period(bh_curve, pd.DataFrame(), s.isoformat(), e.isoformat(), 1000)
                if m:
                    row[f"{bh_label}_ret"] = m["return_pct"]
                    row[f"{bh_label}_sharpe"] = m["sharpe"]
                    row[f"{bh_label}_dd"] = m["max_dd_pct"]
            
            # Strategy metrics per config
            for cfg_name, r in results.items():
                m = compute_metrics_in_period(r["curve"], r["trades"], s.isoformat(), e.isoformat(), 1000)
                if m:
                    row[f"{cfg_name}_ret"] = m["return_pct"]
                    row[f"{cfg_name}_sharpe"] = m["sharpe"]
                    row[f"{cfg_name}_dd"] = m["max_dd_pct"]
                    row[f"{cfg_name}_trades"] = m["n_trades"]
            
            all_segments.append(row)
    
    df_seg = pd.DataFrame(all_segments)
    log.info("\n%s", df_seg.to_string())
    
    # ── Plot equity curves with regime highlighting ──
    fig, axes = plt.subplots(3, 1, figsize=(14, 10), sharex=True)
    
    colors = {"BEAR": "#ff4444", "BULL": "#44ff44", "SIDEWAYS": "#888888"}
    
    for idx, (cfg_name, r) in enumerate(results.items()):
        ax = axes[idx]
        curve = r["curve"]
        bh = bh2 if "2-pair" in cfg_name else bh10
        
        ax.plot(curve.index, curve["equity"], label=f"Strategy: {cfg_name}", color="blue", linewidth=1.5)
        ax.plot(bh.index, bh["equity"], label="Buy & Hold (eq-weight)", color="orange", linewidth=1.5, alpha=0.7)
        
        # Highlight regimes
        for reg, blocks in regime_dates.items():
            color = colors.get(reg, "#888888")
            for blk in blocks:
                ax.axvspan(blk["start"], blk["end"], alpha=0.12, color=color, label=regime_label(reg) if idx == 0 else "")
        
        ax.set_ylabel("Equity (USD)")
        ax.legend(fontsize=8, loc="upper left")
        ax.set_title(cfg_name)
        ax.grid(alpha=0.3)
    
    # Bottom: BTC price with regimes
    axes[2].plot(btc_close.index, btc_close, color="black", linewidth=1, label="BTC Close")
    for reg, blocks in regime_dates.items():
        color = colors.get(reg, "#888888")
        for blk in blocks:
            axes[2].axvspan(blk["start"], blk["end"], alpha=0.12, color=color)
    axes[2].set_ylabel("BTC (USD)")
    axes[2].set_xlabel("Date")
    axes[2].legend(fontsize=8, loc="upper left")
    axes[2].grid(alpha=0.3)
    
    fig.suptitle("Regime Segmentation: Strategy vs Buy-and-Hold (2020-2026)", fontsize=13)
    fig.tight_layout()
    
    out_png = ROOT / "backtest" / "reports" / "regime_segmentation.png"
    fig.savefig(out_png, dpi=120)
    log.info("Chart saved: %s", out_png)
    
    # ── Write report ──
    lines = [
        "# Regime Segmentation Analysis — TrendSentry",
        "",
        "> Tanggal: 2026-09-05",
        "> Tujuan: Analisis performa strategi per rezim pasar (bear/bull/sideways)",
        ">",
        "> Definisi rezim (berdasarkan BTC rolling 90-day return):",
        f"> - **Bear/Crash:** rolling 90d return < {BEAR_THRESHOLD*100:.0f}%",
        f"> - **Bull Rally:** rolling 90d return > {BULL_THRESHOLD*100:.0f}%",
        "> - **Sideways:** sisanya",
        "",
        "---",
        "",
        "## 1. Identifikasi Rezim Pasar",
        "",
        "| Rezim | Start | End | Durasi (hari) | BTC Return % |",
        "|---|---|---|---|---|",
    ]
    for reg, blocks in regime_dates.items():
        for b in blocks:
            lines.append(f"| {regime_label(reg)} | {b['start'].date()} | {b['end'].date()} | {b['duration_days']} | {b['btc_return']} |")
    lines.append("")
    
    lines.append("## 2. Performa per Rezim — Semua Config")
    lines.append("")
    
    # Column headers
    config_names = list(results.keys())
    
    # For each regime block, print a table
    for reg_label in ["Bear/Crash", "Sideways", "Bull Rally"]:
        segs = [s for s in all_segments if s["regime"] == reg_label]
        if not segs:
            continue
        
        lines.append(f"### {reg_label}")
        lines.append("")
        header = "| Periode | BTC% | BH2 Ret% | BH2 DD% | BH2 Sharpe | BH10 Ret% | BH10 DD% | BH10 Sharpe | "
        for cn in config_names:
            short = cn[:25]
            header += f"{short} Ret% | {short} DD% | {short} Sharpe | "
        header += "|"
        lines.append(header)
        
        lines.append("|" + "---|" * (len(config_names) * 3 + 7))
        
        for s in segs:
            row = f"| {s['start']}..{s['end']} | {s['btc_return']} | "
            row += f"{s.get('BH 2-pair_ret', 'N/A')} | {s.get('BH 2-pair_dd', 'N/A')} | {s.get('BH 2-pair_sharpe', 'N/A')} | "
            row += f"{s.get('BH 10-pair_ret', 'N/A')} | {s.get('BH 10-pair_dd', 'N/A')} | {s.get('BH 10-pair_sharpe', 'N/A')} | "
            for cn in config_names:
                row += f"{s.get(f'{cn}_ret', 'N/A')} | {s.get(f'{cn}_dd', 'N/A')} | {s.get(f'{cn}_sharpe', 'N/A')} | "
            lines.append(row)
        lines.append("")
    
    # ── Overall table ──
    lines.append("## 3. Overall (seluruh periode)")
    lines.append("")
    lines.append("| Config | Return% | Sharpe | MaxDD% | Trades |")
    lines.append("|---|---|---|---|---|")
    for cn, r in results.items():
        m = r["metrics"]
        lines.append(f"| {cn} | {m['total_return_pct']} | {m['sharpe']} | {m['max_drawdown_pct']} | {m['n_trades']} |")
    lines.append("")
    
    # ── BH overall ──
    for label, bh in [("BH 2-pair", bh2), ("BH 10-pair", bh10)]:
        daily = bh["equity"].pct_change().dropna()
        sh = daily.mean() / daily.std() * (365**0.5) if daily.std() > 0 else 0.0
        ret = (bh["equity"].iloc[-1] / 1000 - 1) * 100
        lines.append(f"| {label} | {ret:.2f} | {sh:.2f} | — | — |")
    lines.append("")
    
    lines.append("## 4. Analisis: Apakah Strategi Melindungi Modal Saat Bear?")
    lines.append("")
    
    # Find bear segments
    bear_segs = [s for s in all_segments if s["regime"] == "Bear/Crash"]
    lines.append("**Periode bear yang teridentifikasi:**")
    for s in bear_segs:
        lines.append(f"- {s['start']}..{s['end']} (BTC {s['btc_return']}%):")
        for cn in config_names:
            strat_ret = s.get(f"{cn}_ret", "N/A")
            strat_dd = s.get(f"{cn}_dd", "N/A")
            bh10_ret = s.get("BH 10-pair_ret", "N/A")
            bh10_dd = s.get("BH 10-pair_dd", "N/A")
            lines.append(f"  - {cn}: return {strat_ret}%, maxDD {strat_dd}% (vs BH: {bh10_ret}%, {bh10_dd}%)")
    lines.append("")
    
    lines.append("**Kesimpulan perlindungan bear:**")
    
    # Check if strategy consistently outperforms BH during bear
    bear_outperform = []
    for s in bear_segs:
        for cn in config_names:
            strat_ret = s.get(f"{cn}_ret")
            bh_ret = s.get("BH 10-pair_ret")
            if strat_ret is not None and bh_ret is not None:
                if strat_ret > bh_ret:
                    bear_outperform.append((cn, s["start"], strat_ret, bh_ret))
    
    if bear_outperform:
        lines.append("- Strategi **unggul** dibanding buy-and-hold di beberapa periode bear berikut:")
        for cn, start, sret, bret in bear_outperform:
            lines.append(f"  - {cn} pada {start}: strategi {sret}% vs BH {bret}%")
    else:
        lines.append("- Strategi **umumnya kalah** dari buy-and-hold di periode bear karena:")
        lines.append("  1. Donchian exit (Lowest Low 10 hari) tidak cukup cepat untuk keluar sebelum crash besar —")
        lines.append("     posisi yang sudah terbuka akan ikut turun dengan pasar sampai exit terpicu.")
        lines.append("  2. Setelah exit, strategi tetap di cash dan tidak punya short mechanism — tidak bisa dapat profit dari penurunan.")
        lines.append("  3. Keunggulan Donchian adalah di recovery/bull, bukan di bear (karena bisa ikut rally setelah exit, ")
        lines.append("     tidak perlu timing bottom).")
    lines.append("")
    
    lines.append("**Perlindungan terbatas yang TETAP ada:**")
    lines.append("- ATR stop loss membatasi loss per trade (stop di entry - 2x ATR), jadi trade individu tidak akan hancur total")
    lines.append("- Gap stop (exit di open jika harga langsung gap di bawah stop) membantu untuk flash crash")
    lines.append("- Cluster limit (Exp A2) membatasi jumlah posisi terbuka simultan, mengurangi correlated drawdown")
    lines.append("")
    
    lines.append("## 5. Tabel: Di Rezim Mana Strategi Unggul/Kalah?")
    lines.append("")
    lines.append("| Config | Bull | Bear | Sideways | Kesimpulan |")
    lines.append("|---|---|---|---|---|")
    
    for cn in config_names:
        bull_wins = bear_wins = side_wins = 0
        bull_losses = bear_losses = side_losses = 0
        for s in all_segments:
            strat_ret = s.get(f"{cn}_ret")
            bh_ret = s.get("BH 10-pair_ret")
            if strat_ret is None or bh_ret is None:
                continue
            if strat_ret > bh_ret:
                if s["regime"] == "Bull Rally": bull_wins += 1
                elif s["regime"] == "Bear/Crash": bear_wins += 1
                else: side_wins += 1
            else:
                if s["regime"] == "Bull Rally": bull_losses += 1
                elif s["regime"] == "Bear/Crash": bear_losses += 1
                else: side_losses += 1
        
        bullets = []
        if bull_wins > bull_losses: bullets.append(f"✅ Bull ({bull_wins} segmen unggul)")
        else: bullets.append(f"❌ Bull ({bull_losses} segmen kalah)")
        if bear_wins > bear_losses: bullets.append(f"✅ Bear ({bear_wins} segmen unggul)")
        else: bullets.append(f"❌ Bear ({bear_losses} segmen kalah)")
        if side_wins > side_losses: bullets.append(f"✅ Sideways ({side_wins} segmen unggul)")
        else: bullets.append(f"❌ Sideways ({side_losses} segmen kalah)")
        
        lines.append(f"| {cn} | {bullets[0]} | {bullets[1]} | {bullets[2]} | {'Aman di bull, riskan di bear' if '❌ Bear' in bullets[1] else 'Relatif stabil'} |")
    lines.append("")
    
    lines.append(f"![Regime Segmentation Chart](regime_segmentation.png)")
    lines.append("")
    
    lines.append("---")
    lines.append("*Definisi rezim kuantitatif: rolling 90-day return BTC. Bear <-20%, Bull >+40%, sisanya sideways. "
                 "Data: Bitget, 2020-11-09 s.d. 2026-09-02.*")
    
    out = ROOT / "backtest" / "reports" / "regime_segmentation_analysis.md"
    out.write_text("\n".join(lines))
    print(f"\nReport written to {out}")
    print(f"Chart saved: {out_png}")


if __name__ == "__main__":
    main()
