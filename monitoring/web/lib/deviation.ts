import { SupabaseClient } from "@supabase/supabase-js"

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
  min_holding_days?: number
  no_trade_hours?: number[]
  max_position_size_pct?: number
  custom?: Record<string, unknown>
}

function parseRules(
  params: Record<string, unknown>,
  rules_json?: Record<string, unknown> | null
): StrategyRules {
  const rules: StrategyRules = {}

  if (params.direction != null) rules.direction = params.direction as "long_only" | "long_short"
  if (params.risk_per_trade_pct != null) rules.risk_per_trade_pct = Number(params.risk_per_trade_pct)
  if (params.max_concurrent != null) rules.max_concurrent = Number(params.max_concurrent)
  if (params.atr_stop_multiplier != null) rules.atr_stop_multiplier = Number(params.atr_stop_multiplier)

  if (rules_json) {
    if (rules_json.max_daily_trades != null) rules.max_daily_trades = Number(rules_json.max_daily_trades)
    if (Array.isArray(rules_json.allowed_pairs)) rules.allowed_pairs = rules_json.allowed_pairs as string[]
    if (rules_json.min_holding_days != null) rules.min_holding_days = Number(rules_json.min_holding_days)
    if (Array.isArray(rules_json.no_trade_hours)) rules.no_trade_hours = rules_json.no_trade_hours as number[]
    if (rules_json.max_position_size_pct != null) rules.max_position_size_pct = Number(rules_json.max_position_size_pct)
    if (rules_json.custom != null && typeof rules_json.custom === "object") rules.custom = rules_json.custom as Record<string, unknown>
  }

  return rules
}

export function checkDeviation(
  trade: Trade,
  strategy: { params: Record<string, unknown>; rules_json?: Record<string, unknown> | null },
  context?: {
    openPositions?: number
    dailyTrades?: number
    accountEquity?: number
    positionEntryDate?: string
  }
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

  if (context?.accountEquity != null && context.accountEquity > 0 && rules.risk_per_trade_pct != null && trade.side === "buy") {
    const riskAmount = context.accountEquity * (rules.risk_per_trade_pct / 100)
    const tradeValue = trade.price * trade.amount
    if (tradeValue > riskAmount * 10) {
      results.push({
        rule_key: "position_sizing",
        expected: `risk ${rules.risk_per_trade_pct}% (${riskAmount.toFixed(2)} USD)`,
        actual: `trade value ${tradeValue.toFixed(2)} USD (>${(riskAmount * 10).toFixed(2)})`,
        severity: "critical",
      })
    }
  }

  if (rules.min_holding_days && context?.positionEntryDate) {
    const entryDate = new Date(context.positionEntryDate)
    const now = new Date(trade.executed_at)
    const daysHeld = Math.floor((now.getTime() - entryDate.getTime()) / 86_400_000)
    if (daysHeld < rules.min_holding_days && trade.side === "sell") {
      results.push({
        rule_key: "min_holding",
        expected: `hold at least ${rules.min_holding_days} days`,
        actual: `sold after ${daysHeld} days`,
        severity: "warning",
      })
    }
  }

  if (rules.no_trade_hours && rules.no_trade_hours.length > 0) {
    const hour = new Date(trade.executed_at).getUTCHours()
    if (rules.no_trade_hours.includes(hour)) {
      results.push({
        rule_key: "no_trade_hours",
        expected: `no trading at hour ${hour}`,
        actual: `trade executed at ${hour}:00 UTC`,
        severity: "info",
      })
    }
  }

  if (rules.max_position_size_pct && context?.accountEquity && trade.side === "buy") {
    const maxSize = context.accountEquity * (rules.max_position_size_pct / 100)
    const tradeValue = trade.price * trade.amount
    if (tradeValue > maxSize) {
      results.push({
        rule_key: "max_position_size",
        expected: `max ${rules.max_position_size_pct}% (${maxSize.toFixed(2)} USD)`,
        actual: `trade value ${tradeValue.toFixed(2)} USD`,
        severity: "critical",
      })
    }
  }

  return results
}

export async function calculateDisciplineScore(
  userId: string,
  strategyId: number,
  date: string,
  supabase?: SupabaseClient
) {
  const client = supabase ?? await (await import("./supabase/server")).createClient()

  const [{ data: trades }, { data: deviations }] = await Promise.all([
    client
      .from("user_trades")
      .select("id")
      .eq("user_id", userId)
      .eq("strategy_id", strategyId)
      .gte("executed_at", `${date}T00:00:00Z`)
      .lte("executed_at", `${date}T23:59:59Z`),
    client
      .from("deviation_log")
      .select("id, severity")
      .eq("user_id", userId)
      .eq("strategy_id", strategyId)
      .gte("detected_at", `${date}T00:00:00Z`)
      .lte("detected_at", `${date}T23:59:59Z`),
  ])

  const totalTrades = trades?.length ?? 0
  const totalDeviations = deviations?.length ?? 0
  const criticalDeviations = deviations?.filter((d) => d.severity === "critical").length ?? 0

  let score = 100
  score -= criticalDeviations * 25
  score -= (totalDeviations - criticalDeviations) * 10
  score = Math.max(0, Math.min(100, score))

  const { error } = await client.from("discipline_scores").upsert(
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
