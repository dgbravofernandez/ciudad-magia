import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils/currency'
import { cn } from '@/lib/utils/cn'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Partidos' }

export default async function PartidosPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  const memberId = headersList.get('x-member-id')!

  const supabase = await createClient()

  let query = supabase
    .from('sessions')
    .select(`
      *,
      teams(id, name)
    `)
    .eq('club_id', clubId)
    .in('session_type', ['match', 'friendly'])
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
      query = query.in('team_id', teamIds)
    }
  }

  const { data: matches } = await query.limit(100)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Partidos" />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Partidos</h2>
            <p className="text-sm text-muted-foreground">{matches?.length ?? 0} partidos registrados</p>
          </div>
          <div className="flex gap-2">
            <Link href="/entrenadores/sesiones/nueva?type=match" className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Nuevo partido
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          {(matches ?? []).length === 0 && (
            <div className="card p-12 text-center text-muted-foreground">
              No hay partidos registrados
            </div>
          )}
          {(matches ?? []).map((match) => {
            const hasResult = match.score_home != null && match.score_away != null
            const isWin = hasResult && match.score_home! > match.score_away!
            const isLoss = hasResult && match.score_home! < match.score_away!
            const isDraw = hasResult && match.score_home === match.score_away

            return (
              <Link
                key={match.id}
                href={`/entrenadores/partidos/${match.id}`}
                className="card p-4 flex items-center justify-between hover:border-primary/50 transition-colors block"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                    isWin ? 'bg-green-100 text-green-700' :
                    isLoss ? 'bg-red-100 text-red-700' :
                    isDraw ? 'bg-yellow-100 text-yellow-700' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {isWin ? 'W' : isLoss ? 'L' : isDraw ? 'D' : '?'}
                  </div>
                  <div>
                    <p className="font-medium">
                      {(match as any).teams?.name}
                      {match.opponent && <span className="text-muted-foreground"> vs {match.opponent}</span>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(match.session_date)}
                      {match.session_type === 'friendly' && <span className="ml-2 badge badge-muted text-xs">Amistoso</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {hasResult ? (
                    <div className="text-xl font-bold">
                      {match.score_home} - {match.score_away}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sin resultado</span>
                  )}
                  {match.is_live && (
                    <span className="badge badge-destructive animate-pulse text-xs">En directo</span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
