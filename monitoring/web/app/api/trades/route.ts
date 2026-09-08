import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logDeviations, calculateDisciplineScore } from "@/lib/deviation"
import { sendTelegramAlert, formatDeviationAlert } from "@/lib/telegram"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100)
  const offset = (page - 1) * limit

  const { data, count } = await supabase
    .from("user_trades")
    .select("id, pair, side, price, amount, fee, executed_at, strategy_id", { count: "exact" })
    .eq("user_id", user.id)
    .order("executed_at", { ascending: false })
    .range(offset, offset + limit - 1)

  return NextResponse.json({
    trades: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      pages: Math.ceil((count ?? 0) / limit),
    },
  })
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
        .select("name, params, rules_json")
        .eq("id", trade.strategy_id)
        .single()

      if (strategy) {
        try {
          const deviations = await logDeviations(user.id, trade.strategy_id, trade.id, {
            pair: trade.pair,
            side: trade.side as "buy" | "sell",
            price: trade.price,
            amount: trade.amount,
            executed_at: trade.executed_at,
          }, strategy)

          if (deviations && deviations.length > 0) {
            for (const dev of deviations) {
              await sendTelegramAlert(
                formatDeviationAlert(dev.rule_key, dev.expected, dev.actual, dev.severity, strategy.name)
              )
            }
          }
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
