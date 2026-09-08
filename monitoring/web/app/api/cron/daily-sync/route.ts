import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import crypto from "crypto"

function sign(timestamp: string, method: string, path: string, body: string, secret: string) {
  const prehash = timestamp + method.toUpperCase() + path + body
  return crypto.createHmac("sha256", secret).update(prehash).digest("base64")
}

async function fetchBitgetTrades(apiKey: string, apiSecret: string, passphrase: string, symbol: string) {
  const timestamp = Date.now().toString()
  const method = "GET"
  const path = `/api/v2/spot/trades?symbol=${symbol.replace("/", "")}&limit=50`
  const signature = sign(timestamp, method, path, "", apiSecret)

  const res = await fetch(`https://api.bitget.com${path}`, {
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
  })
  const data = await res.json()
  return (data.data ?? []).map((t: any) => ({
    pair: symbol,
    side: t.side === "buy" ? "buy" : "sell",
    price: parseFloat(t.price),
    amount: parseFloat(t.size),
    fee: parseFloat(t.fee) || null,
    fee_currency: t.feeCoin || null,
    executed_at: new Date(parseInt(t.timestamp)).toISOString(),
  }))
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 })
  }

  const results: { userId: string; trades: number }[] = []

  for (const user of users.users) {
    const { data: apiKey } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()
    if (!apiKey) continue

    const { decrypt } = await import("@/lib/encryption")
    const key = await decrypt(apiKey.api_key_enc)
    const secret = await decrypt(apiKey.api_secret_enc)
    const passphrase = apiKey.passphrase_enc ? await decrypt(apiKey.passphrase_enc) : ""

    try {
      const trades = await fetchBitgetTrades(key, secret, passphrase, "BTC/USDT")
      const enriched = trades.map((t: { pair: string; side: string; price: number; amount: number; fee: number | null; fee_currency: string | null; executed_at: string }) => ({ ...t, user_id: user.id, exchange: "bitget" }))

      if (enriched.length > 0) {
        const { error: insertError } = await supabase.from("user_trades").insert(enriched)
        if (insertError) {
          console.error(`Trade insert error for ${user.id}:`, insertError)
          continue
        }
      }

      results.push({ userId: user.id, trades: enriched.length })
    } catch (err) {
      console.error(`Cron error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
