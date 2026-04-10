import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlayerList } from '@/features/jugadores/components/PlayerList'
import { Topbar } from '@/components/layout/Topbar'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Jugadores' }

export default async function JugadoresPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // 1. Resolve clubId from middleware header
  const headersList = await headers()
  let clubId = headersList.get('x-club-id') ?? ''

  // 2. Fallback: lookup from session
  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()
      clubId = member?.club_id ?? ''
    }
  }

  // 3. Last resort: get the only club that exists
  if (!clubId) {
    const { data: anyClub } = await sb
      .from('clubs')
      .select('id')
      .limit(1)
      .single()
    clubId = anyClub?.id ?? ''
  }

  // Query players — simple select without nested joins to avoid PostgREST issues
  const { data: players, error: playersError } = await sb
    .from('players')
    .select('*')
    .eq('club_id', clubId)
    .order('last_name')

  // Fetch teams separately
  const { data: teams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  // Build team map and enrich players with team info
  const teamMap: Record<string, { id: string; name: string }> = {}
  for (const t of (teams ?? [])) {
    teamMap[t.id] = t
  }
  const enrichedPlayers = (players ?? []).map((p: any) => ({
    ...p,
    teams: p.team_id ? teamMap[p.team_id] ?? null : null,
  }))

  // Sanctions
  const { data: sanctionsData } = await sb
    .from('player_sanctions')
    .select('player_id, matches_banned, matches_served')
    .eq('club_id', clubId)
    .eq('active', true)

  const activeSanctions: Record<string, number> = {}
  for (const s of (sanctionsData ?? [])) {
    const remaining = (s.matches_banned ?? 1) - (s.matches_served ?? 0)
    if (remaining > 0) activeSanctions[s.player_id] = remaining
  }

  // Debug: show diagnostic info when no players found
  const debugInfo = (players ?? []).length === 0
    ? `[DEBUG] clubId="${clubId}", header="${headersList.get('x-club-id') ?? 'null'}", error="${playersError?.message ?? 'none'}", env=${process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30)}`
    : null

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Jugadores" />
      <div className="flex-1 p-6">
        {debugInfo && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-xs font-mono text-red-800">
            {debugInfo}
          </div>
        )}
        <PlayerList players={enrichedPlayers} teams={teams ?? []} activeSanctions={activeSanctions} />
      </div>
    </div>
  )
}
