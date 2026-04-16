'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import { Search, X, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import {
  addSessionExercise,
  removeSessionExercise,
} from '@/features/entrenadores/actions/session.actions'

interface Exercise {
  id: string
  title: string
  description: string | null
  category_id: string | null
  subcategory: string | null
  duration_min: number | null
  canvas_image_url: string | null
  exercise_categories: { name: string; color: string } | null
}

interface SessionExercise {
  slot_order: number
  exercise_id: string
  notes: string | null
  exercises: {
    id: string
    title: string
    description: string | null
    canvas_image_url: string | null
    category_id: string | null
  } | null
}

interface SessionExercisePickerProps {
  sessionId: string
  sessionExercises: SessionExercise[]
  allExercises: Exercise[]
  isCompleted: boolean
}

export function SessionExercisePicker({
  sessionId,
  sessionExercises,
  allExercises,
  isCompleted,
}: SessionExercisePickerProps) {
  const [isPending, startTransition] = useTransition()
  const [searchModal, setSearchModal] = useState<number | null>(null) // slot number being selected
  const [search, setSearch] = useState('')
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null)

  const filtered = useMemo(() => {
    if (!search) return allExercises
    const q = search.toLowerCase()
    return allExercises.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.subcategory?.toLowerCase().includes(q)
    )
  }, [allExercises, search])

  function handleSelectExercise(slot: number, exerciseId: string) {
    startTransition(async () => {
      const result = await addSessionExercise(sessionId, exerciseId, slot)
      if (result.success) {
        toast.success('Ejercicio asignado')
        setSearchModal(null)
        setSearch('')
      } else {
        toast.error(result.error ?? 'Error')
      }
    })
  }

  function handleRemoveExercise(slot: number) {
    startTransition(async () => {
      const result = await removeSessionExercise(sessionId, slot)
      if (result.success) {
        toast.success('Ejercicio eliminado del slot')
      } else {
        toast.error(result.error ?? 'Error')
      }
    })
  }

  const slots = [1, 2, 3, 4]

  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-semibold">Ejercicios de la sesion</h3>

      <div className="space-y-3">
        {slots.map((slot) => {
          const assigned = sessionExercises.find((se) => se.slot_order === slot)
          const isExpanded = expandedSlot === slot

          if (assigned && assigned.exercises) {
            return (
              <div key={slot} className="border rounded-lg overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedSlot(isExpanded ? null : slot)}
                >
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {slot}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{assigned.exercises.title}</p>
                  </div>
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveExercise(slot)
                      }}
                      disabled={isPending}
                      className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                      title="Quitar ejercicio"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t p-3 bg-muted/20 space-y-2">
                    {assigned.exercises.canvas_image_url && (
                      <div className="aspect-video max-w-xs rounded overflow-hidden bg-green-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={assigned.exercises.canvas_image_url}
                          alt={assigned.exercises.title}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {assigned.exercises.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {assigned.exercises.description}
                      </p>
                    )}
                    {assigned.notes && (
                      <div className="text-xs bg-yellow-50 text-yellow-800 rounded p-2">
                        Notas: {assigned.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          }

          // Empty slot
          return (
            <div key={slot} className="border border-dashed rounded-lg p-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
                  {slot}
                </span>
                {isCompleted ? (
                  <p className="text-sm text-muted-foreground">Sin ejercicio</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchModal(slot)
                      setSearch('')
                    }}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Plus className="w-4 h-4" />
                    Seleccionar ejercicio
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Exercise search modal */}
      {searchModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setSearchModal(null)
            setSearch('')
          }}
        >
          <div
            className="bg-background rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="font-semibold">Seleccionar ejercicio — Slot {searchModal}</h4>
              <button
                type="button"
                onClick={() => {
                  setSearchModal(null)
                  setSearch('')
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  className="input pl-9 w-full"
                  placeholder="Buscar ejercicio..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">No se encontraron ejercicios</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => handleSelectExercise(searchModal, ex.id)}
                      disabled={isPending}
                      className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-3"
                    >
                      {/* Mini preview */}
                      <div className="w-16 h-10 rounded bg-green-800 overflow-hidden shrink-0">
                        {ex.canvas_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ex.canvas_image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
                            --
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ex.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {ex.exercise_categories && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: `${ex.exercise_categories.color}20`,
                                color: ex.exercise_categories.color,
                              }}
                            >
                              {ex.exercise_categories.name}
                            </span>
                          )}
                          {ex.duration_min && <span>{ex.duration_min} min</span>}
                          {ex.subcategory && <span>{ex.subcategory}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
