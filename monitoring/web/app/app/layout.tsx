import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="flex min-h-screen bg-black">
      <nav className="flex w-56 flex-col gap-1 border-r border-white/10 p-5 pt-28 text-sm">
        <a href="/app/dashboard" className="rounded-lg px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white">Dashboard</a>
        <a href="/app/strategies" className="rounded-lg px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white">Strategies</a>
        <a href="/app/deviation-log" className="rounded-lg px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white">Deviation Log</a>
        <a href="/app/settings" className="rounded-lg px-3 py-2 text-white/60 hover:bg-white/5 hover:text-white">Settings</a>
        <div className="mt-6 border-t border-white/10 pt-4">
          <form action="/auth/signout" method="post">
            <button className="rounded-lg px-3 py-2 text-white/40 hover:text-white">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="flex-1 overflow-auto p-8 pt-28">{children}</main>
    </div>
  )
}
