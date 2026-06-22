'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { bumpSeason } from '@/lib/utils/season'

/**
 * Returns a preview of what startNewSeason will do:
 * - number of active teams
 * - number of players moving (wants_to_continue=true with next_team_id set)
 * - number of players without next_team assignment
 * - current season string
 */
export async function getSeasonPreview() {
  const { sb: supabase, clubId } = await getScopedClient()

  const [{ data: settings }, { data: teams }, { data: players }] = await Promise.all([
    supabase.from('club_settings').select('current_season').eq('club_id', clubId).single(),
    supabase.from('teams').select('id').eq('club_id', clubId).eq('active', true),
    supabase.from('players').select('id, wants_to_continue, next_team_id').eq('club_id', clubId).neq('status', 'low'),
  ])

  const currentSeason: string = (settings as { current_season?: string } | null)?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)
  const activeTeams = teams?.length ?? 0
  const activePlayers = players ?? []
  const continuingWithTeam = activePlayers.filter((p: { wants_to_continue: boolean | null; next_team_id: string | null }) => p.wants_to_continue && p.next_team_id).length
  const continuingWithoutTeam = activePlayers.filter((p: { wants_to_continue: boolean | null; next_team_id: string | null }) => p.wants_to_continue && !p.next_team_id).length
  const notContinuing = activePlayers.filter((p: { wants_to_continue: boolean | null }) => p.wants_to_continue === false).length

  return {
    currentSeason,
    nextSeason,
    activeTeams,
    continuingWithTeam,
    continuingWithoutTeam,
    notContinuing,
    totalPlayers: activePlayers.length,
  }
}

/**
 * Inicia la planificación de la próxima temporada:
 * - Crea equipos borrador (active=false) copiando los actuales
 * - Idempotente: si ya existen equipos para la próxima temporada, los devuelve
 * - NO toca la temporada activa ni los jugadores
 */
export async function initNextSeasonPlanning(): Promise<{
  success: boolean
  error?: string
  nextSeason?: string
  teams?: { id: string; name: string; season: string }[]
  alreadyExisted?: boolean
}> {
  const { sb: supabase, clubId, roles } = await getScopedClient()
  if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Sin permisos' }
  }

  const { data: settings } = await supabase
    .from('club_settings').select('current_season').eq('club_id', clubId).single()
  const currentSeason: string = (settings as { current_season?: string } | null)?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)

  // ¿Ya existen equipos para la próxima temporada?
  const { data: existing } = await supabase
    .from('teams').select('id, name, season').eq('club_id', clubId).eq('season', nextSeason)
  if (existing && existing.length > 0) {
    return { success: true, nextSeason, teams: existing, alreadyExisted: true }
  }

  // Copiar equipos activos como borradores para la próxima temporada
  const { data: activeTeams, error: teamsError } = await supabase
    .from('teams').select('*').eq('club_id', clubId).eq('active', true)
  if (teamsError) return { success: false, error: teamsError.message }
  if (!activeTeams || activeTeams.length === 0) {
    return { success: false, error: 'No hay equipos activos para copiar' }
  }

  const created: { id: string; name: string; season: string }[] = []
  for (const team of activeTeams) {
    const { data: newTeam, error } = await supabase
      .from('teams')
      .insert({ club_id: team.club_id, name: team.name, season: nextSeason, category_id: team.category_id ?? null, active: false })
      .select().single()
    if (error) return { success: false, error: `Error creando equipo ${team.name}: ${error.message}` }
    created.push({ id: newTeam.id, name: newTeam.name, season: newTeam.season })
  }

  revalidatePath('/configuracion/planificacion')
  return { success: true, nextSeason, teams: created, alreadyExisted: false }
}

