import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logDeviations, calculateDisciplineScore } from "@/lib/deviation"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("user_trades")
    .select("id, pair, side, price, amount, fee, executed_at, strategy_id")
    .eq("user_id", user.id)
    .order("executed_at", { ascending: false })
    .limit(100)
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const trades = await request.json()
  const enriched = (Array.isArray(trades) ? trades : [trades]).map((t: Record<string, unknown>) => ({
    user_id: user.id,
    ...t,
  }))

  const { data, error } = await supabase.from("user_trades").insert(enriched).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (data && data.length > 0) {
    for (const trade of data) {
      if (!trade.strategy_id) continue

      const { data: strategy } = await supabase
        .from("user_strategies")
        .select("params, rules_json")
        .eq("id", trade.strategy_id)
        .single()

      if (strategy) {
        try {
          await logDeviations(user.id, trade.strategy_id, trade.id, {
            pair: trade.pair,
            side: trade.side as "buy" | "sell",
            price: trade.price,
            amount: trade.amount,
            executed_at: trade.executed_at,
          }, strategy)
        } catch (err) {
          console.error("Deviation check failed:", err)
        }
      }
    }

    const dates = [...new Set(data.map((t) => t.executed_at.split("T")[0]))]
    for (const date of dates) {
      const strategyIds = [...new Set(data.filter((t) => t.executed_at.startsWith(date)).map((t) => t.strategy_id).filter(Boolean))]
      for (const strategyId of strategyIds) {
        try {
          await calculateDisciplineScore(user.id, strategyId, date)
        } catch (err) {
          console.error("Discipline score calculation failed:", err)
        }
      }
    }
  }

  return NextResponse.json(data)
}
