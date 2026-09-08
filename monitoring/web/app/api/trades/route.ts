import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
  return NextResponse.json(data)
}
