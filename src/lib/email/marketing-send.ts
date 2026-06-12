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
    const info = await transport.sendMail({
      from: `${payload.fromName} <${user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo ?? user,
      headers: {
        // Lista de baja: requerido por Gmail/Yahoo para envíos masivos B2B
        'List-Unsubscribe': `<mailto:${user}?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Precedence': 'bulk',
        'X-Mailer': 'Cluberly/1.0',
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
