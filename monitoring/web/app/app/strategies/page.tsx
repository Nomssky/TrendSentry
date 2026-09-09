import { createClient } from "@/lib/supabase/server"
import Link from "next/link"

export default async function StrategiesPage() {
  const supabase = await createClient()
  const { data: strategies } = await supabase
    .from("user_strategies")
    .select("id, name, is_active, created_at")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Strategies</h1>
        <Link href="/app/strategies/new" className="rounded-full bg-[#ccff00] px-5 py-2 text-sm font-semibold text-black hover:bg-[#aadd00]">+ New</Link>
      </div>

      {!strategies?.length && <p className="text-sm text-white/40">No strategies yet. Create your first one.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {strategies?.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">{s.name}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${s.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"}`}>{s.is_active ? "Active" : "Paused"}</span>
            </div>
            <p className="mt-2 text-xs text-white/30">{new Date(s.created_at).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
