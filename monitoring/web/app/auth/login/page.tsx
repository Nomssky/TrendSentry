"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"

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
      <h1 className="text-2xl font-bold text-white">Sign in</h1>
      {checkEmail && (
        <p className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/10 px-4 py-3 text-sm text-[#ccff00]">
          Check your email for a confirmation link, then sign in.
        </p>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {urlError && !error && <p className="text-sm text-rose-400">{friendlyError(urlError)}</p>}
      {resent && (
        <p className="rounded-lg border border-[#ccff00]/30 bg-[#ccff00]/10 px-4 py-3 text-sm text-[#ccff00]">
          Email konfirmasi dikirim ulang — cek inbox/spam.
        </p>
      )}
      <input name="email" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
      <input name="password" type="password" placeholder="Password" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
      <button disabled={loading} className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00] disabled:opacity-50">
        {loading ? "Signing in..." : "Sign in"}
      </button>
      <button type="button" onClick={resendConfirm} className="w-full text-center text-sm text-white/40 hover:text-[#ccff00] hover:underline">
        Kirim ulang email konfirmasi
      </button>
      <p className="text-center text-sm text-white/40">No account? <a href="/auth/signup" className="text-[#ccff00] hover:underline">Sign up</a></p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <Suspense fallback={<div className="text-white/40">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
