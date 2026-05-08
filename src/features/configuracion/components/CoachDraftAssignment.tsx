'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Users2, Loader2, X, Check } from 'lucide-react'
import { assignCoachToTeam, removeCoachFromTeam, getCoachesForPlanning, type CoachForPlanning } from '@/features/entrenadores/actions/coach.actions'

interface DraftTeam {
  id: string
  name: string
  season: string
}

interface TeamCoachRow {
  team_id: string
  member_id: string | null
}

interface Props {
  draftTeams: DraftTeam[]
  /** Asignaciones actuales de entrenadores en equipos borrador */
  initialAssignments: TeamCoachRow[]
  nextSeason: string
}

export function CoachDraftAssignment({ draftTeams, initialAssignments, nextSeason }: Props) {
  const [coaches, setCoaches] = useState<CoachForPlanning[]>([])
  const [coachesLoaded, setCoachesLoaded] = useState(false)
  const [assignments, setAssignments] = useState<Record<string, string | null>>({})
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getCoachesForPlanning().then(r => {
      if (r.success && r.coaches) setCoaches(r.coaches)
      setCoachesLoaded(true)
    })

    // Inicializar mapa teamId → memberId
    const map: Record<string, string | null> = {}
    for (const team of draftTeams) {
      const found = initialAssignments.find(a => a.team_id === team.id)
      map[team.id] = found?.member_id ?? null
    }
    setAssignments(map)
  }, [draftTeams, initialAssignments])

  function handleAssign(teamId: string, memberId: string | null) {
    const prev = assignments[teamId]

    startTransition(async () => {
      // Si hay asignación previa, quitarla
      if (prev) {
        const r = await removeCoachFromTeam(prev, teamId)
        if (!r.success) { toast.error(r.error ?? 'Error quitando entrenador'); return }
      }

      // Si hay nueva selección, asignar
      if (memberId) {
        const r = await assignCoachToTeam(memberId, teamId)
        if (!r.success) { toast.error(r.error ?? 'Error asignando entrenador'); return }
        setAssignments(a => ({ ...a, [teamId]: memberId }))
        toast.success('Entrenador asignado')
      } else {
        setAssignments(a => ({ ...a, [teamId]: null }))
        toast.success('Entrenador desasignado')
      }
    })
  }

  if (draftTeams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Users2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
          <h2 className="font-semibold text-slate-900">Cuerpo técnico {nextSeason}</h2>
        </div>
        <p className="text-sm text-slate-500 italic">Crea primero los equipos borrador para asignar entrenadores.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
        <h2 className="font-semibold text-slate-900">Cuerpo técnico {nextSeason}</h2>
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {Object.values(assignments).filter(Boolean).length}/{draftTeams.length} asignados
        </span>
      </div>

      {!coachesLoaded ? (
        <p className="text-sm text-slate-400 italic">Cargando entrenadores...</p>
      ) : coaches.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No hay entrenadores registrados en el club. Añádelos primero en Entrenadores → Staff.</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Equipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Entrenador principal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {draftTeams.map(team => {
                const assignedId = assignments[team.id]
                const assignedCoach = coaches.find(c => c.id === assignedId)

                return (
                  <tr key={team.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{team.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-hidden="true" />
                        ) : null}
                        <select
                          value={assignedId ?? ''}
                          onChange={e => handleAssign(team.id, e.target.value || null)}
                          disabled={isPending}
                          className="flex-1 text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          aria-label={`Entrenador para ${team.name}`}
                        >
                          <option value="">— Sin asignar —</option>
                          {coaches.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {assignedCoach ? (
                        <Check className="w-4 h-4 text-emerald-500 mx-auto" aria-label="Asignado" />
                      ) : (
                        <X className="w-4 h-4 text-slate-300 mx-auto" aria-label="Sin asignar" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Los entrenadores asignados aquí se mostrarán en el email de asignación a las familias.
      </p>
    </div>
  )
}
