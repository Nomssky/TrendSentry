import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { PAIRS } from "@/lib/constants"
import { signBitget } from "@/lib/bitget"
import { checkDeviation, calculateDisciplineScore } from "@/lib/deviation"
import crypto from "crypto"

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

const SYMBOL_TO_PAIR = new Map(PAIRS.map((p) => [p.replace("/", ""), p]))

type Fill = {
  pair: string
  side: string
  price: number
  amount: number
  fee: number | null
  fee_currency: string | null
  executed_at: string
  trade_id: string | null
}

// ponytail: mapping defensif — field fills Bitget bisa beda nama antar versi;
// yang tak dikenali dilewati (return null), bukan ditebak.
function mapFill(symbol: string, f: Record<string, unknown>): Fill | null {
  const pair = SYMBOL_TO_PAIR.get(String(f.symbol ?? symbol))
  if (!pair) return null
  const side = String(f.orderSide ?? f.side ?? "").toLowerCase()
  if (side !== "buy" && side !== "sell") return null
  const price = Number(f.price)
  const amount = Number(f.size ?? f.amount ?? f.qty ?? f.quantity)
  const ms = Number(f.cTime ?? f.tTime ?? f.timestamp ?? f.time)
  if (!Number.isFinite(price) || !Number.isFinite(amount) || !Number.isFinite(ms)) return null
  let fee: number | null = null
  let feeCurrency: string | null = null
  const fd = f.feeDetail
  if (typeof fd === "string" && fd) {
    const parts = fd.split(":")
    feeCurrency = parts[0] || null
    fee = parts.length > 1 && Number.isFinite(Number(parts[1])) ? Math.abs(Number(parts[1])) : null
  }
  return {
    pair,
    side,
    price,
    amount,
    fee,
    fee_currency: feeCurrency,
    executed_at: new Date(ms).toISOString(),
    trade_id: f.tradeId != null ? String(f.tradeId) : null,
  }
}

async function fetchBitgetFills(apiKey: string, apiSecret: string, passphrase: string, pair: string): Promise<Fill[]> {
  const symbol = pair.replace("/", "")
  const timestamp = Date.now().toString()
  const path = `/api/v2/spot/trade/fills?symbol=${symbol}&limit=100`
  const res = await fetch(`https://api.bitget.com${path}`, {
    headers: {
      "ACCESS-KEY": apiKey,
      "ACCESS-SIGN": signBitget(timestamp, "GET", path, "", apiSecret),
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": passphrase,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  })
  const data = (await res.json()) as { code?: string; data?: Record<string, unknown>[] }
  if (data.code !== "00000" || !Array.isArray(data.data)) return []
  return data.data
    .map((f) => mapFill(symbol, f))
    .filter((f): f is Fill => f !== null)
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

  const results: { userId: string; trades: number; deviations: number }[] = []

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
        PAIRS.map((pair) => fetchBitgetFills(key, secret, passphrase, pair))
      )
      const allTrades = pairResults
        .filter((r): r is PromiseFulfilledResult<Fill[]> => r.status === "fulfilled")
        .flatMap((r) => r.value)

      if (allTrades.length === 0) {
        results.push({ userId: user.id, trades: 0, deviations: 0 })
        continue
      }

      const timestamps = allTrades.map((t) => t.executed_at)
      const earliest = timestamps.reduce((a, b) => (a < b ? a : b))
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

      const { data: strategies } = await supabase
        .from("user_strategies")
        .select("id, name, params, rules_json")
        .eq("user_id", user.id)
        .eq("is_active", true)
      const strategyId = strategies?.[0]?.id ?? null

      const enriched = newTrades.map((t) => ({
        pair: t.pair,
        side: t.side,
        price: t.price,
        amount: t.amount,
        fee: t.fee,
        fee_currency: t.fee_currency,
        executed_at: t.executed_at,
        user_id: user.id,
        exchange: "bitget",
        strategy_id: strategyId,
      }))

      let inserted: { id: number; pair: string; side: string; price: number; amount: number; executed_at: string; strategy_id: number | null }[] = []
      if (enriched.length > 0) {
        const { data: rows, error: insertError } = await supabase
          .from("user_trades")
          .insert(enriched)
          .select("id, pair, side, price, amount, executed_at, strategy_id")
        if (insertError) {
          console.error(`Trade insert error for ${user.id}:`, insertError)
          continue
        }
        inserted = rows ?? []
      }

      // Deviasi: tiap trade baru vs tiap strategi aktif (Telegram per-user
      // belum ada routing chat id — deviasi tampil di dashboard; alert
      // Telegram user = tier premium, butuh kolom chat id tersendiri).
      let devCount = 0
      if (inserted.length > 0 && strategies && strategies.length > 0) {
        const { count: todayCount } = await supabase
          .from("user_trades")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("executed_at", `${new Date().toISOString().split("T")[0]}T00:00:00Z`)
        const rows = [] as {
          user_id: string; strategy_id: number; trade_id: number;
          rule_key: string; expected: string; actual: string; severity: string
        }[]
        for (const trade of inserted) {
          for (const s of strategies) {
            try {
              const devs = checkDeviation(
                { pair: trade.pair, side: trade.side as "buy" | "sell", price: trade.price, amount: trade.amount, executed_at: trade.executed_at },
                s,
                { dailyTrades: todayCount ?? 0, accountEquity: 1000 }
              )
              for (const dev of devs) {
                rows.push({ user_id: user.id, strategy_id: s.id, trade_id: trade.id, ...dev })
              }
            } catch (err) {
              console.error("Deviation check failed:", err)
            }
          }
        }
        if (rows.length > 0) {
          const { error: devError } = await supabase.from("deviation_log").insert(rows)
          if (devError) console.error("Deviation insert error:", devError)
          else devCount = rows.length
        }
        const dates = [...new Set(inserted.map((t) => t.executed_at.split("T")[0]))]
        for (const date of dates) {
          for (const s of strategies) {
            try {
              await calculateDisciplineScore(user.id, s.id, date, supabase)
            } catch (err) {
              console.error("Discipline score failed:", err)
            }
          }
        }
      }

      results.push({ userId: user.id, trades: inserted.length, deviations: devCount })
    } catch (err) {
      console.error(`Cron error for user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
