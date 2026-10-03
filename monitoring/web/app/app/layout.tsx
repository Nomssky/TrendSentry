import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { AppSidebar } from "./AppSidebar"
import { TopBar, type DeploymentStatus } from "./TopBar"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Status bot keseluruhan untuk TopBar: tanpa JavaScript client,
  // tanpa endpoint baru — query RLS yang sama seperti halaman lain.
  const { data: deployments } = await supabase
    .from("deployments")
    .select("status")
    .eq("user_id", user.id)
  const statuses = ((deployments ?? []).map((d) => d.status) as DeploymentStatus[]).filter((s) =>
    ["created", "running", "stopped", "failed"].includes(s),
  )

  return (
    <div className="flex min-h-screen bg-black">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar email={user.email ?? null} statuses={statuses} botCount={statuses.length} />
        <main className="flex-1 overflow-auto p-4 pt-6 md:p-8">{children}</main>
      </div>
    </div>
  )
}
