import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Auth tetap diwajibkan meski RLS strategy_templates public-read: template
// hanya dipakai di dalam /app (pengguna login). Defense-in-depth + konsisten
// dengan route /api lain. (Bukan celah — hanya lebih ketat dari yang diperlukan.)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("strategy_templates")
    .select("*")
    .order("id")
  return NextResponse.json(data ?? [])
}
