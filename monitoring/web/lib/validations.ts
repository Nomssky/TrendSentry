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
  signals: z.array(z.record(z.string(), z.unknown(), {}), {}).max(500).optional(),
  positions: z.array(z.record(z.string(), z.unknown(), {}), {}).max(100).optional(),
  equity_log: z.array(z.record(z.string(), z.unknown(), {}), {}).max(365).optional(),
  meta: z.record(z.string(), z.string(), {}).optional(),
})
