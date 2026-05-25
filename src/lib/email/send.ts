import nodemailer from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer'

// ── Configuración de transporte ────────────────────────────────────────────
// Estrategia robusta: intenta SMTP genérico primero; si el envío falla,
// cae automáticamente a Gmail. Así un fallo de credenciales de info@ no
// deja al club entero sin notificaciones.

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '465', 10)
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'   // true por defecto (port 465)
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

const CLUB_NAME = process.env.CLUB_EMAIL_NAME ?? 'E.F. Ciudad de Getafe'

const SMTP_OK = !!(SMTP_HOST && SMTP_USER && SMTP_PASS)
const GMAIL_OK = !!(GMAIL_USER && GMAIL_APP_PASSWORD)

interface TransportOption {
  name: 'smtp' | 'gmail'
  transport: nodemailer.Transporter
  fromAddress: string   // dirección "from" válida para este transporte
}

function buildTransports(): TransportOption[] {
  const opts: TransportOption[] = []

  if (SMTP_OK) {
    opts.push({
      name: 'smtp',
      transport: nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER!, pass: SMTP_PASS! },
      }),
      // from = EMAIL_FROM si está, si no el propio SMTP_USER
      fromAddress: process.env.EMAIL_FROM ?? SMTP_USER!,
    })
  }

  if (GMAIL_OK) {
    opts.push({
      name: 'gmail',
      transport: nodemailer.createTransport({
        service: 'gmail',
        auth: { user: GMAIL_USER!, pass: GMAIL_APP_PASSWORD! },
      }),
      // Gmail SOLO permite "from" = la cuenta autenticada (o un alias verificado).
      // Usamos GMAIL_USER para evitar rechazo del servidor.
      fromAddress: GMAIL_USER!,
    })
  }

  return opts
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
  text?: string          // versión plain text (reduce spam score)
  replyTo?: string
  attachments?: EmailAttachment[]
}

export async function sendHtmlEmail(payload: EmailPayload): Promise<{ sent: boolean; error?: string }> {
  const transports = buildTransports()

  if (transports.length === 0) {
    console.error(
      `[email] SIN TRANSPORTE configurado. ` +
      `SMTP=${SMTP_OK ? 'OK' : 'FALTA (SMTP_HOST/SMTP_USER/SMTP_PASS)'} | ` +
      `Gmail=${GMAIL_OK ? 'OK' : 'FALTA (GMAIL_USER/GMAIL_APP_PASSWORD)'} | ` +
      `Email NO enviado a: ${payload.to}`
    )
    return { sent: false, error: 'email_not_configured' }
  }

  const errors: string[] = []

  for (const opt of transports) {
    const replyTo = payload.replyTo ?? opt.fromAddress
    const bcc = process.env.EMAIL_BCC ?? opt.fromAddress

    const mail: Mail.Options = {
      from: `${CLUB_NAME} <${opt.fromAddress}>`,
      to: payload.to,
      bcc: bcc && bcc !== payload.to ? bcc : undefined,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo,
      // Headers anti-spam requeridos por Gmail para envíos masivos
      headers: {
        'List-Unsubscribe': `<mailto:${opt.fromAddress}?subject=Unsubscribe>`,
        'Precedence': 'bulk',
        'X-Mailer': 'CiudadMagiaCRM/1.0',
      },
      attachments: payload.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/pdf',
      })),
    }

    console.log(`[email] Intentando vía ${opt.name.toUpperCase()} desde ${opt.fromAddress} → ${payload.to} | ${payload.subject}`)

    try {
      const info = await opt.transport.sendMail(mail)
      console.log(`[email] ✓ Enviado correctamente vía ${opt.name.toUpperCase()} a ${payload.to} (messageId: ${info.messageId})`)
      return { sent: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[email] ✗ Fallo vía ${opt.name.toUpperCase()}: ${message}`)
      errors.push(`${opt.name}: ${message}`)
      // sigue al siguiente transporte (fallback)
    }
  }

  console.error(`[email] TODOS los transportes fallaron para ${payload.to}: ${errors.join(' | ')}`)
  return { sent: false, error: errors.join(' | ') }
}

/**
 * Verifica la conexión de todos los transportes configurados.
 * Útil para diagnóstico — no envía ningún email.
 */
export async function verifyEmailTransports(): Promise<{
  smtp: { configured: boolean; ok: boolean; error?: string }
  gmail: { configured: boolean; ok: boolean; error?: string }
}> {
  const result = {
    smtp: { configured: SMTP_OK, ok: false, error: undefined as string | undefined },
    gmail: { configured: GMAIL_OK, ok: false, error: undefined as string | undefined },
  }

  if (SMTP_OK) {
    try {
      const t = nodemailer.createTransport({
        host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
        auth: { user: SMTP_USER!, pass: SMTP_PASS! },
      })
      await t.verify()
      result.smtp.ok = true
    } catch (err) {
      result.smtp.error = err instanceof Error ? err.message : String(err)
    }
  }

  if (GMAIL_OK) {
    try {
      const t = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: GMAIL_USER!, pass: GMAIL_APP_PASSWORD! },
      })
      await t.verify()
      result.gmail.ok = true
    } catch (err) {
      result.gmail.error = err instanceof Error ? err.message : String(err)
    }
  }

  return result
}
