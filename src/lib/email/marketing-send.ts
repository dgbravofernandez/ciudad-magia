// Transport de marketing — prefiere Resend (gratis 3000/mes, DKIM/SPF/DMARC
// reales con dominio propio) y cae a Gmail SMTP si Resend no está configurado.
//
// Configuración en Vercel:
//   RESEND_API_KEY=re_xxx                  ← preferido (Inbox real, no Promociones)
//   MARKETING_FROM_EMAIL=hola@cluberly.club ← solo con dominio verificado en Resend
//
// Fallback (si NO hay Resend o falla):
//   MARKETING_GMAIL_USER=iakevoapp@gmail.com
//   MARKETING_GMAIL_APP_PASSWORD=<16 chars>

import nodemailer from 'nodemailer'
import { Resend } from 'resend'

interface MarketingEmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  fromName: string
  replyTo?: string
  unsubscribeUrl?: string  // Para List-Unsubscribe one-click (RFC 8058)
}

const RESEND_KEY = process.env.RESEND_API_KEY
const MARKETING_FROM = process.env.MARKETING_FROM_EMAIL ?? 'hola@cluberly.club'
// Reply-To por defecto va al dominio propio para NO exponer Gmail personal
// en headers públicos de 2000+ emails de campaña (vector de spear-phishing).
// IMPORTANTE: hay que configurar email forwarding del dominio (Cloudflare Email
// Routing gratis, o alias en Resend) para que las respuestas a hola@cluberly.club
// se reenvíen a iakevoapp@gmail.com. Sin ese setup, las respuestas se pierden.
const MARKETING_REPLY_TO = process.env.MARKETING_REPLY_TO ?? 'hola@cluberly.club'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!RESEND_KEY) return null
  if (!_resend) _resend = new Resend(RESEND_KEY)
  return _resend
}

async function sendViaResend(payload: MarketingEmailPayload): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) return { sent: false, error: 'resend_not_configured' }

  try {
    const extraHeaders: Record<string, string> = {}
    if (payload.unsubscribeUrl) {
      extraHeaders['List-Unsubscribe'] = `<${payload.unsubscribeUrl}>, <mailto:${MARKETING_FROM}?subject=baja>`
      extraHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
    const { error } = await resend.emails.send({
      from: `${payload.fromName} <${MARKETING_FROM}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
      replyTo: payload.replyTo ?? MARKETING_REPLY_TO,
      headers: extraHeaders,
    })
    if (error) {
      console.error(`[resend] ✗ ${payload.to}: ${error.message}`)
      return { sent: false, error: error.message }
    }
    console.log(`[resend] ✓ ${payload.to}`)
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[resend] ✗ ${payload.to}: ${message}`)
    return { sent: false, error: message }
  }
}

async function sendViaGmail(payload: MarketingEmailPayload): Promise<{ sent: boolean; error?: string }> {
  const user = process.env.MARKETING_GMAIL_USER
  const pass = process.env.MARKETING_GMAIL_APP_PASSWORD
  if (!user || !pass) {
    return { sent: false, error: 'gmail_not_configured' }
  }
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  try {
    const extraHeaders: Record<string, string> = {}
    if (payload.unsubscribeUrl) {
      extraHeaders['List-Unsubscribe'] = `<${payload.unsubscribeUrl}>, <mailto:${MARKETING_REPLY_TO}?subject=baja>`
      extraHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
    const info = await transport.sendMail({
      from: `${payload.fromName} <${user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
      replyTo: payload.replyTo ?? MARKETING_REPLY_TO,
      headers: extraHeaders,
    })
    console.log(`[gmail] ✓ ${payload.to} (id: ${info.messageId})`)
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[gmail] ✗ ${payload.to}: ${message}`)
    return { sent: false, error: message }
  }
}

/**
 * Envía con la mejor opción disponible:
 * 1. Resend (mejor deliverability con dominio propio + DKIM/SPF/DMARC)
 * 2. Gmail SMTP (fallback si Resend falla o no está configurado)
 */
export async function sendMarketingEmail(payload: MarketingEmailPayload): Promise<{ sent: boolean; error?: string }> {
  // Prefiere Resend si está configurado
  if (RESEND_KEY) {
    const r = await sendViaResend(payload)
    if (r.sent) return r
    // Si Resend falla, intenta Gmail como fallback
    console.warn('[marketing] Resend falló, intentando Gmail...')
    const g = await sendViaGmail(payload)
    if (g.sent) return g
    return { sent: false, error: `Resend: ${r.error} | Gmail: ${g.error}` }
  }

  // Sin Resend, va directo a Gmail
  return sendViaGmail(payload)
}
