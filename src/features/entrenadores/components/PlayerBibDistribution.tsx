'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { updatePlayerBibs } from '@/features/entrenadores/actions/session.actions'

interface Player {
  id: string
  first_name: string
  last_name: string
  dorsal_number: number | null
  position: string | null
}

type BibColor = 'orange' | 'pink' | 'white' | null

interface PlayerAssignment {
  group_color: BibColor
  is_goalkeeper: boolean
}

interface ExistingAttendanceData {
  group_color?: BibColor
  is_goalkeeper?: boolean
}

interface PlayerBibDistributionProps {
  sessionId: string
  players: Player[]
  existingData: Record<string, ExistingAttendanceData>
  isCompleted: boolean
}

const BIB_CONFIG: { value: BibColor; label: string; color: string; textColor: string }[] = [
  { value: null, label: 'Sin peto', color: '#e5e7eb', textColor: '#6b7280' },
  { value: 'orange', label: 'Naranja', color: '#f97316', textColor: '#ffffff' },
  { value: 'pink', label: 'Rosa', color: '#ec4899', textColor: '#ffffff' },
  { value: 'white', label: 'Blanco', color: '#f1f5f9', textColor: '#1e293b' },
]

export function PlayerBibDistribution({
  sessionId,
  players,
  existingData,
  isCompleted,
}: PlayerBibDistributionProps) {
  const [isPending, startTransition] = useTransition()
  const [assignments, setAssignments] = useState<Record<string, PlayerAssignment>>(() => {
    const initial: Record<string, PlayerAssignment> = {}
    for (const p of players) {
      const existing = existingData[p.id]
      initial[p.id] = {
        group_color: existing?.group_color ?? null,
        is_goalkeeper: existing?.is_goalkeeper ?? false,
      }
    }
    return initial
  })

  function setPlayerBib(playerId: string, color: BibColor) {
    setAssignments((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], group_color: color },
    }))
  }

  function toggleGoalkeeper(playerId: string) {
    setAssignments((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], is_goalkeeper: !prev[playerId].is_goalkeeper },
    }))
  }

  function handleSave() {
    const data = Object.entries(assignments).map(([player_id, a]) => ({
      player_id,
      group_color: a.group_color,
      is_goalkeeper: a.is_goalkeeper,
    }))

    startTransition(async () => {
      const result = await updatePlayerBibs(sessionId, data)
      if (result.success) {
        toast.success('Distribucion de petos guardada')
      } else {
        toast.error(result.error ?? 'Error al guardar')
      }
    })
  }

  // Group counts
  const groups = {
    orange: players.filter((p) => assignments[p.id]?.group_color === 'orange'),
    pink: players.filter((p) => assignments[p.id]?.group_color === 'pink'),
    white: players.filter((p) => assignments[p.id]?.group_color === 'white'),
    none: players.filter((p) => !assignments[p.id]?.group_color),
  }

  const goalkeepers = players.filter((p) => assignments[p.id]?.is_goalkeeper)

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Distribucion de petos</h3>
          <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f97316' }} />
              Naranja ({groups.orange.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ec4899' }} />
              Rosa ({groups.pink.length})
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: '#f1f5f9' }} />
              Blanco ({groups.white.length})
            </span>
            {goalkeepers.length > 0 && (
              <span>Porteros: {goalkeepers.length}</span>
            )}
          </div>
        </div>
        {!isCompleted && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-secondary text-sm"
          >
            {isPending ? 'Guardando...' : 'Guardar petos'}
          </button>
        )}
      </div>

      {/* Player list */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left py-2 pr-2 font-medium">Jugador</th>
              <th className="text-center py-2 px-1 font-medium">Peto</th>
              <th className="text-center py-2 px-1 font-medium">Portero</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {players.map((player) => {
              const assignment = assignments[player.id]
              if (!assignment) return null
              const currentBib = BIB_CONFIG.find((b) => b.value === assignment.group_color)

              return (
                <tr key={player.id} className="transition-colors">
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      {/* Color indicator */}
                      <span
                        className="w-3 h-3 rounded-full shrink-0 border"
                        style={{
                          backgroundColor: currentBib?.color ?? '#e5e7eb',
                          borderColor: assignment.group_color ? 'transparent' : '#d1d5db',
                        }}
                      />
                      {player.dorsal_number != null && (
                        <span className="w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {player.dorsal_number}
                        </span>
                      )}
                      <span className="font-medium truncate max-w-[160px]">
                        {player.last_name}, {player.first_name}
                      </span>
                      {assignment.is_goalkeeper && (
                        <span className="badge badge-muted text-xs">POR</span>
                      )}
                    </div>
                  </td>

                  {/* Bib selector */}
                  <td className="py-2 px-1">
                    {isCompleted ? (
                      <div className="flex justify-center">
                        {currentBib && currentBib.value && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: currentBib.color,
                              color: currentBib.textColor,
                            }}
                          >
                            {currentBib.label}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-center gap-1">
                        {BIB_CONFIG.filter((b) => b.value !== null).map((bib) => (
                          <button
                            key={bib.value ?? 'none'}
                            type="button"
                            onClick={() => setPlayerBib(player.id, assignment.group_color === bib.value ? null : bib.value)}
                            className={cn(
                              'w-7 h-7 rounded-full border-2 transition-all',
                              assignment.group_color === bib.value
                                ? 'border-foreground scale-110 shadow-md'
                                : 'border-transparent opacity-60 hover:opacity-100'
                            )}
                            style={{ backgroundColor: bib.color }}
                            title={bib.label}
                          />
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Goalkeeper toggle */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      assignment.is_goalkeeper ? <span className="text-xs font-bold">POR</span> : null
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleGoalkeeper(player.id)}
                        className={cn(
                          'w-7 h-7 rounded text-xs font-bold transition-colors mx-auto',
                          assignment.is_goalkeeper
                            ? 'bg-yellow-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-gray-200'
                        )}
                        title={assignment.is_goalkeeper ? 'Quitar portero' : 'Marcar como portero'}
                      >
                        P
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {players.length === 0 && (
        <p className="text-center text-muted-foreground py-4">No hay jugadores en este equipo</p>
      )}

      {/* Visual groups summary */}
      {!isCompleted && players.length > 0 && (groups.orange.length > 0 || groups.pink.length > 0 || groups.white.length > 0) && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Resumen de grupos</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { key: 'orange' as const, label: 'Naranja', color: '#f97316', players: groups.orange },
              { key: 'pink' as const, label: 'Rosa', color: '#ec4899', players: groups.pink },
              { key: 'white' as const, label: 'Blanco', color: '#f1f5f9', players: groups.white },
            ] as const).filter((g) => g.players.length > 0).map((group) => (
              <div key={group.key} className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm font-medium">{group.label} ({group.players.length})</span>
                </div>
                <div className="space-y-0.5">
                  {group.players.map((p) => (
                    <p key={p.id} className="text-xs text-muted-foreground">
                      {assignments[p.id]?.is_goalkeeper ? '(POR) ' : ''}
                      {p.dorsal_number ? `#${p.dorsal_number} ` : ''}
                      {p.last_name}, {p.first_name}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
