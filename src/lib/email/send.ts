import nodemailer from 'nodemailer'

// ── Configuración de transporte ────────────────────────────────────────────
// Prioridad:
//   1. SMTP genérico (SMTP_HOST + SMTP_USER + SMTP_PASS)  ← para info@efciudaddegetafe
//   2. Gmail legacy  (GMAIL_USER + GMAIL_APP_PASSWORD)    ← fallback

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '465', 10)
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'   // true por defecto (port 465)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

// Dirección desde la que se envía (puede ser distinta al SMTP_USER para aliases)
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM ?? SMTP_USER ?? GMAIL_USER
const CLUB_NAME = process.env.CLUB_EMAIL_NAME ?? 'E.F. Ciudad de Getafe'
const BCC_ADDRESS = process.env.EMAIL_BCC ?? EMAIL_FROM_ADDRESS

function createTransport() {
  // Opción 1: SMTP genérico
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  }
  // Opción 2: Gmail legacy
  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  }
  return null
}

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export interface EmailPayload {
  to: string
  subject: string
  html: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export async function sendHtmlEmail(payload: EmailPayload): Promise<{ sent: boolean; error?: string }> {
  const transport = createTransport()

  if (!transport) {
    const smtpOk = !!(SMTP_HOST && SMTP_USER && SMTP_PASS)
    const gmailOk = !!(GMAIL_USER && GMAIL_APP_PASSWORD)
    console.warn(
      `[email] Sin transporte configurado. SMTP=${smtpOk ? 'OK' : 'FALTA (SMTP_HOST/SMTP_USER/SMTP_PASS)'}` +
      ` | Gmail=${gmailOk ? 'OK' : 'FALTA (GMAIL_USER/GMAIL_APP_PASSWORD)'}` +
      ` | Email NO enviado a: ${payload.to}`
    )
    return { sent: false, error: 'email_not_configured' }
  }

  console.log(`[email] Enviando desde ${EMAIL_FROM_ADDRESS} → ${payload.to} | ${payload.subject}`)

  try {
    await transport.sendMail({
      from: `${CLUB_NAME} <${EMAIL_FROM_ADDRESS}>`,
      to: payload.to,
      bcc: BCC_ADDRESS !== payload.to ? BCC_ADDRESS : undefined,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo ?? EMAIL_FROM_ADDRESS,
      attachments: payload.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/pdf',
      })),
    })
    console.log(`[email] Enviado correctamente a ${payload.to}`)
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Send failed:', message)
    return { sent: false, error: message }
  }
}
