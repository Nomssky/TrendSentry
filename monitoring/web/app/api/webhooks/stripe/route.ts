import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"
import Stripe from "stripe"

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 })
  }

  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: "server misconfigured" }, { status: 500 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "invalid signature" }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.client_reference_id
    const plan = session.metadata?.plan

    if (userId && plan) {
      let planExpiresAt: string | null = null
      if (session.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const periodEnd = subscription.items.data[0]?.current_period_end
          if (periodEnd) planExpiresAt = new Date(periodEnd * 1000).toISOString()
        } catch (err) {
          console.error("Failed to fetch subscription period:", err)
        }
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            plan,
            stripe_customer_id: session.customer as string,
            plan_expires_at: planExpiresAt,
          },
          { onConflict: "id" }
        )

      if (error) {
        console.error("Profile update error:", error)
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription
    const { error } = await supabase
      .from("profiles")
      .update({ plan: "free", plan_expires_at: null })
      .eq("stripe_customer_id", subscription.customer as string)

    if (error) {
      console.error("Profile downgrade error:", error)
    }
  }

  return NextResponse.json({ received: true })
}
