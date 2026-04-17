'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { generateReceiptPDF } from '@/lib/pdf/generate-receipt'
import { sendHtmlEmail } from '@/lib/email/send'
import { assertNotLocked } from '@/lib/accounting/lock'

// Map Spanish UI labels to DB enum values
const METHOD_MAP: Record<string, string> = {
  efectivo: 'cash',
  tarjeta: 'card',
  transferencia: 'transfer',
  cash: 'cash',
  card: 'card',
  transfer: 'transfer',
}

function toDbMethod(method: string): string {
  return METHOD_MAP[method] ?? method
}

async function resolveClubAndMember() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const headersList = await headers()
  let clubId = headersList.get('x-club-id') ?? ''
  const memberId = headersList.get('x-member-id') ?? ''

  if (!clubId) {
    clubId = (await getClubId()) ?? ''
  }
  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members').select('club_id').eq('user_id', user.id).eq('active', true).limit(1).single()
      clubId = member?.club_id ?? ''
    }
  }

  return { sb, clubId, memberId }
}

export async function registerPayment(data: {
  playerId: string
  playerName: string
  teamName: string
  tutorEmail: string | null
  amount: number
  method: string
  date: string
  notes: string
  clubId: string
  concept?: string
  month?: number
}) {
  const { sb, memberId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  // Insert quota_payment record
  const { data: payment, error: paymentError } = await sb.from('quota_payments').insert({
    club_id: data.clubId,
    player_id: data.playerId,
    season: getCurrentSeason(),
    month: data.month ?? new Date(data.date).getMonth() + 1,
    concept: data.concept ?? 'Cuota mensual',
    amount_due: data.amount,
    amount_paid: data.amount,
    payment_date: data.date,
    payment_method: dbMethod,
    status: 'paid',
    notes: data.notes || null,
    email_sent: false,
    registered_by: memberId || null,
  }).select('id').single()

  if (paymentError) return { success: false, error: paymentError.message }

  // Create cash_movement record
  const { error: movementError } = await sb.from('cash_movements').insert({
    club_id: data.clubId,
    type: 'income',
    amount: data.amount,
    payment_method: dbMethod,
    description: `Pago cuota - ${data.playerName}`,
    movement_date: data.date,
    related_payment_id: payment?.id ?? null,
    registered_by: memberId || null,
  })

  if (movementError) return { success: false, error: movementError.message }

  // Send PDF receipt email — must await (Vercel kills serverless after response)
  // Use a timeout so the UI doesn't hang forever if email is slow
  let emailSent = false
  if (data.tutorEmail && payment?.id) {
    try {
      const emailPromise = sendPaymentReceiptEmail({
        paymentId: payment.id,
        tutorEmail: data.tutorEmail,
        playerName: data.playerName,
        teamName: data.teamName,
        amount: data.amount,
        method: dbMethod,
        date: data.date,
        concept: data.concept ?? 'Cuota mensual',
        clubId: data.clubId,
      })
      // 15s timeout — enough for PDF + email, won't hang forever
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 15000)
      )
      await Promise.race([emailPromise, timeout])
      emailSent = true
    } catch (err) {
      console.error('[accounting] PDF/email error:', err)
      // Payment already registered — email failure is not fatal
    }
  }

  revalidatePath('/contabilidad/pagos')
  return { success: true, paymentId: payment?.id, emailSent }
}

