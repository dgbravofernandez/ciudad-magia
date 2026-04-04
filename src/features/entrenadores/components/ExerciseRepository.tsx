'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

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
}

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
      {/* Outer border */}
      <rect x="4" y="4" width="152" height="96" stroke="white" strokeWidth="1.5" fill="none" />
      {/* Center line */}
      <line x1="80" y1="4" x2="80" y2="100" stroke="white" strokeWidth="1" />
      {/* Center circle */}
      <circle cx="80" cy="52" r="18" stroke="white" strokeWidth="1" fill="none" />
      {/* Center spot */}
      <circle cx="80" cy="52" r="1.5" fill="white" />
      {/* Left penalty box */}
      <rect x="4" y="26" width="28" height="52" stroke="white" strokeWidth="1" fill="none" />
      {/* Right penalty box */}
      <rect x="128" y="26" width="28" height="52" stroke="white" strokeWidth="1" fill="none" />
      {/* Left 6-yard box */}
      <rect x="4" y="38" width="10" height="28" stroke="white" strokeWidth="1" fill="none" />
      {/* Right 6-yard box */}
      <rect x="146" y="38" width="10" height="28" stroke="white" strokeWidth="1" fill="none" />
    </svg>
  )
}

export function ExerciseRepository({ exercises, categories }: ExerciseRepositoryProps) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAuthor, setFilterAuthor] = useState('')

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

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchSearch =
        !search ||
        ex.title.toLowerCase().includes(search.toLowerCase()) ||
        ex.description?.toLowerCase().includes(search.toLowerCase()) ||
        ex.objective_tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      const matchCat = !filterCategory || ex.category_id === filterCategory
      const matchAuthor = !filterAuthor || ex.author_id === filterAuthor
      return matchSearch && matchCat && matchAuthor
    })
  }, [exercises, search, filterCategory, filterAuthor])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Repositorio de Ejercicios</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} ejercicios</p>
        </div>
        <Link href="/entrenadores/ejercicios/nuevo" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" />
          Nuevo ejercicio
        </Link>
      </div>

      {/* Filter bar */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="input pl-9 w-full"
            placeholder="Buscar ejercicios..."
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
      </div>

      {/* Exercise grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-muted-foreground">
          No se encontraron ejercicios
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((exercise) => (
            <Link key={exercise.id} href={`/entrenadores/ejercicios/${exercise.id}`}>
              <div className="card overflow-hidden hover:shadow-md transition-shadow cursor-pointer group h-full flex flex-col">
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
                  </div>

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
          ))}
        </div>
      )}
    </div>
  )
}
