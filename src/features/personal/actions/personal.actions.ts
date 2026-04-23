'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export async function scheduleAppointment(data: {
  playerId: string
  injuryId: string
  scheduledAt: string
  notes: string
}) {
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { error } = await supabase.from('fisio_appointments').insert({
    club_id: clubId,
    player_id: data.playerId,
    injury_id: data.injuryId,
    scheduled_at: data.scheduledAt,
    notes: data.notes || null,
    status: 'pending',
    scheduled_by: memberId,
    coach_confirmed: false,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/personal/fisio')
  return { success: true }
}

export async function confirmAppointment(appointmentId: string) {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { error } = await supabase
    .from('fisio_appointments')
    .update({ coach_confirmed: true, status: 'confirmed' })
    .eq('id', appointmentId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/personal/fisio')
  return { success: true }
}

export async function proposeMeeting(data: {
  subject: string
  targetMemberId: string
  description: string
  proposedDates: string[]
}) {
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { error } = await supabase.from('meeting_proposals').insert({
    club_id: clubId,
    proposed_by: memberId,
    target_member_id: data.targetMemberId,
    subject: data.subject,
    description: data.description || null,
    proposed_dates: data.proposedDates,
    status: 'pending',
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/personal/infancia')
  return { success: true }
}

export async function approveMedia(mediaId: string) {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { error } = await supabase
    .from('media_items')
    .update({ approved: true })
    .eq('id', mediaId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/personal/redes')
  return { success: true }
}

export async function rejectMedia(mediaId: string) {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { error } = await supabase
    .from('media_items')
    .delete()
    .eq('id', mediaId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/personal/redes')
  return { success: true }
}

export async function createCalendarEvent(data: {
  title: string
  startAt: string
  endAt: string
  type: string
  attendeeIds: string[]
  notes: string
}) {
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { error } = await supabase.from('direction_calendar_events').insert({
    club_id: clubId,
    created_by: memberId,
    title: data.title,
    start_at: data.startAt,
    end_at: data.endAt,
    event_type: data.type,
    attendee_ids: data.attendeeIds,
    notes: data.notes || null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/personal/direccion')
  return { success: true }
}
