'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export async function createSession(formData: FormData) {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

  const sessionType = formData.get('session_type') as string
  const teamIdRaw = (formData.get('team_id') as string) || ''
  const sessionDate = formData.get('session_date') as string
  const endTimeRaw = (formData.get('end_time') as string) || null
  const opponent = (formData.get('opponent') as string) || null
  const notesRaw = (formData.get('notes') as string) || null

  // Objectives: comma-separated free list
  const objectivesRaw = (formData.get('objectives') as string) || ''
  const objectives = objectivesRaw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  // If teamIdRaw is not a UUID, it's a manual team name — store in notes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const teamId = uuidRegex.test(teamIdRaw) ? teamIdRaw : null
  const manualTeamNote = !uuidRegex.test(teamIdRaw) && teamIdRaw ? `[Equipo: ${teamIdRaw}]` : null
  const notes = [manualTeamNote, notesRaw].filter(Boolean).join(' — ') || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insertData: Record<string, any> = {
    club_id: clubId,
    team_id: teamId,
    session_type: sessionType,
    session_date: sessionDate,
    opponent,
    notes,
    logged_by: memberId,
    is_live: sessionType === 'match',
  }
  // These columns exist after migration 008 — include only if provided
  if (endTimeRaw) insertData.end_time = endTimeRaw
  if (objectives.length > 0) insertData.objectives = objectives

  const { data: session, error } = await supabase
    .from('sessions')
    .insert(insertData)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/sesiones')
  return { success: true, sessionId: session.id }
}

export async function deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  // Verify the session belongs to this club
  const { data: existing, error: fetchErr } = await supabase
    .from('sessions')
    .select('id, club_id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .maybeSingle()

  if (fetchErr) return { success: false, error: fetchErr.message }
  if (!existing) return { success: false, error: 'Sesión no encontrada' }

  // Preserve independent records that reference the session without ON DELETE CASCADE
  await supabase.from('coordinator_observations').update({ session_id: null }).eq('session_id', sessionId)
  await supabase.from('scouting_reports').update({ session_id: null }).eq('session_id', sessionId)

  // Remaining child tables (session_exercises, match_events, match_lineups, attendance) cascade.
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId).eq('club_id', clubId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/sesiones')
  revalidatePath('/entrenadores/partidos')
  revalidatePath('/entrenadores')
  return { success: true }
}

