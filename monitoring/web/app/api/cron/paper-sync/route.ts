import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

type PaperSyncBody = {
  signals?: Record<string, unknown>[]
  positions?: Record<string, unknown>[]
  equity_log?: Record<string, unknown>[]
  meta?: Record<string, string>
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as PaperSyncBody
  const { signals, positions, equity_log, meta } = body

  const supabase = createAdminClient()
  const results: { table: string; count: number; error?: string }[] = []

  if (signals && Array.isArray(signals)) {
    const { error } = await supabase
      .from("paper_signals")
      .upsert(signals, { onConflict: "candle_date,pair", ignoreDuplicates: false })
    results.push({ table: "paper_signals", count: signals.length, error: error?.message })
  }

  if (positions && Array.isArray(positions)) {
    const { error } = await supabase
      .from("paper_positions")
      .upsert(positions, { onConflict: "id", ignoreDuplicates: false })
    results.push({ table: "paper_positions", count: positions.length, error: error?.message })
  }

  if (equity_log && Array.isArray(equity_log)) {
    const { error } = await supabase
      .from("paper_equity_log")
      .upsert(equity_log, { onConflict: "date", ignoreDuplicates: false })
    results.push({ table: "paper_equity_log", count: equity_log.length, error: error?.message })
  }

  if (meta && typeof meta === "object") {
    const entries = Object.entries(meta).map(([key, value]) => ({ key, value: String(value) }))
    const { error } = await supabase
      .from("paper_meta")
      .upsert(entries, { onConflict: "key", ignoreDuplicates: false })
    results.push({ table: "paper_meta", count: entries.length, error: error?.message })
  }

  return NextResponse.json({ synced: results })
}
