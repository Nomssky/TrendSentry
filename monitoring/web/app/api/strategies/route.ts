import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type StrategyPostBody = {
  name: string
  template_id?: number
  params: Record<string, unknown>
  rules_json?: Record<string, unknown>
}

type StrategyPutBody = {
  id: number
  name?: string
  params?: Record<string, unknown>
  rules_json?: Record<string, unknown>
  is_active?: boolean
}

type StrategyDeleteBody = {
  id: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("user_strategies")
    .select("id, name, template_id, params, is_active, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { name, template_id, params, rules_json } = await request.json() as StrategyPostBody
  const { data, error } = await supabase
    .from("user_strategies")
    .insert({ user_id: user.id, name, template_id, params, rules_json })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id, name, params, rules_json, is_active } = await request.json() as StrategyPutBody
  const { data, error } = await supabase
    .from("user_strategies")
    .update({ name, params, rules_json, is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await request.json() as StrategyDeleteBody
  const { error } = await supabase
    .from("user_strategies")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
