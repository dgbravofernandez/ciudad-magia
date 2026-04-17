'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/currency'
import { Plus, Trash2 } from 'lucide-react'
import { deleteSession } from '@/features/entrenadores/actions/session.actions'

interface MatchTeam {
  id: string
  name: string
}

interface Match {
  id: string
  team_id: string
  session_type: string
  session_date: string
  opponent: string | null
  score_home: number | null
  score_away: number | null
  is_live: boolean
  notes: string | null
  teams: MatchTeam | null
}

interface MatchesListProps {
  matches: Match[]
  teams: MatchTeam[]
}

export function MatchesList({ matches, teams }: MatchesListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filterTeam, setFilterTeam] = useState('')

  function handleDelete(e: React.MouseEvent, sessionId: string, label: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`¿Borrar el partido ${label}? Esta acción no se puede deshacer.`)) return
    startTransition(async () => {
      const r = await deleteSession(sessionId)
      if (r.success) {
        toast.success('Partido borrado')
        router.refresh()
      } else {
        toast.error(r.error ?? 'Error al borrar')
      }
    })
  }

  const filtered = useMemo(() => {
    return matches.filter((m) => !filterTeam || m.team_id === filterTeam)
  }, [matches, filterTeam])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Partidos</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} partidos registrados</p>
        </div>
        <Link
          href="/entrenadores/sesiones/nueva?type=match"
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo partido
        </Link>
      </div>

      {/* Filter */}
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
      </div>

      {/* Match cards */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-muted-foreground">
          No hay partidos registrados
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((match) => {
            const hasScore = match.score_home != null && match.score_away != null
            const isWin = hasScore && match.score_home! > match.score_away!
            const isLoss = hasScore && match.score_home! < match.score_away!
            const isDraw = hasScore && match.score_home === match.score_away

            const resultBg = isWin
              ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
              : isLoss
              ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
              : isDraw
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
              : 'bg-muted text-muted-foreground'

            return (
              <div key={match.id} className="card p-4 flex items-center justify-between gap-4">
                {/* Result indicator */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0',
                    resultBg
                  )}
                >
                  {isWin ? 'V' : isLoss ? 'D' : isDraw ? 'E' : '?'}
                </div>

                {/* Match info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {match.teams?.name ?? 'Local'}
                    </span>
                    <span className="text-muted-foreground text-sm">vs</span>
                    <span className="font-semibold text-muted-foreground">
                      {match.opponent ?? 'Rival desconocido'}
                    </span>
                    {match.session_type === 'friendly' && (
                      <span className="badge badge-muted text-xs">Amistoso</span>
                    )}
                    {match.is_live && (
                      <span className="badge badge-destructive animate-pulse text-xs">En directo</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDate(match.session_date)}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  {hasScore ? (
                    <p className="text-2xl font-bold">
                      {match.score_home} - {match.score_away}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Por jugar</p>
                  )}
                </div>

                {/* Action buttons */}
                <Link
                  href={`/entrenadores/partidos/${match.id}`}
                  className="btn-secondary text-sm shrink-0"
                >
                  Gestionar
                </Link>
                <button
                  onClick={(e) => handleDelete(
                    e,
                    match.id,
                    `${match.teams?.name ?? 'Local'} vs ${match.opponent ?? 'Rival'}`
                  )}
                  disabled={isPending}
                  className="p-2 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors shrink-0 disabled:opacity-40"
                  title="Borrar partido"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
