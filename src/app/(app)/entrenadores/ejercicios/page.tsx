import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { ExerciseRepository } from '@/features/entrenadores/components/ExerciseRepository'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ejercicios' }

export default async function EjerciciosPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const [{ data: categories }, { data: exercises }] = await Promise.all([
    supabase
      .from('exercise_categories')
      .select('*')
      .eq('club_id', clubId)
      .order('sort_order'),
    supabase
      .from('exercises')
      .select(`
        *,
        club_members:author_id(full_name),
        exercise_categories:category_id(name, color)
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Ejercicios" />
      <div className="flex-1 p-6">
        <ExerciseRepository
          exercises={exercises ?? []}
          categories={categories ?? []}
        />
      </div>
    </div>
  )
}
