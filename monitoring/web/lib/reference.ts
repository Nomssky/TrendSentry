// Referensi statistik backtest 6 tahun (2020-08..2026-08) — sumber: backtest/reports/metrics.md
// Dipakai sebagai pembanding di dashboard. JANGAN diubah tanpa re-run backtest.
export const BACKTEST_REFERENCE = {
  period: "2020-08 .. 2026-08 (6 tahun)",
  winRatePct: 41.94,
  avgWinR: 6.05,
  avgLossR: -1.01,
  profitFactor: 2.71,
  sharpe: 1.06,
  maxDrawdownPct: -15.36,
  totalReturnPct: 141.17,
  trades: 62,
  tradesPerPairPerYear: 5.2, // ~62 trade / 6 tahun / 2 pair
} as const;

export const EVAL_MIN_TRADES = 10; // kriteria sukses Fase 2: evaluasi hanya setelah >=10 trade tertutup
export const WIN_RATE_TOLERANCE_PP = 15; // toleransi deviasi win rate (pp)
export const AVG_R_FLOOR = 0.5; // avg R live di bawah ini = flag
export const SLIPPAGE_ASSUMPTION_PCT = 0.05; // asumsi di config.yaml
export const SLIPPAGE_ALERT_MULT = 2; // >2x asumsi = revisi sizing
