import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function CallbackPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (data?.claims?.sub) redirect("/app/dashboard")
  redirect("/auth/login")
}
