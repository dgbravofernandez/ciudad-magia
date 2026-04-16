'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { createSession } from '@/features/entrenadores/actions/session.actions'

interface Team {
  id: string
  name: string
  season: string
}

interface SessionFormProps {
  teams: Team[]
  defaultTeamId?: string
}

export function SessionForm({ teams, defaultTeamId }: SessionFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sessionType, setSessionType] = useState<string>('training')
  const [manualTeam, setManualTeam] = useState(teams.length === 0)
  const [objectives, setObjectives] = useState<string[]>([])
  const [newObjective, setNewObjective] = useState('')

  function addObjective() {
    const val = newObjective.trim()
    if (!val) return
    if (objectives.includes(val)) return
    setObjectives((prev) => [...prev, val])
    setNewObjective('')
  }

  function removeObjective(idx: number) {
    setObjectives((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('objectives', objectives.join(','))

    startTransition(async () => {
      const result = await createSession(formData)
      if (result.success) {
        toast.success('Sesion creada correctamente')
        if (sessionType === 'match') {
          router.push(`/entrenadores/partidos/${result.sessionId}`)
        } else {
          router.push(`/entrenadores/sesiones/${result.sessionId}`)
        }
      } else {
        toast.error(result.error ?? 'Error al crear la sesion')
      }
    })
  }

  const now = new Date()
  const defaultDate = now.toISOString().slice(0, 16)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 space-y-5">
        <h2 className="text-base font-semibold">Nueva sesion</h2>

        <div className="space-y-1">
          <div className="flex items-center justify-between mb-1">
            <label className="label" htmlFor="team_id">Equipo *</label>
            {teams.length > 0 && (
              <button
                type="button"
                onClick={() => setManualTeam(p => !p)}
                className="text-xs text-primary hover:underline"
              >
                {manualTeam ? 'Seleccionar de lista' : 'Introducir manualmente'}
              </button>
            )}
          </div>
          {manualTeam ? (
            <input
              id="team_id"
              name="team_id"
              className="input w-full"
              placeholder="Nombre del equipo (ej: Alevin A)"
              required
            />
          ) : (
            <select
              id="team_id"
              name="team_id"
              required
              defaultValue={defaultTeamId ?? ''}
              className="input w-full"
            >
              <option value="">Seleccionar equipo</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {teams.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">No hay equipos asignados — escribe el nombre del equipo manualmente.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="label">Tipo de sesion *</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { value: 'training', label: 'Entrenamiento' },
              { value: 'match', label: 'Partido' },
              { value: 'futsal', label: 'Futbol sala' },
              { value: 'friendly', label: 'Amistoso' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center justify-center p-3 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${
                  sessionType === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="session_type"
                  value={opt.value}
                  checked={sessionType === opt.value}
                  onChange={() => setSessionType(opt.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Date and time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="label" htmlFor="session_date">Fecha y hora inicio *</label>
            <input
              id="session_date"
              name="session_date"
              type="datetime-local"
              required
              defaultValue={defaultDate}
              className="input w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="label" htmlFor="end_time">Hora fin</label>
            <input
              id="end_time"
              name="end_time"
              type="time"
              className="input w-full"
            />
          </div>
        </div>

        {(sessionType === 'match' || sessionType === 'friendly') && (
          <div className="space-y-1">
            <label className="label" htmlFor="opponent">Equipo rival</label>
            <input
              id="opponent"
              name="opponent"
              type="text"
              placeholder="Nombre del equipo rival"
              className="input w-full"
            />
          </div>
        )}

        {/* Objectives */}
        <div className="space-y-2">
          <label className="label">Objetivos de la sesion</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addObjective()
                }
              }}
              placeholder="Ej: Mejorar salida de balon, Presion alta..."
              className="input flex-1"
            />
            <button
              type="button"
              onClick={addObjective}
              className="btn-secondary px-3"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {objectives.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {objectives.map((obj, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm rounded-full px-3 py-1"
                >
                  {obj}
                  <button
                    type="button"
                    onClick={() => removeObjective(i)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="label" htmlFor="notes">Notas previas</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Observaciones previas, indicaciones especiales..."
            className="input w-full resize-none"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary flex-1"
        >
          {isPending ? 'Creando...' : sessionType === 'match' ? 'Iniciar partido' : 'Crear sesion'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-ghost"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
