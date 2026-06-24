import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Short link para reservar: /go/r/[8-char-code]
// Lookup send_id por prefijo, redirige a /reservar con tracking
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'

  if (!code || code.length < 8) {
    return NextResponse.redirect(`${base}/reservar`)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: send } = await sb
      .from('marketing_email_sends')
      .select('id')
      .ilike('id', `${code}%`)
      .maybeSingle()

    if (!send) {
      return NextResponse.redirect(`${base}/reservar`)
    }

    await Promise.all([
      sb.from('marketing_email_clicks').insert({
        send_id: send.id,
        destination: '/reservar',
        user_agent: 'short-link',
      }),
      sb.from('marketing_email_sends')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', send.id)
        .is('clicked_at', null),
    ])

    return NextResponse.redirect(`${base}/reservar?s=${send.id}`)
  } catch {
    return NextResponse.redirect(`${base}/reservar`)
  }
}
