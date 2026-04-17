'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/currency'
import { ChevronRight, Trash2 } from 'lucide-react'
import { deleteSession } from '@/features/entrenadores/actions/session.actions'

interface SessionTeam {
  id: string
  name: string
}

interface Session {
  id: string
  team_id: string
  session_type: string
  session_date: string
  opponent: string | null
  score_home: number | null
  score_away: number | null
  is_live: boolean
  notes: string | null
  teams: SessionTeam | null
}

interface SessionsListProps {
  sessions: Session[]
  teams: SessionTeam[]
}

const TYPE_LABELS: Record<string, string> = {
  training: 'Entrenamiento',
  match: 'Partido',
  futsal: 'Fútbol sala',
  friendly: 'Amistoso',
}

export function SessionsList({ sessions, teams }: SessionsListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filterTeam, setFilterTeam] = useState('')
  const [filterType, setFilterType] = useState('')

  function handleDelete(e: React.MouseEvent, sessionId: string, label: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`¿Borrar ${label}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const r = await deleteSession(sessionId)
      if (r.success) {
        toast.success('Sesión borrada')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al borrar')
      }
    })
  }

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchTeam = !filterTeam || s.team_id === filterTeam
      const matchType = !filterType || s.session_type === filterType
      return matchTeam && matchType
    })
  }, [sessions, filterTeam, filterType])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Sesiones</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} sesiones</p>
        </div>
        <Link href="/entrenadores/sesiones/nueva" className="btn-primary flex items-center gap-2 text-sm">
          + Nueva sesión
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <select
          className="input w-auto min-w-[160px]"
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
        >
          <option value="">Todos los equipos</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          className="input w-auto"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No hay sesiones registradas
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rival</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resultado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="w-8" />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => {
                  const isMatch = session.session_type === 'match' || session.session_type === 'friendly'
                  const hasScore = session.score_home != null && session.score_away != null
                  const href = isMatch
                    ? `/entrenadores/partidos/${session.id}`
                    : `/entrenadores/sesiones/${session.id}`

                  return (
                    <tr
                      key={session.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        {formatDate(session.session_date)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.teams?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'badge',
                          isMatch ? 'badge-primary' : 'badge-muted'
                        )}>
                          {TYPE_LABELS[session.session_type] ?? session.session_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.opponent ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {hasScore ? (
                          <span className="font-bold">
                            {session.score_home} - {session.score_away}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {session.is_live ? (
                          <span className="badge badge-destructive animate-pulse">En directo</span>
                        ) : hasScore || !isMatch ? (
                          <span className="badge badge-success">Completada</span>
                        ) : (
                          <span className="badge badge-muted">Por jugar</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={href}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Link>
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={(e) => handleDelete(
                            e,
                            session.id,
                            `${TYPE_LABELS[session.session_type] ?? session.session_type} del ${formatDate(session.session_date)}`
                          )}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-40"
                          title="Borrar sesión"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
