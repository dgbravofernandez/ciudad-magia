import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOAuthClient } from '@/lib/google/oauth'
import { google } from 'googleapis'

// ──────────────────────────────────────────────────────────────
// Google OAuth2 callback
// Google redirige aquí con ?code=... tras que el usuario autoriza.
// ──────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const INTEGRACIONES = `${APP_URL}/configuracion/integraciones`

export async function GET(req: NextRequest) {
  const code  = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')  // contiene clubId
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${INTEGRACIONES}?google=denied`)
  }

  let clubId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    clubId = decoded.clubId
    if (!clubId) throw new Error('sin clubId en state')
  } catch {
    return NextResponse.redirect(`${INTEGRACIONES}?google=error`)
  }

  try {
    const oauth2Client = getOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      // Sin refresh_token: usuario ya había autorizado antes.
      // Forzar revocación y re-auth (prompt=consent lo evita normalmente).
      return NextResponse.redirect(`${INTEGRACIONES}?google=no_refresh`)
    }

    // Obtener email del usuario
    let googleEmail: string | null = null
    try {
      oauth2Client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const info = await oauth2.userinfo.get()
      googleEmail = info.data.email ?? null
    } catch { /* no crítico */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    await sb
      .from('club_settings')
      .update({
        google_refresh_token: tokens.refresh_token,
        google_service_email: googleEmail,
      })
      .eq('club_id', clubId)

    return NextResponse.redirect(`${INTEGRACIONES}?google=connected`)
  } catch (e) {
    console.error('[google/callback]', e)
    return NextResponse.redirect(`${INTEGRACIONES}?google=error`)
  }
}
