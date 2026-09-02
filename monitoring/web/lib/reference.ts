// Referensi statistik backtest 6 tahun, 10 pair Bitget (2020-11..2026-09) — sumber:
// backtest/run_backtest.py dengan data Bitget OHLCV.
// JANGAN diubah tanpa re-run backtest.
export const BACKTEST_REFERENCE = {
  period: "2020-11 .. 2026-09 (6 tahun, 10 pair Bitget)",
  winRatePct: 33.72,
  avgWinR: 3.59,
  avgLossR: -0.89,
  avgR: 0.62,
  profitFactor: 1.68,
  maxDrawdownPct: -58.49,
  totalReturnPct: 155.56,
  trades: 172,
  tradesPerYear: 28.7, // ~1 sinyal per 12 hari lintas 10 pair
} as const;

export const EVAL_MIN_TRADES = 10; // kriteria sukses Fase 2: evaluasi hanya setelah >=10 trade tertutup
export const WIN_RATE_TOLERANCE_PP = 15; // toleransi deviasi win rate (pp)
export const AVG_R_FLOOR = 0.5; // avg R live di bawah ini = flag
export const SLIPPAGE_ASSUMPTION_PCT = 0.05; // asumsi di config.yaml
export const SLIPPAGE_ALERT_MULT = 2; // >2x asumsi = revisi sizing
