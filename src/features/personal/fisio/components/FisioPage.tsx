'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Calendar, Clock, CheckCircle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDate, formatDateTime } from '@/lib/utils/currency'
import { scheduleAppointment, confirmAppointment } from '@/features/personal/actions/personal.actions'

interface InjuryWithPlayer {
  id: string
  player_id: string
  injury_type: string | null
  description: string | null
  injured_at: string
  status: string
  players: {
    id: string
    first_name: string
    last_name: string
    photo_url: string | null
    teams: { id: string; name: string } | null
  } | null
}

interface AppointmentWithPlayer {
  id: string
  player_id: string
  injury_id: string | null
  scheduled_at: string
  notes: string | null
  status: string
  coach_confirmed: boolean
  players: { id: string; first_name: string; last_name: string } | null
}

interface Props {
  injuries: InjuryWithPlayer[]
  appointments: AppointmentWithPlayer[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning',
  confirmed: 'badge-success',
  completed: 'badge-muted',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function FisioPage({ injuries, appointments }: Props) {
  const [schedulingFor, setSchedulingFor] = useState<string | null>(null)
  const [schedulingInjuryId, setSchedulingInjuryId] = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [appointmentNotes, setAppointmentNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  function openScheduleForm(playerId: string, injuryId: string) {
    setSchedulingFor(playerId)
    setSchedulingInjuryId(injuryId)
    setScheduledAt('')
    setAppointmentNotes('')
  }

  function closeScheduleForm() {
    setSchedulingFor(null)
    setSchedulingInjuryId(null)
  }

  function handleSchedule() {
    if (!schedulingFor || !schedulingInjuryId || !scheduledAt) return

    startTransition(async () => {
      const result = await scheduleAppointment({
        playerId: schedulingFor,
        injuryId: schedulingInjuryId,
        scheduledAt,
        notes: appointmentNotes,
      })

      if (result.success) {
        toast.success('Cita programada correctamente')
        closeScheduleForm()
      } else {
        toast.error(result.error ?? 'Error al programar la cita')
      }
    })
  }

  function handleConfirm(appointmentId: string) {
    startTransition(async () => {
      const result = await confirmAppointment(appointmentId)
      if (result.success) {
        toast.success('Cita confirmada')
      } else {
        toast.error(result.error ?? 'Error al confirmar la cita')
      }
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Injured players */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-lg">Jugadores lesionados</h3>
          <span className="badge badge-warning">{injuries.length}</span>
        </div>

        {injuries.length === 0 && (
          <div className="card p-8 text-center text-muted-foreground">
            No hay jugadores lesionados activos
          </div>
        )}

        {injuries.map((injury) => {
          const player = injury.players
          if (!player) return null
          const days = daysSince(injury.injured_at)
          const isScheduling = schedulingFor === player.id && schedulingInjuryId === injury.id

          return (
            <div key={injury.id} className="card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm shrink-0">
                  {player.first_name.charAt(0)}{player.last_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{player.first_name} {player.last_name}</p>
                  <p className="text-sm text-muted-foreground">{player.teams?.name ?? 'Sin equipo'}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {injury.injury_type && (
                      <span className="badge badge-warning">{injury.injury_type}</span>
                    )}
                    <span className="badge badge-muted">
                      {days === 0 ? 'Hoy' : `Hace ${days} día${days !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {injury.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{injury.description}</p>
                  )}
                </div>
              </div>

              {!isScheduling && (
                <button
                  onClick={() => openScheduleForm(player.id, injury.id)}
                  className="btn-secondary text-sm w-full gap-2 flex items-center justify-center"
                >
                  <Calendar className="w-4 h-4" />
                  Programar cita
                </button>
              )}

              {isScheduling && (
                <div className="border-t pt-3 space-y-3">
                  <p className="text-sm font-medium">Nueva cita</p>
                  <div className="space-y-1">
                    <label className="label">Fecha y hora *</label>
                    <input
                      type="datetime-local"
                      className="input w-full"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="label">Notas</label>
                    <textarea
                      className="input w-full resize-none"
                      rows={2}
                      placeholder="Observaciones..."
                      value={appointmentNotes}
                      onChange={(e) => setAppointmentNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={isPending || !scheduledAt}
                      onClick={handleSchedule}
                      className="btn-primary text-sm flex-1"
                    >
                      {isPending ? 'Guardando...' : 'Guardar cita'}
                    </button>
                    <button onClick={closeScheduleForm} className="btn-ghost text-sm">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right: Scheduled appointments */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-lg">Citas programadas</h3>
          <span className="badge badge-primary">{appointments.length}</span>
        </div>

        {appointments.length === 0 && (
          <div className="card p-8 text-center text-muted-foreground">
            No hay citas programadas
          </div>
        )}

        {appointments.map((appt) => (
          <div key={appt.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {appt.players?.first_name} {appt.players?.last_name}
                </p>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateTime(appt.scheduled_at)}
                </div>
                {appt.notes && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{appt.notes}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={cn('badge', STATUS_COLORS[appt.status] ?? 'badge-muted')}>
                  {STATUS_LABELS[appt.status] ?? appt.status}
                </span>
                {!appt.coach_confirmed && appt.status === 'pending' && (
                  <button
                    disabled={isPending}
                    onClick={() => handleConfirm(appt.id)}
                    className="btn-ghost text-xs gap-1 flex items-center"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Confirmar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