export async function updateSession(input: {
  sessionId: string
  session_date?: string
  end_time?: string | null
  team_id?: string | null
  opponent?: string | null
  score_home?: number | null
  score_away?: number | null
  notes?: string | null
  session_type?: 'training' | 'match' | 'futsal' | 'friendly'
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const patch: Record<string, unknown> = {}
  if (input.session_date !== undefined) patch.session_date = input.session_date
  if (input.end_time !== undefined) patch.end_time = input.end_time
  if (input.team_id !== undefined) patch.team_id = input.team_id
  if (input.opponent !== undefined) patch.opponent = input.opponent
  if (input.score_home !== undefined) patch.score_home = input.score_home
  if (input.score_away !== undefined) patch.score_away = input.score_away
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.session_type !== undefined) patch.session_type = input.session_type

  const { error } = await supabase
    .from('sessions')
    .update(patch)
    .eq('id', input.sessionId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/sesiones/${input.sessionId}`)
  revalidatePath('/entrenadores/sesiones')
  revalidatePath('/entrenadores/partidos')
  return { success: true }
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
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  // Verify session belongs to club
  const { data: session } = await supabase
    .from('sessions')
    .select('id, club_id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesion no encontrada' }

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
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, club_id, team_id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesion no encontrada' }

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
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, club_id, team_id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesion no encontrada' }

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

function parseInt0(v: FormDataEntryValue | null): number | null {
  const s = (v as string) ?? ''
  if (!s.trim()) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

export async function createExercise(formData: FormData) {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

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
      subcategory: (formData.get('subcategory') as string) || null,
      duration_min: parseInt0(formData.get('duration_min')),
      players_min: parseInt0(formData.get('players_min')),
      players_max: parseInt0(formData.get('players_max')),
      material: (formData.get('material') as string) || null,
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

export async function updateExercise(exerciseId: string, formData: FormData) {
  const supabase = createAdminClient()
  const { clubId, memberId, roles } = await getClubContext()
  const isAdmin = roles.some((r) => ['admin', 'direccion'].includes(r))

  // Ownership check: only author or admin can edit
  const { data: existing, error: fetchErr } = await supabase
    .from('exercises')
    .select('id, author_id, club_id')
    .eq('id', exerciseId)
    .eq('club_id', clubId)
    .single()

  if (fetchErr || !existing) return { success: false, error: 'Ejercicio no encontrado' }
  if (!isAdmin && existing.author_id !== memberId) {
    return { success: false, error: 'No tienes permiso para editar este ejercicio' }
  }

  const tagsRaw = formData.get('objective_tags') as string
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const canvasDataRaw = formData.get('canvas_data') as string
  const canvasData = canvasDataRaw ? JSON.parse(canvasDataRaw) : undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    category_id: (formData.get('category_id') as string) || null,
    subcategory: (formData.get('subcategory') as string) || null,
    duration_min: parseInt0(formData.get('duration_min')),
    players_min: parseInt0(formData.get('players_min')),
    players_max: parseInt0(formData.get('players_max')),
    material: (formData.get('material') as string) || null,
    objective_tags: tags,
  }
  if (canvasData !== undefined) updateData.canvas_data = canvasData
  const newImage = formData.get('canvas_image_url') as string
  if (newImage) updateData.canvas_image_url = newImage

  const { error } = await supabase
    .from('exercises')
    .update(updateData)
    .eq('id', exerciseId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/ejercicios')
  revalidatePath(`/entrenadores/ejercicios/${exerciseId}`)
  return { success: true }
}

export async function deleteExercise(exerciseId: string) {
  const supabase = createAdminClient()
  const { clubId, memberId, roles } = await getClubContext()
  const isAdmin = roles.some((r) => ['admin', 'direccion'].includes(r))

  const { data: existing } = await supabase
    .from('exercises')
    .select('id, author_id, club_id')
    .eq('id', exerciseId)
    .eq('club_id', clubId)
    .single()

  if (!existing) return { success: false, error: 'Ejercicio no encontrado' }
  if (!isAdmin && existing.author_id !== memberId) {
    return { success: false, error: 'No tienes permiso para borrar este ejercicio' }
  }

  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/ejercicios')
  return { success: true }
}

export async function toggleExerciseFavorite(exerciseId: string) {
  const supabase = createAdminClient()
  const { memberId } = await getClubContext()

  // Check if already favorited
  const { data: existing } = await supabase
    .from('exercise_favorites')
    .select('exercise_id')
    .eq('member_id', memberId)
    .eq('exercise_id', exerciseId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('exercise_favorites')
      .delete()
      .eq('member_id', memberId)
      .eq('exercise_id', exerciseId)
    if (error) return { success: false, error: error.message, favorited: true }
    revalidatePath('/entrenadores/ejercicios')
    return { success: true, favorited: false }
  } else {
    const { error } = await supabase
      .from('exercise_favorites')
      .insert({ member_id: memberId, exercise_id: exerciseId })
    if (error) return { success: false, error: error.message, favorited: false }
    revalidatePath('/entrenadores/ejercicios')
    return { success: true, favorited: true }
  }
}

export async function createExerciseCategory(name: string, color: string) {
  const supabase = createAdminClient()
  const { clubId, roles } = await getClubContext()
  const canCreate = roles.some((r) => ['admin', 'direccion', 'director_deportivo'].includes(r))

  if (!canCreate) return { success: false, error: 'Solo admin/direccion/director deportivo puede crear categorias' }
  if (!name.trim()) return { success: false, error: 'Nombre requerido' }

  // Compute next sort_order
  const { data: last } = await supabase
    .from('exercise_categories')
    .select('sort_order')
    .eq('club_id', clubId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (last?.sort_order ?? 0) + 1

  const { error } = await supabase
    .from('exercise_categories')
    .insert({ club_id: clubId, name: name.trim(), color, sort_order: sortOrder })

  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/ejercicios')
  return { success: true }
}

export async function deleteExerciseCategory(categoryId: string) {
  const supabase = createAdminClient()
  const { clubId, roles } = await getClubContext()
  const canDelete = roles.some((r) => ['admin', 'direccion', 'director_deportivo'].includes(r))

  if (!canDelete) return { success: false, error: 'No tienes permiso' }

  const { error } = await supabase
    .from('exercise_categories')
    .delete()
    .eq('id', categoryId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/ejercicios')
  return { success: true }
}

export async function addSessionExercise(
  sessionId: string,
  exerciseId: string,
  slotOrder: number,
  notes?: string
) {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesion no encontrada' }

  // Upsert: if slot already exists, replace
  const { error } = await supabase
    .from('session_exercises')
    .upsert(
      { session_id: sessionId, exercise_id: exerciseId, slot_order: slotOrder, notes: notes || null },
      { onConflict: 'session_id,slot_order' }
    )

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/sesiones/${sessionId}`)
  return { success: true }
}

