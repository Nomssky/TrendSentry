import { createClient } from "./supabase/server"

type Trade = {
  pair: string
  side: "buy" | "sell"
  price: number
  amount: number
  executed_at: string
}

type DeviationResult = {
  rule_key: string
  expected: string
  actual: string
  severity: "info" | "warning" | "critical"
}

type StrategyRules = {
  direction?: "long_only" | "long_short"
  risk_per_trade_pct?: number
  max_concurrent?: number
  atr_stop_multiplier?: number
  max_daily_trades?: number
  allowed_pairs?: string[]
  custom?: Record<string, unknown>
}

function parseRules(
  params: Record<string, unknown>,
  rules_json?: Record<string, unknown> | null
): StrategyRules {
  const rules: StrategyRules = {}

  if (params.direction) rules.direction = params.direction as "long_only" | "long_short"
  if (params.risk_per_trade_pct) rules.risk_per_trade_pct = Number(params.risk_per_trade_pct)
  if (params.max_concurrent) rules.max_concurrent = Number(params.max_concurrent)
  if (params.atr_stop_multiplier) rules.atr_stop_multiplier = Number(params.atr_stop_multiplier)

  if (rules_json) {
    if (rules_json.max_daily_trades) rules.max_daily_trades = Number(rules_json.max_daily_trades)
    if (rules_json.allowed_pairs) rules.allowed_pairs = rules_json.allowed_pairs as string[]
    if (rules_json.custom) rules.custom = rules_json.custom as Record<string, unknown>
  }

  return rules
}

function checkDeviation(
  trade: Trade,
  strategy: { params: Record<string, unknown>; rules_json?: Record<string, unknown> | null },
  context?: { openPositions?: number; dailyTrades?: number }
): DeviationResult[] {
  const results: DeviationResult[] = []
  const rules = parseRules(strategy.params, strategy.rules_json)

  if (rules.direction === "long_only" && trade.side === "sell") {
    results.push({
      rule_key: "direction",
      expected: "long_only (no sells)",
      actual: trade.side,
      severity: "critical",
    })
  }

  if (rules.allowed_pairs && rules.allowed_pairs.length > 0) {
    if (!rules.allowed_pairs.includes(trade.pair)) {
      results.push({
        rule_key: "allowed_pairs",
        expected: rules.allowed_pairs.join(", "),
        actual: trade.pair,
        severity: "warning",
      })
    }
  }

  if (context?.openPositions !== undefined && rules.max_concurrent) {
    if (context.openPositions >= rules.max_concurrent && trade.side === "buy") {
      results.push({
        rule_key: "max_concurrent",
        expected: `max ${rules.max_concurrent} positions`,
        actual: `${context.openPositions} open (adding another)`,
        severity: "warning",
      })
    }
  }

  if (context?.dailyTrades !== undefined && rules.max_daily_trades) {
    if (context.dailyTrades >= rules.max_daily_trades) {
      results.push({
        rule_key: "max_daily_trades",
        expected: `max ${rules.max_daily_trades} trades/day`,
        actual: `${context.dailyTrades} trades today`,
        severity: "warning",
      })
    }
  }

  return results
}

export async function logDeviations(
  userId: string,
  strategyId: number,
  tradeId: number,
  trade: Trade,
  strategy: { params: Record<string, unknown>; rules_json?: Record<string, unknown> | null },
  context?: { openPositions?: number; dailyTrades?: number }
) {
  const supabase = await createClient()
  const deviations = checkDeviation(trade, strategy, context)

  if (deviations.length === 0) return []

  const { data, error } = await supabase
    .from("deviation_log")
    .insert(
      deviations.map((d) => ({
        user_id: userId,
        strategy_id: strategyId,
        trade_id: tradeId,
        rule_key: d.rule_key,
        expected: d.expected,
        actual: d.actual,
        severity: d.severity,
      })),
    )
    .select()

  if (error) throw error
  return data
}

export async function calculateDisciplineScore(
  userId: string,
  strategyId: number,
  date: string
) {
  const supabase = await createClient()

  const { data: trades } = await supabase
    .from("user_trades")
    .select("id")
    .eq("user_id", userId)
    .eq("strategy_id", strategyId)
    .gte("executed_at", `${date}T00:00:00Z`)
    .lte("executed_at", `${date}T23:59:59Z`)

  const { data: deviations } = await supabase
    .from("deviation_log")
    .select("id, severity")
    .eq("user_id", userId)
    .eq("strategy_id", strategyId)
    .gte("detected_at", `${date}T00:00:00Z`)
    .lte("detected_at", `${date}T23:59:59Z`)

  const totalTrades = trades?.length ?? 0
  const totalDeviations = deviations?.length ?? 0
  const criticalDeviations = deviations?.filter((d) => d.severity === "critical").length ?? 0

  let score = 100
  score -= criticalDeviations * 25
  score -= (totalDeviations - criticalDeviations) * 10
  score = Math.max(0, Math.min(100, score))

  const { error } = await supabase.from("discipline_scores").upsert(
    {
      user_id: userId,
      strategy_id: strategyId,
      date,
      score,
      total_trades: totalTrades,
      deviations: totalDeviations,
    },
    { onConflict: "user_id,strategy_id,date" }
  )

  if (error) throw error
  return { score, totalTrades, totalDeviations, criticalDeviations }
}
