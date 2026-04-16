'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { Search, Plus, Star, Settings, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils/cn'
import {
  toggleExerciseFavorite,
  createExerciseCategory,
  deleteExerciseCategory,
} from '@/features/entrenadores/actions/session.actions'

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
  author_id: string | null
  created_at: string
  club_members: { full_name: string } | null
  exercise_categories: { name: string; color: string } | null
}

interface ExerciseRepositoryProps {
  exercises: Exercise[]
  categories: ExerciseCategory[]
  favoriteIds: string[]
  canManageCategories: boolean
}

const CATEGORY_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
]

// Fallback pitch SVG placeholder
function PitchPlaceholder() {
  return (
    <svg
      viewBox="0 0 160 104"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="160" height="104" fill="#2d7a3e" />
      <rect x="4" y="4" width="152" height="96" stroke="white" strokeWidth="1.5" fill="none" />
      <line x1="80" y1="4" x2="80" y2="100" stroke="white" strokeWidth="1" />
      <circle cx="80" cy="52" r="18" stroke="white" strokeWidth="1" fill="none" />
      <circle cx="80" cy="52" r="1.5" fill="white" />
      <rect x="4" y="26" width="28" height="52" stroke="white" strokeWidth="1" fill="none" />
      <rect x="128" y="26" width="28" height="52" stroke="white" strokeWidth="1" fill="none" />
      <rect x="4" y="38" width="10" height="28" stroke="white" strokeWidth="1" fill="none" />
      <rect x="146" y="38" width="10" height="28" stroke="white" strokeWidth="1" fill="none" />
    </svg>
  )
}

