import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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
  const state = req.nextUrl.searchParams.get('state')  // contiene clubId + nonce
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${INTEGRACIONES}?google=denied`)
  }

  let clubId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    clubId = decoded.clubId
    if (!clubId) throw new Error('sin clubId en state')

    // SEC-1: Validar nonce CSRF — comparar con el guardado en cookie httpOnly
    const savedNonce = req.cookies.get('oauth_nonce')?.value
    if (!decoded.nonce || !savedNonce || decoded.nonce !== savedNonce) {
      console.warn('[google/callback] nonce inválido — posible ataque CSRF', {
        hasNonceInState: !!decoded.nonce,
        hasCookieNonce: !!savedNonce,
      })
      const response = NextResponse.redirect(`${INTEGRACIONES}?google=invalid_state`)
      response.cookies.delete('oauth_nonce')
      return response
    }

    // SEC-3: Verificar que el usuario autenticado pertenece al clubId del state
    // Evita que un admin de Club A manipule el state para inyectar tokens en Club B
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) {
      const response = NextResponse.redirect(`${INTEGRACIONES}?google=unauthenticated`)
      response.cookies.delete('oauth_nonce')
      return response
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAdmin = createAdminClient() as any
    const { data: membership } = await sbAdmin
      .from('club_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('club_id', clubId)
      .maybeSingle()
    if (!membership) {
      console.warn('[google/callback] usuario no pertenece al club del state — posible ataque', { userId: user.id, clubId })
      const response = NextResponse.redirect(`${INTEGRACIONES}?google=invalid_state`)
      response.cookies.delete('oauth_nonce')
      return response
    }
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

    // Limpiar nonce tras uso exitoso
    const successResponse = NextResponse.redirect(`${INTEGRACIONES}?google=connected`)
    successResponse.cookies.delete('oauth_nonce')
    return successResponse
  } catch (e) {
    console.error('[google/callback]', e)
    const errorResponse = NextResponse.redirect(`${INTEGRACIONES}?google=error`)
    errorResponse.cookies.delete('oauth_nonce')
    return errorResponse
  }
}
