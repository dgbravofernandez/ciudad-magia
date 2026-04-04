'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { saveScoutingReport } from '@/features/entrenadores/actions/session.actions'

const POSITIONS = [
  'Portero',
  'Defensa Central',
  'Lateral Derecho',
  'Lateral Izquierdo',
  'Centrocampista Defensivo',
  'Centrocampista',
  'Mediapunta',
  'Extremo Derecho',
  'Extremo Izquierdo',
  'Delantero Centro',
]

interface ScoutingModalProps {
  sessionId: string
  rivalTeam: string
  onClose: () => void
}

export function ScoutingModal({ sessionId, rivalTeam, onClose }: ScoutingModalProps) {
  const [step, setStep] = useState<'ask' | 'form'>('ask')
  const [isPending, startTransition] = useTransition()
  const [dorsal, setDorsal] = useState('')
  const [position, setPosition] = useState('')
  const [comment, setComment] = useState('')

  function handleYes() {
    setStep('form')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await saveScoutingReport(sessionId, {
        rival_team: rivalTeam,
        dorsal,
        position,
        comment,
      })
      if (result.success) {
        toast.success('Informe de scouting guardado')
        onClose()
      } else {
        toast.error(result.error ?? 'Error al guardar el informe')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Informe de Scouting</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'ask' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Has visto algún jugador interesante del equipo rival
              {rivalTeam ? ` (${rivalTeam})` : ''}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleYes}
                className="btn-primary flex-1"
              >
                Sí, añadir informe
              </button>
              <button
                onClick={onClose}
                className="btn-secondary flex-1"
              >
                No, continuar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="label">Equipo rival</label>
              <input
                type="text"
                value={rivalTeam}
                readOnly
                className="input w-full bg-muted/50 cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label" htmlFor="dorsal">Dorsal</label>
                <input
                  id="dorsal"
                  type="text"
                  placeholder="Ej: 10"
                  value={dorsal}
                  onChange={(e) => setDorsal(e.target.value)}
                  className="input w-full"
                  maxLength={3}
                />
              </div>
              <div className="space-y-1">
                <label className="label" htmlFor="position">Posición</label>
                <select
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="input w-full"
                >
                  <option value="">Seleccionar</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="label" htmlFor="comment">Comentario</label>
              <textarea
                id="comment"
                placeholder="Describe las cualidades del jugador, por qué es interesante..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="input w-full resize-none"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending || !comment.trim()}
                className="btn-primary flex-1"
              >
                {isPending ? 'Guardando...' : 'Guardar informe'}
              </button>
              <button
                type="button"
                onClick={() => setStep('ask')}
                className="btn-ghost"
              >
                Volver
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
