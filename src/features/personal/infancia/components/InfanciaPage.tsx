'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Users, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/currency'
import { proposeMeeting } from '@/features/personal/actions/personal.actions'

interface Incident {
  id: string
  severity: string
  incident_type: string | null
  description: string | null
  created_at: string
  teams: { id: string; name: string } | null
}

interface Meeting {
  id: string
  subject: string
  description: string | null
  status: string
  proposed_dates: string[] | null
  created_at: string
  proposer: { full_name: string } | null
  target: { full_name: string } | null
}

interface Coordinator {
  id: string
  full_name: string
}

interface Props {
  incidents: Incident[]
  meetings: Meeting[]
  coordinators: Coordinator[]
}

const SEVERITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-orange-400',
  low: 'bg-blue-400',
}

const SEVERITY_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

const MEETING_STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning',
  accepted: 'badge-success',
  rejected: 'badge-destructive',
  done: 'badge-muted',
}

const MEETING_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  done: 'Realizada',
}

export function InfanciaPage({ incidents, meetings, coordinators }: Props) {
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [targetMemberId, setTargetMemberId] = useState('')
  const [description, setDescription] = useState('')
  const [isPending, startTransition] = useTransition()

  function openMeetingForm(incidentId?: string) {
    setShowMeetingForm(true)
    setSelectedIncidentId(incidentId ?? null)
    setSubject('')
    setTargetMemberId(coordinators[0]?.id ?? '')
    setDescription('')
  }

  function handlePropose() {
    if (!subject || !targetMemberId) return

    startTransition(async () => {
      const result = await proposeMeeting({
        subject,
        targetMemberId,
        description,
        proposedDates: [],
      })

      if (result.success) {
        toast.success('Reunión propuesta correctamente')
        setShowMeetingForm(false)
      } else {
        toast.error(result.error ?? 'Error al proponer la reunión')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Incidents section */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-lg">Incidencias reportadas</h3>
            <span className="badge badge-destructive">{incidents.length}</span>
          </div>
          <button
            onClick={() => openMeetingForm()}
            className="btn-secondary gap-2 flex items-center text-sm"
          >
            <Plus className="w-4 h-4" />
            Proponer reunión
          </button>
        </div>

        {/* Meeting proposal form */}
        {showMeetingForm && (
          <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Nueva propuesta de reunión</p>
              <button onClick={() => setShowMeetingForm(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-1">
              <label className="label">Asunto *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Asunto de la reunión..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="label">Coordinador / Destinatario *</label>
              <select
                className="input w-full"
                value={targetMemberId}
                onChange={(e) => setTargetMemberId(e.target.value)}
              >
                <option value="">Seleccionar miembro...</option>
                {coordinators.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="label">Descripción</label>
              <textarea
                className="input w-full resize-none"
                rows={3}
                placeholder="Descripción del motivo de la reunión..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                disabled={isPending || !subject || !targetMemberId}
                onClick={handlePropose}
                className="btn-primary text-sm"
              >
                {isPending ? 'Proponiendo...' : 'Proponer'}
              </button>
              <button onClick={() => setShowMeetingForm(false)} className="btn-ghost text-sm">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {incidents.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No hay incidencias pendientes de resolver
          </div>
        )}

        <div className="space-y-0">
          {incidents.map((incident, i) => (
            <div key={incident.id} className="flex gap-4 pb-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={cn('w-3 h-3 rounded-full mt-1 shrink-0', SEVERITY_DOT[incident.severity] ?? 'bg-gray-400')} />
                {i < incidents.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              {/* Content */}
              <div className="flex-1 pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {incident.incident_type ?? 'Incidencia'}
                      {incident.teams && (
                        <span className="ml-2 text-muted-foreground font-normal">— {incident.teams.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(incident.created_at)}</p>
                  </div>
                  <span className={cn('badge shrink-0', incident.severity === 'high' ? 'badge-destructive' : incident.severity === 'medium' ? 'badge-warning' : 'badge-muted')}>
                    {SEVERITY_LABELS[incident.severity] ?? incident.severity}
                  </span>
                </div>
                {incident.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{incident.description}</p>
                )}
                <button
                  onClick={() => openMeetingForm(incident.id)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Proponer reunión sobre esta incidencia
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Meetings section */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-lg">Reuniones propuestas</h3>
          <span className="badge badge-primary">{meetings.length}</span>
        </div>

        {meetings.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            No hay reuniones propuestas
          </div>
        )}

        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{meeting.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Propuesto por <strong>{meeting.proposer?.full_name ?? '—'}</strong>
                    {meeting.target && <> · Para <strong>{meeting.target.full_name}</strong></>}
                  </p>
                  {meeting.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{meeting.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(meeting.created_at)}</p>
                </div>
                <span className={cn('badge shrink-0', MEETING_STATUS_COLORS[meeting.status] ?? 'badge-muted')}>
                  {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
