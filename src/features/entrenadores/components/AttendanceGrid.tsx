'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { updateSessionAttendance, completeSession, type AttendanceRecord } from '@/features/entrenadores/actions/session.actions'

interface Player {
  id: string
  first_name: string
  last_name: string
  dorsal_number: number | null
  position: string | null
}

interface AttendanceGridProps {
  sessionId: string
  players: Player[]
  existingAttendance: Record<string, {
    status?: 'present' | 'absent' | 'justified'
    // legacy boolean fields (backwards compat from DB)
    present?: boolean
    justified?: boolean
    goals: number
    assists: number
    yellow_cards: number
    red_cards: number
    minutes_played?: number
    rating: number | null
    notes: string | null
  }>
  isCompleted: boolean
}

function legacyToStatus(data: AttendanceGridProps['existingAttendance'][string]): 'present' | 'absent' | 'justified' {
  if (data.status) return data.status
  if (data.justified) return 'justified'
  if (data.present === false) return 'absent'
  return 'present'
}

export function AttendanceGrid({ sessionId, players, existingAttendance, isCompleted }: AttendanceGridProps) {
  const [isPending, startTransition] = useTransition()
  const [isSaving, setIsSaving] = useState(false)
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>(() => {
    const initial: Record<string, AttendanceRecord> = {}
    for (const player of players) {
      const existing = existingAttendance[player.id]
      initial[player.id] = {
        player_id: player.id,
        status: existing ? legacyToStatus(existing) : 'present',
        goals: existing?.goals ?? 0,
        assists: existing?.assists ?? 0,
        yellow_cards: existing?.yellow_cards ?? 0,
        red_cards: existing?.red_cards ?? 0,
        minutes_played: existing?.minutes_played ?? 0,
        rating: existing?.rating ?? null,
        notes: existing?.notes ?? null,
      }
    }
    return initial
  })

  function updateRecord<K extends keyof AttendanceRecord>(playerId: string, field: K, value: AttendanceRecord[K]) {
    setAttendance((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }))
  }

  async function handleSave() {
    setIsSaving(true)
    const records = Object.values(attendance)
    const result = await updateSessionAttendance(sessionId, records)
    setIsSaving(false)
    if (result.success) {
      toast.success('Asistencia guardada')
    } else {
      toast.error(result.error ?? 'Error al guardar')
    }
  }

  function handleComplete() {
    startTransition(async () => {
      const records = Object.values(attendance)
      const saveResult = await updateSessionAttendance(sessionId, records)
      if (!saveResult.success) {
        toast.error(saveResult.error ?? 'Error al guardar')
        return
      }
      const result = await completeSession(sessionId)
      if (result.success) {
        toast.success('Sesión completada y estadísticas actualizadas')
      } else {
        toast.error(result.error ?? 'Error al completar')
      }
    })
  }

  const presentCount = Object.values(attendance).filter((a) => a.status === 'present').length
  const absentCount = Object.values(attendance).filter((a) => a.status === 'absent').length
  const justifiedCount = Object.values(attendance).filter((a) => a.status === 'justified').length
  const totalMinutes = Object.values(attendance).filter(a => a.status === 'present').reduce((s, a) => s + (a.minutes_played ?? 0), 0)

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Control de asistencia</h3>
          <div className="flex gap-4 mt-1 text-sm flex-wrap">
            <span className="text-green-600">✓ {presentCount} presentes</span>
            <span className="text-red-500">✗ {absentCount} ausentes</span>
            {justifiedCount > 0 && <span className="text-yellow-600">⚠ {justifiedCount} justificados</span>}
          </div>
        </div>
        {!isCompleted && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-secondary text-sm"
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={handleComplete}
              disabled={isPending}
              className="btn-primary text-sm"
            >
              {isPending ? 'Completando...' : 'Completar sesión'}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left py-2 pr-2 font-medium">Jugador</th>
              <th className="text-center py-2 px-1 font-medium">Estado</th>
              <th className="text-center py-2 px-1 font-medium">Min</th>
              <th className="text-center py-2 px-1 font-medium">⚽</th>
              <th className="text-center py-2 px-1 font-medium">🎯</th>
              <th className="text-center py-2 px-1 font-medium">🟨</th>
              <th className="text-center py-2 px-1 font-medium">🟥</th>
              <th className="text-center py-2 px-1 font-medium">Rating</th>
              <th className="text-left py-2 pl-2 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {players.map((player) => {
              const record = attendance[player.id]
              if (!record) return null
              const isPresent = record.status === 'present'

              return (
                <tr
                  key={player.id}
                  className={cn('transition-colors', !isPresent && 'opacity-60 bg-muted/30')}
                >
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      {player.dorsal_number != null && (
                        <span className="w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                          {player.dorsal_number}
                        </span>
                      )}
                      <span className="font-medium truncate max-w-[120px]">
                        {player.last_name}, {player.first_name}
                      </span>
                    </div>
                  </td>

                  {/* Status toggle */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      <span className={cn(
                        'badge text-xs',
                        record.status === 'present' ? 'badge-success' :
                        record.status === 'justified' ? 'badge-warning' : 'badge-destructive'
                      )}>
                        {record.status === 'present' ? 'P' : record.status === 'justified' ? 'J' : 'A'}
                      </span>
                    ) : (
                      <div className="flex justify-center gap-1">
                        {(['present', 'justified', 'absent'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => updateRecord(player.id, 'status', s)}
                            className={cn(
                              'w-7 h-7 rounded text-xs font-bold transition-colors',
                              record.status === s
                                ? s === 'present' ? 'bg-green-500 text-white'
                                  : s === 'justified' ? 'bg-yellow-500 text-white'
                                  : 'bg-red-500 text-white'
                                : 'bg-muted text-muted-foreground hover:bg-gray-200'
                            )}
                            title={s === 'present' ? 'Presente' : s === 'justified' ? 'Justificado' : 'Ausente'}
                          >
                            {s === 'present' ? 'P' : s === 'justified' ? 'J' : 'A'}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Minutes played */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      <span>{record.minutes_played || '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={record.minutes_played ?? 0}
                        onChange={(e) => updateRecord(player.id, 'minutes_played', parseInt(e.target.value) || 0)}
                        className="w-12 text-center input py-1 px-1 text-xs"
                        disabled={!isPresent}
                      />
                    )}
                  </td>

                  {/* Goals */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      <span>{record.goals || '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={record.goals}
                        onChange={(e) => updateRecord(player.id, 'goals', parseInt(e.target.value) || 0)}
                        className="w-10 text-center input py-1 px-1 text-xs"
                        disabled={!isPresent}
                      />
                    )}
                  </td>

                  {/* Assists */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      <span>{record.assists || '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={record.assists}
                        onChange={(e) => updateRecord(player.id, 'assists', parseInt(e.target.value) || 0)}
                        className="w-10 text-center input py-1 px-1 text-xs"
                        disabled={!isPresent}
                      />
                    )}
                  </td>

                  {/* Yellow cards */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      <span>{record.yellow_cards || '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={2}
                        value={record.yellow_cards}
                        onChange={(e) => updateRecord(player.id, 'yellow_cards', parseInt(e.target.value) || 0)}
                        className="w-10 text-center input py-1 px-1 text-xs"
                        disabled={!isPresent}
                      />
                    )}
                  </td>

                  {/* Red cards */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      <span>{record.red_cards || '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={1}
                        value={record.red_cards}
                        onChange={(e) => updateRecord(player.id, 'red_cards', parseInt(e.target.value) || 0)}
                        className="w-10 text-center input py-1 px-1 text-xs"
                        disabled={!isPresent}
                      />
                    )}
                  </td>

                  {/* Rating */}
                  <td className="py-2 px-1 text-center">
                    {isCompleted ? (
                      <span>{record.rating ?? '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={10}
                        placeholder="—"
                        value={record.rating ?? ''}
                        onChange={(e) => updateRecord(player.id, 'rating', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-12 text-center input py-1 px-1 text-xs"
                        disabled={!isPresent}
                      />
                    )}
                  </td>

                  {/* Notes */}
                  <td className="py-2 pl-2">
                    {isCompleted ? (
                      <span className="text-xs text-muted-foreground">{record.notes ?? ''}</span>
                    ) : (
                      <input
                        type="text"
                        placeholder="Notas..."
                        value={record.notes ?? ''}
                        onChange={(e) => updateRecord(player.id, 'notes', e.target.value || null)}
                        className="input py-1 px-2 text-xs w-full min-w-[120px]"
                        disabled={!isPresent}
                      />
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
    </div>
  )
}
