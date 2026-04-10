import { createClient } from '@/lib/supabase/server'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { PlayerList } from '@/features/jugadores/components/PlayerList'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Jugadores' }

export default async function JugadoresPage() {
  const { clubId, memberId, roles: memberRoles } = await getClubContext()

  const supabase = await createClient()

  let query = supabase
    .from('players')
    .select(`
      *,
      teams(id, name, categories(name))
    `)
    .eq('club_id', clubId)
    .order('last_name')

  // Coaches only see their team's players
  if (
    !memberRoles.some((r) =>
      ['admin', 'direccion', 'director_deportivo', 'coordinador', 'infancia'].includes(r)
    )
  ) {
    const { data: teamIds } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('member_id', memberId)

    const ids = (teamIds ?? []).map((t) => t.team_id)
    if (ids.length > 0) {
      query = query.in('team_id', ids)
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000') // no results
    }
  }

  const { data: players } = await query

  const [{ data: teams }, sanctionsResult] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
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
