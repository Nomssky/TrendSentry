# Backtest Report — RSI(14) 30/55 + ATR(14)x2.0, long-only

| Metrik | Nilai |
|---|---|
| total_return_pct | 5.99 |
| cagr_pct | 1.01 |
| sharpe | 0.15 |
| sortino | 0.11 |
| max_drawdown_pct | -9.13 |
| n_trades | 56 |
| win_rate_pct | 66.07 |
| avg_r_multiple | 0.12 |
| avg_win_r | 0.68 |
| avg_loss_r | -0.98 |
| profit_factor | 1.32 |
| buy_hold_return_pct | 155.03 |
| final_equity | 1059.86 |
| period_days | 2123 |

Keterangan: eksekusi di open hari berikutnya setelah sinyal close (anti look-ahead), fee 0.1% + slippage 0.05% per transaksi.

## Verdict: TIDAK LOLOS (2026-09-12, parameter beku — tanpa tuning)

- Return +5.99% << buy-and-hold +155.03% → tidak menambah value vs HODL → GAGAL.
- Sharpe 0.15 jauh di bawah Cluster-A2 0.82 → GAGAL.
- DD -9.13% < 30% dan n_trades 56 ≥ 30 → dua gate ini lolos, tapi tidak cukup.
- Profil klasik mean-reversion gagal: win rate tinggi (66%) tapi avg win kecil (+0.68R).
  Sesuai ekspektasi jujur di preset — dipublikasikan apa adanya, tanpa tuning.