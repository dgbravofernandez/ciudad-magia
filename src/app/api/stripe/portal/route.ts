import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'

export async function POST(req: NextRequest) {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: club } = await sb.from('clubs').select('stripe_customer_id, name').eq('id', clubId).single()

    if (!club?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing found' }, { status: 400 })
    }

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/configuracion`
    const session = await stripe.billingPortal.sessions.create({
      customer: club.stripe_customer_id,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error('[stripe-portal]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
