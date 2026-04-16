import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ExerciseDetailView } from '@/features/entrenadores/components/ExerciseDetailView'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Detalle del ejercicio' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function ExerciseDetailPage({ params }: Props) {
  const { id } = await params
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!
  const rolesRaw = headersList.get('x-user-roles') ?? '[]'
  const roles = JSON.parse(rolesRaw) as string[]

  const isAdmin = roles.some((r) => ['admin', 'direccion'].includes(r))

  const supabase = await createClient()

  const [{ data: exercise }, { data: categories }] = await Promise.all([
    supabase
      .from('exercises')
      .select(`
        *,
        club_members:author_id(id, full_name),
        exercise_categories:category_id(id, name, color)
      `)
      .eq('id', id)
      .eq('club_id', clubId)
      .single(),
    supabase
      .from('exercise_categories')
      .select('*')
      .eq('club_id', clubId)
      .order('sort_order'),
  ])

  if (!exercise) notFound()

  const canEdit = isAdmin || exercise.author_id === memberId

  return (
    <div className="flex flex-col h-full">
      <Topbar title={exercise.title} />
      <div className="flex-1 p-6">
        <ExerciseDetailView
          exercise={exercise}
          categories={categories ?? []}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
