import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, type PlanId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { planId, annual, clubId, email } = await req.json() as {
      planId: PlanId
      annual: boolean
      clubId: string
      email: string
    }

    const plan = PLANS[planId]
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const isLtd = planId === 'ltd'
    const priceId = annual && !isLtd ? plan.priceIdAnnual : plan.priceId

    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: isLtd ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { club_id: clubId, plan: planId },
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/upgrade?canceled=1`,
      allow_promotion_codes: true,
      ...(isLtd ? {} : {
        subscription_data: {
          metadata: { club_id: clubId, plan: planId },
          // No trial en Stripe — el trial ya se hizo dentro de la app (14 días gratuitos)
        },
      }),
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe-checkout]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