/** Añade un equipo borrador para la próxima temporada */
export async function addDraftTeam(name: string): Promise<{ success: boolean; error?: string; team?: { id: string; name: string; season: string } }> {
  const { sb: supabase, clubId, roles } = await getScopedClient()
  if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Sin permisos' }
  }
  const { data: settings } = await supabase.from('club_settings').select('current_season').eq('club_id', clubId).single()
  const currentSeason: string = (settings as { current_season?: string } | null)?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)

  const { data, error } = await supabase.from('teams')
    .insert({ club_id: clubId, name: name.trim(), season: nextSeason, active: false })
    .select().single()
  if (error) return { success: false, error: error.message }
  revalidatePath('/configuracion/planificacion')
  return { success: true, team: { id: data.id, name: data.name, season: data.season } }
}

/**
 * Activa la próxima temporada (el switch definitivo).
 *
 * Delega en la función SQL `activate_next_season()` (migración 030) que ejecuta
 * todas las operaciones en una única transacción con ROLLBACK automático si algo falla:
 *   1. Jugadores con wants_to_continue=false → status='low'
 *   2. Migra team_id ← next_team_id en jugadores activos
 *   3. Equipos nextSeason → active=true; currentSeason → active=false
 *   4. Elimina club_member_roles de equipos de la temporada anterior
 *   5. current_season = nextSeason
 */
export async function activateNextSeason(): Promise<{
  success: boolean
  error?: string
  nextSeason?: string
  playersUpdated?: number
  lowPlayers?: number
  teamsActivated?: number
}> {
  const { sb: supabase, clubId, roles } = await getScopedClient()
  if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Sin permisos' }
  }

  const { data: settings } = await supabase
    .from('club_settings').select('current_season').eq('club_id', clubId).single()
  const currentSeason: string = (settings as { current_season?: string } | null)?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)

  // Llamar a la función SQL transaccional (migración 030_transactional_fixes.sql)
  const { data, error } = await supabase.rpc('activate_next_season', {
    p_club_id: clubId,
    p_next_season: nextSeason,
  })

  if (error) {
    logger.error({ action: 'activateNextSeason', clubId, nextSeason, error: error.message })
    return { success: false, error: error.message }
  }

  // La función devuelve JSONB: { success, nextSeason, playersUpdated, lowPlayers, teamsActivated }
  const result = data as {
    success: boolean
    nextSeason: string
    playersUpdated: number
    lowPlayers: number
    teamsActivated: number
  }

  logger.info({
    action: 'activateNextSeason',
    clubId,
    nextSeason: result.nextSeason,
    playersUpdated: result.playersUpdated,
    lowPlayers: result.lowPlayers,
    teamsActivated: result.teamsActivated,
  })

  revalidatePath('/configuracion')
  revalidatePath('/jugadores')
  revalidatePath('/entrenadores')
  revalidatePath('/configuracion/planificacion')

  return {
    success: true,
    nextSeason: result.nextSeason,
    playersUpdated: result.playersUpdated,
    lowPlayers: result.lowPlayers,
    teamsActivated: result.teamsActivated,
  }
}

/**
 * Start a new season (legacy — mantenido por compatibilidad con SeasonManagement)
 */
