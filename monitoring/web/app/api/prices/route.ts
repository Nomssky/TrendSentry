import { NextResponse } from "next/server";

const PAIRS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "AVAXUSDT", "LINKUSDT", "DOGEUSDT", "ADAUSDT", "HYPEUSDT"];
const BITGET_URL = "https://api.bitget.com/api/v2/spot/market/tickers";

export async function GET() {
  try {
    const res = await fetch(BITGET_URL, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: res.status }, { status: 502 });
    const json = (await res.json()) as {
      data?: { symbol: string; lastPr: string; open24h: string }[];
    };
    const prices: Record<string, { price: number; changePct: number | null }> = {};
    for (const r of json.data ?? []) {
      if (!PAIRS.includes(r.symbol)) continue;
      const pair = r.symbol.replace("USDT", "/USDT");
      const last = Number(r.lastPr);
      const open24 = Number(r.open24h);
      const changePct = open24 > 0 ? ((last - open24) / open24) * 100 : null;
      prices[pair] = { price: last, changePct };
    }
    return NextResponse.json(prices);
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
