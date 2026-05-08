'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'

const ALLOWED_ROLES = ['admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador']

async function getCtx() {
  const ctx = await getClubContext()
  if (!ctx.roles.some(r => ALLOWED_ROLES.includes(r))) {
    throw new Error('Sin permisos para ver informes')
  }
  return ctx
}

/** Mapeo de número de mes (1–12) a abreviatura en español */
const MONTH_LABEL: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr',
  5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago',
  9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic',
}
const MONTH_ORDER = ['Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago']

// ─────────────────────────────────────────────
// FILTROS COMUNES
// ─────────────────────────────────────────────

export type TeamOption = { id: string; name: string; season: string }

export async function getTeamsForFilter(): Promise<TeamOption[]> {
  const { clubId } = await getCtx()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('teams')
    .select('id, name, season')   // teams no tiene columna 'category' — es category_id (FK)
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')
  return data ?? []
}

// ─────────────────────────────────────────────
// 1. MINUTOS JUGADOS
// ─────────────────────────────────────────────

export type PlayerMinutesRow = {
  player_id: string
  player_name: string
  team_name: string
  matches_played: number
  total_minutes: number
  max_minutes: number    // para calcular % (partidos × 90)
  minutes_pct: number
}

export async function getPlayerMinutes(filters: {
  teamId?: string
  season: string
}): Promise<{ success: boolean; data?: PlayerMinutesRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Filtramos directamente por club_id en sessions y players
    // (session_attendance no tiene club_id propio)
    let query = sb
      .from('session_attendance')
      .select(`
        minutes_played,
        players!inner(id, first_name, last_name, club_id, team_id, teams(name)),
        sessions!inner(session_type, session_date, club_id, season)
      `)
      .eq('sessions.club_id', clubId)
      .eq('sessions.session_type', 'match')
      .eq('players.club_id', clubId)
      .not('minutes_played', 'is', null)
      .gt('minutes_played', 0)

    // Filtramos por temporada solo si la columna ya existe (migration 031)
    if (filters.season) {
      query = query.eq('sessions.season', filters.season)
    }
    if (filters.teamId) {
      query = query.eq('players.team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    // Agregar por jugador
    const byPlayer = new Map<string, PlayerMinutesRow>()
    for (const row of (data ?? [])) {
      const player = row.players
      if (!player) continue
      const key = player.id
      const existing = byPlayer.get(key)
      const minutes = row.minutes_played ?? 0
      const playerName = `${player.first_name} ${player.last_name}`
      if (existing) {
        existing.matches_played++
        existing.total_minutes += minutes
        existing.max_minutes += 90
      } else {
        byPlayer.set(key, {
          player_id: player.id,
          player_name: playerName,
          team_name: player.teams?.name ?? '—',
          matches_played: 1,
          total_minutes: minutes,
          max_minutes: 90,
          minutes_pct: 0,
        })
      }
    }

    const result = Array.from(byPlayer.values())
      .map(r => ({ ...r, minutes_pct: r.max_minutes > 0 ? Math.round((r.total_minutes / r.max_minutes) * 100) : 0 }))
      .sort((a, b) => b.total_minutes - a.total_minutes)

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 2. GOLES Y ASISTENCIAS
// ─────────────────────────────────────────────

export type PlayerGoalsRow = {
  player_id: string
  player_name: string
  team_name: string
  goals: number
  assists: number
  yellow_cards: number
  red_cards: number
  matches_played: number
  avg_rating: number | null
}

export async function getPlayerGoals(filters: {
  teamId?: string
  season: string
}): Promise<{ success: boolean; data?: PlayerGoalsRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    let query = sb
      .from('session_attendance')
      .select(`
        goals, assists, yellow_cards, red_cards, rating,
        players!inner(id, first_name, last_name, club_id, team_id, teams(name)),
        sessions!inner(session_type, club_id, season)
      `)
      .eq('sessions.club_id', clubId)
      .eq('sessions.session_type', 'match')
      .eq('players.club_id', clubId)

    if (filters.season) {
      query = query.eq('sessions.season', filters.season)
    }
    if (filters.teamId) {
      query = query.eq('players.team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    const byPlayer = new Map<string, PlayerGoalsRow & { rating_sum: number; rating_count: number }>()
    for (const row of (data ?? [])) {
      const player = row.players
      if (!player) continue
      const key = player.id
      const existing = byPlayer.get(key)
      const playerName = `${player.first_name} ${player.last_name}`
      if (existing) {
        existing.matches_played++
        existing.goals += row.goals ?? 0
        existing.assists += row.assists ?? 0
        existing.yellow_cards += row.yellow_cards ?? 0
        existing.red_cards += row.red_cards ?? 0
        if (row.rating) { existing.rating_sum += row.rating; existing.rating_count++ }
      } else {
        byPlayer.set(key, {
          player_id: player.id,
          player_name: playerName,
          team_name: player.teams?.name ?? '—',
          goals: row.goals ?? 0,
          assists: row.assists ?? 0,
          yellow_cards: row.yellow_cards ?? 0,
          red_cards: row.red_cards ?? 0,
          matches_played: 1,
          avg_rating: null,
          rating_sum: row.rating ?? 0,
          rating_count: row.rating ? 1 : 0,
        })
      }
    }

    const result = Array.from(byPlayer.values())
      .map(({ rating_sum, rating_count, ...r }) => ({
        ...r,
        avg_rating: rating_count > 0 ? Math.round((rating_sum / rating_count) * 10) / 10 : null,
      }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists)

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 3. ASISTENCIA A ENTRENAMIENTOS
// ─────────────────────────────────────────────

export type PlayerAttendanceRow = {
  player_id: string
  player_name: string
  team_name: string
  total_sessions: number
  attended: number
  justified: number
  absent: number
  attendance_pct: number
}

export async function getPlayerAttendance(filters: {
  teamId?: string
  season: string
}): Promise<{ success: boolean; data?: PlayerAttendanceRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    let query = sb
      .from('session_attendance')
      .select(`
        status,
        players!inner(id, first_name, last_name, club_id, team_id, teams(name)),
        sessions!inner(session_type, club_id, season)
      `)
      .eq('sessions.club_id', clubId)
      .eq('sessions.session_type', 'training')
      .eq('players.club_id', clubId)

    if (filters.season) {
      query = query.eq('sessions.season', filters.season)
    }
    if (filters.teamId) {
      query = query.eq('players.team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    const byPlayer = new Map<string, PlayerAttendanceRow>()
    for (const row of (data ?? [])) {
      const player = row.players
      if (!player) continue
      const key = player.id
      const existing = byPlayer.get(key)
      const playerName = `${player.first_name} ${player.last_name}`
      if (existing) {
        existing.total_sessions++
        if (row.status === 'present') existing.attended++
        else if (row.status === 'justified') existing.justified++
        else existing.absent++
      } else {
        byPlayer.set(key, {
          player_id: player.id,
          player_name: playerName,
          team_name: player.teams?.name ?? '—',
          total_sessions: 1,
          attended: row.status === 'present' ? 1 : 0,
          justified: row.status === 'justified' ? 1 : 0,
          absent: row.status !== 'present' && row.status !== 'justified' ? 1 : 0,
          attendance_pct: 0,
        })
      }
    }

    const result = Array.from(byPlayer.values())
      .map(r => ({
        ...r,
        attendance_pct: r.total_sessions > 0
          ? Math.round(((r.attended + r.justified) / r.total_sessions) * 100)
          : 0,
      }))
      .sort((a, b) => b.attendance_pct - a.attendance_pct)

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 4. LESIONADOS ACTUALES
// ─────────────────────────────────────────────

export type InjuredPlayerRow = {
  player_id: string
  player_name: string
  team_name: string
  injury_type: string
  status: string
  injured_at: string
  recovered_at: string | null
  days_injured: number
}

export async function getInjuredPlayers(filters: {
  teamId?: string
}): Promise<{ success: boolean; data?: InjuredPlayerRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    let query = sb
      .from('injuries')
      .select(`
        injury_type, status, injured_at, recovered_at,
        players!inner(id, first_name, last_name, club_id, team_id, teams(name))
      `)
      .eq('players.club_id', clubId)
      .eq('club_id', clubId)
      .in('status', ['active', 'recovering'])
      .order('injured_at', { ascending: false })

    if (filters.teamId) {
      query = query.eq('players.team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    const now = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: InjuredPlayerRow[] = (data ?? []).map((row: any) => {
      const player = row.players
      const injuredAt = new Date(row.injured_at)
      const daysInjured = Math.floor((now.getTime() - injuredAt.getTime()) / (1000 * 60 * 60 * 24))
      return {
        player_id: player.id,
        player_name: `${player.first_name} ${player.last_name}`,
        team_name: player.teams?.name ?? '—',
        injury_type: row.injury_type,
        status: row.status,
        injured_at: row.injured_at,
        recovered_at: row.recovered_at,
        days_injured: daysInjured,
      }
    })

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 5. SESIONES PLANIFICADAS
// ─────────────────────────────────────────────

export type SessionRow = {
  id: string
  session_date: string
  session_type: string
  team_name: string
  location: string | null
  title: string | null
  attendees_count: number
  total_players: number
}

export async function getSessions(filters: {
  teamId?: string
  season: string
  type?: 'training' | 'match' | 'all'
}): Promise<{ success: boolean; data?: SessionRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // 'title' es nueva (migration 031). 'opponent' ya existía y sirve como alternativa.
    let query = sb
      .from('sessions')
      .select(`
        id, session_date, session_type, location, title, opponent,
        teams!inner(id, name, club_id),
        session_attendance(id, status)
      `)
      .eq('club_id', clubId)
      .order('session_date', { ascending: false })
      .limit(100)

    if (filters.season) {
      query = query.eq('season', filters.season)
    }
    if (filters.teamId) {
      query = query.eq('team_id', filters.teamId)
    }
    if (filters.type && filters.type !== 'all') {
      query = query.eq('session_type', filters.type)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: SessionRow[] = (data ?? []).map((row: any) => {
      const attendance = row.session_attendance ?? []
      const attended = attendance.filter((a: any) => a.status === 'present' || a.status === 'justified').length
      return {
        id: row.id,
        session_date: row.session_date,
        session_type: row.session_type,
        team_name: row.teams?.name ?? '—',
        location: row.location,
        // title (nuevo) o fallback a opponent (campo ya existente)
        title: row.title ?? row.opponent ?? null,
        attendees_count: attended,
        total_players: attendance.length,
      }
    })

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 6. ÚLTIMOS RESULTADOS DE PARTIDOS
// ─────────────────────────────────────────────

export type MatchResultRow = {
  id: string
  session_date: string
  team_name: string
  title: string | null
  result: string | null
  location: string | null
}

export async function getMatchResults(filters: {
  teamId?: string
  season: string
  limit?: number
}): Promise<{ success: boolean; data?: MatchResultRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Seleccionamos result (nueva columna) + score_home/score_away como fallback
    // + opponent como fallback para title
    let query = sb
      .from('sessions')
      .select('id, session_date, title, result, opponent, location, score_home, score_away, teams!inner(id, name, club_id)')
      .eq('club_id', clubId)
      .eq('session_type', 'match')
      .order('session_date', { ascending: false })
      .limit(filters.limit ?? 30)

    if (filters.season) {
      query = query.eq('season', filters.season)
    }
    if (filters.teamId) {
      query = query.eq('team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (data ?? []).map((row: any) => {
        // Derivar resultado desde score_home/score_away si la columna result aún no existe
        let result = row.result ?? null
        if (!result && row.score_home !== null && row.score_away !== null) {
          const opponentSuffix = row.opponent ? ` vs ${row.opponent}` : ''
          result = `${row.score_home} - ${row.score_away}${opponentSuffix}`
        }
        return {
          id: row.id,
          session_date: row.session_date,
          team_name: row.teams?.name ?? '—',
          title: row.title ?? row.opponent ?? null,
          result,
          location: row.location,
        }
      }),
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 7. PAGOS PENDIENTES
// ─────────────────────────────────────────────

export type PendingPaymentRow = {
  player_id: string
  player_name: string
  team_name: string
  pending_months: string[]
  total_pending: number
}

export async function getPendingPayments(filters: {
  teamId?: string
  season: string
}): Promise<{ success: boolean; data?: PendingPaymentRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    let query = sb
      .from('quota_payments')
      .select(`
        amount_due, month, status,
        players!inner(id, first_name, last_name, club_id, team_id, teams(name))
      `)
      .eq('players.club_id', clubId)
      .eq('season', filters.season)
      .eq('status', 'pending')

    if (filters.teamId) {
      query = query.eq('players.team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    const byPlayer = new Map<string, PendingPaymentRow>()
    for (const row of (data ?? [])) {
      const player = row.players
      if (!player) continue
      const key = player.id
      const existing = byPlayer.get(key)
      // month es INTEGER (1-12) — convertir a etiqueta legible
      const monthLabel = typeof row.month === 'number' ? (MONTH_LABEL[row.month] ?? String(row.month)) : (row.month ?? '—')
      const amount = row.amount_due ?? 0
      if (existing) {
        existing.pending_months.push(monthLabel)
        existing.total_pending += amount
      } else {
        byPlayer.set(key, {
          player_id: player.id,
          player_name: `${player.first_name} ${player.last_name}`,
          team_name: player.teams?.name ?? '—',
          pending_months: [monthLabel],
          total_pending: amount,
        })
      }
    }

    const result = Array.from(byPlayer.values())
      .sort((a, b) => b.total_pending - a.total_pending)

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 8. INGRESOS POR MES
// ─────────────────────────────────────────────

export type IncomeRow = {
  month: string
  total: number
  cash: number
  card: number
  transfer: number
  count: number
}

export async function getIncomeByMonth(filters: {
  season: string
  teamId?: string
}): Promise<{ success: boolean; data?: IncomeRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    let query = sb
      .from('quota_payments')
      .select('amount_paid, payment_method, month, players!inner(club_id, team_id)')
      .eq('players.club_id', clubId)
      .eq('season', filters.season)
      .eq('status', 'paid')

    if (filters.teamId) {
      query = query.eq('players.team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    const byMonth = new Map<string, IncomeRow>()
    for (const row of (data ?? [])) {
      // month es INTEGER (1-12) — convertir a etiqueta
      const monthLabel = typeof row.month === 'number' ? (MONTH_LABEL[row.month] ?? String(row.month)) : (row.month ?? 'Sin mes')
      const existing = byMonth.get(monthLabel)
      const amount = row.amount_paid ?? 0
      const method = row.payment_method as string | null
      if (existing) {
        existing.total += amount
        existing.count++
        if (method === 'cash') existing.cash += amount
        else if (method === 'card') existing.card += amount
        else if (method === 'transfer') existing.transfer += amount
      } else {
        byMonth.set(monthLabel, {
          month: monthLabel,
          total: amount,
          cash: method === 'cash' ? amount : 0,
          card: method === 'card' ? amount : 0,
          transfer: method === 'transfer' ? amount : 0,
          count: 1,
        })
      }
    }

    const result = Array.from(byMonth.values())
      .sort((a, b) => {
        const ai = MONTH_ORDER.indexOf(a.month)
        const bi = MONTH_ORDER.indexOf(b.month)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
      })

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ─────────────────────────────────────────────
// 9. OBSERVACIONES DE ENTRENADORES
// ─────────────────────────────────────────────

export type ObservationRow = {
  id: string
  player_name: string
  team_name: string
  category: string
  comment: string
  author_name: string
  created_at: string
}

export async function getCoachObservations(filters: {
  teamId?: string
  season?: string
  limit?: number
}): Promise<{ success: boolean; data?: ObservationRow[]; error?: string }> {
  try {
    const { clubId } = await getCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    let query = sb
      .from('player_observations')
      .select(`
        id, category, comment, created_at,
        players!inner(id, first_name, last_name, club_id, team_id, teams(name)),
        club_members(full_name)
      `)
      .eq('players.club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(filters.limit ?? 50)

    if (filters.teamId) {
      query = query.eq('players.team_id', filters.teamId)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    return {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: (data ?? []).map((row: any) => ({
        id: row.id,
        player_name: row.players ? `${row.players.first_name} ${row.players.last_name}` : '—',
        team_name: row.players?.teams?.name ?? '—',
        category: row.category,
        comment: row.comment,
        author_name: row.club_members?.full_name ?? '—',
        created_at: row.created_at,
      })),
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
