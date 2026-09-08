"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export default function NewStrategyPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<{ id: number; name: string; description: string; params_schema: Record<string, unknown> }[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/templates").then((r) => r.json()).then(setTemplates)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !name) return
    const res = await fetch("/api/strategies", {
      method: "POST",
      body: JSON.stringify({ name, template_id: selected, params: {} }),
    })
    if (!res.ok) {
      const { error: msg } = await res.json()
      return setError(msg)
    }
    router.push("/app/strategies")
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-white">New Strategy</h1>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Strategy name" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelected(t.id)} className={`rounded-2xl border p-5 text-left transition ${selected === t.id ? "border-[#ccff00] bg-[#ccff00]/10" : "border-white/10 bg-white/5 hover:border-white/20"}`}>
              <h2 className="font-semibold text-white">{t.name}</h2>
              <p className="mt-2 text-xs leading-relaxed text-white/50">{t.description}</p>
            </button>
          ))}
        </div>
        <button type="submit" disabled={!selected || !name} className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00] disabled:opacity-40">Create strategy</button>
      </form>
    </div>
  )
}
