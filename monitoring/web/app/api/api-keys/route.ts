import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ApiKeyPostSchema } from "@/lib/validations"
import { validateOrigin } from "@/lib/csrf"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data } = await supabase
    .from("user_api_keys")
    .select("id, exchange, is_active, created_at")
    .eq("user_id", user.id)
    .single()
  return NextResponse.json(data ?? null)
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

  const parsed = ApiKeyPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed", details: parsed.error.flatten() }, { status: 400 })
  }

  const { api_key, api_secret, passphrase } = parsed.data
  const { encrypt } = await import("@/lib/encryption")
  const [api_key_enc, api_secret_enc, passphrase_enc] = await Promise.all([
    encrypt(api_key),
    encrypt(api_secret),
    passphrase ? encrypt(passphrase) : Promise.resolve(null),
  ])

  const { data, error } = await supabase
    .from("user_api_keys")
    .upsert({
      user_id: user.id,
      exchange: "bitget",
      api_key_enc,
      api_secret_enc,
      passphrase_enc,
    })
    .select("id, exchange, is_active, created_at")
    .single()
  if (error) {
    console.error("API key upsert error:", error)
    return NextResponse.json({ error: "save failed" }, { status: 400 })
  }
  return NextResponse.json(data)
}
