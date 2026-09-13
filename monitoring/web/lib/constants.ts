export const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "AVAX/USDT", "LINK/USDT", "DOGE/USDT", "ADA/USDT", "HYPE/USDT"] as const

export const STARTING_CASH = 1000

export const MS_PER_DAY = 86_400_000

export function fmt(n: number, digits = 2): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
