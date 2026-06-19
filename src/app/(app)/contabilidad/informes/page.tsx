import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { SeasonSelector } from '@/features/contabilidad/components/SeasonSelector'
import { InformePagos } from '@/features/contabilidad/components/InformePagos'
import type { PlayerRow, TeamRow } from '@/features/contabilidad/components/InformePagos'
import { getActiveSeasons, getCurrentSeason } from '@/lib/utils/currency'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Informes de Pagos' }
export const dynamic = 'force-dynamic'

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  const params = await searchParams
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { clubId } = await getClubContext()

  const seasons = getActiveSeasons()
  const currentSeason = getCurrentSeason()
  const season = params.season && seasons.includes(params.season) ? params.season : currentSeason

  // Tres queries independientes — paralelizar
  const [{ data: teamsRaw }, { data: playersRaw }, { data: paymentsRaw }] = await Promise.all([
    sb.from('teams').select('id, name, season').eq('club_id', clubId),
    sb.from('players')
      .select('id, first_name, last_name, team_id, next_team_id')
      .eq('club_id', clubId)
      .neq('status', 'low'),
    sb.from('quota_payments')
      .select('player_id, amount_due, amount_paid, status')
      .eq('club_id', clubId)
      .eq('season', season)
      .neq('status', 'refunded'),
  ])

  const teamMap: Record<string, string> = {}
  for (const t of (teamsRaw ?? [])) {
    teamMap[t.id] = t.name
  }

  // Determinar qué campo de equipo usar según temporada
  const isNextSeason = season !== currentSeason

  // Totales globales de todos los pagos de la temporada (incl. jugadores de baja)
  const globalTotalPaid = (paymentsRaw ?? []).reduce((s: number, p: { amount_paid: number }) => s + (p.amount_paid ?? 0), 0)
  const globalTotalDue = (paymentsRaw ?? []).reduce((s: number, p: { amount_due: number }) => s + (p.amount_due ?? 0), 0)

  // Agregar pagos por jugador (para tabla de desglose de activos)
  const paysByPlayer: Record<string, { due: number; paid: number }> = {}
  for (const pay of (paymentsRaw ?? [])) {
    if (!paysByPlayer[pay.player_id]) paysByPlayer[pay.player_id] = { due: 0, paid: 0 }
    paysByPlayer[pay.player_id].due += pay.amount_due ?? 0
    paysByPlayer[pay.player_id].paid += pay.amount_paid ?? 0
  }

  // Todos los jugadores activos — los sin cuota asignada aparecen con 0/0
  const players: PlayerRow[] = []
  for (const p of (playersRaw ?? [])) {
    const agg = paysByPlayer[p.id]
    const teamId = isNextSeason ? (p.next_team_id ?? p.team_id) : p.team_id
    players.push({
      id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      teamId: teamId ?? null,
      teamName: (teamId && teamMap[teamId]) ? teamMap[teamId] : 'Sin equipo',
      totalDue: agg?.due ?? 0,
      totalPaid: agg?.paid ?? 0,
      hasCuota: !!agg,
    })
  }

  // Agregar por equipo
  const teamAgg: Record<string, { name: string; playerCount: number; totalDue: number; totalPaid: number }> = {}
  for (const p of players) {
    const tid = p.teamId ?? '__none__'
    if (!teamAgg[tid]) teamAgg[tid] = { name: p.teamName, playerCount: 0, totalDue: 0, totalPaid: 0 }
    teamAgg[tid].playerCount++
    teamAgg[tid].totalDue += p.totalDue
    teamAgg[tid].totalPaid += p.totalPaid
  }
  const teams: TeamRow[] = Object.entries(teamAgg).map(([id, v]) => ({ id, ...v }))

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title="Informes de Pagos" />
      <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm text-muted-foreground">Temporada {season}</h2>
          <SeasonSelector season={season} seasons={seasons} basePath="/contabilidad/informes" />
        </div>
        <InformePagos players={players} teams={teams} season={season} globalTotalPaid={globalTotalPaid} globalTotalDue={globalTotalDue} />
      </main>
    </div>
  )
}
