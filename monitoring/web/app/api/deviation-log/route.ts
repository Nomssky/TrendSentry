import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("deviation_log")
    .select("id, rule_key, expected, actual, severity, detected_at, strategy_id, trade_id")
    .eq("user_id", user.id)
    .order("detected_at", { ascending: false })
    .limit(100)
  return NextResponse.json(data ?? [])
}
