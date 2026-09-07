"""Sharpe ratio comparison: strategy vs buy-and-hold, same formula.

Formula identik dari run_backtest.py:142:
    daily = curve["equity"].pct_change().dropna()
    sharpe = daily.mean() / daily.std() * (365**0.5)
    risk-free rate = 0, annualized sqrt(365)

Usage: source venv/bin/activate && PYTHONPATH=. python backtest/research/sharpe_benchmark.py
"""

import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from run_backtest import load_ohlcv

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("sharpe_benchmark")

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "data" / "historical"
TIMEFRAME = "1d"

ALL_ORIG = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
            "AVAX/USDT", "LINK/USDT", "DOGE/USDT", "ADA/USDT", "HYPE/USDT"]

STRAT_2PAIR_SHARPE = 0.94   # from portfolio_size_experiment: 2-pair max_conc=1
STRAT_10PAIR_SHARPE = 0.53  # from portfolio_size_experiment: 10-pair max_conc=5


def sharpe_from_close_series(close: pd.Series) -> float:
    """Hitungan Sharpe dari daily return series — formula identik run_backtest.py:142."""
    daily = close.pct_change().dropna()
    if daily.std() <= 0:
        return 0.0
    return daily.mean() / daily.std() * (365 ** 0.5)


def buy_hold_equal_weight(pairs: list[str]) -> pd.DataFrame:
    """Simulasi buy-and-hold portfolio equal-weight, rebalance awal saja (no rebalancing periodik).
    
    Setiap pair di-investasikan pada tanggal pertama data tersedia (bukan dari tanggal seragam),
    sehingga pair yang baru listing (HYPE, ADA) tidak memotong periode portfolio.
    Cash sebelum pair tersedia = 0 kontribusi.
    
    Mirip cara strategy backtest: hanya masuk saat data ada.
    """
    closes = {}
    for s in pairs:
        csv = DATA / f"{s.replace('/', '_')}_{TIMEFRAME}.csv"
        df = pd.read_csv(csv, parse_dates=["date"]).set_index("date")
        closes[s] = df["close"]
    
    df = pd.DataFrame(closes)  # outer join implicit
    init_per_pair = 1000.0 / len(pairs)
    
    # Units = init_per_pair / first_close per pair (masing-masing di first date-nya sendiri)
    units = {}
    contributions = []
    for s in pairs:
        first_valid = df[s].first_valid_index()
        units[s] = init_per_pair / df.loc[first_valid, s]
        # Contribution series: 0 before first_valid, units * close after
        contrib = df[s] * units[s]
        contributions.append(contrib)
    
    values = pd.concat(contributions, axis=1).sum(axis=1)
    return values.to_frame(name="equity")


def buy_hold_single(symbol: str) -> pd.DataFrame:
    """Buy-and-hold single asset, $1000 initial."""
    csv = DATA / f"{symbol.replace('/', '_')}_{TIMEFRAME}.csv"
    df = pd.read_csv(csv, parse_dates=["date"]).set_index("date")
    values = df["close"] / df["close"].iloc[0] * 1000
    return values.to_frame(name="equity")


