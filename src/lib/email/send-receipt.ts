'use server'
/**
 * Helper compartido para enviar email de confirmación de pago con justificante PDF.
 * Usado por Contabilidad, Torneos, Ropa y Actividades.
 *
 * Renderiza usando el sistema unificado (src/lib/email/render-template.ts) →
 * el club edita la plantilla 'payment_receipt' en /configuracion/plantillas-email
 * y los datos del pago se inyectan como variables. El branding (logo + color +
 * footer) sale del wrapper común.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendHtmlEmail } from '@/lib/email/send'
import { renderClubEmail } from '@/lib/email/render-template'
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

export async function sendPaymentReceiptEmail(
  params: ReceiptEmailParams,
): Promise<{ sent: boolean; error?: string }> {
  const receiptNumber = params.paymentId
    ? `REC-${params.paymentId.slice(0, 8).toUpperCase()}`
    : `REC-${Date.now().toString(36).toUpperCase()}`

  // Branding del club (para generar el PDF). El branding del HTML lo aplica
  // el wrapper de render-template, no hace falta tocarlo aquí.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  let clubName = 'El Club'
  let logoUrl: string | null = null
  let primaryColor = '#0d2e6e'
  try {
    const { data } = await sb.from('clubs').select('name, logo_url, primary_color').eq('id', params.clubId).single()
    if (data?.name) clubName = data.name
    logoUrl = data?.logo_url ?? null
    primaryColor = data?.primary_color ?? primaryColor
  } catch (err) {
    console.error('[receipt] fetch branding falló, usando defaults:', err)
  }

  // PDF — si falla, enviar el email SIN adjunto en vez de abortar todo
  let pdfBuffer: Buffer | null = null
  try {
    pdfBuffer = await generateReceiptPDF({
      playerName: params.playerName, teamName: params.teamName, amount: params.amount,
      method: params.method, date: params.date, concept: params.concept,
      receiptNumber, clubName, logoUrl, primaryColor,
    })
  } catch (err) {
    console.error('[receipt] generateReceiptPDF falló, se envía email sin adjunto:', err)
    pdfBuffer = null
  }

  const formattedAmount = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(params.amount)
  const formattedDate = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(params.date))
  const methodLabel = ({ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' } as Record<string, string>)[params.method] ?? params.method

  // Render unificado: el club edita la plantilla 'payment_receipt' desde la UI
  // y el wrapper aplica branding. Si no hay plantilla en BD, cae al DEFAULT
  // limpio (sin estilo Getafe).
  const rendered = await renderClubEmail('payment_receipt', params.clubId, {
    jugador_nombre: params.playerName,
    equipo: params.teamName,
    concepto: params.concept,
    importe_pagado: formattedAmount,
    fecha_pago: formattedDate,
    forma_pago: methodLabel,
    numero_recibo: receiptNumber,
  })

  const result = await sendHtmlEmail({
    to: params.tutorEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    fromName: rendered.fromName,
    replyTo: rendered.replyTo,
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
