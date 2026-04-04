'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export async function registerPayment(data: {
  playerId: string
  amount: number
  method: string
  date: string
  notes: string
  clubId: string
}) {
  const supabase = await createClient()
  const headersList = await headers()
  const memberId = headersList.get('x-member-id')!

  // Insert quota_payment record
  const { error: paymentError } = await supabase.from('quota_payments').insert({
    club_id: data.clubId,
    player_id: data.playerId,
    season: getCurrentSeason(),
    amount_due: data.amount,
    amount_paid: data.amount,
    payment_date: data.date,
    payment_method: data.method,
    status: 'paid',
    notes: data.notes || null,
    email_sent: true,
  })

  if (paymentError) return { success: false, error: paymentError.message }

  // Create cash_movement record
  const { error: movementError } = await supabase.from('cash_movements').insert({
    club_id: data.clubId,
    type: 'income',
    category: 'quota',
    amount: data.amount,
    payment_method: data.method,
    description: `Pago cuota jugador`,
    player_id: data.playerId,
    movement_date: data.date,
    registered_by: memberId,
  })

  if (movementError) return { success: false, error: movementError.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

export async function sendPendingReminders(playerIds: string[]) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!

  const records = playerIds.map((playerId) => ({
    club_id: clubId,
    sent_by: memberId,
    subject: 'Recordatorio de pago de cuota',
    body_html: '<p>Estimado tutor, le recordamos que tiene una cuota pendiente de pago.</p>',
    recipient_type: 'individual',
    recipient_ids: [playerId],
    template_id: null,
    status: 'sent',
    sent_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('communications').insert(records)

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true, count: playerIds.length }
}

export async function addExpense(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!

  const amount = parseFloat(formData.get('amount') as string)
  const date = formData.get('date') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string

  const { error: expenseError } = await supabase.from('expenses').insert({
    club_id: clubId,
    category,
    description,
    amount,
    expense_date: date,
    registered_by: memberId,
  })

  if (expenseError) return { success: false, error: expenseError.message }

  const { error: movementError } = await supabase.from('cash_movements').insert({
    club_id: clubId,
    type: 'expense',
    category,
    amount,
    payment_method: 'efectivo',
    description,
    movement_date: date,
    registered_by: memberId,
  })

  if (movementError) return { success: false, error: movementError.message }

  revalidatePath('/contabilidad/gastos')
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
  const supabase = await createClient()

  const { error } = await supabase.from('cash_closes').insert({
    club_id: data.clubId,
    period_start: data.periodStart,
    period_end: data.periodEnd,
    system_cash: data.systemCash,
    real_cash: data.realCash,
    system_card: data.systemCard,
    real_card: data.realCard,
    diff_cash: data.realCash - data.systemCash,
    diff_card: data.realCard - data.systemCard,
    notes: data.notes || null,
    closed_by: data.closedBy,
  })

  if (error) return { success: false, error: error.message }

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
