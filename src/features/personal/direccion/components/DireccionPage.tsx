'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Users, AlertCircle, Heart, ClipboardList, Plus, X, Calendar } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils/currency'
import { createCalendarEvent } from '@/features/personal/actions/personal.actions'

interface CalendarEvent {
  id: string
  title: string
  start_at: string
  end_at: string
  event_type: string
  attendee_ids: string[] | null
  notes: string | null
}

interface ScoutingReport {
  id: string
  rival_team: string
  dorsal: string | null
  position: string | null
  comment: string | null
  created_at: string
  reporter: { full_name: string } | null
}

interface Member {
  id: string
  full_name: string
}

interface Props {
  clubId: string
  events: CalendarEvent[]
  scoutingReports: ScoutingReport[]
  activePlayers: number
  pendingPayments: number
  activeInjuries: number
  scoutingCount: number
  members: Member[]
}

const EVENT_TYPES = [
  { value: 'meeting', label: 'Reunión' },
  { value: 'event', label: 'Evento' },
  { value: 'training', label: 'Entrenamiento' },
  { value: 'match', label: 'Partido' },
  { value: 'other', label: 'Otro' },
]

const EVENT_TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-blue-100 text-blue-700',
  event: 'bg-purple-100 text-purple-700',
  training: 'bg-green-100 text-green-700',
  match: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
}

export function DireccionPage({
  clubId,
  events,
  scoutingReports,
  activePlayers,
  pendingPayments,
  activeInjuries,
  scoutingCount,
  members,
}: Props) {
  const [showEventForm, setShowEventForm] = useState(false)
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [eventType, setEventType] = useState('meeting')
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([])
  const [eventNotes, setEventNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggleAttendee(memberId: string) {
    setSelectedAttendees((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    )
  }

  function handleCreateEvent() {
    if (!title || !startAt || !endAt) return

    startTransition(async () => {
      const result = await createCalendarEvent({
        title,
        startAt,
        endAt,
        type: eventType,
        attendeeIds: selectedAttendees,
        notes: eventNotes,
      })

      if (result.success) {
        toast.success('Evento creado correctamente')
        setShowEventForm(false)
        setTitle('')
        setStartAt('')
        setEndAt('')
        setSelectedAttendees([])
        setEventNotes('')
      } else {
        toast.error(result.error ?? 'Error al crear el evento')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jugadores activos</p>
            <p className="text-xl font-bold">{activePlayers}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pagos pendientes</p>
            <p className="text-xl font-bold text-red-600">{pendingPayments}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
            <Heart className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Lesionados</p>
            <p className="text-xl font-bold text-orange-600">{activeInjuries}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Informes scouting</p>
            <p className="text-xl font-bold">{scoutingCount}</p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-lg">Próximos eventos (30 días)</h3>
          </div>
          <button
            onClick={() => setShowEventForm((v) => !v)}
            className="btn-primary gap-2 flex items-center text-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo evento
          </button>
        </div>

        {showEventForm && (
          <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Nuevo evento</p>
              <button onClick={() => setShowEventForm(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="label">Título *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Nombre del evento..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label">Inicio *</label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="label">Fin *</label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="label">Tipo</label>
              <select
                className="input w-full"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Asistentes</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAttendee(m.id)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      selectedAttendees.includes(m.id)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    {m.full_name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="label">Notas</label>
              <textarea
                className="input w-full resize-none"
                rows={2}
                placeholder="Observaciones..."
                value={eventNotes}
                onChange={(e) => setEventNotes(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                disabled={isPending || !title || !startAt || !endAt}
                onClick={handleCreateEvent}
                className="btn-primary text-sm"
              >
                {isPending ? 'Creando...' : 'Crear evento'}
              </button>
              <button onClick={() => setShowEventForm(false)} className="btn-ghost text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {events.length === 0 && !showEventForm && (
          <div className="py-8 text-center text-muted-foreground">
            No hay eventos en los próximos 30 días
          </div>
        )}

        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/20 transition-colors">
              <div className={`text-xs font-medium px-2 py-1 rounded-md shrink-0 ${EVENT_TYPE_COLORS[event.event_type] ?? 'bg-gray-100 text-gray-700'}`}>
                {EVENT_TYPES.find((t) => t.value === event.event_type)?.label ?? event.event_type}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{event.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(event.start_at)} — {formatDateTime(event.end_at)}</p>
                {event.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.notes}</p>}
              </div>
              {event.attendee_ids && event.attendee_ids.length > 0 && (
                <span className="badge badge-muted text-xs shrink-0">{event.attendee_ids.length} asistentes</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scouting reports table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold">Últimos informes de scouting</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo rival</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dorsal</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Posición</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Comentario</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reportado por</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {scoutingReports.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{r.rival_team}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.dorsal ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.position ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs">
                    <span className="line-clamp-2">{r.comment ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{r.reporter?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                </tr>
              ))}
              {scoutingReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No hay informes de scouting
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
