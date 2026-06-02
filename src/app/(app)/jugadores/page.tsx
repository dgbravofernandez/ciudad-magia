import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlayerList } from '@/features/jugadores/components/PlayerList'
import { Topbar } from '@/components/layout/Topbar'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Jugadores' }

function bumpSeason(season: string): string {
  const m = season.match(/^(\d{4})\/(\d{2})$/)
  if (m) {
    const y1 = parseInt(m[1]) + 1
    const y2short = parseInt(m[2])
    const y2full = y2short >= 90 ? 1900 + y2short : 2000 + y2short
    return `${y1}/${String(y2full + 1).slice(-2)}`
  }
  return season
}

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

  // Si no hay clubId el middleware ya habría redirigido — no hacer fallback al primer club
  if (!clubId) return <div className="p-6 text-muted-foreground">No se pudo determinar el club.</div>

  // Temporadas
  const { data: settings } = await sb
    .from('club_settings')
    .select('current_season')
    .eq('club_id', clubId)
    .single()
  const currentSeason: string = settings?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)

  // Query players
  const { data: players, error: playersError } = await sb
    .from('players')
    .select('*')
    .eq('club_id', clubId)
    .order('last_name')

  // Equipos temporada actual (activos)
  const { data: teams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  // Equipos próxima temporada (borrador)
  const { data: nextTeams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('season', nextSeason)
    .order('name')

  // Mapas de equipos
  const teamMap: Record<string, { id: string; name: string }> = {}
  for (const t of (teams ?? [])) teamMap[t.id] = t

  const nextTeamMap: Record<string, { id: string; name: string }> = {}
  for (const t of (nextTeams ?? [])) nextTeamMap[t.id] = t

  // Enriquecer jugadores con info de ambos equipos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedPlayers = (players ?? []).map((p: any) => ({
    ...p,
    teams: p.team_id ? teamMap[p.team_id] ?? null : null,
    nextTeam: p.next_team_id ? nextTeamMap[p.next_team_id] ?? null : null,
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

  // Debug info solo cuando no hay jugadores
  const debugInfo = (players ?? []).length === 0
    ? `[DEBUG] clubId="${clubId}", header="${headersList.get('x-club-id') ?? 'null'}", error="${playersError?.message ?? 'none'}"`
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
        <PlayerList
          players={enrichedPlayers}
          teams={teams ?? []}
          nextTeams={nextTeams ?? []}
          currentSeason={currentSeason}
          nextSeason={nextSeason}
          activeSanctions={activeSanctions}
        />
      </div>
    </div>
  )
}
