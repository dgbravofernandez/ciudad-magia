import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params
  const ua = req.headers.get('user-agent') ?? ''

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Solo marcar como abierto si no es Gmail prefetch (Googleimageproxy)
    const isPrefetch = /GoogleImageProxy|YahooMailProxy/i.test(ua)

    await sb.from('marketing_email_opens').insert({ send_id: sendId, user_agent: ua.slice(0, 200) })

    if (!isPrefetch) {
      await sb.from('marketing_email_sends').update({ opened_at: new Date().toISOString() })
        .eq('id', sendId).is('opened_at', null)
      // Marcar last_opened_at en el club
      const { data: send } = await sb.from('marketing_email_sends').select('club_id').eq('id', sendId).maybeSingle()
      if (send?.club_id) {
        await sb.from('marketing_clubs').update({ last_opened_at: new Date().toISOString() }).eq('id', send.club_id)
      }
    }
  } catch { /* tracking nunca rompe */ }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
