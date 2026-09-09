import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getEnv } from "./lib/env"

const protectedPrefixes = ["/app"]
const authPages = ["/auth/login", "/auth/signup"]

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const { supabaseUrl, supabaseKey } = getEnv()

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const userId = data?.user?.id

  const { pathname } = request.nextUrl
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p))
  const isAuthPage = authPages.some((p) => pathname.startsWith(p))

  if (isProtected && !userId) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  if (isAuthPage && userId) {
    const url = request.nextUrl.clone()
    url.pathname = "/app/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/app/:path+", "/auth/:path+"],
}
