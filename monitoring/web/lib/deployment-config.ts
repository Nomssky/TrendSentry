/**
 * MVP config bundle — kontrak kontrol-eksekusi (Phase A).
 *
 * Bentuk objek di sini HARUS sama persis dengan `config.yaml` yang dibaca
 * `paper_trading/live_signal.py` dan `risk_manager/guards.py::validate_config`,
 * supaya Phase B cukup menyuntikkan objek ini ke `main(cfg=...)` tanpa
 * translation layer.
 *
 * Tiga kunci top-level (`deployment_id`, `user_strategy_id`, `config_version`)
 * diabaikan oleh engine — `validate_config()` hanya membaca kunci yang dikenal —
 * dan dipakai execution plane untuk memilih file SQLite + logging versi.
 *
 * JANGAN menambah abstraction strategi: bundle ini Donchian-spesifik dan itu
 * disengaja (8 template ≠ 8 strategi eksekusi; hanya Donchian yang executable).
 *
 * Nilai frozen di `MVP_ENGINE_DEFAULTS` adalah salinan web-side dari `config.yaml`
 * (ARCH §16: config.yaml = source of truth). Drift dicegah oleh
 * `tests/test_deployments_contract.py::test_engine_defaults_match_config_yaml`.
 */
import { z } from "zod"
import { PAIRS, STARTING_CASH } from "@/lib/constants"

/** Identitas template Donchian di `strategy_templates` (canonical id 1, nama unique). */
export const DONCHIAN_TEMPLATE_NAME = "Donchian Breakout"

/**
 * Default level engine yang TIDAK berasal dari params user.
 * Angka = config.yaml (lihat catatan drift test di atas).
 */
export const MVP_ENGINE_DEFAULTS = {
  timeframe: "1d",
  max_positions_per_cluster: 2,
  max_drawdown_circuit_breaker_pct: 15.0,
  fee_pct: 0.1,
  slippage_pct: 0.05,
  data_source: "bitget",
  yield_apy_idle_cash: 5.0,
  mode: "paper",
  exchange: "bitget",
} as const

/**
 * Kontrak payload yang dikirim ke engine.
 *
 * BATAS DI SINI BUKAN guardrail kebijakan baru — guardrail kebijakan tetap
 * `checkStrategyGuardrails()` (lib/validations.ts) pada input user, dan
 * `risk_manager/guards.py::validate_config()` pada engine. Skema ini adalah
 * KUNCI TYPE + snapshot dari penolakan yang memang sudah dimiliki engine,
 * supaya bundle yang melanggar tidak pernah bisa terbentuk:
 *
 *   execution.mode = live        -> z.literal("paper")     (validate_config: "Fase 4 belum tersedia")
 *   exchange non-bitget          -> z.literal("bitget")    (validate_config: "venue tunggal")
 *   direction = long_short       -> z.literal("long_only") (validate_config + checkStrategyGuardrails)
 *   risk_per_trade_pct > 1       -> .max(1)                (validate_config + checkStrategyGuardrails)
 *   max_concurrent > 5           -> .max(5)                (validate_config + checkStrategyGuardrails)
 *   atr_stop_multiplier <= 0     -> .positive()            (validate_config: "stop loss wajib")
 *
 * Paritas kedua ujung diuji oleh tests/test_deployments_contract.py.
 */
export const ConfigBundleSchema = z.object({
  deployment_id: z.number().int().positive(),
  user_strategy_id: z.number().int().positive(),
  config_version: z.number().int().min(1),

  strategy: z.object({
    model: z.literal("donchian"),
    pairs: z.array(z.enum(PAIRS)).min(1),
    timeframe: z.literal("1d"),
    donchian_entry_period: z.number().int().min(1),
    donchian_exit_period: z.number().int().min(1),
    atr_period: z.number().int().min(1),
    atr_stop_multiplier: z.number().positive(),
    direction: z.literal("long_only"),
    max_positions_per_cluster: z.number().int().min(1),
  }),

  risk: z.object({
    risk_per_trade_pct: z.number().gt(0).max(1),
    max_concurrent_positions: z.number().int().min(1).max(5),
    max_drawdown_circuit_breaker_pct: z.number().gt(0),
  }),

  backtest: z.object({
    fee_pct: z.number().min(0).max(5),
    slippage_pct: z.number().min(0).max(2),
    initial_capital_usd: z.number().gt(0),
  }),

  execution: z.object({
    mode: z.literal("paper"),
    exchange: z.literal("bitget"),
  }),

  paper_trading: z.object({
    data_source: z.literal("bitget"),
    yield_apy_idle_cash: z.number().min(0),
  }),

  // MVP: AI/LLM di luar scope, jadi literal false — mengaktifkan filter butuh
  // perubahan eksplisit di sini (Fase 3 + gate-nya), bukan sekadar config.
  llm_filter: z.object({ enabled: z.literal(false) }),
})

export type ConfigBundle = z.infer<typeof ConfigBundleSchema>

/** Params dari `user_strategies.params` yang kosong jatuh ke default template. */
function resolved(params: Record<string, unknown>, props: Record<string, { default?: unknown }>, key: string): unknown {
  const v = params[key]
  return v === undefined || v === null || v === "" ? props[key]?.default : v
}

export function buildDonchianBundle(args: {
  deploymentId: number
  userStrategyId: number
  configVersion: number
  /** `user_strategies.params` milik strategi yang dipilih. */
  params: Record<string, unknown>
  /** `strategy_templates.params_schema` — sumber default canonical (seed 8 template). */
  paramsSchema: { properties?: Record<string, { default?: unknown }> }
}): ConfigBundle {
  const props = args.paramsSchema.properties ?? {}
  // Sengaja TIDAK melempar: nilai tak-terbaca jadi NaN dan `ConfigBundleSchema`
  // (z.number() menolak NaN) menolaknya dengan path yang jelas di response 400.
  const num = (key: string): number => Number(resolved(args.params, props, key))

  return {
    deployment_id: args.deploymentId,
    user_strategy_id: args.userStrategyId,
    config_version: args.configVersion,

    strategy: {
      model: "donchian",
      pairs: [...PAIRS],
      timeframe: MVP_ENGINE_DEFAULTS.timeframe,
      // nama key berubah di sini: params pakai nama template (entry_period, ...),
      // engine pakai nama config.yaml (donchian_entry_period, ...).
      donchian_entry_period: num("entry_period"),
      donchian_exit_period: num("exit_period"),
      atr_period: num("atr_period"),
      atr_stop_multiplier: num("atr_stop_multiplier"),
      direction: resolved(args.params, props, "direction") as "long_only",
      max_positions_per_cluster: MVP_ENGINE_DEFAULTS.max_positions_per_cluster,
    },

    risk: {
      risk_per_trade_pct: num("risk_per_trade_pct"),
      max_concurrent_positions: num("max_concurrent"),
      max_drawdown_circuit_breaker_pct: MVP_ENGINE_DEFAULTS.max_drawdown_circuit_breaker_pct,
    },

    backtest: {
      fee_pct: MVP_ENGINE_DEFAULTS.fee_pct,
      slippage_pct: MVP_ENGINE_DEFAULTS.slippage_pct,
      initial_capital_usd: STARTING_CASH,
    },

    execution: { mode: MVP_ENGINE_DEFAULTS.mode, exchange: MVP_ENGINE_DEFAULTS.exchange },

    paper_trading: {
      data_source: MVP_ENGINE_DEFAULTS.data_source,
      yield_apy_idle_cash: MVP_ENGINE_DEFAULTS.yield_apy_idle_cash,
    },

    llm_filter: { enabled: false },
  }
}
