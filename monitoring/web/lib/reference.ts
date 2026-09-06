// Referensi statistik backtest — Cluster-A2 (2026-09-06, official config):
// 10 pair Bitget, Donchian 20/10, ATR(14)x2, long-only, risk 1%, cluster limit 2/cluster.
// sumber: backtest/run_backtest.py (lihat backtest/reports/decision_log.md).
// Sebelumnya: vanilla 10-pair (Sharpe 0.53, DD -58.49%, 172 trades) — distale 2026-09-06.
export const BACKTEST_REFERENCE = {
  period: "2020-08 .. 2026-08 (6 tahun, 10 pair Bitget, Cluster-A2)",
  winRatePct: 36.17,
  avgWinR: 4.31,
  avgLossR: -0.84,
  avgR: 1.02,
  profitFactor: 2.26,
  maxDrawdownPct: -26.19,
  totalReturnPct: 149.59,
  trades: 94,
  tradesPerYear: 15.7, // ~1 sinyal per 23 hari lintas 10 pair (cluster limit mengurangi frekuensi)
} as const;

export const EVAL_MIN_TRADES = 10; // kriteria sukses Fase 2: evaluasi hanya setelah >=10 trade tertutup
export const WIN_RATE_TOLERANCE_PP = 15; // toleransi deviasi win rate (pp)
export const AVG_R_FLOOR = 0.5; // avg R live di bawah ini = flag
export const SLIPPAGE_ASSUMPTION_PCT = 0.05; // asumsi di config.yaml
export const SLIPPAGE_ALERT_MULT = 2; // >2x asumsi = revisi sizing
