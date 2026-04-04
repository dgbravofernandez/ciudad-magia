'use client'

import Link from 'next/link'
import { Users, Calendar, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/currency'
import { RoleGuard } from '@/components/shared/RoleGuard'

interface Coach {
  member_id: string
  club_members: { full_name: string; email: string } | null
}

interface Team {
  id: string
  name: string
  category_id: string | null
  season: string
  team_coaches?: Coach[]
}

interface Observation {
  team_id: string
  nivel_rating: number | null
  ajeno_rating: number | null
  created_at: string
}

interface TeamsOverviewProps {
  teams: Team[]
  lastSessions: Record<string, string>
  nextSessions: Record<string, string>
  observations: Observation[]
  memberRoles: string[]
  memberId: string
}

export function TeamsOverview({
  teams,
  lastSessions,
  nextSessions,
  observations,
  memberRoles,
}: TeamsOverviewProps) {
  const isCoordinator = memberRoles.some((r) =>
    ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r)
  )

  // Average observation ratings per team
  const teamObsMap: Record<string, { nivel: number; ajeno: number; count: number }> = {}
  for (const obs of observations) {
    if (!teamObsMap[obs.team_id]) {
      teamObsMap[obs.team_id] = { nivel: 0, ajeno: 0, count: 0 }
    }
    teamObsMap[obs.team_id].nivel += obs.nivel_rating ?? 0
    teamObsMap[obs.team_id].ajeno += obs.ajeno_rating ?? 0
    teamObsMap[obs.team_id].count++
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Equipos</h2>
          <p className="text-sm text-muted-foreground">{teams.length} equipos activos</p>
        </div>
        <div className="flex gap-2">
          <Link href="/entrenadores/sesiones/nueva" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nueva sesión
          </Link>
        </div>
      </div>

      {teams.length === 0 && (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay equipos asignados</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teams.map((team) => {
          const coaches = team.team_coaches ?? []
          const lastSession = lastSessions[team.id]
          const nextSession = nextSessions[team.id]
          const obs = teamObsMap[team.id]
          const avgNivel = obs ? (obs.nivel / obs.count).toFixed(1) : null
          const avgAjeno = obs ? (obs.ajeno / obs.count).toFixed(1) : null

          return (
            <div key={team.id} className="card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base">{team.name}</h3>
                  <p className="text-xs text-muted-foreground">Temporada {team.season}</p>
                </div>
                <Link
                  href={`/entrenadores/sesiones?team=${team.id}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              {/* Coaches */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Entrenadores</p>
                {coaches.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sin entrenador asignado</p>
                ) : (
                  <div className="space-y-1">
                    {coaches.map((c) => (
                      <p key={c.member_id} className="text-sm">
                        {c.club_members?.full_name ?? 'Desconocido'}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-1">Última sesión</p>
                  <p className={cn('font-medium', !lastSession && 'text-muted-foreground italic')}>
                    {lastSession ? formatDate(lastSession) : 'Ninguna'}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-1">Próxima sesión</p>
                  <p className={cn('font-medium', !nextSession && 'text-muted-foreground italic')}>
                    {nextSession ? formatDate(nextSession) : 'Sin programar'}
                  </p>
                </div>
              </div>

              {/* Coordinator observations summary */}
              {isCoordinator && obs && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-2">Observaciones (promedio)</p>
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nivel: </span>
                      <span className="font-semibold">{avgNivel}/5</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ajeno: </span>
                      <span className="font-semibold">{avgAjeno}/5</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{obs.count} observaciones</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-2 border-t">
                <Link
                  href={`/entrenadores/sesiones/nueva?team=${team.id}`}
                  className="btn-secondary text-xs flex-1 text-center flex items-center justify-center gap-1"
                >
                  <Calendar className="w-3 h-3" />
                  Nueva sesión
                </Link>
                <Link
                  href={`/entrenadores/sesiones?team=${team.id}`}
                  className="btn-ghost text-xs flex-1 text-center"
                >
                  Ver historial
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/entrenadores/sesiones" className="card p-4 hover:border-primary/50 transition-colors">
          <Calendar className="w-5 h-5 text-primary mb-2" />
          <p className="font-medium text-sm">Sesiones</p>
          <p className="text-xs text-muted-foreground">Historial completo</p>
        </Link>
        <Link href="/entrenadores/partidos" className="card p-4 hover:border-primary/50 transition-colors">
          <span className="text-xl mb-2 block">⚽</span>
          <p className="font-medium text-sm">Partidos</p>
          <p className="text-xs text-muted-foreground">Resultados y actas</p>
        </Link>
        <Link href="/entrenadores/ejercicios" className="card p-4 hover:border-primary/50 transition-colors">
          <span className="text-xl mb-2 block">📋</span>
          <p className="font-medium text-sm">Ejercicios</p>
          <p className="text-xs text-muted-foreground">Repositorio</p>
        </Link>
        <RoleGuard roles={['admin', 'direccion', 'coordinador', 'director_deportivo']}>
          <Link href="/entrenadores/observaciones" className="card p-4 hover:border-primary/50 transition-colors">
            <span className="text-xl mb-2 block">👁️</span>
            <p className="font-medium text-sm">Observaciones</p>
            <p className="text-xs text-muted-foreground">Informes coordinador</p>
          </Link>
        </RoleGuard>
      </div>
    </div>
  )
}
