import { z } from "zod"

export const TradeBodySchema = z.object({
  pair: z.string().min(1).max(20),
  side: z.enum(["buy", "sell"]),
  price: z.number().positive().finite(),
  amount: z.number().positive().finite(),
  fee: z.number().finite().optional(),
  executed_at: z.string().datetime(),
  strategy_id: z.number().int().positive().optional(),
})

export const TradeBatchSchema = z.array(TradeBodySchema, {}).max(100)

export const StrategyPostSchema = z.object({
  name: z.string().min(1).max(100),
  template_id: z.number().int().positive().optional(),
  params: z.record(z.string(), z.unknown(), {}),
  rules_json: z.record(z.string(), z.unknown(), {}).optional(),
})

export const StrategyPutSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  params: z.record(z.string(), z.unknown(), {}).optional(),
  rules_json: z.record(z.string(), z.unknown(), {}).optional(),
  is_active: z.boolean().optional(),
})

// Guardrail server-side (PLAN.md §9 + seed strategy_templates): envelope yang
// mengikat terlepas dari UI. Mencegah user menggeser batas risk/max_concurrent
// demi menaikkan discipline score.
export const GUARDRAILS = {
  direction: "long_only",
  maxRiskPerTradePct: 1.0,
  maxConcurrent: 5,
} as const

/** Return error message kalau params/rules_json melanggar guardrail, atau null. */
export function checkStrategyGuardrails(
  params: Record<string, unknown>,
  rules_json?: Record<string, unknown> | null
): string | null {
  if (params.direction != null && params.direction !== GUARDRAILS.direction) {
    return `direction harus "${GUARDRAILS.direction}"`
  }
  if (params.risk_per_trade_pct != null) {
    const v = Number(params.risk_per_trade_pct)
    if (!Number.isFinite(v) || v <= 0 || v > GUARDRAILS.maxRiskPerTradePct) {
      return `risk_per_trade_pct harus > 0 dan <= ${GUARDRAILS.maxRiskPerTradePct}`
    }
  }
  if (params.max_concurrent != null) {
    const v = Number(params.max_concurrent)
    if (!Number.isInteger(v) || v < 1 || v > GUARDRAILS.maxConcurrent) {
      return `max_concurrent harus 1..${GUARDRAILS.maxConcurrent}`
    }
  }
  if (rules_json && "max_concurrent" in rules_json) {
    return "max_concurrent tidak boleh di rules_json (pakai params)"
  }
  return null
}

export const StrategyDeleteSchema = z.object({
  id: z.number().int().positive(),
})

export const ApiKeyPostSchema = z.object({
  api_key: z.string().min(1),
  api_secret: z.string().min(1),
  passphrase: z.string().optional(),
})

export const CheckoutPostSchema = z.object({
  plan: z.string().min(1),
})

export const PaperSyncSchema = z.object({
  // Sync mengirim inkremental untuk tabel append-only (signals/slippage/yield),
  // dan union (open + baru + baru-ditutup) untuk positions. Cap di sini hanya
  // jaring pengaman payload; angka besar agar sync tidak mati permanen saat
  // data bertambah (mis. equity_log ~1 baris/hari jangka panjang).
  signals: z.array(z.record(z.string(), z.unknown(), {}), {}).max(5000).optional(),
  positions: z.array(z.record(z.string(), z.unknown(), {}), {}).max(2000).optional(),
  equity_log: z.array(z.record(z.string(), z.unknown(), {}), {}).max(5000).optional(),
  slippage_log: z.array(z.record(z.string(), z.unknown(), {}), {}).max(5000).optional(),
  yield_log: z.array(z.record(z.string(), z.unknown(), {}), {}).max(5000).optional(),
  meta: z.record(z.string(), z.string(), {}).optional(),
})
