'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/currency'
import { AttendanceGrid } from './AttendanceGrid'
import { completeSession } from '@/features/entrenadores/actions/session.actions'

interface Player {
  id: string
  first_name: string
  last_name: string
  dorsal_number: number | null
  position: string | null
}

interface AttendanceData {
  player_id: string
  present: boolean
  justified: boolean
  goals: number
  assists: number
  yellow_cards: number
  red_cards: number
  rating: number | null
  notes: string | null
}

interface Exercise {
  id: string
  title: string
  description: string | null
  category_id: string | null
}

interface SessionExercise {
  id: string
  slot_order: number
  exercises: Exercise | null
}

interface MatchEvent {
  id: string
  event_type: string
  minute: number
  notes: string | null
  players: { first_name: string; last_name: string; dorsal_number: number | null } | null
  player_out: { first_name: string; last_name: string; dorsal_number: number | null } | null
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
  teams?: { id: string; name: string } | null
}

interface SessionDetailProps {
  session: Session
  players: Player[]
  attendanceMap: Record<string, AttendanceData>
  sessionExercises: SessionExercise[]
  availableExercises: { id: string; title: string }[]
  matchEvents: MatchEvent[]
}

const TYPE_LABELS: Record<string, string> = {
  training: 'Entrenamiento',
  match: 'Partido',
  futsal: 'Fútbol sala',
  friendly: 'Amistoso',
}

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽',
  yellow_card: '🟨',
  red_card: '🟥',
  substitution: '🔄',
  injury: '💊',
}

const EVENT_LABELS: Record<string, string> = {
  goal: 'Gol',
  yellow_card: 'Amarilla',
  red_card: 'Roja',
  substitution: 'Cambio',
  injury: 'Lesión',
}

type Tab = 'asistencia' | 'ejercicios' | 'partido' | 'scouting'

export function SessionDetail({
  session,
  players,
  attendanceMap,
  sessionExercises,
  availableExercises,
  matchEvents,
}: SessionDetailProps) {
  const isMatch = session.session_type === 'match' || session.session_type === 'friendly'
  const isCompleted = !session.is_live && Object.keys(attendanceMap).length > 0

  const tabs: { id: Tab; label: string }[] = [
    { id: 'asistencia', label: 'Asistencia' },
    { id: 'ejercicios', label: 'Ejercicios' },
    ...(isMatch ? [{ id: 'partido' as Tab, label: 'Partido' }] : []),
    { id: 'scouting', label: 'Scouting' },
  ]

  const [activeTab, setActiveTab] = useState<Tab>('asistencia')
  const [isPending, startTransition] = useTransition()

  function handleComplete() {
    startTransition(async () => {
      const result = await completeSession(session.id)
      if (result.success) {
        toast.success('Sesión completada y estadísticas actualizadas')
      } else {
        toast.error(result.error ?? 'Error al completar la sesión')
      }
    })
  }

  const sortedEvents = [...matchEvents].sort((a, b) => a.minute - b.minute)

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {session.teams?.name} — {TYPE_LABELS[session.session_type] ?? session.session_type}
            </h2>
            <p className="text-muted-foreground mt-1">{formatDate(session.session_date)}</p>
            {session.opponent && (
              <p className="text-sm text-muted-foreground mt-1">vs {session.opponent}</p>
            )}
            {session.score_home != null && session.score_away != null && (
              <p className="text-lg font-bold mt-2">
                {session.score_home} - {session.score_away}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {session.is_live && (
              <span className="badge badge-destructive animate-pulse">En directo</span>
            )}
            {isMatch && session.is_live && (
              <Link
                href={`/entrenadores/partidos/${session.id}`}
                className="btn-primary text-sm"
              >
                Gestionar partido
              </Link>
            )}
            {!isCompleted && !session.is_live && (
              <button
                onClick={handleComplete}
                disabled={isPending}
                className="btn-primary text-sm"
              >
                {isPending ? 'Finalizando...' : 'Finalizar sesión'}
              </button>
            )}
          </div>
        </div>
        {session.notes && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
            {session.notes}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'asistencia' && (
        <AttendanceGrid
          sessionId={session.id}
          players={players}
          existingAttendance={attendanceMap}
          isCompleted={isCompleted}
        />
      )}

      {activeTab === 'ejercicios' && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold">Ejercicios de la sesión</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((slot) => {
              const ex = sessionExercises.find((e) => e.slot_order === slot)
              return (
                <div
                  key={slot}
                  className="border rounded-lg p-4 min-h-[100px] flex flex-col gap-2"
                >
                  <p className="text-xs text-muted-foreground font-medium">Slot {slot}</p>
                  {ex?.exercises ? (
                    <div className="flex-1">
                      <p className="font-medium text-sm">{ex.exercises.title}</p>
                      {ex.exercises.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                          {ex.exercises.description}
                        </p>
                      )}
                      <Link
                        href={`/entrenadores/ejercicios/${ex.exercises.id}`}
                        className="text-xs text-primary hover:underline mt-2 inline-block"
                      >
                        Ver ejercicio
                      </Link>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground italic">Slot vacío</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'partido' && isMatch && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Eventos del partido</h3>
              <Link
                href={`/entrenadores/partidos/${session.id}`}
                className="btn-secondary text-sm"
              >
                Gestionar partido
              </Link>
            </div>
            {sortedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin eventos registrados
              </p>
            ) : (
              <div className="space-y-2">
                {sortedEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
                    <span className="text-lg w-8 text-center">
                      {EVENT_ICONS[ev.event_type] ?? '•'}
                    </span>
                    <span className="text-muted-foreground w-10 shrink-0 font-mono">
                      {ev.minute}&apos;
                    </span>
                    <span className="font-medium text-xs px-2 py-0.5 rounded bg-muted">
                      {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    </span>
                    <div className="flex-1">
                      {ev.players && (
                        <span>
                          {ev.players.last_name}, {ev.players.first_name}
                          {ev.players.dorsal_number != null && (
                            <span className="text-muted-foreground"> #{ev.players.dorsal_number}</span>
                          )}
                        </span>
                      )}
                      {ev.player_out && (
                        <span className="text-muted-foreground">
                          {' '}→ {ev.player_out.last_name}
                        </span>
                      )}
                      {ev.notes && (
                        <span className="text-muted-foreground"> · {ev.notes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'scouting' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Informes de scouting</h3>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            Los informes de scouting se generan al finalizar un partido.
            {isMatch && (
              <span className="block mt-2">
                <Link href={`/entrenadores/partidos/${session.id}`} className="text-primary hover:underline">
                  Ver gestión del partido
                </Link>
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
