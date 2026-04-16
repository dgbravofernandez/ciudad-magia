'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Check, X, Download } from 'lucide-react'
import { updateSessionPlanning } from '@/features/entrenadores/actions/session.actions'

interface Props {
  sessionId: string
  microcycle: string | null
  macrocycle: string | null
  sessionNumber: number | null
}

export function SessionPlanningHeader({
  sessionId,
  microcycle: microcycleProp,
  macrocycle: macrocycleProp,
  sessionNumber: sessionNumberProp,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [microcycle, setMicrocycle] = useState(microcycleProp ?? '')
  const [macrocycle, setMacrocycle] = useState(macrocycleProp ?? '')
  const [sessionNumber, setSessionNumber] = useState<string>(
    sessionNumberProp != null ? String(sessionNumberProp) : '',
  )

  function handleSave() {
    startTransition(async () => {
      const numeric = sessionNumber.trim() === '' ? null : Number(sessionNumber)
      const result = await updateSessionPlanning(sessionId, {
        microcycle,
        macrocycle,
        session_number: numeric,
      })
      if (result.success) {
        toast.success('Planificacion actualizada')
        setEditing(false)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toast.error((result as any).error ?? 'Error al guardar')
      }
    })
  }

  function handleCancel() {
    setMicrocycle(microcycleProp ?? '')
    setMacrocycle(macrocycleProp ?? '')
    setSessionNumber(sessionNumberProp != null ? String(sessionNumberProp) : '')
    setEditing(false)
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Planificacion</h3>
        <div className="flex gap-2">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-ghost text-xs flex items-center gap-1"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
          )}
          <a
            href={`/api/sessions/${sessionId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar PDF
          </a>
        </div>
      </div>

      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Macrociclo</p>
            <p className="font-medium">{macrocycleProp || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Microciclo</p>
            <p className="font-medium">{microcycleProp || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nº de sesion</p>
            <p className="font-medium">{sessionNumberProp != null ? sessionNumberProp : '—'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="macrocycle" className="label">Macrociclo</label>
              <input
                id="macrocycle"
                type="text"
                value={macrocycle}
                onChange={(e) => setMacrocycle(e.target.value)}
                placeholder="Ej: Pretemporada"
                className="input w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="microcycle" className="label">Microciclo</label>
              <input
                id="microcycle"
                type="text"
                value={microcycle}
                onChange={(e) => setMicrocycle(e.target.value)}
                placeholder="Ej: Semana 3"
                className="input w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="session_number" className="label">Nº de sesion</label>
              <input
                id="session_number"
                type="number"
                min="0"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
                placeholder="12"
                className="input w-full"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              {isPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="btn-ghost text-xs flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
