import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateOrigin } from "@/lib/csrf"

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

  const { password } = (body ?? {}) as { password?: string }
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "password required" }, { status: 400 })
  }

  if (!user.email) {
    return NextResponse.json({ error: "no email on file" }, { status: 400 })
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (signInError) {
    return NextResponse.json({ error: "incorrect password" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) return NextResponse.json({ error: "delete failed" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
