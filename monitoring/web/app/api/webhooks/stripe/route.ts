import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"
import { STRIPE_PLANS } from "@/lib/stripe"
import Stripe from "stripe"

const VALID_PLANS = Object.keys(STRIPE_PLANS)

async function setPlan(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  plan: string,
  session: { customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null; subscription?: string | Stripe.Subscription | null }
) {
  const stripe = getStripe()
  let planExpiresAt: string | null = null
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const periodEnd = subscription.items.data[0]?.current_period_end
      if (periodEnd) planExpiresAt = new Date(periodEnd * 1000).toISOString()
    } catch (err) {
      console.error("Failed to fetch subscription period:", err)
    }
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { id: userId, plan, stripe_customer_id: customerId, plan_expires_at: planExpiresAt },
      { onConflict: "id" }
    )
  if (error) console.error("Profile plan update error:", error)
}

async function expirePlanBySubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  console.error(
    `Subscription ${subscription.id} cancelled/ended for customer ${subscription.customer} — resetting affected profiles`
  )
  const { error } = await supabase
    .from("profiles")
    .update({ plan: "free", plan_expires_at: null })
    .eq("stripe_customer_id", subscription.customer as string)
  if (error) console.error("Profile downgrade error:", error)
}

async function renewBySubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const plan = subscription.metadata?.plan
  const userId = subscription.metadata?.user_id
  if (!plan || !userId || !VALID_PLANS.includes(plan)) {
    console.error(`Renewal skipped: metadata tidak lengkap (plan=${plan}, user_id=${userId})`)
    return
  }
  const periodEnd = subscription.items.data[0]?.current_period_end
  const { error } = await supabase
    .from("profiles")
    .update({ plan, plan_expires_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null })
    .eq("id", userId)
  if (error) console.error("Profile renewal error:", error)
}

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

    // Jangan aktifkan plan sebelum benar-benar dibayar (metode async bisa
    // mengirim completed dengan payment_status=unpaid). invoice.paid akan
    // mengejar kasus unpaid.
    if (session.payment_status === "unpaid") {
      console.warn(`checkout.session.completed unpaid (${session.id}) — menunggu invoice.paid`)
      return NextResponse.json({ received: true })
    }

    if (!userId || !plan || !VALID_PLANS.includes(plan)) {
      console.error(`checkout.session.completed metadata invalid (plan=${plan}, user=${userId})`)
      return NextResponse.json({ received: true })
    }
    await setPlan(supabase, userId, plan, session)
  }

  // Renewal / upgrade / downgrade: perbarui masa berlaku dari metadata subscription.
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice
    const subscriptionId =
      typeof invoice.parent?.subscription_details?.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await renewBySubscription(supabase, subscription)
      } catch (err) {
        console.error("invoice.paid renew failed:", err)
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription
    if (subscription.status === "active" || subscription.status === "trialing") {
      await renewBySubscription(supabase, subscription)
    } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
      await expirePlanBySubscription(supabase, subscription)
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription
    await expirePlanBySubscription(supabase, subscription)
  }

  return NextResponse.json({ received: true })
}
