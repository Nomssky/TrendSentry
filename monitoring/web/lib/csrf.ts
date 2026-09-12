import { NextResponse } from "next/server"

// Origin diizinkan untuk request mutasi. Dikonfigurasi lewat env supaya domain
// kustom tidak perlu ubah kode. Default: produksi + dev lokal.
function allowedOrigins(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS
  if (fromEnv) {
    return fromEnv.split(",").map((o) => o.trim()).filter(Boolean)
  }
  return [
    "https://trendsentry.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ]
}

function isAllowedHost(host: string): boolean {
  return allowedOrigins().some((o) => {
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

  // Origin absent: hanya izinkan kalau host cocok allowlist.
  if (host && isAllowedHost(host)) return null

  return NextResponse.json({ error: "forbidden" }, { status: 403 })
}
