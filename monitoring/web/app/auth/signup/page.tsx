"use client"

import { createClient } from "@/lib/supabase/client"
import { storedReferral } from "@/app/components/AnalyticsBeacon"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.get("email") as string,
      password: form.get("password") as string,
      options: {
        data: { full_name: form.get("name") as string, referral_source: storedReferral() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) return setError(error.message)
    router.push("/auth/login?check_email=1")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-bold text-white">Create account</h1>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <input name="name" placeholder="Name" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
        <input name="email" type="email" placeholder="Email" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
        <input name="password" type="password" placeholder="Password (min 6)" required minLength={6} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
        <button className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00]">Sign up</button>
        <p className="text-center text-sm text-white/40">Already have one? <a href="/auth/login" className="text-[#ccff00] hover:underline">Sign in</a></p>
      </form>
    </div>
  )
}
