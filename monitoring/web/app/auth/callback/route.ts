import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Menukar ?code= dari email konfirmasi jadi session (PKCE).
// Page.tsx lama tidak pernah melakukan ini — penyebab "confirm lalu gabisa login".
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/app/dashboard"
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app/dashboard"

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login?error=no_code", url.origin))
  }
  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error.message)}`, url.origin)
    )
  }
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