def main():
    results = []
    
    # ── 1. Buy-and-hold 2-pair (BTC+ETH) ──
    log.info("=== Buy-and-Hold: 2-pair ===")
    bh2 = buy_hold_equal_weight(ALL_ORIG[:2])
    sh2 = sharpe_from_close_series(bh2["equity"])
    ret2 = (bh2["equity"].iloc[-1] / 1000 - 1) * 100
    log.info("BH 2-pair: Sharpe=%.2f  Return=%.2f%%", sh2, ret2)
    
    # ── 2. Buy-and-hold 10-pair ──
    log.info("=== Buy-and-Hold: 10-pair ===")
    bh10 = buy_hold_equal_weight(ALL_ORIG)
    sh10 = sharpe_from_close_series(bh10["equity"])
    ret10 = (bh10["equity"].iloc[-1] / 1000 - 1) * 100
    log.info("BH 10-pair: Sharpe=%.2f  Return=%.2f%%", sh10, ret10)
    
    # ── 3. Buy-and-hold BTC only ──
    log.info("=== Buy-and-Hold: BTC only ===")
    btc = buy_hold_single("BTC/USDT")
    sh_btc = sharpe_from_close_series(btc["equity"])
    ret_btc = (btc["equity"].iloc[-1] / 1000 - 1) * 100
    log.info("BH BTC: Sharpe=%.2f  Return=%.2f%%", sh_btc, ret_btc)
    
    # ── 4. T-test: apakah selisih Sharpe strategi vs BH signifikan? ──
    # Kita perlu daily return series dari STRATEGI untuk 2-pair dan 10-pair
    # Re-run strategy for 2-pair (BTC+ETH, max_conc=1)
    log.info("=== Re-run strategy 2-pair for daily returns ===")
    from run_backtest import run_backtest, compute_metrics
    cfg2 = {
        "strategy": {"pairs": ALL_ORIG[:2], "timeframe": TIMEFRAME,
                     "donchian_entry_period": 20, "donchian_exit_period": 10,
                     "atr_period": 14, "atr_stop_multiplier": 2.0,
                     "direction": "long_only"},
        "risk": {"risk_per_trade_pct": 1.0, "max_concurrent_positions": 1},
        "backtest": {"initial_capital_usd": 1000, "fee_pct": 0.1, "slippage_pct": 0.05},
    }
    dfs2 = {s: load_ohlcv(s, TIMEFRAME) for s in ALL_ORIG[:2]}
    curve2, trades2 = run_backtest(dfs2, cfg2)
    strat2_ret = curve2["equity"].pct_change().dropna()
    
    log.info("=== Re-run strategy 10-pair for daily returns ===")
    cfg10 = {
        "strategy": {"pairs": ALL_ORIG, "timeframe": TIMEFRAME,
                     "donchian_entry_period": 20, "donchian_exit_period": 10,
                     "atr_period": 14, "atr_stop_multiplier": 2.0,
                     "direction": "long_only"},
        "risk": {"risk_per_trade_pct": 1.0, "max_concurrent_positions": 5},
        "backtest": {"initial_capital_usd": 1000, "fee_pct": 0.1, "slippage_pct": 0.05},
    }
    dfs10 = {s: load_ohlcv(s, TIMEFRAME) for s in ALL_ORIG}
    curve10, trades10 = run_backtest(dfs10, cfg10)
    strat10_ret = curve10["equity"].pct_change().dropna()
    
    # T-test: paired t-test on aligned daily returns
    bh2_ret = bh2["equity"].pct_change().dropna()
    bh10_ret = bh10["equity"].pct_change().dropna()
    btc_ret = btc["equity"].pct_change().dropna()
    
    # Align indices
    common2 = strat2_ret.index.intersection(bh2_ret.index)
    common10 = strat10_ret.index.intersection(bh10_ret.index)
    common_btc = strat10_ret.index.intersection(btc_ret.index)
    
    # Paired t-test: difference in MEAN daily return
    t2 = stats.ttest_rel(strat2_ret.loc[common2], bh2_ret.loc[common2])
    t10 = stats.ttest_rel(strat10_ret.loc[common10], bh10_ret.loc[common10])
    # For BTC: just report BH's Sharpe on its own
    
    # ── 5. Write report ──
    lines = [
        "# Sharpe Benchmark Comparison — Strategy vs Buy-and-Hold",
        "",
        "> Tanggal: 2026-09-05",
        "> Formula identik untuk semua perhitungan (run_backtest.py:142):",
        "> ```",
        "> daily = equity_series.pct_change().dropna()",
        "> sharpe = daily.mean() / daily.std() * sqrt(365)",
        "> ```",
        "> Risk-free rate = 0, annualized dengan sqrt(365).",
        "",
        "---",
        "",
        "## 1. Tabel Perbandingan",
        "",
        "| Config | Sharpe Strategi | Sharpe Buy-and-Hold | Return Strategi | Return B&H | Selisih Sharpe | Strategi > B&H? |",
        "|---|---|---|---|---|---|---|",
        f"| 2-pair (BTC+ETH) | {STRAT_2PAIR_SHARPE} | {sh2:.2f} | 38.05% | {ret2:.2f}% | {STRAT_2PAIR_SHARPE - sh2:.2f} | {'Ya' if STRAT_2PAIR_SHARPE > sh2 else 'Tidak'} |",
        f"| 10-pair (all) | {STRAT_10PAIR_SHARPE} | {sh10:.2f} | 155.82% | {ret10:.2f}% | {STRAT_10PAIR_SHARPE - sh10:.2f} | {'Ya' if STRAT_10PAIR_SHARPE > sh10 else 'Tidak'} |",
        f"| BTC only | — | {sh_btc:.2f} | — | {ret_btc:.2f}% | — | — |",
        "",
        "## 2. Detail Buy-and-Hold Sharpe",
        "",
        f"| Pair Set | Daily Mean Return | Daily Std Dev | Non-Annualized Sharpe | Annualized (sqrt365) |",
        f"|---|---|---|---|",
        f"| 2-pair EQW | {bh2_ret.mean():.6f} | {bh2_ret.std():.6f} | {bh2_ret.mean()/bh2_ret.std():.4f} | {sh2:.2f} |",
        f"| 10-pair EQW | {bh10_ret.mean():.6f} | {bh10_ret.std():.6f} | {bh10_ret.mean()/bh10_ret.std():.4f} | {sh10:.2f} |",
        f"| BTC only | {btc_ret.mean():.6f} | {btc_ret.std():.6f} | {btc_ret.mean()/btc_ret.std():.4f} | {sh_btc:.2f} |",
        "",
        "## 3. Uji Signifikansi (Paired t-test: daily return strategi vs B&H)",
        "",
        f"| Config | t-statistic | p-value | Mean diff (strat - bh) | Signifikan (p<0.05)? |",
        f"|---|---|---|---|",
    ]
    
    # Diff stats
    strat2_minus_bh2 = strat2_ret.loc[common2] - bh2_ret.loc[common2]
    strat10_minus_bh10 = strat10_ret.loc[common10] - bh10_ret.loc[common10]
    
    t2_mean = strat2_minus_bh2.mean()
    t10_mean = strat10_minus_bh10.mean()
    
    lines.append(f"| 2-pair | {t2.statistic:.3f} | {t2.pvalue:.4f} | {t2_mean:.6f} | {'Ya' if t2.pvalue < 0.05 else 'Tidak'} |")
    lines.append(f"| 10-pair | {t10.statistic:.3f} | {t10.pvalue:.4f} | {t10_mean:.6f} | {'Ya' if t10.pvalue < 0.05 else 'Tidak'} |")
    lines.append("")
    
    lines.append(f"**Interpretasi t-test:**")
    lines.append(f"- 2-pair: {'perbedaan mean return strategi vs B&H signifikan' if t2.pvalue < 0.05 else 'perbedaan mean return TIDAK signifikan'} "
                 f"(p={t2.pvalue:.4f}). Selisih harian rata-rata {t2_mean:.6f}.")
    lines.append(f"- 10-pair: {'perbedaan mean return strategi vs B&H signifikan' if t10.pvalue < 0.05 else 'perbedaan mean return TIDAK signifikan'} "
                 f"(p={t10.pvalue:.4f}). Selisih harian rata-rata {t10_mean:.6f}.")
    lines.append("")
    
    lines.append("## 4. Jawaban untuk Threshold RULES.md (Sharpe >= 1.0)")
    lines.append("")
    
    lines.append(f"**Buy-and-hold Sharpe ratios di pasar crypto (2020-2026):**")
    lines.append(f"- BTC only: {sh_btc:.2f}")
    lines.append(f"- 2-pair equal-weight (BTC+ETH): {sh2:.2f}")
    lines.append(f"- 10-pair equal-weight: {sh10:.2f}")
    lines.append("")
    
    all_sharpe_above_1 = sh_btc >= 1.0 or sh2 >= 1.0 or sh10 >= 1.0
    best_bh = max(sh_btc, sh2, sh10)
    
    lines.append(f"**Apakah Sharpe buy-and-hold crypto di atas 1.0?**")
    if best_bh >= 1.0:
        lines.append(f"- Ya — setidaknya satu varian B&H mencapai Sharpe >= 1.0 ({best_bh:.2f}).")
    else:
        lines.append(f"- **Tidak** — semua varian B&H di bawah 1.0. Tertinggi {best_bh:.2f}.")
    
    lines.append(f"- BTC only: {sh_btc:.2f} {'>=1.0' if sh_btc >= 1.0 else '<1.0'}")
    lines.append(f"- Artinya: threshold Sharpe >= 1.0 di RULES.md adalah **{'realistis' if best_bh >= 1.0 else 'sangat agresif'}** "
                 f"untuk pasar crypto pada periode ini.")
    lines.append("")
    
    if sh_btc >= 1.0:
        lines.append("BTC buy-and-hold sendiri sudah mencapai Sharpe >=1.0, jadi ekspektasi Sharpe >=1.0 untuk strategi aktif ")
        lines.append("bukan tidak masuk akal — strategi harus outperform aset paling likuid di benchmark yang sama.")
    else:
        lines.append("Jika aset paling blue-chip (BTC) sekalipun tidak mencapai Sharpe 1.0, maka threshold 1.0 mungkin terlalu tinggi. ")
        lines.append("Alternatif: Sharpe strategi > Sharpe buy-and-hold counterpart sebagai ukuran value-add yang lebih realistis.")
    
    lines.append("")
    lines.append(f"**Rekomendasi:** gunakan Sharpe strategi vs buy-and-hold yang SEBANDING sebagai benchmark, bukan angka absolut 1.0. "
                 f"Strategi 2-pair menghasilkan Sharpe {STRAT_2PAIR_SHARPE} vs B&H {sh2:.2f} — selisih {STRAT_2PAIR_SHARPE - sh2:.2f} — "
                 f"{'signifikan secara statistik' if t2.pvalue<0.05 else 'tidak signifikan secara statistik'}. "
                 f"Strategi 10-pair menghasilkan Sharpe {STRAT_10PAIR_SHARPE} vs B&H {sh10:.2f} — selisih {STRAT_10PAIR_SHARPE - sh10:.2f} — "
                 f"{'signifikan secara statistik' if t10.pvalue<0.05 else 'tidak signifikan secara statistik'}.")
    
    lines.append("")
    lines.append("---")
    lines.append(f"*Semua data: Bitget (existing 10 pair) + periode 2020-11-09 s.d. 2026-09-02. "
                 f"Formula Sharpe identik dengan run_backtest.py:142 (risk-free=0, sqrt(365)). "
                 f"Buy-and-hold = equal-weight, hold sampai akhir tanpa rebalancing.*")
    
    out = ROOT / "backtest" / "reports" / "sharpe_benchmark_comparison.md"
    out.write_text("\n".join(lines))
    print(f"\nReport written to {out}")
    
    # Console summary
    print("\n" + "=" * 60)
    print("SHARPE BENCHMARK SUMMARY")
    print("=" * 60)
    print(f"{'Config':25s} {'Sharpe Strat':12s} {'Sharpe B&H':12s} {'Return':10s}")
    print("-" * 60)
    print(f"{'2-pair':25s} {STRAT_2PAIR_SHARPE:<12.2f} {sh2:<12.2f} {ret2:>8.2f}%")
    print(f"{'10-pair':25s} {STRAT_10PAIR_SHARPE:<12.2f} {sh10:<12.2f} {ret10:>8.2f}%")
    print(f"{'BTC only':25s} {'N/A':12s} {sh_btc:<12.2f} {ret_btc:>8.2f}%")
    print("-" * 60)
    print(f"Best B&H Sharpe: {best_bh:.2f}")
    print(f"Threshold >=1.0 {'REALISTIS' if best_bh >= 1.0 else 'TERLALU TINGGI'}")
    print()
    print("Paired t-test:")
    print(f"  2-pair:  t={t2.statistic:.3f}  p={t2.pvalue:.4f}  {'signifikan' if t2.pvalue<0.05 else 'tidak signifikan'}")
    print(f"  10-pair: t={t10.statistic:.3f}  p={t10.pvalue:.4f}  {'signifikan' if t10.pvalue<0.05 else 'tidak signifikan'}")


if __name__ == "__main__":
    main()
