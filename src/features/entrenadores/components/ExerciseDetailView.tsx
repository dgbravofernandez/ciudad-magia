'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Clock,
  Users,
  Package,
  Tag,
  User,
  Calendar,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  updateExercise,
  deleteExercise,
} from '@/features/entrenadores/actions/session.actions'

const TacticalBoard = dynamic(
  () => import('./TacticalBoard').then((m) => m.TacticalBoard),
  { ssr: false, loading: () => <div className="h-64 bg-green-800 rounded-lg animate-pulse" /> }
)

interface ExerciseCategory {
  id: string
  name: string
  color: string
  sort_order: number
}

interface Exercise {
  id: string
  title: string
  description: string | null
  category_id: string | null
  subcategory: string | null
  duration_min: number | null
  players_min: number | null
  players_max: number | null
  material: string | null
  objective_tags: string[]
  canvas_image_url: string | null
  canvas_data: unknown | null
  author_id: string | null
  is_public: boolean
  created_at: string
  club_members: { id: string; full_name: string } | null
  exercise_categories: { id: string; name: string; color: string } | null
}

interface ExerciseDetailViewProps {
  exercise: Exercise
  categories: ExerciseCategory[]
  canEdit: boolean
}

export function ExerciseDetailView({
  exercise,
  categories,
  canEdit,
}: ExerciseDetailViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [canvasImageUrl, setCanvasImageUrl] = useState(exercise.canvas_image_url ?? '')

  function handleDelete() {
    if (!confirm('Eliminar este ejercicio permanentemente?')) return
    startTransition(async () => {
      const result = await deleteExercise(exercise.id)
      if (result.success) {
        toast.success('Ejercicio eliminado')
        router.push('/entrenadores/ejercicios')
      } else {
        toast.error(result.error ?? 'Error al eliminar')
      }
    })
  }

  function handleExport(dataUrl: string) {
    setCanvasImageUrl(dataUrl)
    toast.success('Imagen del tablero actualizada')
  }

  function handleSubmitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    if (canvasImageUrl) {
      formData.set('canvas_image_url', canvasImageUrl)
    }
    startTransition(async () => {
      const result = await updateExercise(exercise.id, formData)
      if (result.success) {
        toast.success('Ejercicio actualizado')
        setIsEditing(false)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Error al actualizar')
      }
    })
  }

  const createdDate = new Date(exercise.created_at).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // ---------- EDIT MODE ----------
  if (isEditing) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="p-2 rounded-lg hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold">Editar ejercicio</h2>
        </div>

        <form onSubmit={handleSubmitEdit} className="space-y-6">
          <div className="card p-6 space-y-5">
            {/* Title */}
            <div className="space-y-1">
              <label className="label" htmlFor="title">Titulo *</label>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={exercise.title}
                className="input w-full"
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="label" htmlFor="category_id">Categoria</label>
              <select
                id="category_id"
                name="category_id"
                className="input w-full"
                defaultValue={exercise.category_id ?? ''}
              >
                <option value="">Sin categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Subcategory */}
            <div className="space-y-1">
              <label className="label" htmlFor="subcategory">Subcategoria</label>
              <input
                id="subcategory"
                name="subcategory"
                type="text"
                defaultValue={exercise.subcategory ?? ''}
                placeholder="Ej: Salida de balon, Rondo 4v2..."
                className="input w-full"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="label" htmlFor="description">Descripcion</label>
              <textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={exercise.description ?? ''}
                placeholder="Describe el ejercicio, objetivos, variantes..."
                className="input w-full resize-none"
              />
            </div>

            {/* Duration + players */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="label" htmlFor="duration_min">Duracion (min)</label>
                <input
                  id="duration_min"
                  name="duration_min"
                  type="number"
                  min="0"
                  defaultValue={exercise.duration_min ?? ''}
                  className="input w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="label" htmlFor="players_min">Jugadores min.</label>
                <input
                  id="players_min"
                  name="players_min"
                  type="number"
                  min="0"
                  defaultValue={exercise.players_min ?? ''}
                  className="input w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="label" htmlFor="players_max">Jugadores max.</label>
                <input
                  id="players_max"
                  name="players_max"
                  type="number"
                  min="0"
                  defaultValue={exercise.players_max ?? ''}
                  className="input w-full"
                />
              </div>
            </div>

            {/* Material */}
            <div className="space-y-1">
              <label className="label" htmlFor="material">Material necesario</label>
              <input
                id="material"
                name="material"
                type="text"
                defaultValue={exercise.material ?? ''}
                placeholder="Ej: 8 conos, 4 petos, 2 porterias..."
                className="input w-full"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <label className="label" htmlFor="objective_tags">Etiquetas / objetivos</label>
              <input
                id="objective_tags"
                name="objective_tags"
                type="text"
                defaultValue={exercise.objective_tags.join(', ')}
                placeholder="presion, posesion, transicion..."
                className="input w-full"
              />
            </div>

            {/* Visibility */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_public"
                name="is_public"
                value="true"
                defaultChecked={exercise.is_public}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="is_public" className="text-sm">
                Compartir con todos los entrenadores del club
              </label>
            </div>
          </div>

          {/* Tactical Board */}
          <div className="card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Tablero tactico</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Modifica el dibujo del ejercicio. Pulsa &ldquo;Exportar imagen&rdquo; para guardarlo.
                </p>
              </div>
              {canvasImageUrl && (
                <span className="badge badge-success text-xs">Imagen guardada</span>
              )}
            </div>

            <TacticalBoard onExport={handleExport} />

            {canvasImageUrl && (
              <input type="hidden" name="canvas_image_url" value={canvasImageUrl} />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary flex-1"
            >
              {isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-ghost"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ---------- VIEW MODE ----------
  return (
    <div className="max-w-4xl space-y-6">
      {/* Back + actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.push('/entrenadores/ejercicios')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al repositorio
        </button>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="btn-ghost text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: image + details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Canvas image */}
          <div className="card overflow-hidden">
            <div className="aspect-video bg-green-800 relative">
              {exercise.canvas_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={exercise.canvas_image_url}
                  alt={exercise.title}
                  className="w-full h-full object-contain bg-green-900"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-white/50 text-sm">
                  Sin imagen del tablero tactico
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {exercise.description && (
            <div className="card p-6 space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Descripcion
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {exercise.description}
              </p>
            </div>
          )}
        </div>

        {/* Right column: metadata */}
        <div className="space-y-4">
          {/* Title card */}
          <div className="card p-5 space-y-4">
            <h1 className="text-xl font-bold">{exercise.title}</h1>

            {/* Category badge */}
            {exercise.exercise_categories && (
              <div>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${exercise.exercise_categories.color}20`,
                    color: exercise.exercise_categories.color,
                    border: `1px solid ${exercise.exercise_categories.color}40`,
                  }}
                >
                  {exercise.exercise_categories.name}
                </span>
              </div>
            )}

            {exercise.subcategory && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="w-4 h-4 shrink-0" />
                <span>{exercise.subcategory}</span>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Detalles
            </h3>

            {exercise.duration_min != null && (
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{exercise.duration_min} minutos</span>
              </div>
            )}

            {(exercise.players_min != null || exercise.players_max != null) && (
              <div className="flex items-center gap-3 text-sm">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>
                  {exercise.players_min ?? '?'}
                  {exercise.players_max && exercise.players_max !== exercise.players_min
                    ? ` - ${exercise.players_max}`
                    : ''}{' '}
                  jugadores
                </span>
              </div>
            )}

            {exercise.material && (
              <div className="flex items-center gap-3 text-sm">
                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{exercise.material}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{exercise.club_members?.full_name ?? 'Desconocido'}</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{createdDate}</span>
            </div>

            {exercise.is_public && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 mt-2">
                Compartido con todo el club
              </div>
            )}
          </div>

          {/* Objective tags */}
          {exercise.objective_tags.length > 0 && (
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
                Etiquetas / Objetivos
              </h3>
              <div className="flex flex-wrap gap-2">
                {exercise.objective_tags.map((tag) => (
                  <span key={tag} className="badge badge-muted text-xs px-2.5 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