export async function removeSessionExercise(sessionId: string, slotOrder: number) {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesion no encontrada' }

  const { error } = await supabase
    .from('session_exercises')
    .delete()
    .eq('session_id', sessionId)
    .eq('slot_order', slotOrder)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/sesiones/${sessionId}`)
  return { success: true }
}

export async function updateSessionPlanning(
  sessionId: string,
  data: { microcycle?: string | null; macrocycle?: string | null; session_number?: number | null },
) {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const update: Record<string, string | number | null> = {}
  if (data.microcycle !== undefined) update.microcycle = data.microcycle?.trim() || null
  if (data.macrocycle !== undefined) update.macrocycle = data.macrocycle?.trim() || null
  if (data.session_number !== undefined) {
    update.session_number = data.session_number === null || Number.isNaN(data.session_number)
      ? null
      : Number(data.session_number)
  }

  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await supabase
    .from('sessions')
    .update(update)
    .eq('id', sessionId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/sesiones/${sessionId}`)
  return { success: true }
}

export async function updateSessionObjectives(sessionId: string, objectives: string[]) {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const { error } = await supabase
    .from('sessions')
    .update({ objectives })
    .eq('id', sessionId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/sesiones/${sessionId}`)
  return { success: true }
}

export async function updatePlayerBibs(
  sessionId: string,
  assignments: { player_id: string; group_color: 'orange' | 'pink' | 'white' | null; is_goalkeeper: boolean }[]
) {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('club_id', clubId)
    .single()

  if (!session) return { success: false, error: 'Sesion no encontrada' }

  // Upsert attendance rows with bib/goalkeeper info
  const records = assignments.map((a) => ({
    session_id: sessionId,
    player_id: a.player_id,
    group_color: a.group_color,
    is_goalkeeper: a.is_goalkeeper,
  }))

  const { error } = await supabase
    .from('session_attendance')
    .upsert(records, { onConflict: 'session_id,player_id' })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/entrenadores/sesiones/${sessionId}`)
  return { success: true }
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
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

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
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

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

export async function deleteObservation(observationId: string) {
  const supabase = createAdminClient()
  const { clubId, memberId, roles } = await getClubContext()

  // Allow authors + admin/direccion/director_deportivo
  const { data: obs } = await supabase
    .from('coordinator_observations')
    .select('observer_id, club_id')
    .eq('id', observationId)
    .single()

  if (!obs) return { success: false, error: 'Observación no encontrada' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = obs as any
  if (o.club_id !== clubId) return { success: false, error: 'No autorizado' }

  const isPrivileged = roles.some((r: string) => ['admin', 'direccion', 'director_deportivo'].includes(r))
  if (!isPrivileged && o.observer_id !== memberId) {
    return { success: false, error: 'Solo el autor o dirección pueden eliminar esta observación' }
  }

  const { error } = await supabase.from('coordinator_observations').delete().eq('id', observationId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/observaciones')
  return { success: true }
}

export async function updateObservationComment(observationId: string, comment: string) {
  const supabase = createAdminClient()
  const { clubId, memberId, roles } = await getClubContext()

  const { data: obs } = await supabase
    .from('coordinator_observations')
    .select('observer_id, club_id')
    .eq('id', observationId)
    .single()
  if (!obs) return { success: false, error: 'Observación no encontrada' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = obs as any
  if (o.club_id !== clubId) return { success: false, error: 'No autorizado' }

  const isPrivileged = roles.some((r: string) => ['admin', 'direccion', 'director_deportivo'].includes(r))
  if (!isPrivileged && o.observer_id !== memberId) {
    return { success: false, error: 'Solo el autor puede editar' }
  }

  const { error } = await supabase
    .from('coordinator_observations')
    .update({ comment })
    .eq('id', observationId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/entrenadores/observaciones')
  return { success: true }
}
