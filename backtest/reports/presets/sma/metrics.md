# Backtest Report — SMA 20/50 + ATR(14)x2.0, long-only

| Metrik | Nilai |
|---|---|
| total_return_pct | 41.17 |
| cagr_pct | 6.11 |
| sharpe | 0.35 |
| sortino | 0.42 |
| max_drawdown_pct | -53.21 |
| n_trades | 58 |
| win_rate_pct | 31.03 |
| avg_r_multiple | 0.56 |
| avg_win_r | 3.83 |
| avg_loss_r | -0.92 |
| profit_factor | 1.8 |
| buy_hold_return_pct | 155.03 |
| final_equity | 1411.72 |
| period_days | 2123 |

Keterangan: eksekusi di open hari berikutnya setelah sinyal close (anti look-ahead), fee 0.1% + slippage 0.05% per transaksi.

## Verdict: TIDAK LOLOS (2026-09-12, parameter beku — tanpa tuning)

- Max drawdown -53.21% > batas 30% → GAGAL.
- Return +41.17% << buy-and-hold +155.03% → tidak menambah value vs HODL → GAGAL.
- n_trades 58 ≥ 30 → sampel cukup (satu-satunya gate yang lolos).
- Kesimpulan: SMA 20/50 long-only kalah telak oleh whipsaw di data ini.
  Sesuai aturan beku parameter, TIDAK ada tuning — preset dipublikasikan apa adanya.