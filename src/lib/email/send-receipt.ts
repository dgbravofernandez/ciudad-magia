'use server'
/**
 * Helper compartido para enviar email de confirmación de pago con justificante PDF.
 * Usado por Contabilidad, Torneos, Ropa y Actividades.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendHtmlEmail } from '@/lib/email/send'
import { generateReceiptPDF } from '@/lib/pdf/generate-receipt'

export interface ReceiptEmailParams {
  paymentId?: string        // opcional: si existe, se marca email_sent=true en la tabla indicada
  paymentTable?: string     // 'quota_payments' | ninguna (solo para cuotas)
  tutorEmail: string
  playerName: string
  teamName: string
  amount: number
  method: string
  date: string
  concept: string
  clubId: string
}

interface ClubBranding {
  name: string
  logoUrl: string | null
  primaryColor: string | null
}

async function fetchClubBranding(clubId: string): Promise<ClubBranding> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('clubs')
    .select('name, logo_url, primary_color')
    .eq('id', clubId)
    .single()
  return {
    name: data?.name ?? 'Escuela de Fútbol Ciudad de Getafe',
    logoUrl: data?.logo_url ?? null,
    primaryColor: data?.primary_color ?? '#0d2e6e',
  }
}

export async function sendPaymentReceiptEmail(
  params: ReceiptEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  const receiptNumber = params.paymentId
    ? `REC-${params.paymentId.slice(0, 8).toUpperCase()}`
    : `REC-${Date.now().toString(36).toUpperCase()}`

  // Branding — si falla, usar valores por defecto (no abortar el email)
  let branding: ClubBranding
  try {
    branding = await fetchClubBranding(params.clubId)
  } catch (err) {
    console.error('[receipt] fetchClubBranding falló, usando defaults:', err)
    branding = { name: 'Escuela de Fútbol Ciudad de Getafe', logoUrl: null, primaryColor: '#0d2e6e' }
  }

  // PDF — si falla, enviar el email SIN adjunto en vez de abortar todo
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateReceiptPDF({
      playerName: params.playerName,
      teamName:   params.teamName,
      amount:     params.amount,
      method:     params.method,
      date:       params.date,
      concept:    params.concept,
      receiptNumber,
      clubName:     branding.name,
      logoUrl:      branding.logoUrl,
      primaryColor: branding.primaryColor ?? undefined,
    })
  } catch (err) {
    console.error('[receipt] generateReceiptPDF falló, se envía email sin adjunto:', err)
    pdfBuffer = null
  }

  const formattedAmount = new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR',
  }).format(params.amount)

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(new Date(params.date))

  const primaryColor = branding.primaryColor ?? '#0d2e6e'

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header color -->
        <tr>
          <td style="background:${primaryColor};padding:24px 36px;text-align:center;">
            <p style="margin:0;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:2px;text-transform:uppercase;">
              ${branding.name}
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:1px;text-transform:uppercase;">
              Confirmación de pago
            </p>
          </td>
        </tr>

        <!-- Importe destacado -->
        <tr>
          <td style="background:#fafafa;border-bottom:1px solid #eee;padding:28px 36px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Total pagado</p>
            <p style="margin:0;font-size:36px;font-weight:700;color:#16a34a;">${formattedAmount}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#aaa;">${receiptNumber} · ${formattedDate}</p>
          </td>
        </tr>

        <!-- Cuerpo -->
        <tr>
          <td style="padding:28px 36px;">
            <p style="margin:0 0 20px;color:#444;font-size:15px;line-height:1.6;">
              Estimada familia,
            </p>
            <p style="margin:0 0 20px;color:#444;font-size:15px;line-height:1.6;">
              Confirmamos la recepción del pago correspondiente a <strong>${params.playerName}</strong>:
            </p>

            <!-- Tabla detalles -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;">
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 16px;font-size:13px;color:#888;width:45%;">Concepto</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#222;">${params.concept}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#888;border-top:1px solid #eee;">Jugador</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#222;border-top:1px solid #eee;">${params.playerName}</td>
              </tr>
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 16px;font-size:13px;color:#888;border-top:1px solid #eee;">Equipo / Categoría</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#222;border-top:1px solid #eee;">${params.teamName}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:13px;color:#888;border-top:1px solid #eee;">Forma de pago</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#222;border-top:1px solid #eee;">${
                  ({ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' }[params.method] ?? params.method)
                }</td>
              </tr>
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 16px;font-size:13px;color:#888;border-top:1px solid #eee;">Fecha</td>
                <td style="padding:10px 16px;font-size:13px;font-weight:700;color:#222;border-top:1px solid #eee;">${formattedDate}</td>
              </tr>
            </table>

            <p style="margin:24px 0 0;color:#666;font-size:14px;line-height:1.6;">
              Adjuntamos el justificante de pago en PDF para sus registros.
            </p>
            <p style="margin:16px 0 0;color:#444;font-size:14px;line-height:1.6;">
              Muchas gracias por su confianza.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${primaryColor};padding:16px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.75);">
              ${branding.name} · Este email es un justificante oficial de pago
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  const result = await sendHtmlEmail({
    to: params.tutorEmail,
    subject: `Confirmación de pago — ${params.playerName}`,
    html,
    attachments: pdfBuffer
      ? [{
          filename: `Justificante_${params.playerName.replace(/\s+/g, '_')}_${params.date}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }]
      : undefined,
  })

  // Si hay paymentId y tabla, marcar email_sent=true
  if (result.sent && params.paymentId && params.paymentTable) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    await sb.from(params.paymentTable).update({ email_sent: true }).eq('id', params.paymentId)
  }

  return { sent: result.sent, error: result.error }
}
