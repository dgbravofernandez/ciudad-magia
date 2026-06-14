import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico de la configuración de email para superadmin.
 * Devuelve qué transports están configurados (sin exponer valores secretos).
 */
export async function GET() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data: pa } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!pa) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const resendOk = !!process.env.RESEND_API_KEY
  const gmailOk = !!(process.env.MARKETING_GMAIL_USER && process.env.MARKETING_GMAIL_APP_PASSWORD)
  const fromEmail = process.env.MARKETING_FROM_EMAIL || null
  const gmailUser = process.env.MARKETING_GMAIL_USER || null

  return NextResponse.json({
    resend: {
      configured: resendOk,
      api_key_prefix: resendOk ? process.env.RESEND_API_KEY!.slice(0, 6) + '...' : null,
      from_email: fromEmail,
    },
    gmail: {
      configured: gmailOk,
      user: gmailUser,
      app_password_set: !!process.env.MARKETING_GMAIL_APP_PASSWORD,
      app_password_length: process.env.MARKETING_GMAIL_APP_PASSWORD?.length ?? 0,
    },
    primary_transport: resendOk ? 'resend' : gmailOk ? 'gmail' : 'none',
    app_url: process.env.NEXT_PUBLIC_APP_URL || null,
  })
}
