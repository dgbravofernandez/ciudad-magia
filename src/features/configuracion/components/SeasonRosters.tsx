'use client'

import { useState, useEffect } from 'react'
import { LayoutList, AlertTriangle, User, CheckCircle2, Mail } from 'lucide-react'
import { getSeasonRosters, type SeasonRostersResult, type TeamRoster } from '@/features/configuracion/actions/assignment-email.actions'

function RosterColumn({ label, rosters, showEmailStatus }: {
  label: string
  rosters: TeamRoster[]
  showEmailStatus?: boolean
}) {
  if (rosters.length === 0) {
    return (
      <div className="flex-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</p>
        <p className="text-sm text-slate-400 italic">Sin equipos</p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</p>
      <div className="space-y-4">
        {rosters.map(roster => (
          <div key={roster.team.id} className="border border-slate-200 rounded-lg overflow-hidden">
            {/* Header equipo */}
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{roster.team.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 text-slate-400" aria-hidden="true" />
                {roster.coach ? (
                  <span className="text-xs text-slate-600">{roster.coach.name}</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                    Sin entrenador
                  </span>
                )}
              </div>
            </div>

            {/* Jugadores */}
            {roster.players.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 italic">Sin jugadores</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {roster.players.map((player, idx) => (
                  <li key={player.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50/60">
                    <span className="text-slate-400 w-4 shrink-0">{idx + 1}.</span>
                    <span className="flex-1 text-slate-700 font-medium truncate">
                      {player.last_name}, {player.first_name}
                    </span>
                    {showEmailStatus && (
                      player.email_team_assignment_sent
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Email de asignación enviado" aria-label="Email enviado" />
                        : <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" title="Email pendiente" aria-label="Email pendiente" />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SeasonRosters() {
  const [data, setData] = useState<SeasonRostersResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'side-by-side' | 'next-only'>('side-by-side')

  useEffect(() => {
    getSeasonRosters().then(r => {
      if (r.success && r.data) setData(r.data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="h-5 w-40 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="h-48 bg-slate-100 rounded animate-pulse" />
      </div>
    )
  }

  if (!data) return null

  // Jugadores 25/26 sin equipo asignado 26/27
  const allCurrentPlayers = data.current.flatMap(r => r.players)
  const assignedIds = new Set(data.next.flatMap(r => r.players).map(p => p.id))
  const unassignedCount = allCurrentPlayers.filter(p => !assignedIds.has(p.id)).length

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutList className="w-5 h-5 text-slate-600" aria-hidden="true" />
          <h2 className="font-semibold text-slate-900">Listado de plantillas</h2>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {(['side-by-side', 'next-only'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                view === v
                  ? 'bg-white text-slate-900 font-medium shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'side-by-side' ? 'Lado a lado' : `Solo ${data.nextSeason}`}
            </button>
          ))}
        </div>
      </div>

      {/* Aviso jugadores sin equipo */}
      {unassignedCount > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>{unassignedCount}</strong> jugador{unassignedCount !== 1 ? 'es' : ''} activo{unassignedCount !== 1 ? 's' : ''} sin equipo asignado para {data.nextSeason}.
            Asígnalos en la sección de <a href="/jugadores/inscripciones" className="underline hover:no-underline">Inscripciones</a>.
          </span>
        </div>
      )}

      {/* Leyenda */}
      {view === 'next-only' && (
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Email enviado</span>
          <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-300" /> Email pendiente</span>
        </div>
      )}

      <div className={`flex gap-5 ${view === 'side-by-side' ? 'flex-row' : 'flex-col'}`}>
        {view === 'side-by-side' && (
          <RosterColumn
            label={`Temporada ${data.currentSeason}`}
            rosters={data.current}
          />
        )}
        <RosterColumn
          label={`Temporada ${data.nextSeason}`}
          rosters={data.next}
          showEmailStatus={true}
        />
      </div>

      {data.current.length === 0 && data.next.length === 0 && (
        <p className="text-sm text-slate-400 italic text-center py-6">
          No hay equipos configurados. Inicia la planificación primero.
        </p>
      )}
    </div>
  )
}
