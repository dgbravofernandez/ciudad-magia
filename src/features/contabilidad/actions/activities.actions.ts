'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { sendPaymentReceiptEmail } from '@/lib/email/send-receipt'

const ADMIN_ROLES = ['admin', 'direccion']

function canWrite(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r))
}

export interface Activity {
  id: string
  club_id: string
  name: string
  type: 'campus' | 'tecnificacion' | 'otro'
  description: string | null
  season: string | null
  start_date: string | null
  end_date: string | null
  active: boolean
  created_at: string
}

export interface ActivityCharge {
  id: string
  activity_id: string
  player_id: string | null
  participant_name: string | null
  concept: string | null
  amount: number
  amount_paid: number
  paid: boolean
  payment_method: string | null
  payment_date: string | null
  notes: string | null
  created_at: string
}

export interface ActivityExpense {
  id: string
  activity_id: string
  concept: string
  amount: number
  category: string | null
  receipt_url: string | null
  expense_date: string
  notes: string | null
  created_at: string
}

// ── Activities CRUD ──────────────────────────────────────────────

export async function createActivity(input: {
  name: string
  type: 'campus' | 'tecnificacion' | 'otro'
  description?: string
  season?: string
  start_date?: string
  end_date?: string
}) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    if (!input.name.trim()) return { success: false, error: 'Nombre requerido' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data, error } = await sb
      .from('activities')
      .insert({
        club_id: clubId,
        name: input.name.trim(),
        type: input.type,
        description: input.description?.trim() || null,
        season: input.season || null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
      })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/actividades')
    return { success: true, id: data?.id as string }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateActivity(id: string, input: Partial<Activity>) {
  try {
    const { roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('activities')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/actividades')
    revalidatePath(`/contabilidad/actividades/${id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteActivity(id: string) {
  try {
    const { roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('activities').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/actividades')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Charges ───────────────────────────────────────────────────────

export async function addCharge(input: {
  activityId: string
  playerId?: string | null
  participantName?: string | null
  concept?: string
  amount: number
  paid?: boolean
  paymentMethod?: 'transfer' | 'cash' | 'card' | null
  paymentDate?: string | null
  notes?: string | null
}) {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    if (!input.playerId && !input.participantName?.trim()) {
      return { success: false, error: 'Indica jugador o nombre del participante' }
    }
    if (input.amount < 0) return { success: false, error: 'Importe inválido' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('activity_charges').insert({
      club_id: clubId,
      activity_id: input.activityId,
      player_id: input.playerId ?? null,
      participant_name: input.participantName?.trim() || null,
      concept: input.concept?.trim() || null,
      amount: input.amount,
      paid: !!input.paid,
      payment_method: input.paid ? input.paymentMethod ?? null : null,
      payment_date: input.paid ? input.paymentDate ?? new Date().toISOString().slice(0, 10) : null,
      notes: input.notes?.trim() || null,
      registered_by: memberId || null,
    })
    if (error) return { success: false, error: error.message }

    // Si está pagada en cash/card → registrar en cash_movements
    if (input.paid && (input.paymentMethod === 'cash' || input.paymentMethod === 'card')) {
      await sb.from('cash_movements').insert({
        club_id: clubId,
        type: 'income',
        amount: input.amount,
        payment_method: input.paymentMethod,
        description: `Actividad · ${input.concept ?? ''} ${input.participantName ?? ''}`.trim(),
        movement_date: input.paymentDate ?? new Date().toISOString().slice(0, 10),
        registered_by: memberId || null,
      })
    }

    revalidatePath(`/contabilidad/actividades/${input.activityId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Bulk insert: crea N cobros para una actividad de un solo viaje.
 * Útil para añadir un equipo entero (todos los jugadores con el mismo importe).
 * Cada cobro es individual — el equipo es solo un atajo de UX.
 */
export async function addChargesBulk(input: {
  activityId: string
  playerIds: string[]
  amount: number
  concept?: string
  paid?: boolean
  paymentMethod?: 'transfer' | 'cash' | 'card' | null
  paymentDate?: string | null
}): Promise<{ success: boolean; error?: string; inserted?: number }> {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    if (!input.playerIds?.length) return { success: false, error: 'No hay jugadores seleccionados' }
    if (input.amount < 0) return { success: false, error: 'Importe inválido' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Cargar nombres de los jugadores para incluir en el cash_movement description
    const { data: players } = await sb
      .from('players')
      .select('id, first_name, last_name')
      .eq('club_id', clubId)
      .in('id', input.playerIds)
    const nameMap = new Map<string, string>()
    for (const p of (players ?? [])) nameMap.set(p.id, `${p.first_name} ${p.last_name}`.trim())

    const paymentDate = input.paid ? (input.paymentDate ?? new Date().toISOString().slice(0, 10)) : null
    const rows = input.playerIds.map(pid => ({
      club_id: clubId,
      activity_id: input.activityId,
      player_id: pid,
      participant_name: null,
      concept: input.concept?.trim() || null,
      amount: input.amount,
      paid: !!input.paid,
      payment_method: input.paid ? input.paymentMethod ?? null : null,
      payment_date: paymentDate,
      registered_by: memberId || null,
    }))

    const { error } = await sb.from('activity_charges').insert(rows)
    if (error) return { success: false, error: error.message }

    // Si vienen pagados con cash/card → registrar movimientos de caja por jugador
    if (input.paid && (input.paymentMethod === 'cash' || input.paymentMethod === 'card')) {
      const movements = input.playerIds.map(pid => ({
        club_id: clubId,
        type: 'income',
        amount: input.amount,
        payment_method: input.paymentMethod,
        description: `Actividad · ${input.concept ?? ''} ${nameMap.get(pid) ?? ''}`.trim(),
        movement_date: paymentDate,
        registered_by: memberId || null,
      }))
      await sb.from('cash_movements').insert(movements)
    }

    revalidatePath(`/contabilidad/actividades/${input.activityId}`)
    return { success: true, inserted: rows.length }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function markChargePaid(
  chargeId: string,
  paymentMethod: 'transfer' | 'cash' | 'card',
  partialAmount?: number,  // si se omite → paga el total pendiente
  paymentDate?: string,
) {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const date = paymentDate ?? new Date().toISOString().slice(0, 10)
    const { data: charge, error: fetchErr } = await sb
      .from('activity_charges')
      .select('activity_id, amount, amount_paid, participant_name, concept, paid, player_id')
      .eq('id', chargeId)
      .single()
    if (fetchErr || !charge) return { success: false, error: fetchErr?.message ?? 'No existe' }
    if (charge.paid) return { success: false, error: 'Ya está pagada' }

    const alreadyPaid = Number(charge.amount_paid ?? 0)
    const remaining   = Number(charge.amount) - alreadyPaid
    const payNow      = partialAmount !== undefined ? Math.min(partialAmount, remaining) : remaining
    if (payNow <= 0) return { success: false, error: 'Sin importe pendiente' }

    const newAmountPaid = alreadyPaid + payNow
    const isFullyPaid   = newAmountPaid >= Number(charge.amount) - 0.001

    const { error } = await sb
      .from('activity_charges')
      .update({
        paid: isFullyPaid,
        amount_paid: newAmountPaid,
        payment_method: paymentMethod,
        payment_date: date,
      })
      .eq('id', chargeId)
    if (error) return { success: false, error: error.message }

    if (paymentMethod === 'cash' || paymentMethod === 'card') {
      const partialLabel = isFullyPaid ? '' : ' (parcial)'
      await sb.from('cash_movements').insert({
        club_id: clubId,
        type: 'income',
        amount: payNow,
        payment_method: paymentMethod,
        description: `Actividad · ${charge.concept ?? ''} ${charge.participant_name ?? ''}${partialLabel}`.trim(),
        movement_date: date,
        registered_by: memberId || null,
      })
    }

    // Email de confirmación con justificante PDF (solo si pago completo y hay jugador con tutor_email)
    if (isFullyPaid && charge.player_id) {
      const { data: player } = await sb
        .from('players')
        .select('tutor_email, first_name, last_name, team_id, teams(name)')
        .eq('id', charge.player_id)
        .single()

      const tutorEmail = player?.tutor_email ?? null
      const playerName = player
        ? `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()
        : (charge.participant_name ?? 'Participante')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const teamName = (player?.teams as any)?.name ?? 'Actividad'

      if (tutorEmail) {
        const emailPromise = sendPaymentReceiptEmail({
          tutorEmail,
          playerName,
          teamName,
          amount: payNow,
          method: paymentMethod,
          date,
          concept: charge.concept ?? 'Actividad',
          clubId,
        })
        Promise.race([
          emailPromise,
          new Promise<void>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
        ]).catch(err => console.error('[actividades] email error:', err))
      }
    }

    revalidatePath(`/contabilidad/actividades/${charge.activity_id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteCharge(chargeId: string) {
  try {
    const { roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: charge } = await sb
      .from('activity_charges')
      .select('activity_id')
      .eq('id', chargeId)
      .single()
    const { error } = await sb.from('activity_charges').delete().eq('id', chargeId)
    if (error) return { success: false, error: error.message }
    if (charge?.activity_id) revalidatePath(`/contabilidad/actividades/${charge.activity_id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Expenses ──────────────────────────────────────────────────────

export async function addActivityExpense(input: {
  activityId: string
  concept: string
  amount: number
  category?: string
  expenseDate: string
  notes?: string
}) {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    if (!input.concept.trim()) return { success: false, error: 'Concepto requerido' }
    if (input.amount <= 0) return { success: false, error: 'Importe inválido' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('activity_expenses').insert({
      club_id: clubId,
      activity_id: input.activityId,
      concept: input.concept.trim(),
      amount: input.amount,
      category: input.category?.trim() || null,
      expense_date: input.expenseDate,
      notes: input.notes?.trim() || null,
      registered_by: memberId || null,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath(`/contabilidad/actividades/${input.activityId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteActivityExpense(id: string) {
  try {
    const { roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'Sin permisos' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: exp } = await sb
      .from('activity_expenses')
      .select('activity_id')
      .eq('id', id)
      .single()
    const { error } = await sb.from('activity_expenses').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    if (exp?.activity_id) revalidatePath(`/contabilidad/actividades/${exp.activity_id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
