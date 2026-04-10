import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlayerList } from '@/features/jugadores/components/PlayerList'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Jugadores' }

export default async function JugadoresPage() {
  // Resolve clubId: try header first, fall back to DB lookup via session
  const { headers } = await import('next/headers')
  const headersList = await headers()
  let clubId = headersList.get('x-club-id') ?? ''

  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = createAdminClient() as any
      const { data: member } = await admin
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()
      clubId = member?.club_id ?? ''
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: players } = await sb
    .from('players')
    .select(`
      *,
      teams(id, name)
    `)
    .eq('club_id', clubId)
    .order('last_name')

  const [{ data: teams }, sanctionsResult] = await Promise.all([
    sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name'),
    sb
      .from('player_sanctions')
      .select('player_id, matches_banned, matches_served')
      .eq('club_id', clubId)
      .eq('active', true),
  ])

  // Build map: player_id → remaining matches
  const activeSanctions: Record<string, number> = {}
  for (const s of (sanctionsResult.data ?? [])) {
    const remaining = (s.matches_banned ?? 1) - (s.matches_served ?? 0)
    if (remaining > 0) activeSanctions[s.player_id] = remaining
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Jugadores" />
      <div className="flex-1 p-6">
        <PlayerList players={players ?? []} teams={teams ?? []} activeSanctions={activeSanctions} />
      </div>
    </div>
  )
}
