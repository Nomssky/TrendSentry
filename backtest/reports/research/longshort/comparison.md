# Riset: Long-Short vs Long-Only (Donchian 20/10 + ATR x2, funding nyata)

Periode: 2020-08-27 .. 2026-08-25
Fee 0.1% + slippage 0.05% (asumsi konservatif utk futures), funding perp nyata dibebankan ke short.

| Metrik | long_only | short_only | long_short |
|---|---|---|---|
| total_return_pct | 152.42 | -14.01 | 118.12 |
| cagr_pct | 16.71 | -2.49 | 13.9 |
| sharpe | 1.12 | -0.3 | 0.88 |
| sortino | 1.04 | -0.32 | 1.15 |
| max_drawdown_pct | -15.29 | -28.1 | -18.96 |
| n_trades | 62 | 67 | 129 |
| win_rate_pct | 41.94 | 31.34 | 36.43 |
| avg_r_multiple | 1.93 | -0.15 | 0.85 |
| profit_factor | 2.7 | 0.78 | 1.62 |
| buy_hold_return_pct | 570.78 | 570.78 | 570.78 |

Total funding yang diterima posisi short (semua konfigurasi ber-short): $-86.26