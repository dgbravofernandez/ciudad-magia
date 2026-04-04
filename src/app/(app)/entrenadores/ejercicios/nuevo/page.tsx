import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { ExerciseForm } from '@/features/entrenadores/components/ExerciseForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Nuevo Ejercicio' }

export default async function NuevoEjercicioPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('exercise_categories')
    .select('*')
    .eq('club_id', clubId)
    .order('sort_order')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Nuevo Ejercicio" />
      <div className="flex-1 p-6 max-w-4xl">
        <ExerciseForm categories={categories ?? []} />
      </div>
    </div>
  )
}
