import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ApiKeyPostBody = {
  api_key: string
  api_secret: string
  passphrase?: string
}

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { api_key, api_secret, passphrase } = await request.json() as ApiKeyPostBody
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
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
