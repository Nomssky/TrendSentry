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

function checkDeviation(trade: Trade, strategy: { params: Record<string, unknown>; rules_json?: Record<string, unknown> | null }): DeviationResult[] {
  const results: DeviationResult[] = []
  const params = strategy.params

  if (params.direction === "long_only" && trade.side === "sell") {
    results.push({
      rule_key: "direction",
      expected: "long_only",
      actual: trade.side,
      severity: "critical",
    })
  }

  return results
}

export async function logDeviations(
  userId: string,
  strategyId: number,
  tradeId: number,
  trade: Trade,
  strategy: { params: Record<string, unknown>; rules_json?: Record<string, unknown> | null },
) {
  const supabase = await createClient()
  const deviations = checkDeviation(trade, strategy)

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
