import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Dua alur confirm (email dibuka di browser mana pun):
// 1. token_hash (utama) — verifyOtp, TIDAK butuh PKCE verifier.
//    Template email harus link ke /auth/callback?token_hash={{ .TokenHash }}&type=signup
// 2. code (fallback) — exchangeCodeForSession, butuh verifier di browser yang sama.
// Page.tsx lama tidak melakukan keduanya — penyebab "confirm lalu gabisa login".
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get("next") ?? "/app/dashboard"
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app/dashboard"
  const loginError = (msg: string) =>
    NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(msg)}`, url.origin))

  // Supabase meneruskan kegagalan verifikasi (link kedaluwarsa / sudah dipakai)
  // sebagai ?error= di redirect — teruskan pesannya, jangan tutupi dengan no_code.
  const upstreamError = url.searchParams.get("error_description") ?? url.searchParams.get("error")
  if (upstreamError) return loginError(upstreamError)

  const supabase = await createClient()

  const tokenHash = url.searchParams.get("token_hash")
  const type = url.searchParams.get("type")
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "recovery" | "magiclink" | "email_change" | "invite",
    })
    if (error) return loginError(error.message)
    return NextResponse.redirect(new URL(safeNext, url.origin))
  }

  const code = url.searchParams.get("code")
  if (!code) return loginError("no_code")
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // Kasus umum: link dibuka di browser/HP berbeda (PKCE verifier hilang).
    // Solusi user: login lalu klik "kirim ulang", buka link di browser yang sama.
    return loginError(error.message)
  }
  return NextResponse.redirect(new URL(safeNext, url.origin))
}
