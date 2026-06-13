// Transport dedicado para marketing outbound — aislado del email transaccional
// del club para no quemar reputación de la cuenta principal.
//
// Configurar en Vercel envs:
//   MARKETING_GMAIL_USER=iakevoapp@gmail.com
//   MARKETING_GMAIL_APP_PASSWORD=<app password 16 chars sin espacios>
//
// Sin esas envs, falla con error claro.

import nodemailer from 'nodemailer'

interface MarketingEmailPayload {
  to: string
  subject: string
  html: string
  fromName: string
  replyTo?: string
}

export async function sendMarketingEmail(payload: MarketingEmailPayload): Promise<{ sent: boolean; error?: string }> {
  const user = process.env.MARKETING_GMAIL_USER
  const pass = process.env.MARKETING_GMAIL_APP_PASSWORD
  if (!user || !pass) {
    return { sent: false, error: 'MARKETING_GMAIL_USER/MARKETING_GMAIL_APP_PASSWORD no configurados en Vercel' }
  }

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })

  try {
    // INBOX-friendly: SIN Precedence:bulk ni X-Mailer (delatan envío masivo).
    // List-Unsubscribe se mantiene porque Gmail/Yahoo lo exigen para >5k/día y
    // NO clasifica a Promociones por su presencia (sí por su ausencia o por
    // 'Precedence: bulk'). Sin él además aumenta riesgo de Spam.
    const info = await transport.sendMail({
      from: `${payload.fromName} <${user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo ?? user,
      headers: {
        'List-Unsubscribe': `<mailto:${user}?subject=baja>`,
      },
    })
    console.log(`[marketing] ✓ ${payload.to} (id: ${info.messageId})`)
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[marketing] ✗ ${payload.to}: ${message}`)
    return { sent: false, error: message }
  }
}
