import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de verificación de Sentry.
 * Lanza un error controlado, lo captura explícitamente y lo envía a Sentry.
 * Sirve para comprobar end-to-end que el DSN, la red y las alertas por email funcionan.
 *
 * Protegido: solo superadmin (no genera ruido en producción por visitantes random).
 * Nota: Sentry.init tiene `enabled: production`, así que en local NO envía nada —
 * hay que ejecutarlo en producción (https://cluberly.club/api/debug/sentry-test).
 */
export async function GET() {
  // ── Gate: solo superadmin ──────────────────────────────────────────────────
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data: paRow } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!paRow) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // ── Disparar error controlado y enviarlo a Sentry ───────────────────────────
  const testError = new Error(
    `[PRUEBA SENTRY] Error de verificación lanzado manualmente el ${new Date().toISOString()} por ${user.email}`
  )
  const eventId = Sentry.captureException(testError, {
    tags: { test: 'true', source: 'sentry-test-endpoint' },
  })

  // Forzar el envío antes de responder (en serverless el proceso puede terminar antes de flush)
  await Sentry.flush(3000)

  const enabled = process.env.NODE_ENV === 'production'

  return NextResponse.json({
    ok: true,
    enabled,
    event_id: eventId,
    message: enabled
      ? 'Error de prueba enviado a Sentry. En ~1 minuto debería aparecer en el dashboard y llegarte el email de alerta.'
      : 'En desarrollo Sentry está DESACTIVADO (enabled: production). Ejecuta esto en producción para una prueba real.',
  })
}
