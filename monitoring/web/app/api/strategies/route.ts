import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { StrategyPostSchema, StrategyPutSchema, StrategyDeleteSchema, checkStrategyGuardrails } from "@/lib/validations"
import { validateOrigin } from "@/lib/csrf"

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

  const parsed = StrategyPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, template_id, params, rules_json } = parsed.data
  const guardrailError = checkStrategyGuardrails(params, rules_json)
  if (guardrailError) {
    return NextResponse.json({ error: guardrailError }, { status: 400 })
  }
  const { data, error } = await supabase
    .from("user_strategies")
    .insert({ user_id: user.id, name, template_id, params, rules_json })
    .select()
    .single()
  if (error) {
    console.error("Strategy insert error:", error)
    return NextResponse.json({ error: "insert failed" }, { status: 400 })
  }
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
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

  const parsed = StrategyPutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { id, name, params, rules_json, is_active } = parsed.data
  if (params || rules_json) {
    const guardrailError = checkStrategyGuardrails(params ?? {}, rules_json)
    if (guardrailError) {
      return NextResponse.json({ error: guardrailError }, { status: 400 })
    }
  }
  const { data, error } = await supabase
    .from("user_strategies")
    .update({ name, params, rules_json, is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()
  if (error) {
    console.error("Strategy update error:", error)
    return NextResponse.json({ error: "update failed" }, { status: 400 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
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

  const parsed = StrategyDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { error } = await supabase
    .from("user_strategies")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
  if (error) {
    console.error("Strategy delete error:", error)
    return NextResponse.json({ error: "delete failed" }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
