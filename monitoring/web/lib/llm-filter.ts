const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions"

type SignalContext = {
  pair: string
  signal: "LONG_ENTRY" | "LONG_EXIT"
  price: number
  atr: number
  donchian_hi: number
  donchian_lo: number
  openPositions: number
  recentPnL: number[]
}

type LLMFilterResult = {
  approved: boolean
  confidence: number
  reasoning: string
  riskFlags: string[]
}

export async function filterSignalWithLLM(
  context: SignalContext,
  apiKey: string
): Promise<LLMFilterResult> {
  if (!apiKey) {
    return { approved: true, confidence: 0, reasoning: "LLM filter not configured", riskFlags: [] }
  }

  const prompt = `You are a risk management assistant for a crypto trend-following strategy. 
Analyze this trading signal and determine if it should be approved or rejected.

Signal Details:
- Pair: ${context.pair}
- Signal: ${context.signal}
- Price: $${context.price.toLocaleString()}
- ATR(14): $${context.atr.toFixed(2)}
- Donchian High (20d): $${context.donchian_hi.toLocaleString()}
- Donchian Low (10d): $${context.donchian_lo.toLocaleString()}
- Open Positions: ${context.openPositions}
- Recent PnL (last 5): ${context.recentPnL.map((p) => `$${p.toFixed(2)}`).join(", ")}

Rules:
1. Only approve signals that align with the trend direction
2. Flag if too many positions are open (>3)
3. Flag if recent losses suggest market conditions have changed
4. Never generate new signals - only filter existing ones

Respond in JSON format:
{
  "approved": boolean,
  "confidence": number (0-100),
  "reasoning": "string",
  "riskFlags": ["string"]
}`

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!res.ok) {
      console.error("LLM API error:", res.status)
      return { approved: true, confidence: 0, reasoning: "LLM API error", riskFlags: [] }
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { approved: true, confidence: 0, reasoning: "No LLM response", riskFlags: [] }
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { approved: true, confidence: 0, reasoning: "Invalid LLM response format", riskFlags: [] }
    }

    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error("LLM filter error:", err)
    return { approved: true, confidence: 0, reasoning: "LLM filter failed", riskFlags: [] }
  }
}
