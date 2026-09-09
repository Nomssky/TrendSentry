import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "./AppSidebar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="flex min-h-screen bg-black">
      <AppSidebar />
      <main className="flex-1 overflow-auto p-4 pt-20 md:p-8 md:pt-28">{children}</main>
    </div>
  )
}
