'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import { formatDate } from '@/lib/utils/currency'
import { Plus, Star, X, Trash2, Pencil, Check } from 'lucide-react'
import { ObservationForm } from './ObservationForm'
import { deleteObservation, updateObservationComment } from '../actions/session.actions'

interface Observation {
  id: string
  observer_id: string | null
  team_id: string
  observation_date: string
  nivel_rating: number | null
  ajeno_rating: number | null
  comment: string | null
  coach_rating: number | null
  coach_comment: string | null
  club_members: { full_name: string } | null
  teams: { name: string } | null
}

interface ObservationTeam {
  id: string
  name: string
}

interface ObservationsPageProps {
  observations: Observation[]
  teams: ObservationTeam[]
}

function StarRating({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value == null) return <span className="text-muted-foreground text-sm">—</span>
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            'w-3.5 h-3.5',
            i < value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          )}
        />
      ))}
    </div>
  )
}

export function ObservationsPage({ observations, teams }: ObservationsPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editComment, setEditComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = (id: string) => {
    if (!confirm('¿Eliminar esta observación? No se puede deshacer.')) return
    startTransition(async () => {
      const res = await deleteObservation(id)
      if (res.success) {
        toast.success('Observación eliminada')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  const handleSaveEdit = (id: string) => {
    startTransition(async () => {
      const res = await updateObservationComment(id, editComment)
      if (res.success) {
        toast.success('Observación actualizada')
        setEditingId(null)
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Observaciones de Coordinador</h2>
          <p className="text-sm text-muted-foreground">{observations.length} observaciones</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva observación
        </button>
      </div>

      {/* Observations list */}
      {observations.length === 0 ? (
        <div className="card p-12 text-center text-muted-foreground">
          No hay observaciones registradas
        </div>
      ) : (
        <div className="space-y-3">
          {observations.map((obs) => (
            <div key={obs.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {obs.teams?.name ?? 'Equipo desconocido'}
                    </span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(obs.observation_date)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Por {obs.club_members?.full_name ?? 'Desconocido'}
                  </p>
                </div>
                <div className="flex gap-4 shrink-0 items-start">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Nivel</p>
                    <StarRating value={obs.nivel_rating} />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Ajeno</p>
                    <StarRating value={obs.ajeno_rating} />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingId(obs.id)
                        setEditComment(obs.comment ?? '')
                      }}
                      disabled={isPending}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                      title="Editar comentario"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(obs.id)}
                      disabled={isPending}
                      className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {editingId === obs.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    rows={3}
                    className="input w-full text-sm"
                    placeholder="Comentario..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(obs.id)}
                      disabled={isPending}
                      className="btn-primary text-xs flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Guardar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-secondary text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                obs.comment && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{obs.comment}</p>
                )
              )}

              {obs.coach_rating != null && (
                <div className="border-t pt-2 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground italic">
                    Evaluación entrenador (privado):
                  </span>
                  <StarRating value={obs.coach_rating} />
                  {obs.coach_comment && (
                    <span className="text-xs text-muted-foreground line-clamp-1 flex-1">
                      {obs.coach_comment}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Overlay modal for new observation */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Nueva Observación</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <ObservationForm
                teams={teams}
                onSuccess={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
