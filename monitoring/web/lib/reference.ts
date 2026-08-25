// Referensi statistik backtest 6 tahun, 5 pair (2020-08..2026-08) — sumber:
// backtest/reports/research/capital_efficiency/trades_5pair_max5.csv (kriteria sukses v2, TASKS.md).
// JANGAN diubah tanpa re-run backtest.
export const BACKTEST_REFERENCE = {
  period: "2020-08 .. 2026-08 (6 tahun, 5 pair)",
  winRatePct: 40.1,
  avgWinR: 6.63,
  avgLossR: -0.91,
  avgR: 2.12,
  profitFactor: 2.48,
  maxDrawdownPct: -27.34,
  totalReturnPct: 862.42,
  trades: 147,
  tradesPerYear: 24.5, // ~1 sinyal per 15 hari lintas 5 pair
} as const;

export const EVAL_MIN_TRADES = 10; // kriteria sukses Fase 2: evaluasi hanya setelah >=10 trade tertutup
export const WIN_RATE_TOLERANCE_PP = 15; // toleransi deviasi win rate (pp)
export const AVG_R_FLOOR = 0.5; // avg R live di bawah ini = flag
export const SLIPPAGE_ASSUMPTION_PCT = 0.05; // asumsi di config.yaml
export const SLIPPAGE_ALERT_MULT = 2; // >2x asumsi = revisi sizing
