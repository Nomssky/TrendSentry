import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PAIRS } from "@/lib/constants"
import crypto from "crypto"

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

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
  return (data.data ?? []).map((t: Record<string, string>) => ({
    pair: symbol,
    side: t.side === "buy" ? "buy" : "sell",
    price: parseFloat(t.price),
    amount: parseFloat(t.size),
    fee: parseFloat(t.fee) || null,
    fee_currency: t.feeCoin || null,
    executed_at: new Date(Number(t.timestamp)).toISOString(),
  }))
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!authHeader || !timingSafeEqual(authHeader, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { decrypt } = await import("@/lib/encryption")
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error("List users error:", usersError)
    return NextResponse.json({ error: "failed to list users" }, { status: 500 })
  }

  const results: { userId: string; trades: number }[] = []

  for (const user of users.users) {
    const { data: apiKey } = await supabase
      .from("user_api_keys")
      .select("id, user_id, api_key_enc, api_secret_enc, passphrase_enc, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()
    if (!apiKey) continue

    let key: string, secret: string, passphrase: string
    try {
      key = await decrypt(apiKey.api_key_enc)
      secret = await decrypt(apiKey.api_secret_enc)
      passphrase = apiKey.passphrase_enc ? await decrypt(apiKey.passphrase_enc) : ""
    } catch (err) {
      console.error(`Decrypt failed for user ${user.id}:`, err)
      continue
    }

    try {
      const pairResults = await Promise.allSettled(
        PAIRS.map((pair) => fetchBitgetTrades(key, secret, passphrase, pair))
      )
      const allTrades = pairResults
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchBitgetTrades>>> => r.status === "fulfilled")
        .flatMap((r) => r.value)

      if (allTrades.length === 0) {
        results.push({ userId: user.id, trades: 0 })
        continue
      }

      // Dedup: fetch existing trades in the same time window and filter
      const timestamps = allTrades.map((t) => t.executed_at)
      const earliest = timestamps.reduce((a, b) => a < b ? a : b)
      const { data: existing } = await supabase
        .from("user_trades")
        .select("pair, executed_at, price, amount")
        .eq("user_id", user.id)
        .gte("executed_at", earliest)

      const existingKeys = new Set(
        (existing ?? []).map((t) => `${t.pair}|${t.executed_at}|${t.price}|${t.amount}`)
      )
      const newTrades = allTrades.filter(
        (t) => !existingKeys.has(`${t.pair}|${t.executed_at}|${t.price}|${t.amount}`)
      )

      const enriched = newTrades.map((t) => ({ ...t, user_id: user.id, exchange: "bitget" }))

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
