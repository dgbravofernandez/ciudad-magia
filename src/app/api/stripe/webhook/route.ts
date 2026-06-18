import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // BILLING-1: Idempotencia. Stripe reintenta webhooks si no respondemos 2xx en <30s
  // o si su entrega falla. Sin esto, retries duplicarían updates (doble cambio de plan,
  // doble email, etc.). Patrón: INSERT con PK conflict = ya procesado.
  // Si la tabla aún no existe en la BD destino (migración 050 no aplicada), seguimos
  // procesando sin idempotencia (mejor procesar que perder eventos críticos).
  const { error: idemErr } = await sb
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })

  if (idemErr) {
    // 23505 = unique_violation → ya procesado, devolver 200 sin reprocesar
    if (idemErr.code === '23505') {
      console.log('[stripe-webhook] duplicate event ignored:', event.id, event.type)
      return NextResponse.json({ received: true, duplicate: true })
    }
    // 42P01 = undefined_table → migración no aplicada todavía. Log y continuar.
    if (idemErr.code === '42P01') {
      console.warn('[stripe-webhook] migration 050 not applied — idempotency skipped')
    } else {
      // Otro error de BD: log pero continuar; preferimos procesar a perder webhook
      console.error('[stripe-webhook] idempotency log error:', idemErr)
    }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const clubId = session.metadata?.club_id
      if (!clubId) break

      const isLtd = session.metadata?.plan === 'ltd'

      await sb.from('clubs').update({
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: isLtd ? null : session.subscription as string,
        subscription_status: isLtd ? 'ltd' : 'active',
        plan: session.metadata?.plan ?? 'pro',
        trial_ends_at: null,
      }).eq('id', clubId)

      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const status = sub.status === 'active' ? 'active'
        : sub.status === 'past_due' ? 'past_due'
        : sub.status === 'canceled' ? 'canceled'
        : sub.status

      await sb.from('clubs').update({
        subscription_status: status,
        stripe_subscription_id: sub.id,
      }).eq('stripe_customer_id', customerId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      await sb.from('clubs').update({
        subscription_status: 'canceled',
        plan: 'starter',
      }).eq('stripe_customer_id', customerId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      await sb.from('clubs').update({
        subscription_status: 'past_due',
      }).eq('stripe_customer_id', customerId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
