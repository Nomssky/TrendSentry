"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"
import LogoMark from "@/app/components/LogoMark"

function friendlyError(msg: string): string {
  if (/not confirmed|not_confirmed|no_code/i.test(msg)) {
    return "Email belum dikonfirmasi — cek inbox/spam, atau klik kirim ulang di bawah."
  }
  return msg
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const checkEmail = searchParams.get("check_email") === "1"
  const urlError = searchParams.get("error")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const [email, setEmail] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: form.get("email") as string,
      password: form.get("password") as string,
    })
    setLoading(false)
    if (error) return setError(friendlyError(error.message))
    router.push("/app/dashboard")
  }

  async function resendConfirm() {
    if (!email) return setError("Isi email dulu, lalu klik kirim ulang.")
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) return setError(friendlyError(error.message))
    setResent(true)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
      <div className="flex items-center gap-2.5">
        <LogoMark className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-primary">TrendSentry</span>
      </div>
      <h1 className="font-display text-2xl text-primary">Sign in</h1>
      {checkEmail && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          Check your email for a confirmation link, then sign in.
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {urlError && !error && <p className="text-sm text-danger">{friendlyError(urlError)}</p>}
      {resent && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          Email konfirmasi dikirim ulang — cek inbox/spam.
        </p>
      )}
      <input name="email" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-control-border bg-surface px-4 py-3 text-primary placeholder-muted focus:border-accent/40" />
      <input name="password" type="password" placeholder="Password" required className="w-full rounded-lg border border-control-border bg-surface px-4 py-3 text-primary placeholder-muted focus:border-accent/40" />
      <button disabled={loading} className="w-full rounded-full bg-action px-6 py-3 font-semibold text-on-action transition hover:bg-accent-hover disabled:opacity-50">
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <button type="button" onClick={resendConfirm} className="w-full text-center text-sm text-muted hover:text-accent hover:underline">
        Kirim ulang email konfirmasi
      </button>
      <p className="text-center text-sm text-muted">No account? <a href="/auth/signup" className="text-accent hover:underline">Sign up</a></p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Suspense fallback={<div className="text-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
