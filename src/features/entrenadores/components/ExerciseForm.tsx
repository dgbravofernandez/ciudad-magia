'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { createExercise } from '@/features/entrenadores/actions/session.actions'

// Dynamically import TacticalBoard to avoid SSR issues with Konva
const TacticalBoard = dynamic(
  () => import('./TacticalBoard').then((m) => m.TacticalBoard),
  { ssr: false, loading: () => <div className="h-64 bg-green-800 rounded-lg animate-pulse" /> }
)

interface ExerciseCategory {
  id: string
  name: string
  color: string
}

interface ExerciseFormProps {
  categories: ExerciseCategory[]
}

export function ExerciseForm({ categories }: ExerciseFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [canvasImageUrl, setCanvasImageUrl] = useState<string>('')
  const formRef = useRef<HTMLFormElement>(null)

  function handleExport(dataUrl: string) {
    setCanvasImageUrl(dataUrl)
    toast.success('Imagen del tablero exportada')
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    // Attach canvas image if available
    if (canvasImageUrl) {
      formData.set('canvas_image_url', canvasImageUrl)
    }

    startTransition(async () => {
      const result = await createExercise(formData)
      if (result.success) {
        toast.success('Ejercicio guardado correctamente')
        router.push(`/entrenadores/ejercicios`)
      } else {
        toast.error((result as any).error ?? 'Error al guardar el ejercicio')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div className="card p-6 space-y-5">
        <h2 className="text-base font-semibold">Nuevo ejercicio</h2>

        {/* Title */}
        <div className="space-y-1">
          <label className="label" htmlFor="title">Título *</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            placeholder="Nombre del ejercicio"
            className="input w-full"
          />
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className="label" htmlFor="category_id">Categoría</label>
          <div className="flex gap-2">
            <select
              id="category_id"
              name="category_id"
              className="input flex-1"
              defaultValue=""
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {/* Category color dots */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: c.color }}
                  />
                  {c.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subcategory (free text) */}
        <div className="space-y-1">
          <label className="label" htmlFor="subcategory">
            Subcategoría
            <span className="text-muted-foreground font-normal ml-1">(texto libre)</span>
          </label>
          <input
            id="subcategory"
            name="subcategory"
            type="text"
            placeholder="Ej: Salida de balón, Rondo 4v2, Finalización 1v1..."
            className="input w-full"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="label" htmlFor="description">Descripción</label>
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Describe el ejercicio, objetivos, variantes..."
            className="input w-full resize-none"
          />
        </div>

        {/* Duration + players grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="label" htmlFor="duration_min">Duración (min)</label>
            <input
              id="duration_min"
              name="duration_min"
              type="number"
              min="0"
              placeholder="15"
              className="input w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="label" htmlFor="players_min">Jugadores mín.</label>
            <input
              id="players_min"
              name="players_min"
              type="number"
              min="0"
              placeholder="6"
              className="input w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="label" htmlFor="players_max">Jugadores máx.</label>
            <input
              id="players_max"
              name="players_max"
              type="number"
              min="0"
              placeholder="12"
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
            placeholder="Ej: 8 conos, 4 petos, 2 porterías, 6 balones..."
            className="input w-full"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <label className="label" htmlFor="objective_tags">
            Etiquetas / objetivos
            <span className="text-muted-foreground font-normal ml-1">(separadas por comas)</span>
          </label>
          <input
            id="objective_tags"
            name="objective_tags"
            type="text"
            placeholder="presión, posesión, transición..."
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
            <h3 className="font-semibold">Tablero táctico</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dibuja el ejercicio en el campo. Pulsa "Exportar imagen" para guardarlo.
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
          {isPending ? 'Guardando...' : 'Guardar ejercicio'}
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
