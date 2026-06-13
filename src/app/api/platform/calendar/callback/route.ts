import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOAuthClient } from '@/lib/google/oauth'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
const INTEGRACIONES = `${APP_URL}/superadmin/integraciones`

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${INTEGRACIONES}?gcal=denied`)
  }

  // Validar state + nonce
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = decoded.userId
    if (decoded.intent !== 'platform_calendar') throw new Error('intent inválido')
    const savedNonce = req.cookies.get('platform_oauth_nonce')?.value
    if (!decoded.nonce || !savedNonce || decoded.nonce !== savedNonce) {
      const resp = NextResponse.redirect(`${INTEGRACIONES}?gcal=invalid_state`)
      resp.cookies.delete('platform_oauth_nonce')
      return resp
    }
  } catch {
    return NextResponse.redirect(`${INTEGRACIONES}?gcal=error`)
  }

  // Verificar que el usuario autenticado coincide con el del state
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${INTEGRACIONES}?gcal=unauthenticated`)
  }

  // Verificar que es superadmin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data: pa } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!pa) {
    return NextResponse.redirect(`${INTEGRACIONES}?gcal=forbidden`)
  }

  try {
    const oauth = getOAuthClient()
    const { tokens } = await oauth.getToken(code)
    if (!tokens.refresh_token) {
      // Sin refresh_token: usuario ya autorizó antes. Forzar reauth.
      return NextResponse.redirect(`${INTEGRACIONES}?gcal=no_refresh`)
    }

    // Obtener email del calendar
    oauth.setCredentials(tokens)
    const ui = google.oauth2({ version: 'v2', auth: oauth })
    const { data: profile } = await ui.userinfo.get()

    await adm.from('platform_integrations').upsert({
      user_id: user.id,
      provider: 'google_calendar',
      refresh_token: tokens.refresh_token,
      calendar_id: 'primary',
      calendar_email: profile.email ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' })

    const resp = NextResponse.redirect(`${INTEGRACIONES}?gcal=connected`)
    resp.cookies.delete('platform_oauth_nonce')
    return resp
  } catch (err) {
    console.error('[gcal/callback] error:', (err as Error).message)
    return NextResponse.redirect(`${INTEGRACIONES}?gcal=error`)
  }
}
