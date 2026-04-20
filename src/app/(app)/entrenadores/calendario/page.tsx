import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { CalendarView, type CalendarEvent } from '@/features/entrenadores/components/CalendarView'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Calendario' }
export const dynamic = 'force-dynamic'

function parseMonth(raw?: string): { year: number; month: number } {
  const now = new Date()
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number)
    return { year: y, month: m - 1 }
  }
  return { year: now.getFullYear(), month: now.getMonth() }
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; team?: string }>
}) {
  const params = await searchParams
  const { clubId, memberId, roles } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { year, month } = parseMonth(params.month)
  // Grid abarca 6 semanas — desde lunes anterior al 1 del mes hasta domingo tras fin de mes
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7 // lunes=0
  const gridStart = new Date(year, month, 1 - startOffset)
  const gridEnd = new Date(year, month, last.getDate() + (6 - ((last.getDay() + 6) % 7)))

  const fromIso = toISO(gridStart)
  const toIso = toISO(gridEnd)

  let query = sb
    .from('sessions')
    .select('id, session_date, start_time, session_type, opponent, team_id, teams(id, name)')
    .eq('club_id', clubId)
    .gte('session_date', fromIso)
    .lte('session_date', toIso)
    .order('session_date', { ascending: true })

  // Entrenador puro → solo sus equipos
  const isCoachOnly =
    roles.includes('entrenador') &&
    !roles.some((r: string) => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))

  if (isCoachOnly) {
    const { data: coachTeams } = await sb
      .from('team_coaches')
      .select('team_id')
      .eq('member_id', memberId)
    const teamIds = (coachTeams ?? []).map((t: { team_id: string }) => t.team_id)
    if (teamIds.length === 0) {
      query = query.eq('team_id', '00000000-0000-0000-0000-000000000000')
    } else {
      query = query.in('team_id', teamIds)
    }
  }

  if (params.team) query = query.eq('team_id', params.team)

  const { data: sessions } = await query

  const events: CalendarEvent[] = ((sessions ?? []) as Array<{
    id: string
    session_date: string
    start_time: string | null
    session_type: string
    opponent: string | null
    team_id: string | null
    teams: { id: string; name: string } | Array<{ id: string; name: string }> | null
  }>).map((s) => {
    const team = Array.isArray(s.teams) ? s.teams[0] : s.teams
    return {
      id: s.id,
      date: s.session_date,
      time: s.start_time ? String(s.start_time).slice(0, 5) : null,
      type: s.session_type,
      opponent: s.opponent,
      teamName: team?.name ?? '',
      href:
        s.session_type === 'match' || s.session_type === 'friendly'
          ? `/entrenadores/partidos/${s.id}`
          : `/entrenadores/sesiones/${s.id}`,
    }
  })

  const { data: teams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Calendario" />
      <div className="flex-1 p-6">
        <CalendarView
          year={year}
          month={month}
          events={events}
          teams={(teams ?? []) as Array<{ id: string; name: string }>}
          selectedTeam={params.team ?? ''}
        />
      </div>
    </div>
  )
}
