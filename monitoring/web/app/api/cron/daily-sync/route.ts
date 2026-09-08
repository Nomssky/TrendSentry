import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const { data: users } = await supabase.auth.admin.listUsers()
  const results: { userId: string; trades: number }[] = []

  for (const user of users.users) {
    const { data: apiKey } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user.id)
      .single()
    if (!apiKey) continue

    const { decrypt } = await import("@/lib/encryption")
    const key = await decrypt(apiKey.api_key_enc)
    const secret = await decrypt(apiKey.api_secret_enc)

    try {
      const { data: trades, error: tradeError } = await supabase
        .from("user_trades")
        .insert({
          user_id: user.id,
          exchange: "bitget",
          pair: "BTC/USDT",
          side: "buy",
          price: 0,
          amount: 0,
          executed_at: new Date().toISOString(),
        })
        .select()

      if (tradeError) {
        console.error(`Trade insert error for ${user.id}:`, tradeError)
        continue
      }

      results.push({ userId: user.id, trades: trades?.length ?? 0 })
    } catch (err) {
      console.error(`Cron error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
