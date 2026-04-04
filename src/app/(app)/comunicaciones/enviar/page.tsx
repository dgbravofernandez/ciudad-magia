import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { EmailComposer } from '@/features/comunicaciones/components/EmailComposer'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Enviar Comunicación' }

export default async function EnviarPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

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
          templates={templates ?? []}
          teams={teams ?? []}
          categories={categories ?? []}
          totalPlayers={totalPlayers ?? 0}
          pendingPlayersCount={pendingPlayers ?? 0}
        />
      </div>
    </div>
  )
}
