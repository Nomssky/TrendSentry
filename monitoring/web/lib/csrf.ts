import { NextResponse } from "next/server"

const ALLOWED_ORIGINS = [
  "https://trendsentry.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
]

export function validateOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")

  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (ALLOWED_ORIGINS.some((o) => new URL(o).host === originHost)) return null
    } catch { /* invalid origin */ }
  }

  if (host && ALLOWED_ORIGINS.some((o) => new URL(o).host === host)) return null

  return NextResponse.json({ error: "forbidden" }, { status: 403 })
}
