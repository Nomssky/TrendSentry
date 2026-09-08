"use client"

import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"

type ApiKeyInfo = {
  id: number
  exchange: string
  is_active: boolean
  created_at: string
}

export default function SettingsPage() {
  const [existingKey, setExistingKey] = useState<ApiKeyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/api-keys")
      .then((r) => r.json())
      .then((data) => {
        setExistingKey(data.id ? data : null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function saveApiKeys(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/api-keys", {
      method: "POST",
      body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, passphrase: passphrase || undefined }),
    })
    setSaving(false)
    if (!res.ok) {
      const { error } = await res.json()
      return setMsg(error)
    }
    setMsg("API keys saved")
    setApiKey(""); setApiSecret(""); setPassphrase("")
    fetch("/api/api-keys").then((r) => r.json()).then((data) => setExistingKey(data.id ? data : null))
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Bitget API Key</h2>
        <p className="text-sm text-white/40">Read-only API key from Bitget. Your keys are encrypted at rest with AES-256-GCM.</p>

        {!loading && existingKey && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-white/60">
              <span className="font-medium text-white">{existingKey.exchange}</span> API key configured
            </p>
            <p className="mt-1 text-xs text-white/40">
              Added {new Date(existingKey.created_at).toLocaleDateString()} · {existingKey.is_active ? "Active" : "Inactive"}
            </p>
          </div>
        )}

        {msg && <p className={`text-sm ${msg === "API keys saved" ? "text-emerald-400" : "text-rose-400"}`}>{msg}</p>}
        <form onSubmit={saveApiKeys} className="space-y-3">
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
          <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="API Secret" required type="password" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
          <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Passphrase (optional)" type="password" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
          <button disabled={saving} className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00] disabled:opacity-40">{saving ? "Saving..." : existingKey ? "Update keys" : "Save keys"}</button>
        </form>
      </section>
    </div>
  )
}
