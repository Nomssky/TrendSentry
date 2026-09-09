import { createClient } from "@/lib/supabase/server"
import { validateOrigin } from "@/lib/csrf"
import { redirect } from "next/navigation"

export async function POST(request: Request) {
  const csrf = validateOrigin(request)
  if (csrf) return csrf

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}
