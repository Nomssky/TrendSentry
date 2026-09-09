import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PaperSyncSchema } from "@/lib/validations"

const SIGNAL_FIELDS = ["candle_date", "processed_at", "pair", "close_price", "donchian_hi", "donchian_lo", "atr", "signal", "decision", "reason"]
const POSITION_FIELDS = ["pair", "entry_date", "entry_price", "units", "stop_price", "risk_amount", "status", "exit_date", "exit_price", "exit_reason", "pnl", "r_multiple"]
const EQUITY_FIELDS = ["date", "cash", "positions_mtm", "n_open", "total_equity"]

function pick(obj: Record<string, unknown>, fields: string[]) {
  const result: Record<string, unknown> = {}
  for (const f of fields) {
    if (f in obj) result[f] = obj[f]
  }
  return result
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const parsed = PaperSyncSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { signals, positions, equity_log, meta } = parsed.data
  const supabase = createAdminClient()
  const results: { table: string; count: number; error?: string }[] = []

  if (signals && signals.length > 0) {
    const cleaned = signals.map((s) => pick(s, SIGNAL_FIELDS))
    const { error } = await supabase
      .from("paper_signals")
      .upsert(cleaned, { onConflict: "candle_date,pair", ignoreDuplicates: false })
    results.push({ table: "paper_signals", count: cleaned.length, error: error?.message })
  }

  if (positions && positions.length > 0) {
    const cleaned = positions.map((p) => pick(p, POSITION_FIELDS))
    const { error } = await supabase
      .from("paper_positions")
      .upsert(cleaned, { onConflict: "id", ignoreDuplicates: false })
    results.push({ table: "paper_positions", count: cleaned.length, error: error?.message })
  }

  if (equity_log && equity_log.length > 0) {
    const cleaned = equity_log.map((e) => pick(e, EQUITY_FIELDS))
    const { error } = await supabase
      .from("paper_equity_log")
      .upsert(cleaned, { onConflict: "date", ignoreDuplicates: false })
    results.push({ table: "paper_equity_log", count: cleaned.length, error: error?.message })
  }

  if (meta && Object.keys(meta).length > 0) {
    const entries = Object.entries(meta).map(([key, value]) => ({ key, value }))
    const { error } = await supabase
      .from("paper_meta")
      .upsert(entries, { onConflict: "key", ignoreDuplicates: false })
    results.push({ table: "paper_meta", count: entries.length, error: error?.message })
  }

  return NextResponse.json({ synced: results })
}
