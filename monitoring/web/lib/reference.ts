// Referensi statistik backtest — SATU sumber: lib/backtest-reference.json.
// Jangan hardcode angka di sini. Setiap perubahan angka = re-run backtest +
// catatan di PLAN.md (AGENTS.md aturan 2).
import ref from "./backtest-reference.json"

export const BACKTEST_REFERENCE = {
  period: ref.period,
  winRatePct: ref.winRatePct,
  avgWinR: ref.avgWinR,
  avgLossR: ref.avgLossR,
  avgR: ref.avgR,
  profitFactor: ref.profitFactor,
  sharpeRatio: ref.sharpeRatio,
  maxDrawdownPct: ref.maxDrawdownPct,
  totalReturnPct: ref.totalReturnPct,
  trades: ref.trades,
  tradesPerYear: ref.tradesPerYear,
} as const

export const EVAL_MIN_TRADES = ref.evalMinTrades
export const WIN_RATE_TOLERANCE_PP = ref.winRateTolerancePp
export const AVG_R_FLOOR = ref.avgRFloor
export const SLIPPAGE_ASSUMPTION_PCT = ref.slippageAssumptionPct
export const SLIPPAGE_ALERT_MULT = ref.slippageAlertMult
