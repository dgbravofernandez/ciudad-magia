import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, SETUP_FEE_PRICE_ID, type PlanId } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubContext } from '@/lib/supabase/get-club-id'

const BILLING_ROLES = ['admin', 'direccion']

export async function POST(req: NextRequest) {
  try {
    // SEC: clubId y email se derivan del servidor — el body solo elige plan/periodicidad.
    // Antes el cliente mandaba clubId y podía crear checkouts contra clubs ajenos.
    const { planId, annual } = await req.json() as { planId: PlanId; annual: boolean }

    const plan = PLANS[planId]
    if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const { clubId, memberId, roles } = await getClubContext()
    if (!clubId || !memberId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!roles.some(r => BILLING_ROLES.includes(r))) {
      return NextResponse.json({ error: 'Solo un administrador del club puede gestionar la facturación' }, { status: 403 })
    }

    // Invariante: el member del header pertenece de verdad a ese club
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: member } = await sb
      .from('club_members')
      .select('id')
      .eq('id', memberId)
      .eq('club_id', clubId)
      .eq('active', true)
      .maybeSingle()
    if (!member) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    // Email del usuario autenticado (no del body)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email ?? undefined

    const priceId = annual ? plan.priceIdAnnual : plan.priceId
    if (!priceId) {
      return NextResponse.json({ error: 'Price not configured' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Setup fee one-time: solo en mensual (anual lo lleva incluido como gancho).
    // Si no hay STRIPE_PRICE_SETUP_FEE configurado, no se cobra (no rompe).
    const setupFeeApplies = !annual && SETUP_FEE_PRICE_ID
    const lineItems: { price: string; quantity: number }[] = [{ price: priceId, quantity: 1 }]
    if (setupFeeApplies) {
      lineItems.push({ price: SETUP_FEE_PRICE_ID, quantity: 1 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: lineItems,
      metadata: { club_id: clubId, plan: planId, setup_fee: setupFeeApplies ? 'yes' : 'no' },
      success_url: `${appUrl}/dashboard?billing=success`,
      cancel_url: `${appUrl}/upgrade?canceled=1`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { club_id: clubId, plan: planId },
        // No trial en Stripe — el trial ya se hizo dentro de la app (14 días gratuitos)
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe-checkout]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
