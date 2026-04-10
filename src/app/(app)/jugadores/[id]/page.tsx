import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
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
  const headersList = await headers()
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  const memberName = headersList.get('x-member-name') ?? 'Usuario'

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const [
    { data: player },
    { data: stats },
    { data: injuries },
    { data: payments },
    { data: sanctions },
    { data: observations },
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
    sb
      .from('player_observations')
      .select('id, category, comment, author_name, created_at')
      .eq('player_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!player) notFound()

  // Coaches can also add injuries
  const canAddInjury = memberRoles.some(r =>
    ['admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador'].includes(r)
  )

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
          observations={observations ?? []}
          canAddInjury={canAddInjury}
          authorName={memberName}
        />
      </div>
    </div>
  )
}
