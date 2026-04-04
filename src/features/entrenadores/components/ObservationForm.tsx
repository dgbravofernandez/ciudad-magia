'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createObservation } from '@/features/entrenadores/actions/session.actions'

interface ObservationTeam {
  id: string
  name: string
}

interface ObservationFormProps {
  teams: ObservationTeam[]
  onSuccess?: () => void
}

function StarInput({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="label">{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5 transition-transform hover:scale-110"
            aria-label={`${n} estrella${n !== 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                'w-6 h-6 transition-colors',
                n <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground hover:text-yellow-300'
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

export function ObservationForm({ teams, onSuccess }: ObservationFormProps) {
  const [isPending, startTransition] = useTransition()
  const [nivelRating, setNivelRating] = useState(3)
  const [ajenoRating, setAjenoRating] = useState(3)
  const [coachRating, setCoachRating] = useState(3)

  const today = new Date().toISOString().split('T')[0]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createObservation(formData)
      if (result.success) {
        toast.success('Observación guardada correctamente')
        onSuccess?.()
      } else {
        toast.error((result as any).error ?? 'Error al guardar la observación')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Team */}
      <div className="space-y-1">
        <label className="label" htmlFor="obs-team">Equipo *</label>
        <select
          id="obs-team"
          name="team_id"
          required
          className="input w-full"
          defaultValue=""
        >
          <option value="">Seleccionar equipo</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label className="label" htmlFor="obs-date">Fecha *</label>
        <input
          id="obs-date"
          name="observation_date"
          type="date"
          required
          defaultValue={today}
          className="input w-full"
        />
      </div>

      {/* Nivel rating */}
      <StarInput
        label="Nivel del equipo"
        name="nivel_rating"
        value={nivelRating}
        onChange={setNivelRating}
      />

      {/* Ajeno rating */}
      <StarInput
        label="Factor ajeno (árbitro, campo, etc.)"
        name="ajeno_rating"
        value={ajenoRating}
        onChange={setAjenoRating}
      />

      {/* Comment */}
      <div className="space-y-1">
        <label className="label" htmlFor="obs-comment">Comentario general</label>
        <textarea
          id="obs-comment"
          name="comment"
          rows={3}
          placeholder="Observaciones generales del equipo..."
          className="input w-full resize-none"
        />
      </div>

      {/* Divider: Private coach eval */}
      <div className="border-t pt-4 space-y-4">
        <div>
          <p className="font-medium text-sm">Evaluación del entrenador (privado)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Solo visible para Dirección y Director Deportivo
          </p>
        </div>

        <StarInput
          label="Valoración del entrenador"
          name="coach_rating"
          value={coachRating}
          onChange={setCoachRating}
        />

        <div className="space-y-1">
          <label className="label" htmlFor="obs-coach-comment">Comentario sobre el entrenador</label>
          <textarea
            id="obs-coach-comment"
            name="coach_comment"
            rows={3}
            placeholder="Observaciones privadas sobre el desempeño del entrenador..."
            className="input w-full resize-none"
          />
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="btn-primary w-full"
      >
        {isPending ? 'Guardando...' : 'Guardar observación'}
      </button>
    </form>
  )
}
