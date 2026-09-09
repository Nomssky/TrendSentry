import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/csrf"
import { z } from "zod"

const PasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6),
})

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

  const parsed = PasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 400 })
  }

  const { current_password, new_password } = parsed.data

  // Verify current password
  if (!user.email) return NextResponse.json({ error: "no email on file" }, { status: 400 })
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current_password,
  })
  if (signInError) {
    return NextResponse.json({ error: "incorrect password" }, { status: 403 })
  }

  // Update password
  const { error } = await supabase.auth.updateUser({ password: new_password })
  if (error) {
    return NextResponse.json({ error: "update failed" }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
