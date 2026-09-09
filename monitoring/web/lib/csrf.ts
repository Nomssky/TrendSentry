import { NextResponse } from "next/server"

const ALLOWED_ORIGINS = [
  "https://trendsentry.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
]

function isAllowedHost(host: string): boolean {
  return ALLOWED_ORIGINS.some((o) => {
    try { return new URL(o).host === host } catch { return false }
  })
}

export function validateOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")

  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (isAllowedHost(originHost)) return null
    } catch { /* invalid origin */ }
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  // Origin absent: only allow same-origin requests (host must match allowlist)
  if (host && isAllowedHost(host)) return null

  return NextResponse.json({ error: "forbidden" }, { status: 403 })
}
