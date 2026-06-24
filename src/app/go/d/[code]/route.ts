import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Short link para demo: /go/d/[8-char-code]
// Lookup send_id por prefijo, detecta si es RFFM, redirige a /demo con tracking
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'

  if (!code || code.length < 8) {
    return NextResponse.redirect(`${base}/demo`)
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Lookup por prefijo del UUID
    const { data: send } = await sb
      .from('marketing_email_sends')
      .select('id, club_id')
      .ilike('id', `${code}%`)
      .maybeSingle()

    if (!send) {
      return NextResponse.redirect(`${base}/demo`)
    }

    // Detectar RFFM para servir vídeo correcto
    const { data: club } = await sb
      .from('marketing_clubs')
      .select('federation')
      .eq('id', send.club_id)
      .maybeSingle()

    const isRffm = (club?.federation ?? '').toUpperCase().includes('RFFM')
    const fedParam = isRffm ? '&fed=rffm' : ''

    // Registrar click
    await Promise.all([
      sb.from('marketing_email_clicks').insert({
        send_id: send.id,
        destination: '/demo',
        user_agent: 'short-link',
      }),
      sb.from('marketing_email_sends')
        .update({ clicked_at: new Date().toISOString() })
        .eq('id', send.id)
        .is('clicked_at', null),
    ])

    return NextResponse.redirect(`${base}/demo?s=${send.id}${fedParam}`)
  } catch {
    return NextResponse.redirect(`${base}/demo`)
  }
}
