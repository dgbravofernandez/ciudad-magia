'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { addMatchEvent, completeSession, updateSession, type MatchEvent } from '@/features/entrenadores/actions/session.actions'
import { ScoutingModal } from './ScoutingModal'
import { CallupModal } from './CallupModal'
import { ClipboardList, FileDown } from 'lucide-react'
import { formatDate } from '@/lib/utils/currency'

interface Player {
  id: string
  first_name: string
  last_name: string
  dorsal_number: number | null
  position: string | null
}

interface EventRecord {
  id: string
  event_type: string
  minute: number
  notes: string | null
  players: { first_name: string; last_name: string; dorsal_number: number | null } | null
  player_out: { first_name: string; last_name: string; dorsal_number: number | null } | null
}

interface LiveMatchProps {
  session: {
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
  players: Player[]
  initialEvents: EventRecord[]
  yellowCardCounts: Record<string, number>
  sanctionThreshold: number
  sanctionMatches: number
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

export function LiveMatch({
  session,
  players,
  initialEvents,
  yellowCardCounts,
  sanctionThreshold,
  sanctionMatches,
}: LiveMatchProps) {
  const [isPending, startTransition] = useTransition()
  const [events, setEvents] = useState<EventRecord[]>(initialEvents)
  const [scoreHome, setScoreHome] = useState(session.score_home ?? 0)
  const [scoreAway, setScoreAway] = useState(session.score_away ?? 0)
  const [isLive, setIsLive] = useState(session.is_live)
  const [showEventForm, setShowEventForm] = useState(false)
  const [selectedEventType, setSelectedEventType] = useState<MatchEvent['event_type']>('goal')
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [selectedPlayerOut, setSelectedPlayerOut] = useState<string>('')
  const [minute, setMinute] = useState<number>(1)
  const [eventNotes, setEventNotes] = useState<string>('')
  const [showScoutingModal, setShowScoutingModal] = useState(false)
  const [showCallupModal, setShowCallupModal] = useState(false)

  // Accumulate yellow cards from events
  const yellowsThisMatch: Record<string, number> = {}
  for (const ev of events) {
    if (ev.event_type === 'yellow_card' && ev.players) {
      const pid = Object.keys(yellowCardCounts).find(
        () => ev.players?.last_name
      ) ?? ''
      // We need player_id — let's track from added events via local state
    }
  }

  function adjustScore(side: 'home' | 'away', delta: number) {
    const next = side === 'home'
      ? Math.max(0, scoreHome + delta)
      : Math.max(0, scoreAway + delta)
    if (side === 'home') setScoreHome(next)
    else setScoreAway(next)
    startTransition(async () => {
      const res = await updateSession({
        sessionId: session.id,
        ...(side === 'home' ? { score_home: next } : { score_away: next }),
      })
      if (!res.success) toast.error(res.error ?? 'Error al guardar marcador')
    })
  }

  function getPlayerName(p: Player) {
    return `${p.dorsal_number != null ? `#${p.dorsal_number} ` : ''}${p.last_name}, ${p.first_name}`
  }

  async function handleAddEvent() {
    if (!selectedPlayer && selectedEventType !== 'injury') {
      toast.error('Selecciona un jugador')
      return
    }

    const event: MatchEvent = {
      event_type: selectedEventType,
      player_id: selectedPlayer || null,
      player_out_id: selectedEventType === 'substitution' ? selectedPlayerOut || null : null,
      minute,
      notes: eventNotes || null,
    }

    startTransition(async () => {
      const result = await addMatchEvent(session.id, event)
      if (result.success) {
        toast.success(`${EVENT_LABELS[selectedEventType]} registrado`)
        if (selectedEventType === 'goal') {
          setScoreHome((prev) => prev + 1)
        }
        // Add to local events list
        const player = players.find((p) => p.id === selectedPlayer)
        const playerOut = players.find((p) => p.id === selectedPlayerOut)
        setEvents((prev) => [
          ...prev,
          {
            id: result.event?.id ?? Date.now().toString(),
            event_type: selectedEventType,
            minute,
            notes: eventNotes || null,
            players: player ? { first_name: player.first_name, last_name: player.last_name, dorsal_number: player.dorsal_number } : null,
            player_out: playerOut ? { first_name: playerOut.first_name, last_name: playerOut.last_name, dorsal_number: playerOut.dorsal_number } : null,
          } as EventRecord,
        ])
        setShowEventForm(false)
        setSelectedPlayer('')
        setSelectedPlayerOut('')
        setEventNotes('')
      } else {
        toast.error(result.error ?? 'Error al registrar evento')
      }
    })
  }

  function handleFinishMatch() {
    startTransition(async () => {
      const result = await completeSession(session.id)
      if (result.success) {
        toast.success('Partido finalizado')
        setIsLive(false)
        setShowScoutingModal(true)
      } else {
        toast.error(result.error ?? 'Error al finalizar')
      }
    })
  }

  // Players with sanction warnings (already accumulated yellows close to threshold)
  const warnings = players.filter((p) => {
    const yellows = yellowCardCounts[p.id] ?? 0
    return yellows >= sanctionThreshold - 1 && yellows < sanctionThreshold
  })

  const sortedEvents = [...events].sort((a, b) => a.minute - b.minute)

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Match header */}
        <div className="card p-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">{formatDate(session.session_date)}</p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="font-bold text-lg">{(session as any).teams?.name ?? 'Local'}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-4xl font-bold">{scoreHome}</div>
                <div className="text-2xl text-muted-foreground">-</div>
                <div className="text-4xl font-bold text-muted-foreground">{scoreAway}</div>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-muted-foreground">{session.opponent ?? 'Rival'}</p>
              </div>
            </div>
            {isLive ? (
              <span className="badge badge-destructive animate-pulse">En directo</span>
            ) : (
              <span className="badge badge-muted">Finalizado</span>
            )}

            {/* Callup actions */}
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowCallupModal(true)}
                className="btn-secondary text-xs flex items-center gap-1"
                title="Gestionar convocatoria"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Convocatoria
              </button>
              <a
                href={`/api/callup-pdf?sessionId=${session.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs flex items-center gap-1"
                title="Descargar PDF de convocatoria"
              >
                <FileDown className="w-3.5 h-3.5" />
                PDF
              </a>
            </div>
          </div>

          {/* Score adjustment */}
          {isLive && (
            <div className="flex justify-center items-center gap-6 mt-4 pt-4 border-t flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Goles a favor:</span>
                <button
                  onClick={() => adjustScore('home', -1)}
                  disabled={isPending}
                  className="w-7 h-7 rounded border flex items-center justify-center hover:bg-gray-100"
                >-</button>
                <span className="w-6 text-center font-bold">{scoreHome}</span>
                <button
                  onClick={() => adjustScore('home', 1)}
                  disabled={isPending}
                  className="w-7 h-7 rounded border flex items-center justify-center hover:bg-gray-100"
                >+</button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Goles rival:</span>
                <button
                  onClick={() => adjustScore('away', -1)}
                  disabled={isPending}
                  className="w-7 h-7 rounded border flex items-center justify-center hover:bg-gray-100"
                >-</button>
                <span className="w-6 text-center font-bold">{scoreAway}</span>
                <button
                  onClick={() => adjustScore('away', 1)}
                  disabled={isPending}
                  className="w-7 h-7 rounded border flex items-center justify-center hover:bg-gray-100"
                >+</button>
              </div>
            </div>
          )}
        </div>

        {/* Sanction warnings */}
        {warnings.length > 0 && (
          <div className="card p-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 space-y-2">
            <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">⚠️ Avisos de sanción</p>
            {warnings.map((p) => (
              <p key={p.id} className="text-sm text-yellow-700 dark:text-yellow-400">
                {p.first_name} {p.last_name} acumula {yellowCardCounts[p.id] ?? 0} amarillas — 1 más = {sanctionMatches} partido(s) de sanción
              </p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Event log */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold">Registro de eventos</h3>
            {sortedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin eventos registrados</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {sortedEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 text-sm">
                    <span className="text-lg">{EVENT_ICONS[ev.event_type] ?? '•'}</span>
                    <span className="text-muted-foreground w-8 shrink-0">{ev.minute}&apos;</span>
                    <div>
                      <span className="font-medium">
                        {ev.players ? `${ev.players.last_name}, ${ev.players.first_name}` : EVENT_LABELS[ev.event_type]}
                      </span>
                      {ev.player_out && (
                        <span className="text-muted-foreground"> → {ev.player_out.last_name}</span>
                      )}
                      {ev.notes && <span className="text-muted-foreground"> · {ev.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add event */}
            {isLive && !showEventForm && (
              <div className="pt-3 border-t grid grid-cols-2 gap-2">
                {(Object.entries(EVENT_LABELS) as [MatchEvent['event_type'], string][]).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => { setSelectedEventType(type); setShowEventForm(true) }}
                    className="btn-ghost text-sm flex items-center gap-2 justify-center"
                  >
                    {EVENT_ICONS[type]} {label}
                  </button>
                ))}
              </div>
            )}

            {isLive && showEventForm && (
              <div className="pt-3 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{EVENT_ICONS[selectedEventType]} {EVENT_LABELS[selectedEventType]}</p>
                  <button onClick={() => setShowEventForm(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-xs">Minuto</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={minute}
                      onChange={(e) => setMinute(parseInt(e.target.value) || 1)}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Jugador</label>
                    <select
                      value={selectedPlayer}
                      onChange={(e) => setSelectedPlayer(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Seleccionar</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>{getPlayerName(p)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedEventType === 'substitution' && (
                  <div>
                    <label className="label text-xs">Sale</label>
                    <select
                      value={selectedPlayerOut}
                      onChange={(e) => setSelectedPlayerOut(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Seleccionar jugador que sale</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>{getPlayerName(p)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Notas (opcional)"
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  className="input w-full"
                />
                <button
                  onClick={handleAddEvent}
                  disabled={isPending}
                  className="btn-primary w-full"
                >
                  {isPending ? 'Registrando...' : 'Registrar evento'}
                </button>
              </div>
            )}
          </div>

          {/* Lineup */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold">Convocatoria</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {players.map((p) => {
                const yellows = yellowCardCounts[p.id] ?? 0
                const hasWarning = yellows >= sanctionThreshold - 1

                return (
                  <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                    {p.dorsal_number != null && (
                      <span className="w-6 h-6 rounded bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {p.dorsal_number}
                      </span>
                    )}
                    <span className="flex-1">{p.last_name}, {p.first_name}</span>
                    {p.position && <span className="text-xs text-muted-foreground">{p.position}</span>}
                    {hasWarning && <span title="Riesgo de sanción">⚠️</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Finish match */}
        {isLive && (
          <div className="flex justify-center">
            <button
              onClick={handleFinishMatch}
              disabled={isPending}
              className="btn-primary px-8 py-3"
            >
              {isPending ? 'Finalizando...' : '🏁 Finalizar partido'}
            </button>
          </div>
        )}
      </div>

      {/* Scouting modal after match */}
      {showScoutingModal && (
        <ScoutingModal
          sessionId={session.id}
          rivalTeam={session.opponent ?? ''}
          onClose={() => setShowScoutingModal(false)}
        />
      )}

      {/* Callup modal */}
      {showCallupModal && (
        <CallupModal
          sessionId={session.id}
          onClose={() => setShowCallupModal(false)}
        />
      )}
    </>
  )
}
