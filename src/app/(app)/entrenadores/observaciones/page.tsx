import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { ObservationsPage } from '@/features/entrenadores/components/ObservationsPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Observaciones' }
export const dynamic = 'force-dynamic'

export default async function ObservacionesPage() {
  const { clubId } = await getClubContext()
  if (!clubId) return <div className="p-6 text-sm">No autenticado</div>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const [{ data: observations }, { data: teams }] = await Promise.all([
    supabase
      .from('coordinator_observations')
      .select(`
        *,
        club_members:observer_id(full_name),
        teams:team_id(name)
      `)
      .eq('club_id', clubId)
      .order('observation_date', { ascending: false })
      .limit(100),
    supabase
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .order('name'),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Observaciones" />
      <div className="flex-1 p-6">
        <ObservationsPage
          observations={observations ?? []}
          teams={teams ?? []}
        />
      </div>
    </div>
  )
}
