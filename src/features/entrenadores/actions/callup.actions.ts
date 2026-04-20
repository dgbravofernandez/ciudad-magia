'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

function canEdit(roles: string[]) {
  return roles.some((r) =>
    ['admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador'].includes(r)
  )
}

export interface CallupEntry {
  player_id: string
  is_starter: boolean
}

/**
 * Retorna la convocatoria de una sesión + plantilla del equipo + tamaño máximo.
 */
export async function getCallup(sessionId: string) {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: session } = await sb
      .from('sessions')
      .select('id, team_id, club_id, session_date, opponent, teams(id, name, default_callup_size)')
      .eq('id', sessionId)
      .eq('club_id', clubId)
      .single()

    if (!session) return { success: false, error: 'Partido no encontrado' }

    const { data: roster } = await sb
      .from('players')
      .select('id, first_name, last_name, dorsal_number, position, status')
      .eq('team_id', session.team_id)
      .eq('club_id', clubId)
      .in('status', ['active', 'injured'])
      .order('dorsal_number', { ascending: true, nullsFirst: false })

    const { data: callups } = await sb
      .from('match_callups')
      .select('player_id, is_starter, notes')
      .eq('session_id', sessionId)
      .eq('club_id', clubId)

    const team = Array.isArray(session.teams) ? session.teams[0] : session.teams

    return {
      success: true,
      session: {
        id: session.id,
        team_id: session.team_id,
        session_date: session.session_date,
        opponent: session.opponent,
      },
      team: {
        id: team?.id ?? session.team_id,
        name: team?.name ?? '',
        default_callup_size: team?.default_callup_size ?? 18,
      },
      roster: (roster ?? []) as Array<{
        id: string
        first_name: string
        last_name: string
        dorsal_number: number | null
        position: string | null
        status: string
      }>,
      callups: (callups ?? []) as Array<{
        player_id: string
        is_starter: boolean
        notes: string | null
      }>,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Reemplaza la convocatoria de un partido por la lista dada.
 * (Delete + insert para simplicidad — idempotente.)
 */
export async function saveCallup(sessionId: string, entries: CallupEntry[]) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canEdit(roles)) return { success: false, error: 'Sin permisos' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Comprobar que la sesión pertenece al club
    const { data: session } = await sb
      .from('sessions')
      .select('id, team_id, club_id')
      .eq('id', sessionId)
      .eq('club_id', clubId)
      .single()
    if (!session) return { success: false, error: 'Partido no encontrado' }

    // Validar tamaño contra default_callup_size del equipo
    const { data: team } = await sb
      .from('teams')
      .select('default_callup_size')
      .eq('id', session.team_id)
      .eq('club_id', clubId)
      .single()
    const maxSize = team?.default_callup_size ?? 18
    if (entries.length > maxSize) {
      return {
        success: false,
        error: `La convocatoria supera el máximo del equipo (${maxSize}). Ajusta el tamaño o quita jugadores.`,
      }
    }

    // Borrar convocatoria previa
    await sb
      .from('match_callups')
      .delete()
      .eq('session_id', sessionId)
      .eq('club_id', clubId)

    if (entries.length > 0) {
      const rows = entries.map((e) => ({
        club_id: clubId,
        session_id: sessionId,
        player_id: e.player_id,
        is_starter: e.is_starter,
      }))
      const { error } = await sb.from('match_callups').insert(rows)
      if (error) return { success: false, error: error.message }
    }

    revalidatePath(`/entrenadores/partidos/${sessionId}`)
    revalidatePath('/entrenadores/partidos')
    return { success: true, count: entries.length }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Cambia el tamaño máximo de convocatoria de un equipo.
 */
export async function updateTeamCallupSize(teamId: string, size: number) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canEdit(roles)) return { success: false, error: 'Sin permisos' }
    if (!Number.isInteger(size) || size < 1 || size > 30) {
      return { success: false, error: 'Tamaño inválido (1-30)' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('teams')
      .update({ default_callup_size: size })
      .eq('id', teamId)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/entrenadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Resumen de convocatorias de un jugador en un rango de fechas (temporada).
 */
export async function getPlayerCallupStats(playerId: string, start: string, end: string) {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Partidos totales del equipo del jugador en el rango
    const { data: player } = await sb
      .from('players')
      .select('team_id')
      .eq('id', playerId)
      .eq('club_id', clubId)
      .single()
    const teamId = player?.team_id
    if (!teamId) return { success: true, team_matches: 0, called: 0, starter: 0 }

    const { count: teamMatches } = await sb
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('club_id', clubId)
      .in('session_type', ['match', 'friendly'])
      .gte('session_date', start)
      .lte('session_date', end)

    const { data: called } = await sb
      .from('match_callups')
      .select('is_starter, sessions!inner(session_date, team_id, club_id, session_type)')
      .eq('player_id', playerId)
      .eq('club_id', clubId)
      .gte('sessions.session_date', start)
      .lte('sessions.session_date', end)
      .eq('sessions.team_id', teamId)

    let starter = 0
    const total = (called ?? []).length
    for (const c of (called ?? []) as Array<{ is_starter: boolean }>) {
      if (c.is_starter) starter++
    }

    return {
      success: true,
      team_matches: teamMatches ?? 0,
      called: total,
      starter,
    }
  } catch (e) {
    return { success: false, error: (e as Error).message, team_matches: 0, called: 0, starter: 0 }
  }
}
