'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export interface ScheduleSlotInput {
  team_id: string
  weekday: number // 0..6 (0=Sun, 1=Mon, ..., 6=Sat)
  start_time: string // 'HH:MM'
  end_time?: string | null
  location?: string | null
  session_type?: 'training' | 'match'
}

function canEdit(roles: string[]) {
  return roles.some((r) => ['admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador'].includes(r))
}

export async function getTeamSchedule(teamId: string) {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data, error } = await sb
    .from('team_schedule')
    .select('*')
    .eq('club_id', clubId)
    .eq('team_id', teamId)
    .eq('active', true)
    .order('weekday')
    .order('start_time')
  if (error) return { success: false, error: error.message, slots: [] }
  return { success: true, slots: data ?? [] }
}

export async function addScheduleSlot(input: ScheduleSlotInput) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canEdit(roles)) return { success: false, error: 'Sin permisos' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('team_schedule').insert({
      club_id: clubId,
      team_id: input.team_id,
      weekday: input.weekday,
      start_time: input.start_time,
      end_time: input.end_time ?? null,
      location: input.location ?? null,
      session_type: input.session_type ?? 'training',
      active: true,
    })
    if (error) return { success: false, error: error.message }

    revalidatePath('/entrenadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateScheduleSlot(slotId: string, patch: Partial<ScheduleSlotInput> & { active?: boolean }) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canEdit(roles)) return { success: false, error: 'Sin permisos' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: existing } = await sb.from('team_schedule').select('club_id').eq('id', slotId).single()
    if (!existing || existing.club_id !== clubId) return { success: false, error: 'Slot no encontrado' }

    const { error } = await sb.from('team_schedule').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', slotId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/entrenadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteScheduleSlot(slotId: string) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canEdit(roles)) return { success: false, error: 'Sin permisos' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: existing } = await sb.from('team_schedule').select('club_id').eq('id', slotId).single()
    if (!existing || existing.club_id !== clubId) return { success: false, error: 'Slot no encontrado' }

    const { error } = await sb.from('team_schedule').delete().eq('id', slotId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/entrenadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Given a reference date and a weekday (0..6), returns the date of the next
 * occurrence of that weekday strictly inside [from, from+7 days).
 */
function dateForWeekday(from: Date, weekday: number): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const delta = (weekday - d.getDay() + 7) % 7
  d.setDate(d.getDate() + delta)
  return d
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Generate sessions for the week starting `weekStart` (default = next Monday)
 * for all active schedule slots in the club.
 * Idempotent: uq_sessions_team_date_start prevents duplicates.
 */
export async function generateWeekSessions(opts?: { clubId?: string; weekStart?: Date }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // default week = next 7 days starting tomorrow
  const weekStart = opts?.weekStart ?? new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() + 1) // start tomorrow to avoid creating for today

  const clubFilter = opts?.clubId ? { club_id: opts.clubId } : {}

  // Fetch all active slots (optionally scoped to a club)
  let query = sb.from('team_schedule').select('*').eq('active', true)
  if (opts?.clubId) query = query.eq('club_id', opts.clubId)
  const { data: slots, error: slotsErr } = await query
  if (slotsErr) return { success: false, error: slotsErr.message, created: 0 }

  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const slot of (slots ?? [])) {
    // Compute the first occurrence of slot.weekday on or after weekStart
    const target = dateForWeekday(weekStart, slot.weekday)
    const dateStr = toISODate(target)

    // Insert — unique index will silently skip duplicates
    const { error } = await sb.from('sessions').insert({
      club_id: slot.club_id,
      team_id: slot.team_id,
      session_type: slot.session_type ?? 'training',
      session_date: dateStr,
      start_time: slot.start_time,
      end_time: slot.end_time,
      location: slot.location,
      schedule_id: slot.id,
      is_live: false,
      completed: false,
    })
    if (error) {
      if (error.code === '23505') {
        skipped++ // duplicate, expected
      } else {
        errors.push(`${slot.id}: ${error.message}`)
      }
    } else {
      created++
    }
  }

  revalidatePath('/entrenadores')
  revalidatePath('/entrenadores/sesiones')
  return { success: true, created, skipped, errors, weekStart: toISODate(weekStart), ...clubFilter }
}
