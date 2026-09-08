import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("discipline_scores")
    .select("id, strategy_id, date, score, total_trades, deviations")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(90)
  return NextResponse.json(data ?? [])
}
