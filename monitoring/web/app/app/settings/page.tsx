"use client"

import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FormField } from "@/app/components/ui"

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

  async function safeError(res: Response): Promise<string> {
    try {
      const j = await res.json()
      if (j && typeof j.error === "string" && j.error) return j.error
    } catch { /* non-JSON */ }
    return `Request failed (HTTP ${res.status}).`
  }

  async function saveApiKeys(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    let res: Response
    try {
      res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, passphrase: passphrase || undefined }),
      })
    } catch {
      setSaving(false)
      return setMsg("Network problem — check your connection and try again.")
    }
    setSaving(false)
    if (!res.ok) {
      return setMsg(await safeError(res))
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
    let res: Response
    try {
      res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
    } catch {
      setChangingPassword(false)
      return setPasswordMsg("Network problem — check your connection and try again.")
    }
    setChangingPassword(false)
    if (!res.ok) {
      return setPasswordMsg(await safeError(res))
    }
    setCurrentPassword(""); setNewPassword("")
    setPasswordMsg("Password updated — signing you out. Redirecting to login…")
    setTimeout(() => { router.push("/auth/login"); router.refresh() }, 1500)
  }

  async function deleteAccount() {
    if (deleteConfirm !== "DELETE" || !deletePassword) return
    setDeleting(true)
    setDeleteMsg(null)
    let res: Response
    try {
      res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      })
    } catch {
      setDeleting(false)
      return setDeleteMsg("Network problem — check your connection and try again.")
    }
    setDeleting(false)
    if (!res.ok) {
      setDeleteMsg(await safeError(res))
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="font-display text-2xl tracking-tight text-primary sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Exchange connection, account security, and danger zone.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Exchange connection</h2>
        <div className="rounded-lg border border-line bg-surface p-4 text-sm text-secondary">
          <p>
            Connect your Bitget account with a <strong className="text-secondary">read-only</strong> API key.
            TrendSentry uses it to log your trades and check for deviations — it can never place orders or withdraw funds.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-4">
            <li>Go to <a href="https://www.bitget.com/settings/api-management" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Bitget API Management</a></li>
            <li>Create a key with <strong className="text-secondary">Read-only</strong> permission (no Trade, no Withdraw)</li>
            <li>Paste the API Key, Secret, and Passphrase below</li>
          </ol>
        </div>

        {!loading && existingKey && (
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-sm text-secondary">
              <span className="font-medium text-primary">{existingKey.exchange}</span> API key configured
            </p>
            <p className="mt-1 text-xs text-muted">
              Added {new Date(existingKey.created_at).toLocaleDateString()} · {existingKey.is_active ? "Active" : "Inactive"}
            </p>
          </div>
        )}

        {msg && <p className={`text-sm ${msg === "API keys saved" ? "text-success" : "text-danger"}`}>{msg}</p>}
        <form onSubmit={saveApiKeys} className="space-y-3">
          <FormField label="API Key" help="Stored encrypted — values are never shown again after saving.">
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" required type="password" className="w-full rounded-lg border border-control-border bg-surface px-4 py-3 text-primary placeholder-muted focus:border-accent/40" />
          </FormField>
          <FormField label="API Secret" help="Stored encrypted — values are never shown again after saving.">
            <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="API Secret" required type="password" className="w-full rounded-lg border border-control-border bg-surface px-4 py-3 text-primary placeholder-muted focus:border-accent/40" />
          </FormField>
          <FormField label="Passphrase" help="Only if your Bitget key uses one. Optional.">
            <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Passphrase (optional)" type="password" className="w-full rounded-lg border border-control-border bg-surface px-4 py-3 text-primary placeholder-muted focus:border-accent/40" />
          </FormField>
          <button disabled={saving} className="w-full rounded-full bg-action px-6 py-3 font-semibold text-on-action transition hover:bg-accent-hover disabled:opacity-40">{saving ? "Saving..." : existingKey ? "Update keys" : "Save keys"}</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-primary">Account password</h2>
        {passwordMsg && <p className={`text-sm ${passwordMsg.startsWith("Password updated") ? "text-success" : "text-danger"}`}>{passwordMsg}</p>}
        <form onSubmit={changePassword} className="space-y-3">
          <FormField label="Current password">
            <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" required type="password" className="w-full rounded-lg border border-control-border bg-surface px-4 py-3 text-primary placeholder-muted focus:border-accent/40" />
          </FormField>
          <FormField label="New password" help="Min 10 characters, upper/lowercase + digit.">
            <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" required minLength={10} type="password" className="w-full rounded-lg border border-control-border bg-surface px-4 py-3 text-primary placeholder-muted focus:border-accent/40" />
          </FormField>
          <button disabled={changingPassword} className="w-full rounded-full bg-elevated px-6 py-3 font-semibold text-primary transition hover:bg-elevated disabled:opacity-40">{changingPassword ? "Updating..." : "Update password"}</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-danger">Danger zone</h2>
        <p className="text-sm text-muted">Delete your account and all associated data. This cannot be undone.</p>
        {deleteMsg && <p className="text-sm text-danger">{deleteMsg}</p>}
        <div className="space-y-3">
          <FormField label="Confirm with password" help="Re-authentication is required for this destructive action.">
            <input value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Enter your password to confirm" type="password" className="w-full rounded-lg border border-danger bg-surface px-4 py-3 text-primary placeholder-muted focus:border-danger/50" />
          </FormField>
          <FormField label='Type "DELETE" to confirm'>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder='Type "DELETE" to confirm' className="w-full rounded-lg border border-danger bg-surface px-4 py-3 text-primary placeholder-muted focus:border-danger/50" />
          </FormField>
          <button disabled={deleting || deleteConfirm !== "DELETE" || !deletePassword} onClick={deleteAccount} className="w-full rounded-full bg-danger/20 px-6 py-3 font-semibold text-danger transition hover:bg-danger/30 disabled:opacity-40">{deleting ? "Deleting..." : "Delete account"}</button>
        </div>
      </section>
    </div>
  )
}
