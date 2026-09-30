import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PaperSyncSchema } from "@/lib/validations"
import crypto from "crypto"

const SIGNAL_FIELDS = ["candle_date", "processed_at", "pair", "close_price", "donchian_hi", "donchian_lo", "atr", "signal", "decision", "reason"]
// `id` SQLite TIDAK ikut: autoincrement per file deployment, jadi id=1 milik A
// dan B sama dan akan saling menimpa di PK cloud. Identitas fill = fill_key
// (pair|entry_date) yang selalu ditemani deployment_id.
const POSITION_FIELDS = ["pair", "entry_date", "entry_price", "units", "stop_price", "risk_amount", "status", "exit_date", "exit_price", "exit_reason", "pnl", "r_multiple", "side", "fill_key"]
const EQUITY_FIELDS = ["date", "cash", "positions_mtm", "n_open", "total_equity"]
const SLIPPAGE_FIELDS = ["timestamp", "pair", "bid", "ask", "mid", "spread_pct"]
const YIELD_FIELDS = ["date", "cash_before", "rate_daily", "amount"]

function pick(obj: Record<string, unknown>, fields: string[]) {
  const result: Record<string, unknown> = {}
  for (const f of fields) {
    if (f in obj) result[f] = obj[f]
  }
  return result
}

/** Allowlist kolom + tanamkan deployment_id pemilik payload ke SETIAP baris. */
function tagged(rows: Record<string, unknown>[], fields: string[], deploymentId: number) {
  return rows.map((r) => ({ ...pick(r, fields), deployment_id: deploymentId }))
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing cron request")
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 })
  }
  const authHeader = request.headers.get("authorization")
  const expected = `Bearer ${secret}`
  if (!authHeader || authHeader.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
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

  const { signals, positions, equity_log, slippage_log, yield_log, meta, deployment_id } = parsed.data
  // 0 = stream global legacy (db/paper_trading.db). Key unique di bawah selalu
  // memuat deployment_id, jadi deployment A + BTC + tanggal X dan deployment
  // B + BTC + tanggal X tetap DUA baris berbeda (ship gate Phase B).
  const deploymentId = deployment_id ?? 0
  const supabase = createAdminClient()
  const results: { table: string; count: number; error?: string }[] = []

  if (signals && signals.length > 0) {
    const cleaned = tagged(signals, SIGNAL_FIELDS, deploymentId)
    const { error } = await supabase
      .from("paper_signals")
      .upsert(cleaned, { onConflict: "deployment_id,candle_date,pair", ignoreDuplicates: false })
    results.push({ table: "paper_signals", count: cleaned.length, error: error?.message })
  }

  if (positions && positions.length > 0) {
    const cleaned = tagged(positions, POSITION_FIELDS, deploymentId)
    const { error } = await supabase
      .from("paper_positions")
      .upsert(cleaned, { onConflict: "deployment_id,fill_key", ignoreDuplicates: false })
    results.push({ table: "paper_positions", count: cleaned.length, error: error?.message })
  }

  if (equity_log && equity_log.length > 0) {
    const cleaned = tagged(equity_log, EQUITY_FIELDS, deploymentId)
    const { error } = await supabase
      .from("paper_equity_log")
      .upsert(cleaned, { onConflict: "deployment_id,date", ignoreDuplicates: false })
    results.push({ table: "paper_equity_log", count: cleaned.length, error: error?.message })
  }

  if (slippage_log && slippage_log.length > 0) {
    const cleaned = tagged(slippage_log, SLIPPAGE_FIELDS, deploymentId)
    const { error } = await supabase
      .from("paper_slippage_log")
      .upsert(cleaned, { onConflict: "deployment_id,timestamp,pair", ignoreDuplicates: false })
    results.push({ table: "paper_slippage_log", count: cleaned.length, error: error?.message })
  }

  if (yield_log && yield_log.length > 0) {
    const cleaned = tagged(yield_log, YIELD_FIELDS, deploymentId)
    const { error } = await supabase
      .from("paper_yield_log")
      .upsert(cleaned, { onConflict: "deployment_id,date", ignoreDuplicates: false })
    results.push({ table: "paper_yield_log", count: cleaned.length, error: error?.message })
  }

  if (meta && Object.keys(meta).length > 0) {
    const entries = Object.entries(meta).map(([key, value]) => ({ key, value, deployment_id: deploymentId }))
    const { error } = await supabase
      .from("paper_meta")
      .upsert(entries, { onConflict: "deployment_id,key", ignoreDuplicates: false })
    results.push({ table: "paper_meta", count: entries.length, error: error?.message })
  }

  return NextResponse.json({ synced: results })
}
