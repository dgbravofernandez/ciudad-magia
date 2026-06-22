import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { PlayerList } from '@/features/jugadores/components/PlayerList'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'
import { bumpSeason } from '@/lib/utils/season'

export const metadata: Metadata = { title: 'Jugadores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export default async function JugadoresPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const clubId = await getClubId()
  if (!clubId) return <div className="p-6 text-muted-foreground">No se pudo determinar el club.</div>

  // Temporada — necesaria antes del resto para calcular nextSeason
  const { data: settings } = await sb
    .from('club_settings')
    .select('current_season')
    .eq('club_id', clubId)
    .single()
  const currentSeason: string = settings?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)
  const relevantSeasons = [currentSeason, nextSeason].filter(Boolean)

  // Todas las queries independientes en paralelo.
  // players y quota_payments usan fetchAllRows: PostgREST corta a 1000 filas y
  // un .limit(2000) NO lo evita → con >1000 jugadores los últimos (orden alfabético)
  // desaparecían del listado, y los pagos quedaban truncados falseando estados.
  const [players, teamsResult, nextTeamsResult, sanctionsResult, pagosData, clubResult] =
    await Promise.all([
      fetchAllRows(() => sb.from('players').select('*').eq('club_id', clubId).order('last_name')),
      sb.from('teams').select('id, name').eq('club_id', clubId).eq('active', true).order('name'),
      sb.from('teams').select('id, name').eq('club_id', clubId).eq('season', nextSeason).order('name'),
      sb.from('player_sanctions')
        .select('player_id, matches_banned, matches_served')
        .eq('club_id', clubId)
        .eq('active', true),
      fetchAllRows(() => sb.from('quota_payments')
        .select('player_id, season, amount_due, amount_paid')
        .eq('club_id', clubId)
        .in('season', relevantSeasons)),
      sb.from('clubs').select('name, logo_url, primary_color').eq('id', clubId).single(),
    ])

  const teams = teamsResult.data ?? []
  const nextTeams = nextTeamsResult.data ?? []
  const sanctionsData = sanctionsResult.data ?? []
  const clubData = clubResult.data

  // Mapas de equipos
  const teamMap: Record<string, { id: string; name: string }> = {}
  for (const t of teams) teamMap[t.id] = t

  const nextTeamMap: Record<string, { id: string; name: string }> = {}
  for (const t of nextTeams) nextTeamMap[t.id] = t

  // Enriquecer jugadores con info de ambos equipos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedPlayers = players.map((p: any) => ({
    ...p,
    teams: p.team_id ? teamMap[p.team_id] ?? null : null,
    nextTeam: p.next_team_id ? nextTeamMap[p.next_team_id] ?? null : null,
  }))

  // Sanciones activas
  const activeSanctions: Record<string, number> = {}
  for (const s of sanctionsData) {
    const remaining = (s.matches_banned ?? 1) - (s.matches_served ?? 0)
    if (remaining > 0) activeSanctions[s.player_id] = remaining
  }

  // Mapa de pagos: { [playerId]: { [season]: { due, paid } } }
  const paymentsByPlayer: Record<string, Record<string, { due: number; paid: number }>> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of pagosData as any[]) {
    if (!p.player_id || !p.season) continue
    const playerMap = paymentsByPlayer[p.player_id] ?? (paymentsByPlayer[p.player_id] = {})
    // Normalizar al formato barra '2025/26' que usa club_settings.current_season
    const seasonKey = (p.season as string).replace('-', '/')
    const seasonAcc = playerMap[seasonKey] ?? (playerMap[seasonKey] = { due: 0, paid: 0 })
    seasonAcc.due  += Number(p.amount_due  ?? 0)
    seasonAcc.paid += Number(p.amount_paid ?? 0)
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Jugadores" />
      <div className="flex-1 p-6">
        <PlayerList
          players={enrichedPlayers}
          teams={teams}
          nextTeams={nextTeams}
          currentSeason={currentSeason}
          nextSeason={nextSeason}
          activeSanctions={activeSanctions}
          paymentsByPlayer={paymentsByPlayer}
          clubName={clubData?.name ?? ''}
          clubLogoUrl={clubData?.logo_url ?? null}
          clubPrimaryColor={clubData?.primary_color ?? '#EC4899'}
        />
      </div>
    </div>
  )
}
