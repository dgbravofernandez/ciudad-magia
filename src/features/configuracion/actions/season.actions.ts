'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

/**
 * Returns a preview of what startNewSeason will do:
 * - number of active teams
 * - number of players moving (wants_to_continue=true with next_team_id set)
 * - number of players without next_team assignment
 * - current season string
 */
export async function getSeasonPreview() {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()

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
 * Start a new season:
 * 1. Duplicate active teams with new season string
 * 2. Move players: team_id ← next_team_id, next_team_id ← null (for wants_to_continue)
 * 3. Mark old teams as inactive
 * 4. Update club_settings.current_season
 */
export async function startNewSeason() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any
  const { clubId, roles } = await getClubContext()

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
  const supabase = createAdminClient()
  const { clubId, roles } = await getClubContext()

  if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Sin permisos' }
  }

  const { data: settings } = await supabase
    .from('club_settings')
    .select('current_season')
    .eq('club_id', clubId)
    .single()
  const currentSeason = (settings as { current_season?: string } | null)?.current_season ?? '2025/26'

  // Fetch players
  const { data: players } = await supabase
    .from('players')
    .select('first_name, last_name, dni, position, birth_date, status, tutor_name, tutor_email, tutor_phone, teams:team_id(name)')
    .eq('club_id', clubId)
    .neq('status', 'low')
    .order('last_name')

  // Fetch payments for current season
  const { data: payments } = await supabase
    .from('quota_payments')
    .select('players:player_id(first_name, last_name), concept, amount_due, amount_paid, status, payment_date, payment_method')
    .eq('club_id', clubId)
    .eq('season', currentSeason)
    .order('payment_date', { ascending: false })

  // Fetch sessions for current season (approximate by date range)
  const { data: sessions } = await supabase
    .from('sessions')
    .select('session_type, session_date, teams:team_id(name), notes')
    .eq('club_id', clubId)
    .order('session_date', { ascending: false })

  return {
    success: true,
    season: currentSeason,
    players: players ?? [],
    payments: payments ?? [],
    sessions: sessions ?? [],
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** '2025/26' → '2026/27' */
function bumpSeason(season: string): string {
  const match = season.match(/^(\d{4})\/(\d{2})$/)
  if (!match) {
    // Try full year format '2025/2026'
    const fullMatch = season.match(/^(\d{4})\/(\d{4})$/)
    if (fullMatch) {
      const y1 = parseInt(fullMatch[1]) + 1
      const y2 = parseInt(fullMatch[2]) + 1
      return `${y1}/${y2}`
    }
    return season
  }
  const y1 = parseInt(match[1]) + 1
  const y2 = parseInt(match[2])
  const y2full = y2 >= 90 ? 1900 + y2 : 2000 + y2
  const y2next = y2full + 1
  return `${y1}/${String(y2next).slice(-2)}`
}
