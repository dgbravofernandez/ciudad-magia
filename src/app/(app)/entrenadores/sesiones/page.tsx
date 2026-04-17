import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils/currency'
import { DeleteSessionButton } from '@/features/entrenadores/components/DeleteSessionButton'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sesiones' }

export const dynamic = 'force-dynamic'

export default async function SesionesPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; type?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const { clubId, memberId, roles: memberRoles } = await getClubContext()
  const supabase = createAdminClient()

  let sessionsQuery = supabase
    .from('sessions')
    .select(`
      *,
      teams(id, name)
    `)
    .eq('club_id', clubId)
    .order('session_date', { ascending: false })

  // Coaches see only their teams
  if (
    memberRoles.includes('entrenador') &&
    !memberRoles.some((r: string) => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))
  ) {
    const { data: coachTeams } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('member_id', memberId)
    const teamIds = (coachTeams ?? []).map((t) => t.team_id)
    if (teamIds.length > 0) {
      sessionsQuery = sessionsQuery.in('team_id', teamIds)
    }
  }

  if (params.team) sessionsQuery = sessionsQuery.eq('team_id', params.team)
  if (params.type) sessionsQuery = sessionsQuery.eq('session_type', params.type)
  if (params.from) sessionsQuery = sessionsQuery.gte('session_date', params.from)
  if (params.to) sessionsQuery = sessionsQuery.lte('session_date', params.to)

  const { data: sessions } = await sessionsQuery.limit(100)

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  const typeLabel: Record<string, string> = {
    training: 'Entrenamiento',
    match: 'Partido',
    futsal: 'Fútbol sala',
    friendly: 'Amistoso',
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Sesiones" />
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Sesiones de entrenamiento</h2>
            <p className="text-sm text-muted-foreground">{sessions?.length ?? 0} sesiones encontradas</p>
          </div>
          <Link href="/entrenadores/sesiones/nueva" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva sesión
          </Link>
        </div>

        {/* Filters */}
        <form method="GET" className="card p-4 flex flex-wrap gap-3">
          <select name="team" defaultValue={params.team ?? ''} className="input w-auto min-w-[160px]">
            <option value="">Todos los equipos</option>
            {(teams ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select name="type" defaultValue={params.type ?? ''} className="input w-auto">
            <option value="">Todos los tipos</option>
            <option value="training">Entrenamiento</option>
            <option value="match">Partido</option>
            <option value="futsal">Fútbol sala</option>
            <option value="friendly">Amistoso</option>
          </select>
          <input type="date" name="from" defaultValue={params.from ?? ''} className="input w-auto" placeholder="Desde" />
          <input type="date" name="to" defaultValue={params.to ?? ''} className="input w-auto" placeholder="Hasta" />
          <button type="submit" className="btn-secondary">Filtrar</button>
          <Link href="/entrenadores/sesiones" className="btn-ghost">Limpiar</Link>
        </form>

        {/* Sessions list */}
        <div className="space-y-2">
          {(sessions ?? []).length === 0 && (
            <div className="card p-12 text-center text-muted-foreground">
              No hay sesiones registradas
            </div>
          )}
          {(sessions ?? []).map((session) => (
            <Link
              key={session.id}
              href={session.session_type === 'match' ? `/entrenadores/partidos/${session.id}` : `/entrenadores/sesiones/${session.id}`}
              className="card p-4 flex items-center justify-between hover:border-primary/50 transition-colors block"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg">
                  {session.session_type === 'match' ? '⚽' : '🏃'}
                </div>
                <div>
                  <p className="font-medium">
                    {(session as any).teams?.name} — {typeLabel[session.session_type] ?? session.session_type}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(session.session_date)}
                    {session.opponent && ` · vs ${session.opponent}`}
                    {session.score_home != null && session.score_away != null && (
                      <span className="ml-2 font-semibold text-foreground">
                        {session.score_home} - {session.score_away}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {session.is_live && (
                  <span className="badge badge-destructive animate-pulse">En directo</span>
                )}
                <DeleteSessionButton
                  sessionId={session.id}
                  label={`${typeLabel[session.session_type] ?? session.session_type} del ${formatDate(session.session_date)}`}
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
