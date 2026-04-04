import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { notFound } from 'next/navigation'
import { PlayerCard } from '@/features/jugadores/components/PlayerCard'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: player } = await supabase
    .from('players')
    .select('first_name, last_name')
    .eq('id', id)
    .single()

  if (!player) return { title: 'Jugador no encontrado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { title: `${(player as any).first_name} ${(player as any).last_name}` }
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const clubId = await getClubId()

  const supabase = await createClient()

  const [
    { data: player },
    { data: stats },
    { data: injuries },
    { data: payments },
    { data: sanctions },
  ] = await Promise.all([
    supabase
      .from('players')
      .select('*, teams(id, name, categories(name))')
      .eq('id', id)
      .eq('club_id', clubId)
      .single(),
    supabase
      .from('player_season_stats')
      .select('*')
      .eq('player_id', id)
      .order('season', { ascending: false }),
    supabase
      .from('injuries')
      .select('*')
      .eq('player_id', id)
      .order('injured_at', { ascending: false }),
    supabase
      .from('quota_payments')
      .select('*')
      .eq('player_id', id)
      .order('season', { ascending: false })
      .order('month', { ascending: false })
      .limit(24),
    supabase
      .from('player_sanctions')
      .select('*')
      .eq('player_id', id)
      .eq('active', true),
  ])

  if (!player) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = player as any
  return (
    <div className="flex flex-col h-full">
      <Topbar title={`${p.first_name} ${p.last_name}`} />
      <div className="flex-1 p-6">
        <PlayerCard
          player={player}
          stats={stats ?? []}
          injuries={injuries ?? []}
          payments={payments ?? []}
          sanctions={sanctions ?? []}
        />
      </div>
    </div>
  )
}
