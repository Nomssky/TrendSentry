"use client"

import { useState } from "react"

export function CheckoutButton({ plan, hot }: { plan: string; hot?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        alert(data.error ?? "Checkout failed. Please try again.")
        setLoading(false)
        return
      }
      window.location.assign(data.url)
    } catch {
      alert("Network error. Please try again.")
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className={`mt-8 w-full rounded-full px-6 py-3 font-semibold transition disabled:opacity-50 ${
        hot
          ? "bg-black text-[#ccff00] hover:bg-black/80"
          : "bg-[#ccff00] text-black hover:bg-[#aadd00]"
      }`}
    >
      {loading ? "Redirecting…" : "Subscribe"}
    </button>
  )
}
