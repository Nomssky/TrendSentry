import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkDeviation, calculateDisciplineScore } from "@/lib/deviation"
import { sendTelegramAlert, formatDeviationAlert } from "@/lib/telegram"
import { TradeBatchSchema } from "@/lib/validations"
import { validateOrigin } from "@/lib/csrf"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1)
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "50") || 50), 100)
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
  const csrf = validateOrigin(request)
  if (csrf) return csrf

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const parsed = TradeBatchSchema.safeParse(Array.isArray(body) ? body : [body])
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const allowed = parsed.data.map((t) => ({
    user_id: user.id,
    pair: t.pair,
    side: t.side,
    price: t.price,
    amount: t.amount,
    fee: t.fee ?? null,
    executed_at: t.executed_at,
    strategy_id: t.strategy_id ?? null,
  }))

  const { data, error } = await supabase.from("user_trades").insert(allowed).select()
  if (error) {
    console.error("Trade insert error:", error)
    return NextResponse.json({ error: "insert failed" }, { status: 400 })
  }
  if (!data) return NextResponse.json({ trades: [] })

  if (data.length > 0) {
    const strategyIds = [...new Set(data.map((t) => t.strategy_id).filter(Boolean))]
    const strategyMap = new Map<number, { name: string; params: Record<string, unknown>; rules_json?: Record<string, unknown> | null }>()

    if (strategyIds.length > 0) {
      const { data: strategies } = await supabase
        .from("user_strategies")
        .select("id, name, params, rules_json")
        .in("id", strategyIds)

      for (const s of strategies ?? []) {
        strategyMap.set(s.id, s)
      }
    }

    // Collect all deviations in parallel (pure computation)
    const allDeviations: { trade: typeof data[0]; strategy: typeof strategyMap extends Map<infer K, infer V> ? V : never; dev: { rule_key: string; expected: string; actual: string; severity: "info" | "warning" | "critical" } }[] = []
    for (const trade of data) {
      if (!trade.strategy_id) continue
      const strategy = strategyMap.get(trade.strategy_id)
      if (!strategy) continue
      try {
        const devs = checkDeviation({
          pair: trade.pair,
          side: trade.side as "buy" | "sell",
          price: trade.price,
          amount: trade.amount,
          executed_at: trade.executed_at,
        }, strategy)
        for (const dev of devs) {
          allDeviations.push({ trade, strategy, dev })
        }
      } catch (err) {
        console.error("Deviation check failed:", err)
      }
    }

    // Batch insert all deviations
    if (allDeviations.length > 0) {
      const { error: devInsertError } = await supabase.from("deviation_log").insert(
        allDeviations.map(({ trade, dev }) => ({
          user_id: user.id,
          strategy_id: trade.strategy_id,
          trade_id: trade.id,
          rule_key: dev.rule_key,
          expected: dev.expected,
          actual: dev.actual,
          severity: dev.severity,
        }))
      )
      if (devInsertError) console.error("Batch deviation insert error:", devInsertError)

      // Send all alerts in parallel (fire-and-forget)
      Promise.all(allDeviations.map(({ strategy, dev }) =>
        sendTelegramAlert(formatDeviationAlert(dev.rule_key, dev.expected, dev.actual, dev.severity, strategy.name))
      )).catch((err) => console.error("Telegram alert batch failed:", err))
    }

    const dates = [...new Set(data.map((t) => t.executed_at?.split("T")[0]).filter(Boolean))]
    const scoreJobs: Promise<void>[] = []
    for (const date of dates) {
      const dateStrategyIds = [...new Set(data.filter((t) => t.executed_at?.startsWith(date)).map((t) => t.strategy_id).filter(Boolean))]
      for (const strategyId of dateStrategyIds) {
        scoreJobs.push(
          calculateDisciplineScore(user.id, strategyId, date).then(() => {}).catch((err) =>
            console.error("Discipline score calculation failed:", err)
          )
        )
      }
    }
    await Promise.all(scoreJobs)
  }

  return NextResponse.json({ trades: data })
}
