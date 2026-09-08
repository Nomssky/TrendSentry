"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: form.get("email") as string,
      password: form.get("password") as string,
    })
    if (error) return setError(error.message)
    router.push("/app/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-bold text-white">Sign in</h1>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <input name="email" type="email" placeholder="Email" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
        <input name="password" type="password" placeholder="Password" required className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/40 outline-none focus:border-[#ccff00]/50" />
        <button className="w-full rounded-full bg-[#ccff00] px-6 py-3 font-semibold text-black transition hover:bg-[#aadd00]">Sign in</button>
        <p className="text-center text-sm text-white/40">No account? <a href="/auth/signup" className="text-[#ccff00] hover:underline">Sign up</a></p>
      </form>
    </div>
  )
}
