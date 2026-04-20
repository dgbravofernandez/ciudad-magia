import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { ObservationsPage } from '@/features/entrenadores/components/ObservationsPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Observaciones' }
export const dynamic = 'force-dynamic'

export default async function ObservacionesPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = createAdminClient()

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
      .eq('active', true)
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
