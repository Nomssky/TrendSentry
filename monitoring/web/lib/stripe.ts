import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      typescript: true,
    })
  }
  return _stripe
}

export const STRIPE_PLANS = {
  paper_beta: {
    name: "Paper Beta",
    price: 19,
    interval: "month" as const,
    features: ["Telegram deviation alerts", "Discipline Benchmark", "Unlimited strategies"],
  },
  live_assist: {
    name: "Live Assist",
    price: 49,
    interval: "month" as const,
    features: ["Real-time trade alerts", "Auto-stop-loss enforcement", "Priority support"],
  },
} as const

export type PlanKey = keyof typeof STRIPE_PLANS
