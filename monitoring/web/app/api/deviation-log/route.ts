import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1)
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "100") || 100), 200)
  const offset = (page - 1) * limit

  const { data, count } = await supabase
    .from("deviation_log")
    .select("id, rule_key, expected, actual, severity, detected_at, strategy_id, trade_id", { count: "exact" })
    .eq("user_id", user.id)
    .order("detected_at", { ascending: false })
    .range(offset, offset + limit - 1)

  return NextResponse.json({
    deviations: data ?? [],
    pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
  })
}
