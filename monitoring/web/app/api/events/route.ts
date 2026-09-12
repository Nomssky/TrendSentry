import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateOrigin } from "@/lib/csrf"
import { clientIp, isRateLimited } from "@/lib/rate-limit"
import { z } from "zod"

const EventSchema = z.object({
  path: z.string().min(1).max(200),
  ref: z.string().max(100).nullish(),
})

// 30 event / menit / IP — cukup untuk 1 beacon per page-view, menahan spam.
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

export async function POST(request: Request) {
  const csrf = validateOrigin(request)
  if (csrf) return csrf

  if (isRateLimited("events", clientIp(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
  const parsed = EventSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from("analytics_events").insert({
    path: parsed.data.path,
    ref: parsed.data.ref ?? null,
  })
  if (error) return NextResponse.json({ error: "save failed" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
