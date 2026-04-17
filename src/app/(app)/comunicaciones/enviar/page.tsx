import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { EmailComposer } from '@/features/comunicaciones/components/EmailComposer'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Enviar Comunicación' }
export const dynamic = 'force-dynamic'

export default async function EnviarPage() {
  const { clubId } = await getClubContext()
  const supabase = createAdminClient()

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .eq('club_id', clubId)
    .order('name')

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, categories(name)')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('club_id', clubId)
    .order('name')

  // Count players for estimation
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'active')

  const { count: pendingPlayers } = await supabase
    .from('quota_payments')
    .select('player_id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'pending')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Enviar Comunicación" />
      <div className="flex-1 p-6">
        <EmailComposer
          clubId={clubId}
          templates={(templates ?? []) as never}
          teams={(teams ?? []) as never}
          categories={(categories ?? []) as never}
          totalPlayers={totalPlayers ?? 0}
          pendingPlayersCount={pendingPlayers ?? 0}
        />
      </div>
    </div>
  )
}