export function ExerciseRepository({
  exercises,
  categories,
  favoriteIds,
  canManageCategories,
}: ExerciseRepositoryProps) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')
  const [filterDuration, setFilterDuration] = useState('') // '', '0-15', '15-30', '30+'
  const [filterPlayers, setFilterPlayers] = useState('')   // '', 'small', 'medium', 'large'
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set(favoriteIds))
  const [isPending, startTransition] = useTransition()

  // Category management modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0])

  // Unique authors
  const authors = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; name: string }[] = []
    for (const ex of exercises) {
      if (ex.author_id && ex.club_members && !seen.has(ex.author_id)) {
        seen.add(ex.author_id)
        result.push({ id: ex.author_id, name: ex.club_members.full_name })
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [exercises])

  function matchDuration(ex: Exercise): boolean {
    if (!filterDuration) return true
    const d = ex.duration_min
    if (d == null) return false
    if (filterDuration === '0-15') return d <= 15
    if (filterDuration === '15-30') return d > 15 && d <= 30
    if (filterDuration === '30+') return d > 30
    return true
  }

  function matchPlayers(ex: Exercise): boolean {
    if (!filterPlayers) return true
    const min = ex.players_min
    const max = ex.players_max
    if (min == null && max == null) return false
    const ref = max ?? min ?? 0
    if (filterPlayers === 'small') return ref <= 8
    if (filterPlayers === 'medium') return ref > 8 && ref <= 14
    if (filterPlayers === 'large') return ref > 14
    return true
  }

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchSearch =
        !search ||
        ex.title.toLowerCase().includes(search.toLowerCase()) ||
        ex.description?.toLowerCase().includes(search.toLowerCase()) ||
        ex.subcategory?.toLowerCase().includes(search.toLowerCase()) ||
        ex.objective_tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      const matchCat = !filterCategory || ex.category_id === filterCategory
      const matchAuthor = !filterAuthor || ex.author_id === filterAuthor
      const matchFav = !onlyFavorites || favorites.has(ex.id)
      return matchSearch && matchCat && matchAuthor && matchDuration(ex) && matchPlayers(ex) && matchFav
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, search, filterCategory, filterAuthor, filterDuration, filterPlayers, onlyFavorites, favorites])

  function handleToggleFavorite(e: React.MouseEvent, exerciseId: string) {
    e.preventDefault()
    e.stopPropagation()
    // Optimistic update
    const wasFav = favorites.has(exerciseId)
    setFavorites((prev) => {
      const next = new Set(prev)
      if (wasFav) next.delete(exerciseId)
      else next.add(exerciseId)
      return next
    })
    startTransition(async () => {
      const result = await toggleExerciseFavorite(exerciseId)
      if (!result.success) {
        // Revert on error
        setFavorites((prev) => {
          const next = new Set(prev)
          if (wasFav) next.add(exerciseId)
          else next.delete(exerciseId)
          return next
        })
        toast.error(result.error ?? 'Error')
      }
    })
  }

  function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      toast.error('Introduce un nombre')
      return
    }
    startTransition(async () => {
      const result = await createExerciseCategory(newCategoryName.trim(), newCategoryColor)
      if (result.success) {
        toast.success('Categoría creada')
        setNewCategoryName('')
      } else {
        toast.error(result.error ?? 'Error al crear categoría')
      }
    })
  }

  function handleDeleteCategory(categoryId: string, name: string) {
    if (!confirm(`Borrar la categoría "${name}"? Los ejercicios asociados quedarán sin categoría.`)) return
    startTransition(async () => {
      const result = await deleteExerciseCategory(categoryId)
      if (result.success) {
        toast.success('Categoría borrada')
      } else {
        toast.error(result.error ?? 'Error')
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Repositorio de Ejercicios</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} ejercicios</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageCategories && (
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Settings className="w-4 h-4" />
              Categorías
            </button>
          )}
          <Link href="/entrenadores/ejercicios/nuevo" className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            Nuevo ejercicio
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              className="input pl-9 w-full"
              placeholder="Buscar por título, descripción, etiquetas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input w-auto min-w-[160px]"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            className="input w-auto min-w-[140px]"
            value={filterAuthor}
            onChange={(e) => setFilterAuthor(e.target.value)}
          >
            <option value="">Todos los autores</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          <select
            className="input w-auto min-w-[140px]"
            value={filterDuration}
            onChange={(e) => setFilterDuration(e.target.value)}
          >
            <option value="">Cualquier duración</option>
            <option value="0-15">≤ 15 min</option>
            <option value="15-30">15-30 min</option>
            <option value="30+">+ 30 min</option>
          </select>

          <select
            className="input w-auto min-w-[140px]"
            value={filterPlayers}
            onChange={(e) => setFilterPlayers(e.target.value)}
          >
            <option value="">Cualquier nº jugadores</option>
            <option value="small">Pocos (≤ 8)</option>
            <option value="medium">Medio (9-14)</option>
            <option value="large">Muchos (+ 14)</option>
          </select>

          <button
            type="button"
            onClick={() => setOnlyFavorites((p) => !p)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
              onlyFavorites
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-border hover:border-muted-foreground'
            )}
          >
            <Star className={cn('w-4 h-4', onlyFavorites && 'fill-amber-500 text-amber-500')} />
            Favoritos
          </button>
        </div>
      </div>

      {/* Exercise grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-muted-foreground">
          No se encontraron ejercicios
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((exercise) => {
            const isFav = favorites.has(exercise.id)
            return (
              <Link key={exercise.id} href={`/entrenadores/ejercicios/${exercise.id}`}>
                <div className="card overflow-hidden hover:shadow-md transition-shadow cursor-pointer group h-full flex flex-col relative">
                  {/* Favorite button */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(e, exercise.id)}
                    disabled={isPending}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
                    title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  >
                    <Star className={cn('w-4 h-4', isFav ? 'fill-amber-400 text-amber-400' : 'text-white')} />
                  </button>

                  {/* Preview image */}
                  <div className="aspect-video bg-green-800 relative overflow-hidden">
                    {exercise.canvas_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exercise.canvas_image_url}
                        alt={exercise.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full">
                        <PitchPlaceholder />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {exercise.title}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {exercise.exercise_categories && (
                        <span
                          className="badge text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${exercise.exercise_categories.color}20`,
                            color: exercise.exercise_categories.color,
                            border: `1px solid ${exercise.exercise_categories.color}40`,
                          }}
                        >
                          {exercise.exercise_categories.name}
                        </span>
                      )}
                      {exercise.subcategory && (
                        <span className="badge badge-muted text-xs">{exercise.subcategory}</span>
                      )}
                    </div>

                    {/* Quick stats */}
                    {(exercise.duration_min || exercise.players_min || exercise.players_max) && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {exercise.duration_min && <span>⏱ {exercise.duration_min} min</span>}
                        {(exercise.players_min || exercise.players_max) && (
                          <span>
                            👥 {exercise.players_min ?? '?'}
                            {exercise.players_max && exercise.players_max !== exercise.players_min
                              ? `-${exercise.players_max}`
                              : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {exercise.objective_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {exercise.objective_tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="badge badge-muted text-xs">{tag}</span>
                        ))}
                        {exercise.objective_tags.length > 3 && (
                          <span className="badge badge-muted text-xs">+{exercise.objective_tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className="mt-auto pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                      <span>{exercise.club_members?.full_name ?? 'Desconocido'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Category management modal */}
      {categoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setCategoryModalOpen(false)}
        >
          <div
            className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Gestionar categorías</h3>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing categories */}
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full inline-block"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-sm">{c.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id, c.name)}
                    disabled={isPending}
                    className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    title="Borrar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Sin categorías</p>
              )}
            </div>

            {/* Add new */}
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Añadir nueva</p>
              <input
                type="text"
                className="input w-full"
                placeholder="Nombre de la categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCategoryColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      newCategoryColor === color ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={isPending}
                className="btn-primary w-full"
              >
                {isPending ? 'Creando...' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
