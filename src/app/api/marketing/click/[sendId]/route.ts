import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const ALLOWED_HOSTS = ['cluberly.vercel.app', 'cluberly.com', 'cluberly.es', 'localhost', 'localhost:3000']

export async function GET(req: NextRequest, { params }: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await params
  const dest = req.nextUrl.searchParams.get('u') ?? '/'
  const ua = req.headers.get('user-agent') ?? ''

  // SEC: solo permitir redirects a hosts conocidos (anti open-redirect)
  let safeUrl: URL
  try {
    safeUrl = new URL(dest, 'https://cluberly.vercel.app')
    if (!ALLOWED_HOSTS.includes(safeUrl.host)) {
      safeUrl = new URL('/', 'https://cluberly.vercel.app')
    }
  } catch {
    safeUrl = new URL('/', 'https://cluberly.vercel.app')
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    await sb.from('marketing_email_clicks').insert({
      send_id: sendId,
      destination: safeUrl.pathname + safeUrl.search,
      user_agent: ua.slice(0, 200),
    })
    await sb.from('marketing_email_sends').update({ clicked_at: new Date().toISOString() })
      .eq('id', sendId).is('clicked_at', null)
  } catch { /* tracking nunca rompe */ }

  return NextResponse.redirect(safeUrl)
}
