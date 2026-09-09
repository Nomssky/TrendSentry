"use client"

import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

type ApiKeyInfo = {
  id: number
  exchange: string
  is_active: boolean
  created_at: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [existingKey, setExistingKey] = useState<ApiKeyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiKey, setApiKey] = useState("")
  const [apiSecret, setApiSecret] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)

  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)

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
      headers: { "Content-Type": "application/json" },
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

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword) return setPasswordMsg("Current password is required")
    setChangingPassword(true)
    setPasswordMsg(null)
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    })
    setChangingPassword(false)
    if (!res.ok) {
      const { error } = await res.json()
      return setPasswordMsg(error)
    }
    setPasswordMsg("Password updated")
    setCurrentPassword(""); setNewPassword("")
  }

  async function deleteAccount() {
    if (deleteConfirm !== "DELETE" || !deletePassword) return
    setDeleting(true)
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    })
    setDeleting(false)
    if (!res.ok) {
      const { error } = await res.json()
      setDeleteMsg(error)
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
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

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Change Password</h2>
        {passwordMsg && <p className={`text-sm ${passwordMsg === "Password updated" ? "text-emerald-400" : "text-rose-400"}`}>{passwordMsg}</p>}
        <form onSubmit={changePassword} className="space-y-3">
          <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" required type="password" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
          <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" required minLength={6} type="password" className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
          <button disabled={changingPassword} className="w-full rounded-full bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20 disabled:opacity-40">{changingPassword ? "Updating..." : "Update password"}</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-rose-400">Danger Zone</h2>
        <p className="text-sm text-white/40">Delete your account and all associated data. This cannot be undone.</p>
        {deleteMsg && <p className="text-sm text-rose-400">{deleteMsg}</p>}
        <div className="space-y-3">
          <input value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter your password to confirm" type="password" className="w-full rounded-lg border border-rose-400/30 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-rose-400/50" />
          <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder='Type "DELETE" to confirm' className="w-full rounded-lg border border-rose-400/30 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-rose-400/50" />
          <button disabled={deleting || deleteConfirm !== "DELETE" || !deletePassword} onClick={deleteAccount} className="w-full rounded-full bg-rose-500/20 px-6 py-3 font-semibold text-rose-400 transition hover:bg-rose-500/30 disabled:opacity-40">{deleting ? "Deleting..." : "Delete account"}</button>
        </div>
      </section>
    </div>
  )
}
