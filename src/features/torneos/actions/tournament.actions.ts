'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export type TournamentKind = 'local' | 'external'
export type PayMethod = 'cash' | 'card' | 'transfer'

export interface CreateTournamentInput {
  name: string
  category?: string | null
  format: 'league' | 'cup' | 'mixed'
  start_date?: string | null
  end_date?: string | null
  location?: string | null
  kind?: TournamentKind
}

export async function createTournament(input: CreateTournamentInput): Promise<{
  success: boolean
  error?: string
  id?: string
}> {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

  const name = input.name?.trim()
  if (!name) return { success: false, error: 'El nombre es obligatorio' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data, error } = await sb
    .from('tournaments')
    .insert({
      club_id: clubId,
      name,
      category: input.category?.trim() || null,
      format: input.format,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      location: input.location?.trim() || null,
      status: 'upcoming',
      kind: input.kind ?? 'local',
      created_by: memberId ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/torneos')
  return { success: true, id: data.id }
}

export async function deleteTournament(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb
    .from('tournaments')
    .delete()
    .eq('id', id)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/torneos')
  return { success: true }
}

// ============================================================
// PRESUPUESTO DEL TORNEO EXTERNO
// ============================================================

export interface UpsertBudgetInput {
  tournamentId: string
  organizerCost: number
  marginPct: number
  estimatedPlayers: number
  priceMode: 'auto' | 'manual'
  priceManual?: number | null
  notes?: string | null
}

async function verifyTournamentOwnership(tournamentId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data, error } = await sb
    .from('tournaments')
    .select('id')
    .eq('id', tournamentId)
    .eq('club_id', clubId)
    .single()
  if (error || !data) return { ok: false, error: 'Torneo no encontrado' }
  return { ok: true }
}

export async function upsertTournamentBudget(input: UpsertBudgetInput): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(input.tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: existing } = await sb
    .from('tournament_budget')
    .select('id')
    .eq('tournament_id', input.tournamentId)
    .maybeSingle()

  const payload = {
    tournament_id: input.tournamentId,
    organizer_cost: input.organizerCost,
    margin_pct: input.marginPct,
    estimated_players: Math.max(0, Math.floor(input.estimatedPlayers || 0)),
    price_mode: input.priceMode,
    price_manual: input.priceMode === 'manual' ? (input.priceManual ?? null) : null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await sb.from('tournament_budget').update(payload).eq('id', existing.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await sb.from('tournament_budget').insert(payload)
    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/torneos/${input.tournamentId}`)
  return { success: true }
}

export async function addBudgetItem(input: {
  tournamentId: string
  name: string
  amount: number
}): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(input.tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const name = input.name?.trim()
  if (!name) return { success: false, error: 'Nombre obligatorio' }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb.from('tournament_budget_items').insert({
    tournament_id: input.tournamentId,
    name,
    amount: input.amount || 0,
  })

  if (error) return { success: false, error: error.message }
  revalidatePath(`/torneos/${input.tournamentId}`)
  return { success: true }
}

export async function removeBudgetItem(itemId: string, tournamentId: string): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // If the item was paid, also delete its related expense + cash_movement
  const { data: item } = await sb
    .from('tournament_budget_items')
    .select('id, related_expense_id')
    .eq('id', itemId)
    .single()

  if (item?.related_expense_id) {
    await sb.from('cash_movements').delete().eq('related_expense_id', item.related_expense_id)
    await sb.from('expenses').delete().eq('id', item.related_expense_id)
  }

  const { error } = await sb.from('tournament_budget_items').delete().eq('id', itemId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/torneos/${tournamentId}`)
  revalidatePath('/contabilidad/gastos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

/**
 * Marca un gasto del torneo como pagado: crea una fila en `expenses` + cash_movements
 * (source='torneo'). Por defecto `transfer` (no afecta al cierre de caja).
 */
export async function markBudgetItemPaid(
  itemId: string,
  tournamentId: string,
  method: PayMethod = 'transfer'
): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: item, error: fetchErr } = await sb
    .from('tournament_budget_items')
    .select('id, name, amount, is_paid, tournament_id')
    .eq('id', itemId)
    .single()

  if (fetchErr || !item) return { success: false, error: 'Gasto no encontrado' }
  if (item.is_paid) return { success: false, error: 'Ya estaba pagado' }

  const { data: torneo } = await sb
    .from('tournaments').select('name').eq('id', tournamentId).single()
  const tourneyName = torneo?.name ?? 'Torneo'
  const today = new Date().toISOString().slice(0, 10)

  // 1. Crear expense
  const { data: expense, error: expenseErr } = await sb.from('expenses').insert({
    club_id: clubId,
    category: 'Torneo',
    description: `${tourneyName} — ${item.name}`,
    amount: item.amount,
    expense_date: today,
    paid_by: memberId ?? null,
  }).select('id').single()

  if (expenseErr) return { success: false, error: expenseErr.message }

  // 2. Crear cash_movement tipo expense, source='torneo'
  const { error: movementErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'expense',
    amount: item.amount,
    payment_method: method,
    description: `${tourneyName} — ${item.name}`,
    movement_date: today,
    related_expense_id: expense.id,
    related_tournament_id: tournamentId,
    source: 'torneo',
    registered_by: memberId ?? null,
  })

  if (movementErr) {
    await sb.from('expenses').delete().eq('id', expense.id)
    return { success: false, error: movementErr.message }
  }

  // 3. Marcar el item como pagado
  const { error: updateErr } = await sb
    .from('tournament_budget_items')
    .update({
      is_paid: true,
      payment_method: method,
      paid_at: new Date().toISOString(),
      related_expense_id: expense.id,
    })
    .eq('id', itemId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath(`/torneos/${tournamentId}`)
  revalidatePath('/contabilidad/gastos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

// ============================================================
// ASISTENTES (qué jugadores van y cuánto paga cada familia)
// ============================================================

export async function addAttendee(input: {
  tournamentId: string
  playerId: string
  amountDue: number
  notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(input.tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  const { memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb.from('tournament_attendees').insert({
    tournament_id: input.tournamentId,
    player_id: input.playerId,
    amount_due: input.amountDue,
    notes: input.notes?.trim() || null,
    added_by: memberId ?? null,
  })

  if (error) {
    // Unique constraint (tournament_id, player_id)
    if (error.code === '23505') return { success: false, error: 'Ese jugador ya está apuntado' }
    return { success: false, error: error.message }
  }

  revalidatePath(`/torneos/${input.tournamentId}`)
  return { success: true }
}

export async function removeAttendee(attendeeId: string, tournamentId: string): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Borrar movimientos de caja ligados al asistente
  await sb.from('cash_movements').delete().eq('related_tournament_attendee_id', attendeeId)

  const { error } = await sb.from('tournament_attendees').delete().eq('id', attendeeId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/torneos/${tournamentId}`)
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updateAttendeeAmount(
  attendeeId: string,
  tournamentId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb
    .from('tournament_attendees')
    .update({ amount_due: amount })
    .eq('id', attendeeId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/torneos/${tournamentId}`)
  return { success: true }
}

export async function markAttendeePaid(
  attendeeId: string,
  tournamentId: string,
  method: PayMethod
): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: attendee, error: fetchErr } = await sb
    .from('tournament_attendees')
    .select('id, player_id, amount_due, payment_status, tournament_id')
    .eq('id', attendeeId)
    .single()

  if (fetchErr || !attendee) return { success: false, error: 'Asistente no encontrado' }
  if (attendee.payment_status === 'paid') return { success: false, error: 'Ya estaba pagado' }

  const { data: player } = await sb
    .from('players').select('first_name, last_name').eq('id', attendee.player_id).single()
  const playerLabel = player ? `${player.first_name} ${player.last_name}`.trim() : 'Jugador'

  const { data: torneo } = await sb
    .from('tournaments').select('name').eq('id', tournamentId).single()
  const tourneyName = torneo?.name ?? 'Torneo'
  const today = new Date().toISOString().slice(0, 10)

  // 1. Update attendee status
  const { error: updateErr } = await sb
    .from('tournament_attendees')
    .update({
      payment_status: 'paid',
      payment_method: method,
      paid_at: new Date().toISOString(),
    })
    .eq('id', attendeeId)

  if (updateErr) return { success: false, error: updateErr.message }

  // 2. Create cash_movement income, source='torneo'
  const { error: movementErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'income',
    amount: attendee.amount_due,
    payment_method: method,
    description: `${tourneyName} — ${playerLabel}`,
    movement_date: today,
    related_tournament_id: tournamentId,
    related_tournament_attendee_id: attendeeId,
    source: 'torneo',
    registered_by: memberId ?? null,
  })

  if (movementErr) {
    // Rollback attendee status
    await sb
      .from('tournament_attendees')
      .update({ payment_status: 'pending', payment_method: null, paid_at: null })
      .eq('id', attendeeId)
    return { success: false, error: movementErr.message }
  }

  revalidatePath(`/torneos/${tournamentId}`)
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function refundAttendee(
  attendeeId: string,
  tournamentId: string
): Promise<{ success: boolean; error?: string }> {
  const check = await verifyTournamentOwnership(tournamentId)
  if (!check.ok) return { success: false, error: check.error }

  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: attendee } = await sb
    .from('tournament_attendees')
    .select('id, player_id, amount_due, payment_status, payment_method')
    .eq('id', attendeeId).single()

  if (!attendee || attendee.payment_status !== 'paid') {
    return { success: false, error: 'Solo se pueden devolver pagos ya realizados' }
  }

  const { data: player } = await sb
    .from('players').select('first_name, last_name').eq('id', attendee.player_id).single()
  const playerLabel = player ? `${player.first_name} ${player.last_name}`.trim() : 'Jugador'

  const { data: torneo } = await sb
    .from('tournaments').select('name').eq('id', tournamentId).single()
  const tourneyName = torneo?.name ?? 'Torneo'
  const today = new Date().toISOString().slice(0, 10)

  const { error: movementErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'expense',
    amount: attendee.amount_due,
    payment_method: attendee.payment_method ?? 'cash',
    description: `Devolución ${tourneyName} — ${playerLabel}`,
    movement_date: today,
    related_tournament_id: tournamentId,
    related_tournament_attendee_id: attendeeId,
    source: 'torneo',
    registered_by: memberId ?? null,
  })

  if (movementErr) return { success: false, error: movementErr.message }

  const { error: updateErr } = await sb
    .from('tournament_attendees')
    .update({ payment_status: 'cancelled' })
    .eq('id', attendeeId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath(`/torneos/${tournamentId}`)
  revalidatePath('/contabilidad/caja')
  return { success: true }
}
