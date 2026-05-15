import { NextRequest, NextResponse } from 'next/server'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { verifyEmailTransports, sendHtmlEmail } from '@/lib/email/send'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico de email — requiere estar autenticado (club context).
 *
 *   GET /api/email-test            → verifica conexión SMTP + Gmail
 *   GET /api/email-test?send=a@b.c → además envía un email de prueba a esa dirección
 */
export async function GET(req: NextRequest) {
  // Gate: solo usuarios autenticados con club
  let clubId: string | null = null
  try {
    const ctx = await getClubContext()
    clubId = ctx.clubId
  } catch {
    clubId = null
  }
  if (!clubId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Estado de las env vars (sin revelar valores sensibles)
  const env = {
    SMTP_HOST:   process.env.SMTP_HOST ? `set (${process.env.SMTP_HOST})` : 'FALTA',
    SMTP_PORT:   process.env.SMTP_PORT ?? '(default 465)',
    SMTP_SECURE: process.env.SMTP_SECURE ?? '(default true)',
    SMTP_USER:   process.env.SMTP_USER ? `set (${process.env.SMTP_USER})` : 'FALTA',
    SMTP_PASS:   process.env.SMTP_PASS ? `set (longitud ${process.env.SMTP_PASS.length})` : 'FALTA',
    EMAIL_FROM:  process.env.EMAIL_FROM ?? '(no set — usa SMTP_USER)',
    EMAIL_BCC:   process.env.EMAIL_BCC ?? '(no set)',
    CLUB_EMAIL_NAME: process.env.CLUB_EMAIL_NAME ?? '(no set)',
    GMAIL_USER:  process.env.GMAIL_USER ? `set (${process.env.GMAIL_USER})` : 'FALTA',
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? `set (longitud ${process.env.GMAIL_APP_PASSWORD.length})` : 'FALTA',
  }

  // Verifica conexión real con los servidores
  const verify = await verifyEmailTransports()

  // Envío de prueba opcional
  const sendTo = req.nextUrl.searchParams.get('send')
  let testEmail: { sent: boolean; error?: string } | null = null
  if (sendTo) {
    testEmail = await sendHtmlEmail({
      to: sendTo,
      subject: 'Prueba de email — Ciudad Magia',
      html: `<p>Este es un email de prueba enviado desde el diagnóstico de Ciudad Magia.</p>
             <p>Si lo recibes, la configuración de correo funciona correctamente.</p>`,
    })
  }

  return NextResponse.json({
    env,
    verify,
    testEmail,
    hint: 'verify.smtp.error / verify.gmail.error indican el problema exacto. ' +
          'Para enviar un email de prueba: /api/email-test?send=tu@correo.com',
  })
}
