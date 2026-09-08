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
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
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
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            plan,
            stripe_customer_id: session.customer as string,
            plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
