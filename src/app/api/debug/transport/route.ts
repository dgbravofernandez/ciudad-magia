import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Endpoint PÚBLICO de diagnóstico rápido del transport email.
 * No expone secretos (solo si están configurados y los primeros caracteres).
 * Sin auth porque NO devuelve nada sensible.
 */
export async function GET() {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.MARKETING_FROM_EMAIL
  const replyTo = process.env.MARKETING_REPLY_TO
  const gmailUser = process.env.MARKETING_GMAIL_USER
  const gmailPass = process.env.MARKETING_GMAIL_APP_PASSWORD

  const resendOk = !!resendKey
  const fromOk = !!fromEmail
  const replyOk = !!replyTo
  const gmailUserOk = !!gmailUser
  const gmailPassOk = !!gmailPass

  const willUseResend = resendOk && fromOk
  const willUseGmail = !willUseResend && gmailUserOk && gmailPassOk

  return NextResponse.json({
    transport_que_se_usara: willUseResend ? '✅ RESEND' : willUseGmail ? '⚠️ GMAIL (fallback)' : '❌ NINGUNO',
    config: {
      RESEND_API_KEY: resendOk ? `${resendKey!.slice(0, 7)}... (${resendKey!.length} chars)` : '❌ NO configurada',
      MARKETING_FROM_EMAIL: fromOk ? fromEmail : '❌ NO configurada',
      MARKETING_REPLY_TO: replyOk ? replyTo : '❌ NO configurada (usará el FROM)',
      MARKETING_GMAIL_USER: gmailUserOk ? gmailUser : '— sin configurar',
      MARKETING_GMAIL_APP_PASSWORD: gmailPassOk ? `${gmailPass!.length} chars` : '— sin configurar',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? '— sin configurar',
    },
    diagnostico: willUseResend
      ? 'Resend activo. Si llega a Promociones, mira el FROM del email recibido: si es hola@cluberly.club -> es Gmail clasificando; si es iakevoapp@gmail.com -> Resend falló y cayó a Gmail.'
      : willUseGmail
        ? 'Estás mandando vía Gmail SMTP. Por eso va a Promociones. Configura RESEND_API_KEY + MARKETING_FROM_EMAIL en Vercel y haz redeploy.'
        : 'NO HAY TRANSPORT CONFIGURADO. Los emails fallarán. Configura Resend en Vercel.',
    deploy_id: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || '?',
  })
}
