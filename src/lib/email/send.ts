import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const CLUB_NAME = 'Escuela de Fútbol Ciudad de Getafe'
const BCC_ADDRESS = process.env.GMAIL_BCC ?? GMAIL_USER // copia oculta al club

function createTransport() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  })
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
    // Credentials not configured — log warning and return gracefully
    console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD not set. Email not sent to:', payload.to)
    return { sent: false, error: 'email_not_configured' }
  }

  try {
    await transport.sendMail({
      from: `${CLUB_NAME} <${GMAIL_USER}>`,
      to: payload.to,
      bcc: BCC_ADDRESS,
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo ?? GMAIL_USER,
      attachments: payload.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/pdf',
      })),
    })
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[email] Send failed:', message)
    return { sent: false, error: message }
  }
}
