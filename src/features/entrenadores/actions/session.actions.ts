'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export async function createSession(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!

  const sessionType = formData.get('session_type') as string
  const teamId = formData.get('team_id') as string
  const sessionDate = formData.get('session_date') as string
  const opponent = (formData.get('opponent') as string) || null
  const notes = (formData.get('notes') as string) || null

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      club_id: clubId,
      team_id: teamId,
      session_type: sessionType,
      session_date: sessionDate,
      opponent,
      notes,
      logged_by: memberId,
      is_live: sessionType === 'match',
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/sesiones')
  return { success: true, sessionId: session.id }
}

export interface AttendanceRecord {
  player_id: string
  status: 'present' | 'absent' | 'justified'
  goals: number
  assists: number
  yellow_cards: number
  red_cards: number
  minutes_played: number
  rating: number | null
  notes: string | null
}

export async function updateSessionAttendance(
  sessionId: string,
  attendance: AttendanceRecord[]
) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  // Verify session belongs to club
  const { data: session } = await supabase
    .from('sessions')
    .select('id, club_id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesión no encontrada' }

  const records = attendance.map((a) => ({
    session_id: sessionId,
    player_id: a.player_id,
    status: a.status,
    goals: a.goals,
    assists: a.assists,
    yellow_cards: a.yellow_cards,
    red_cards: a.red_cards,
    minutes_played: a.minutes_played,
    rating: a.rating,
    notes: a.notes,
  }))

  const { error } = await supabase
    .from('session_attendance')
    .upsert(records, { onConflict: 'session_id,player_id' })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/sesiones/${sessionId}`)
  return { success: true }
}

export interface MatchEvent {
  event_type: 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'injury'
  player_id: string | null
  player_out_id?: string | null
  minute: number
  notes?: string | null
}

export async function addMatchEvent(sessionId: string, event: MatchEvent) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const { data: session } = await supabase
    .from('sessions')
    .select('id, club_id, team_id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesión no encontrada' }

  const { data: matchEvent, error } = await supabase
    .from('match_events')
    .insert({
      session_id: sessionId,
      event_type: event.event_type,
      player_id: event.player_id,
      player_out_id: event.player_out_id ?? null,
      minute: event.minute,
      notes: event.notes ?? null,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Update score if goal
  if (event.event_type === 'goal') {
    const { data: current } = await supabase
      .from('sessions')
      .select('score_home')
      .eq('id', sessionId)
      .single()

    await supabase
      .from('sessions')
      .update({ score_home: (current?.score_home ?? 0) + 1 })
      .eq('id', sessionId)
  }

  revalidatePath(`/entrenadores/partidos/${sessionId}`)
  return { success: true, event: matchEvent }
}

export async function completeSession(sessionId: string) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const { data: session } = await supabase
    .from('sessions')
    .select('id, club_id, team_id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesión no encontrada' }

  // Mark session as completed (not live)
  const { error } = await supabase
    .from('sessions')
    .update({ is_live: false })
    .eq('id', sessionId)

  if (error) return { success: false, error: error.message }

  // Update player season stats from attendance
  const { data: attendance } = await supabase
    .from('session_attendance')
    .select('*')
    .eq('session_id', sessionId)

  if (attendance && attendance.length > 0) {
    for (const record of attendance) {
      // Get current stats
      const { data: existing } = await supabase
        .from('player_season_stats')
        .select('*')
        .eq('player_id', record.player_id)
        .eq('club_id', clubId)
        .single()

      if (existing) {
        await supabase
          .from('player_season_stats')
          .update({
            sessions_attended: existing.sessions_attended + (record.present ? 1 : 0),
            sessions_absent: existing.sessions_absent + (!record.present && !record.justified ? 1 : 0),
            goals: existing.goals + (record.goals ?? 0),
            assists: existing.assists + (record.assists ?? 0),
            yellow_cards: existing.yellow_cards + (record.yellow_cards ?? 0),
            red_cards: existing.red_cards + (record.red_cards ?? 0),
          })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('player_season_stats')
          .insert({
            club_id: clubId,
            player_id: record.player_id,
            season: new Date().getFullYear().toString(),
            sessions_attended: record.present ? 1 : 0,
            sessions_absent: !record.present && !record.justified ? 1 : 0,
            goals: record.goals ?? 0,
            assists: record.assists ?? 0,
            yellow_cards: record.yellow_cards ?? 0,
            red_cards: record.red_cards ?? 0,
          })
      }
    }
  }

  revalidatePath(`/entrenadores/sesiones/${sessionId}`)
  revalidatePath('/entrenadores/sesiones')
  return { success: true }
}

export async function createExercise(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!

  const tagsRaw = formData.get('objective_tags') as string
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const canvasDataRaw = formData.get('canvas_data') as string
  const canvasData = canvasDataRaw ? JSON.parse(canvasDataRaw) : null

  const { data: exercise, error } = await supabase
    .from('exercises')
    .insert({
      club_id: clubId,
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || null,
      category_id: (formData.get('category_id') as string) || null,
      objective_tags: tags,
      canvas_data: canvasData,
      canvas_image_url: (formData.get('canvas_image_url') as string) || null,
      author_id: memberId,
      is_public: formData.get('is_public') === 'true',
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/ejercicios')
  return { success: true, exercise }
}

export async function saveScoutingReport(
  sessionId: string,
  data: {
    rival_team: string
    dorsal: string
    position: string
    comment: string
  }
) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!

  const { error } = await supabase.from('scouting_reports').insert({
    club_id: clubId,
    session_id: sessionId,
    reported_by: memberId,
    rival_team: data.rival_team,
    dorsal: data.dorsal,
    position: data.position,
    comment: data.comment,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/partidos/${sessionId}`)
  return { success: true }
}

export async function createObservation(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!

  const playerRatingsRaw = formData.get('player_ratings') as string
  const playerRatings = playerRatingsRaw ? JSON.parse(playerRatingsRaw) : null

  const { error } = await supabase.from('coordinator_observations').insert({
    club_id: clubId,
    observer_id: memberId,
    team_id: formData.get('team_id') as string,
    session_id: (formData.get('session_id') as string) || null,
    observation_date: formData.get('observation_date') as string,
    nivel_rating: parseInt(formData.get('nivel_rating') as string) || null,
    ajeno_rating: parseInt(formData.get('ajeno_rating') as string) || null,
    comment: (formData.get('comment') as string) || null,
    player_ratings: playerRatings,
    coach_rating: parseInt(formData.get('coach_rating') as string) || null,
    coach_comment: (formData.get('coach_comment') as string) || null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/observaciones')
  return { success: true }
}
