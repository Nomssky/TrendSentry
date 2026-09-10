import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe, STRIPE_PLANS, PlanKey } from "@/lib/stripe"
import { CheckoutPostSchema } from "@/lib/validations"
import { validateOrigin } from "@/lib/csrf"

export async function POST(request: Request) {
  const csrf = validateOrigin(request)
  if (csrf) return csrf

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const parsed = CheckoutPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 400 })
  }

  const { plan } = parsed.data
  if (!(plan in STRIPE_PLANS)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 })
  }

  const planConfig = STRIPE_PLANS[plan as PlanKey]
  const stripe = getStripe()
  const origin = request.headers.get("origin") ?? "https://trendsentry.vercel.app"

  try {
    const idempotencyKey = `checkout_${user.id}_${plan}_${Date.now()}`
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: planConfig.name,
              description: planConfig.features.join(", "),
            },
            unit_amount: planConfig.price * 100,
            recurring: { interval: planConfig.interval },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/app/dashboard?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { user_id: user.id, plan },
    }, { idempotencyKey })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error("Stripe checkout error:", err)
    return NextResponse.json({ error: "checkout failed" }, { status: 500 })
  }
}
