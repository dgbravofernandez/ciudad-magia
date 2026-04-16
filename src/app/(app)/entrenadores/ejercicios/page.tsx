import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { ExerciseRepository } from '@/features/entrenadores/components/ExerciseRepository'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Ejercicios' }

export const dynamic = 'force-dynamic'

export default async function EjerciciosPage() {
  const { clubId, memberId, roles } = await getClubContext()

  const canManageCategories = roles.some((r) =>
    ['admin', 'direccion', 'director_deportivo'].includes(r)
  )

  const supabase = createAdminClient()

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

  // Favorites query — may fail if migration 008 has not been applied yet
  let favoriteIds: string[] = []
  try {
    const { data: favRows } = await supabase
      .from('exercise_favorites')
      .select('exercise_id')
      .eq('member_id', memberId)
    favoriteIds = (favRows ?? []).map((r: { exercise_id: string }) => r.exercise_id)
  } catch {
    // Table doesn't exist yet — gracefully ignore
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Ejercicios" />
      <div className="flex-1 p-6">
        <ExerciseRepository
          exercises={exercises ?? []}
          categories={categories ?? []}
          favoriteIds={favoriteIds}
          canManageCategories={canManageCategories}
        />
      </div>
    </div>
  )
}
