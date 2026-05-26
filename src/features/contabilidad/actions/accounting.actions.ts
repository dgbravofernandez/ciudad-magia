'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { sendPaymentReceiptEmail as sendReceiptEmail } from '@/lib/email/send-receipt'
import { sendHtmlEmail } from '@/lib/email/send'
import { assertNotLocked } from '@/lib/accounting/lock'
import { logger } from '@/lib/logger'
import { formatCurrency } from '@/lib/utils/currency'

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
  let roles: string[] = []
  try {
    roles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  } catch {
    roles = []
  }

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

  return { sb, clubId, memberId, roles }
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
  season?: string
}) {
  // SEC: usar siempre clubId del contexto de servidor — nunca confiar en data.clubId del cliente
  const { sb, clubId, memberId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  // Buscar registro pendiente existente para este jugador y temporada
  const season = data.season ?? getCurrentSeason()
  const { data: pendingRec } = await sb
    .from('quota_payments')
    .select('id, amount_due, amount_paid')
    .eq('club_id', clubId)
    .eq('player_id', data.playerId)
    .eq('season', season)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let paymentId: string | null = null

  if (pendingRec) {
    // Actualizar el registro pendiente existente → pagado
    const { error: updateErr } = await sb.from('quota_payments').update({
      amount_paid: data.amount,
      amount_due: Number(pendingRec.amount_due), // preservar la deuda original (no máx con el pago parcial)
      payment_date: data.date,
      payment_method: dbMethod,
      status: 'paid',
      notes: data.notes || null,
      email_sent: false,
      registered_by: memberId || null,
    }).eq('id', pendingRec.id)
    if (updateErr) return { success: false, error: updateErr.message }
    paymentId = pendingRec.id
  } else {
    // Sin pendiente previo — crear registro nuevo pagado
    const { data: payment, error: paymentError } = await sb.from('quota_payments').insert({
      club_id: clubId,
      player_id: data.playerId,
      season,
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
    paymentId = payment?.id ?? null
  }

  // Create cash_movement record
  const { error: movementError } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'income',
    amount: data.amount,
    payment_method: dbMethod,
    description: `Pago cuota - ${data.playerName}`,
    movement_date: data.date,
    related_payment_id: paymentId,
    source: 'cuota',
    registered_by: memberId || null,
  })

  if (movementError) return { success: false, error: movementError.message }

  // Send PDF receipt email — must await (Vercel kills serverless after response)
  // Use a timeout so the UI doesn't hang forever if email is slow
  let emailSent = false
  if (data.tutorEmail && paymentId) {
    try {
      const emailPromise = sendReceiptEmail({
        paymentId: paymentId!,
        paymentTable: 'quota_payments',
        tutorEmail: data.tutorEmail,
        playerName: data.playerName,
        teamName: data.teamName,
        amount: data.amount,
        method: dbMethod,
        date: data.date,
        concept: data.concept ?? 'Cuota mensual',
        clubId: clubId,
      })
      // 15s timeout — enough for PDF + email, won't hang forever
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 15000)
      )
      await Promise.race([emailPromise, timeout])
      emailSent = true
    } catch (err) {
      console.error('[accounting] PDF/email error:', err)
      logger.error({ action: 'registerPayment', clubId, memberId, error: (err as Error).message, phase: 'email' })
      // Payment already registered — email failure is not fatal
    }
  }

  logger.info({ action: 'registerPayment', clubId, memberId, amount: data.amount, emailSent })
  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true, paymentId: paymentId ?? undefined, emailSent }
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
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function refundPayment(
  paymentId: string,
  refundMethod: string = 'transfer'
): Promise<{ success: boolean; error?: string }> {
  const { sb, clubId } = await resolveClubAndMember()

  const { data: payment } = await sb
    .from('quota_payments')
    .select('*')
    .eq('id', paymentId)
    .eq('club_id', clubId)
    .single()

  if (!payment) return { success: false, error: 'Pago no encontrado' }
  if ((payment as { status?: string }).status === 'refunded') {
    return { success: false, error: 'Este pago ya fue reembolsado' }
  }

  const today = new Date().toISOString().slice(0, 10)
  const lockCheck = await assertNotLocked(today, clubId)
  if (!lockCheck.ok) return { success: false, error: lockCheck.error }

  const dbMethod = toDbMethod(refundMethod)
  const amount = (payment as { amount_paid: number }).amount_paid

  // Create negative cash movement (reverse) only if the payment had a real cash/card movement
  const { error: movErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    movement_date: today,
    amount: -Math.abs(amount),
    payment_method: dbMethod,
    source: 'cuota',
    concept: `Reembolso cuota (pago ${paymentId.slice(0, 8)})`,
    related_payment_id: paymentId,
  })
  if (movErr) return { success: false, error: movErr.message }

  const notes = [(payment as { notes?: string }).notes, `REEMBOLSADO el ${today}`].filter(Boolean).join(' · ')
  const { error: updErr } = await sb
    .from('quota_payments')
    .update({ status: 'refunded', notes })
    .eq('id', paymentId)
  if (updErr) return { success: false, error: updErr.message }

  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updateQuotaPaymentComment(paymentId: string, comment: string) {
  // Anotaciones son de solo información — cualquier miembro del club puede añadirlas
  const { sb, clubId } = await resolveClubAndMember()

  if (!clubId) return { success: false, error: 'Club no identificado' }

  const { error } = await sb
    .from('quota_payments')
    .update({ admin_comment: comment.trim() || null })
    .eq('id', paymentId)
    .eq('club_id', clubId)

  if (error) {
    logger.error({ action: 'updateQuotaPaymentComment', clubId, paymentId, error: error.message })
    return { success: false, error: error.message }
  }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

/**
 * Recordatorio bulk de pagos pendientes — envía email a cada tutor con la
 * deuda total + métodos de pago + aviso de plaza próxima temporada.
 *
 * Excluye automáticamente los jugadores cuyo pago pendiente está marcado
 * como is_special_case=true (familias ya contactadas, casos especiales…).
 *
 * Devuelve detalle granular: sent, skipped, failed.
 */
import { EMAIL_BATCH_CAP, CLUB_IBAN } from '@/lib/contabilidad/constants'
const EMAIL_DELAY_MS = 2000   // 2s entre emails — evita detección de spam por Gmail

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function sendPendingReminders(playerIds: string[]) {
  const { sb, clubId, memberId } = await resolveClubAndMember()

  if (playerIds.length === 0) {
    return { success: false, error: 'No hay jugadores seleccionados' }
  }

  if (playerIds.length > EMAIL_BATCH_CAP) {
    return {
      success: false,
      error: `Máximo ${EMAIL_BATCH_CAP} jugadores por lote (límite de tiempo del servidor). Usa el envío por lotes desde la UI.`,
    }
  }

  // 1. Cargar jugadores + total pendiente + flag caso especial
  const { data: players } = await sb
    .from('players')
    .select('id, first_name, last_name, tutor_name, tutor_email')
    .eq('club_id', clubId)
    .in('id', playerIds)

  const { data: pendings } = await sb
    .from('quota_payments')
    .select('player_id, amount_due, amount_paid, is_special_case')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .in('player_id', playerIds)

  // Agrupar por jugador: total pendiente + marca de caso especial
  const byPlayer: Record<string, { total: number; specialCase: boolean }> = {}
  for (const p of (pendings ?? [])) {
    if (!byPlayer[p.player_id]) byPlayer[p.player_id] = { total: 0, specialCase: false }
    byPlayer[p.player_id].total += (Number(p.amount_due) - Number(p.amount_paid))
    if (p.is_special_case) byPlayer[p.player_id].specialCase = true
  }

  // 2. Obtener nombre del club + email remitente para la plantilla
  const { data: clubData } = await sb
    .from('clubs').select('name').eq('id', clubId).single()
  const clubName = clubData?.name ?? 'Club'

  let sent = 0
  let skippedSpecial = 0
  let skippedNoEmail = 0
  let skippedNoDebt = 0
  let failed = 0
  const errorList: string[] = []

  // 3. Para cada jugador → enviar email
  const playersList = players ?? []
  for (let i = 0; i < playersList.length; i++) {
    const player = playersList[i]
    const info = byPlayer[player.id]

    if (info?.specialCase) { skippedSpecial++; continue }
    if (!info || info.total <= 0) { skippedNoDebt++; continue }
    if (!player.tutor_email) { skippedNoEmail++; continue }

    const tutorName = (player.tutor_name ?? '').trim() || 'familia'
    const playerName = `${player.first_name} ${player.last_name}`.trim()
    const debtStr = formatCurrency(info.total)

    const html = buildReminderHtml({
      tutorName, playerName, debtStr, clubName,
    })

    // Versión plain text para reducir spam score (Gmail penaliza emails solo-HTML)
    const text = [
      `Estimada ${tutorName},`,
      '',
      `Le informamos que ${playerName} tiene una cuota pendiente de ${debtStr} con ${clubName}.`,
      '',
      'MÉTODOS DE PAGO:',
      `  · Transferencia bancaria: ${CLUB_IBAN} (${clubName})`,
      '  · En las oficinas del club',
      '',
      'Por favor, realice el pago a la mayor brevedad posible.',
      '',
      `Un saludo,`,
      clubName,
    ].join('\n')

    try {
      const sendPromise = sendHtmlEmail({
        to: player.tutor_email,
        subject: `Cuota pendiente — ${playerName}`,
        html,
        text,
      })
      const timeout = new Promise<void>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 20000)
      )
      await Promise.race([sendPromise, timeout])
      sent++

      // Registrar el envío en communications
      await sb.from('communications').insert({
        club_id: clubId,
        sent_by: memberId || null,
        subject: `Cuota pendiente — ${playerName}`,
        body_html: html,
        recipient_type: 'individual',
        recipient_ids: [player.id],
        template_id: null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    } catch (e) {
      failed++
      errorList.push(`${playerName}: ${(e as Error).message}`)
    } finally {
      // Throttle entre TODOS los intentos (éxito o fallo) — evita detección de spam
      // No dormimos tras el último jugador del lote
      if (i < playersList.length - 1) {
        await sleep(EMAIL_DELAY_MS)
      }
    }
  }

  revalidatePath('/contabilidad/pagos')
  return {
    success: failed === 0,
    sent,
    skippedSpecial,
    skippedNoEmail,
    skippedNoDebt,
    failed,
    errors: errorList.slice(0, 5),  // limit
  }
}

function buildReminderHtml(opts: {
  tutorName: string; playerName: string; debtStr: string; clubName: string
}) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

  <!-- Cabecera -->
  <div style="background:#1a1a1a;padding:24px 32px;text-align:center;">
    <p style="color:#ffcc00;font-size:20px;font-weight:bold;margin:0;letter-spacing:1px;">E.F. CIUDAD DE GETAFE</p>
    <p style="color:#ffffff;font-size:12px;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">Recordatorio de pago de cuotas</p>
  </div>

  <!-- Franja amarilla -->
  <div style="background:#ffcc00;height:4px;"></div>

  <!-- Cuerpo -->
  <div style="padding:32px;">

    <p style="font-size:15px;color:#333;margin:0 0 16px;">Estimado/a <strong>${opts.tutorName}</strong>,</p>

    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px;">
      Le escribimos para recordarle que <strong>${opts.playerName}</strong> tiene <strong>cuotas pendientes</strong> de pago correspondientes a la temporada actual.
    </p>

    <!-- Importe pendiente destacado -->
    <div style="background:#fffbe6;border-left:4px solid #ffcc00;border-radius:6px;padding:18px 20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Importe pendiente</p>
      <p style="margin:0;font-size:26px;font-weight:bold;color:#b76e00;">${opts.debtStr}</p>
    </div>

    <!-- Aviso plaza próxima temporada -->
    <div style="background:#fff3e0;border-left:4px solid #e05c00;border-radius:6px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#7a3a00;line-height:1.5;">
        ⚠️ <strong>Importante:</strong> para tener derecho a plaza la próxima temporada es necesario haber abonado todas las cuotas pendientes de la temporada actual.
      </p>
    </div>

    <!-- Formas de pago -->
    <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:1px;">Formas de pago</p>

      <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#1a1a1a;">🏦 Transferencia bancaria</p>
      <table style="width:100%;font-size:14px;color:#333;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:3px 0;color:#888;width:130px;">Titular</td><td><strong>CLUB DEPORTIVO ELEMENTAL E.F. CIUDAD DE GETAFE</strong></td></tr>
        <tr><td style="padding:3px 0;color:#888;">Banco</td><td>Caja Rural Jaén</td></tr>
        <tr><td style="padding:3px 0;color:#888;">IBAN</td><td><strong>${CLUB_IBAN}</strong></td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:13px;color:#e05c00;background:#fff3e0;padding:8px 12px;border-radius:4px;">
        ⚠️ <strong>Importante:</strong> Indique en el concepto el nombre completo del jugador/a para identificar correctamente el pago.
      </p>

      <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#1a1a1a;">🏢 En la oficina del club</p>
      <p style="margin:0;font-size:14px;color:#333;">También puede abonar la deuda en efectivo o con tarjeta directamente en nuestras instalaciones.</p>
    </div>

    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 8px;">
      Si ya ha efectuado el pago o existe alguna circunstancia que debamos conocer, le rogamos que conteste a este correo para revisar el caso.
    </p>
    <p style="margin:0 0 24px;">
      <a href="mailto:info@efciudaddegetafe.com" style="color:#ffcc00;font-weight:bold;text-decoration:none;font-size:15px;">📧 info@efciudaddegetafe.com</a>
    </p>

    <p style="font-size:15px;color:#333;line-height:1.7;margin:0;">
      Gracias por su atención.
    </p>

  </div>

  <!-- Pie -->
  <div style="background:#1a1a1a;padding:18px 32px;text-align:center;">
    <p style="color:#ffcc00;font-size:13px;font-weight:bold;margin:0 0 4px;">E.F. Ciudad de Getafe</p>
    <p style="color:#888;font-size:12px;margin:0;">info@efciudaddegetafe.com</p>
  </div>

</div>`
}

/**
 * Marcar / desmarcar un pago pendiente como "caso especial" → excluido del
 * recordatorio bulk. Aplica a TODOS los pagos pendientes del jugador
 * (no solo al firstPendingPaymentId), para que el flag funcione aunque
 * la deuda esté repartida en varios meses.
 */
export async function toggleQuotaSpecialCase(playerId: string, value: boolean) {
  try {
    const { sb, clubId } = await resolveClubAndMember()
    const { error } = await sb
      .from('quota_payments')
      .update({ is_special_case: value })
      .eq('club_id', clubId)
      .eq('player_id', playerId)
      .eq('status', 'pending')
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/pagos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addExpense(formData: FormData) {
  const { sb, clubId, memberId } = await resolveClubAndMember()

  const amount = parseFloat(formData.get('amount') as string)
  const date = formData.get('date') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const method = toDbMethod((formData.get('method') as string) ?? 'cash')
  const receiptUrl = (formData.get('receipt_url') as string | null)?.trim() || null

  const { data: expense, error: expenseError } = await sb.from('expenses').insert({
    club_id: clubId,
    category,
    description,
    amount,
    expense_date: date,
    paid_by: memberId || null,
    receipt_url: receiptUrl,
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
  receipt_url?: string | null
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

  const expensePatch: Record<string, unknown> = {
    amount: data.amount,
    expense_date: data.date,
    category: data.category,
    description: data.description,
  }
  if (data.receipt_url !== undefined) {
    expensePatch.receipt_url = data.receipt_url?.trim() || null
  }
  const { error: expenseErr } = await sb
    .from('expenses')
    .update(expensePatch)
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

export async function reopenCashClose(
  closeId: string
): Promise<{ success: boolean; error?: string }> {
  const { sb, clubId, roles } = await resolveClubAndMember()

  // Only admin/direccion can reopen
  if (!roles.some((r) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Solo admin o dirección pueden reabrir un cierre' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: close } = await (sb as any)
    .from('cash_closes')
    .select('club_id')
    .eq('id', closeId)
    .single()
  if (!close || close.club_id !== clubId) return { success: false, error: 'Cierre no encontrado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('cash_closes').delete().eq('id', closeId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/caja')
  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/gastos')
  return { success: true }
}

// ── updatePlayerTeam ─────────────────────────────────────────────────────────
// Cambia el equipo de un jugador desde la vista de pendientes.
// isNextSeason=true → actualiza next_team_id; false → team_id.
export async function updatePlayerTeam(
  playerId: string,
  teamId: string | null,
  isNextSeason = false,
) {
  const { sb, clubId } = await resolveClubAndMember()

  const field = isNextSeason ? 'next_team_id' : 'team_id'
  const { error } = await sb
    .from('players')
    .update({ [field]: teamId })
    .eq('id', playerId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

// ── updatePendingPaymentAmount ─────────────────────────────────────────────────
// Corrige el importe pendiente de un quota_payment con status='pending'.
export async function updatePendingPaymentAmount(paymentId: string, amountDue: number) {
  const { sb, clubId } = await resolveClubAndMember()

  const { data: existing } = await sb
    .from('quota_payments')
    .select('status, club_id, amount_paid')
    .eq('id', paymentId)
    .single()

  if (!existing) return { success: false, error: 'Pago no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  // amountDue es el importe PENDIENTE que quiere el usuario → amount_due = ya_pagado + pendiente
  const newAmountDue = (Number(existing.amount_paid) || 0) + amountDue

  const { error } = await sb
    .from('quota_payments')
    .update({ amount_due: newAmountDue })
    .eq('id', paymentId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

// ── updateCashMovement ───────────────────────────────────────────────────────
// Edita un movimiento de caja directamente (no cuota). Actualiza también el
// registro enlazado si existe (quota_payment o expense).
export async function updateCashMovement(data: {
  movementId: string
  amount: number
  method: string
  date: string
  description?: string
}) {
  const { sb, clubId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  const { data: existing } = await sb
    .from('cash_movements')
    .select('movement_date, related_payment_id, related_expense_id, club_id')
    .eq('id', data.movementId)
    .single()

  if (!existing) return { success: false, error: 'Movimiento no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  const oldCheck = await assertNotLocked(existing.movement_date, clubId)
  if (!oldCheck.ok) return { success: false, error: oldCheck.error }
  if (data.date) {
    const newCheck = await assertNotLocked(data.date, clubId)
    if (!newCheck.ok) return { success: false, error: newCheck.error }
  }

  // Actualizar cash_movement
  const patch: Record<string, unknown> = {
    amount: data.amount,
    payment_method: dbMethod,
    movement_date: data.date,
  }
  if (data.description) patch.description = data.description

  const { error: movErr } = await sb.from('cash_movements').update(patch).eq('id', data.movementId)
  if (movErr) return { success: false, error: movErr.message }

  // Actualizar registro enlazado si existe
  if (existing.related_payment_id) {
    await sb.from('quota_payments').update({
      amount_paid: data.amount,
      amount_due: data.amount,
      payment_date: data.date,
      payment_method: dbMethod,
    }).eq('id', existing.related_payment_id)
  }
  if (existing.related_expense_id) {
    await sb.from('expenses').update({
      amount: data.amount,
      expense_date: data.date,
    }).eq('id', existing.related_expense_id)
  }

  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 9) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}