export async function deletePayment(paymentId: string) {
  const { sb, clubId } = await resolveClubAndMember()

  // Lock check against the payment's date
  const { data: existing } = await sb
    .from('quota_payments').select('payment_date').eq('id', paymentId).single()
  if (existing?.payment_date) {
    const check = await assertNotLocked(existing.payment_date, clubId)
    if (!check.ok) return { success: false, error: check.error }
  }

  // Delete related cash_movement first (FK)
  const { error: movementError } = await sb
    .from('cash_movements')
    .delete()
    .eq('related_payment_id', paymentId)

  if (movementError) return { success: false, error: movementError.message }

  const { error } = await sb.from('quota_payments').delete().eq('id', paymentId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updatePayment(data: {
  paymentId: string
  amount: number
  method: string
  date: string
  notes: string
}) {
  const { sb, clubId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  // Lock check against BOTH old and new date (so you can't sneak a row out of a locked period by moving it)
  const { data: existing } = await sb
    .from('quota_payments').select('payment_date').eq('id', data.paymentId).single()
  if (existing?.payment_date) {
    const oldCheck = await assertNotLocked(existing.payment_date, clubId)
    if (!oldCheck.ok) return { success: false, error: oldCheck.error }
  }
  if (data.date) {
    const newCheck = await assertNotLocked(data.date, clubId)
    if (!newCheck.ok) return { success: false, error: newCheck.error }
  }

  const { error: paymentError } = await sb
    .from('quota_payments')
    .update({
      amount_due: data.amount,
      amount_paid: data.amount,
      payment_date: data.date,
      payment_method: dbMethod,
      notes: data.notes || null,
    })
    .eq('id', data.paymentId)

  if (paymentError) return { success: false, error: paymentError.message }

  // Update related cash_movement too
  const { error: movementError } = await sb
    .from('cash_movements')
    .update({
      amount: data.amount,
      payment_method: dbMethod,
      movement_date: data.date,
    })
    .eq('related_payment_id', data.paymentId)

  if (movementError) return { success: false, error: movementError.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

export async function sendPendingReminders(playerIds: string[]) {
  const { sb, clubId, memberId } = await resolveClubAndMember()

  const records = playerIds.map((playerId) => ({
    club_id: clubId,
    sent_by: memberId || null,
    subject: 'Recordatorio de pago de cuota',
    body_html: '<p>Estimado tutor, le recordamos que tiene una cuota pendiente de pago.</p>',
    recipient_type: 'individual',
    recipient_ids: [playerId],
    template_id: null,
    status: 'sent',
    sent_at: new Date().toISOString(),
  }))

  const { error } = await sb.from('communications').insert(records)

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true, count: playerIds.length }
}

export async function addExpense(formData: FormData) {
  const { sb, clubId, memberId } = await resolveClubAndMember()

  const amount = parseFloat(formData.get('amount') as string)
  const date = formData.get('date') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const method = toDbMethod((formData.get('method') as string) ?? 'cash')

  const { data: expense, error: expenseError } = await sb.from('expenses').insert({
    club_id: clubId,
    category,
    description,
    amount,
    expense_date: date,
    paid_by: memberId || null,
  }).select('id').single()

  if (expenseError) return { success: false, error: expenseError.message }

  const { error: movementError } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'expense',
    amount,
    payment_method: method,
    description,
    movement_date: date,
    related_expense_id: expense?.id ?? null,
    registered_by: memberId || null,
  })

  if (movementError) return { success: false, error: movementError.message }

  revalidatePath('/contabilidad/gastos')
  return { success: true }
}

export async function deleteExpense(expenseId: string) {
  const { sb, clubId } = await resolveClubAndMember()

  const { data: existing } = await sb
    .from('expenses').select('expense_date, club_id').eq('id', expenseId).single()
  if (!existing) return { success: false, error: 'Gasto no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  const check = await assertNotLocked(existing.expense_date, clubId)
  if (!check.ok) return { success: false, error: check.error }

  // Delete linked cash_movement(s)
  const { error: movementErr } = await sb
    .from('cash_movements').delete().eq('related_expense_id', expenseId)
  if (movementErr) return { success: false, error: movementErr.message }

  // If the expense was linked to a tournament_budget_item, un-link it + mark unpaid
  await sb
    .from('tournament_budget_items')
    .update({ is_paid: false, payment_method: null, paid_at: null, related_expense_id: null })
    .eq('related_expense_id', expenseId)

  const { error } = await sb.from('expenses').delete().eq('id', expenseId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/gastos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updateExpense(data: {
  expenseId: string
  amount: number
  date: string
  category: string
  description: string
  method: string
}) {
  const { sb, clubId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  const { data: existing } = await sb
    .from('expenses').select('expense_date, club_id').eq('id', data.expenseId).single()
  if (!existing) return { success: false, error: 'Gasto no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  // Lock check against BOTH old and new date
  const oldCheck = await assertNotLocked(existing.expense_date, clubId)
  if (!oldCheck.ok) return { success: false, error: oldCheck.error }
  if (data.date) {
    const newCheck = await assertNotLocked(data.date, clubId)
    if (!newCheck.ok) return { success: false, error: newCheck.error }
  }

  const { error: expenseErr } = await sb
    .from('expenses')
    .update({
      amount: data.amount,
      expense_date: data.date,
      category: data.category,
      description: data.description,
    })
    .eq('id', data.expenseId)

  if (expenseErr) return { success: false, error: expenseErr.message }

  const { error: movementErr } = await sb
    .from('cash_movements')
    .update({
      amount: data.amount,
      payment_method: dbMethod,
      movement_date: data.date,
      description: data.description,
    })
    .eq('related_expense_id', data.expenseId)

  if (movementErr) return { success: false, error: movementErr.message }

  revalidatePath('/contabilidad/gastos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function closeCash(data: {
  clubId: string
  periodStart: string
  periodEnd: string
  systemCash: number
  realCash: number
  systemCard: number
  realCard: number
  notes: string
  closedBy: string
}) {
  const { sb } = await resolveClubAndMember()

  // cash_difference and card_difference are GENERATED columns — do NOT insert them
  const { error } = await sb.from('cash_closes').insert({
    club_id: data.clubId,
    period_start: data.periodStart,
    period_end: data.periodEnd,
    system_cash: data.systemCash,
    real_cash: data.realCash,
    system_card: data.systemCard,
    real_card: data.realCard,
    notes: data.notes || null,
    closed_by: data.closedBy || null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/caja')
  return { success: true }
}

async function sendPaymentReceiptEmail(params: {
  paymentId: string
  tutorEmail: string
  playerName: string
  teamName: string
  amount: number
  method: string
  date: string
  concept: string
  clubId: string
}) {
  console.log('[receipt] Starting PDF generation for', params.playerName)

  const receiptNumber = `REC-${params.paymentId.slice(0, 8).toUpperCase()}`

  const pdfBuffer = await generateReceiptPDF({
    playerName: params.playerName,
    teamName: params.teamName,
    amount: params.amount,
    method: params.method,
    date: params.date,
    concept: params.concept,
    receiptNumber,
  })

  console.log('[receipt] PDF generated:', pdfBuffer.length, 'bytes')

  const formattedAmount = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(params.amount)

  const formattedDate = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(params.date))

  console.log('[receipt] Sending email to', params.tutorEmail)

  const result = await sendHtmlEmail({
    to: params.tutorEmail,
    subject: `Confirmacion de pago - ${params.playerName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a;">Escuela de Futbol Ciudad de Getafe</h2>
        <p>Estimada familia,</p>
        <p>Le confirmamos que hemos recibido el pago correspondiente a <strong>${params.playerName}</strong> con los siguientes datos:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Concepto:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${params.concept}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Importe:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; color: #16a34a;">${formattedAmount}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Fecha:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${formattedDate}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Equipo:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${params.teamName}</td></tr>
        </table>
        <p>Adjuntamos el justificante de pago en formato PDF para sus registros.</p>
        <p>Muchas gracias por su confianza.</p>
        <p style="margin-top: 20px; color: #666; font-size: 12px;">
          Atentamente,<br/>
          <strong>Escuela de Futbol Ciudad de Getafe</strong>
        </p>
      </div>
    `,
    attachments: [{
      filename: `Recibo_${params.playerName.replace(/\s+/g, '_')}_${params.date}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  })

  console.log('[receipt] Email result:', result)

  if (result.sent) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    await sb.from('quota_payments').update({ email_sent: true }).eq('id', params.paymentId)
  }
}

function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 9) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}