export async function startNewSeason() {
  const { sb: supabase, clubId, roles } = await getScopedClient()

  // Permission check
  if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Sin permisos para gestionar temporadas' }
  }

  // Get current season
  const { data: settings } = await supabase
    .from('club_settings')
    .select('current_season')
    .eq('club_id', clubId)
    .single()

  const currentSeason: string = (settings as { current_season?: string } | null)?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)

  // 1. Get all active teams
  const { data: activeTeams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .eq('club_id', clubId)
    .eq('active', true)

  if (teamsError) return { success: false, error: teamsError.message }
  if (!activeTeams || activeTeams.length === 0) {
    return { success: false, error: 'No hay equipos activos para esta temporada' }
  }

  // 2. Create new teams for next season (map old_id -> new_id)
  const teamIdMap: Record<string, string> = {}

  for (const team of activeTeams) {
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({
        club_id: team.club_id,
        name: team.name,
        season: nextSeason,
        category_id: team.category_id ?? null,
        active: true,
      })
      .select()
      .single()

    if (createError) return { success: false, error: `Error creando equipo ${team.name}: ${createError.message}` }
    teamIdMap[team.id] = newTeam.id
  }

  // 3. Migrate players: team_id = next_team_id (mapped to new team), next_team_id = null
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, next_team_id, wants_to_continue, status')
    .eq('club_id', clubId)

  const playerUpdates: Array<{ id: string; team_id: string | null; next_team_id: null }> = []

  for (const player of (allPlayers ?? [])) {
    const typedPlayer = player as { id: string; next_team_id: string | null; wants_to_continue: boolean | null; status: string | null }
    if (typedPlayer.status === 'low') continue // skip inactive players

    const oldNextTeamId = typedPlayer.next_team_id
    const newTeamId = oldNextTeamId ? (teamIdMap[oldNextTeamId] ?? null) : null

    playerUpdates.push({
      id: typedPlayer.id,
      team_id: newTeamId,
      next_team_id: null,
    })
  }

  // Batch update players
  for (const update of playerUpdates) {
    await supabase
      .from('players')
      .update({ team_id: update.team_id, next_team_id: null })
      .eq('id', update.id)
  }

  // 4. Mark old teams as inactive
  const oldTeamIds = activeTeams.map((t: { id: string }) => t.id)
  const { error: deactivateError } = await supabase
    .from('teams')
    .update({ active: false })
    .in('id', oldTeamIds)

  if (deactivateError) return { success: false, error: deactivateError.message }

  // 5. Update current_season in club_settings
  const { error: settingsError } = await supabase
    .from('club_settings')
    .update({ current_season: nextSeason })
    .eq('club_id', clubId)

  if (settingsError) return { success: false, error: settingsError.message }

  revalidatePath('/configuracion')
  revalidatePath('/entrenadores')
  revalidatePath('/jugadores')

  return {
    success: true,
    nextSeason,
    teamsCreated: activeTeams.length,
    playersUpdated: playerUpdates.length,
  }
}

/**
 * Export season data as CSV strings (client downloads them)
 */
export async function exportSeasonData() {
  const { sb: supabase, clubId, roles } = await getScopedClient()

  if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Sin permisos' }
  }

  const { data: settings } = await supabase
    .from('club_settings')
    .select('current_season')
    .eq('club_id', clubId)
    .single()
  const currentSeason = (settings as { current_season?: string } | null)?.current_season ?? '2025/26'

  // Fetch players — TODOS los datos relevantes para el listado de temporada
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, dni, nationality, spanish_nationality, license_type, birth_date, position, dominant_foot, dorsal_number, status, tutor_name, tutor_email, tutor_phone, tutor2_name, tutor2_email, notes, is_special_case, teams:team_id(name)')
    .eq('club_id', clubId)
    .neq('status', 'low')
    .order('last_name')

  // Fetch payments for current season (con player_id para agregar cuotas por jugador)
  // fetchAllRows: una temporada supera 1000 cuotas → el export salía truncado (dinero).
  const payments = await fetchAllRows(() => supabase
    .from('quota_payments')
    .select('player_id, players:player_id(first_name, last_name), concept, amount_due, amount_paid, status, payment_date, payment_method')
    .eq('club_id', clubId)
    .eq('season', currentSeason)
    .order('payment_date', { ascending: false }))

  // Fetch sessions for current season (approximate by date range)
  // fetchAllRows: varias temporadas de sesiones superan 1000 filas.
  const sessions = await fetchAllRows(() => supabase
    .from('sessions')
    .select('session_type, session_date, teams:team_id(name), notes')
    .eq('club_id', clubId)
    .order('session_date', { ascending: false }))

  return {
    success: true,
    season: currentSeason,
    players: players ?? [],
    payments: payments ?? [],
    sessions: sessions ?? [],
  }
}

