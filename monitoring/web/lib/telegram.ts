const TELEGRAM_API = "https://api.telegram.org/bot"

export async function sendTelegramAlert(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn("TELEGRAM_BOT_TOKEN/CHAT_ID not configured — alert skipped")
    return false
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    })
    return res.ok
  } catch (err) {
    console.error("Failed to send Telegram alert:", err)
    return false
  }
}

export function formatDeviationAlert(
  ruleKey: string,
  expected: string,
  actual: string,
  severity: string,
  strategyName: string
): string {
  const icon = severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️"
  return [
    `${icon} <b>Deviation Detected</b>`,
    "",
    `<b>Strategy:</b> ${strategyName}`,
    `<b>Rule:</b> ${ruleKey}`,
    `<b>Expected:</b> ${expected}`,
    `<b>Actual:</b> ${actual}`,
    `<b>Severity:</b> ${severity}`,
    "",
    `<i>${new Date().toISOString()}</i>`,
  ].join("\n")
}
