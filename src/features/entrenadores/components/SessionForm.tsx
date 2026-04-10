'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createSession(formData)
      if (result.success) {
        toast.success('Sesión creada correctamente')
        if (sessionType === 'match') {
          router.push(`/entrenadores/partidos/${result.sessionId}`)
        } else {
          router.push(`/entrenadores/sesiones/${result.sessionId}`)
        }
      } else {
        toast.error(result.error ?? 'Error al crear la sesión')
      }
    })
  }

  const now = new Date()
  const defaultDate = now.toISOString().slice(0, 16)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 space-y-5">
        <h2 className="text-base font-semibold">Nueva sesión</h2>

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
              placeholder="Nombre del equipo (ej: Alevín A)"
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
          <label className="label">Tipo de sesión *</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { value: 'training', label: '🏃 Entrenamiento' },
              { value: 'match', label: '⚽ Partido' },
              { value: 'futsal', label: '🏟️ Fútbol sala' },
              { value: 'friendly', label: '🤝 Amistoso' },
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

        <div className="space-y-1">
          <label className="label" htmlFor="session_date">Fecha y hora *</label>
          <input
            id="session_date"
            name="session_date"
            type="datetime-local"
            required
            defaultValue={defaultDate}
            className="input w-full"
          />
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

        <div className="space-y-1">
          <label className="label" htmlFor="notes">Notas previas</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Objetivos de la sesión, observaciones previas..."
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
          {isPending ? 'Creando...' : sessionType === 'match' ? 'Iniciar partido' : 'Crear sesión'}
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
