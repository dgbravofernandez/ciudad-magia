import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { InscripcionesTable } from '@/features/jugadores/components/InscripcionesTable'
import { Topbar } from '@/components/layout/Topbar'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Seguimiento de inscripciones' }
export const maxDuration = 30

export default async function InscripcionesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Resolución robusta multi-club (header → cookie preferida → más reciente)
  const headersList = await headers()
  const clubId = await getClubId()
  if (!clubId) return <div className="p-6 text-muted-foreground">No se pudo determinar el club.</div>

  // Resolve isAdmin
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  let isAdmin = memberRoles.some(r => ['admin', 'direccion'].includes(r))
  if (!isAdmin && memberRoles.length === 0) {
    const memberId = headersList.get('x-member-id') ?? ''
    if (memberId) {
      const { data: roles } = await sb
        .from('club_member_roles').select('role').eq('member_id', memberId)
      isAdmin = (roles ?? []).some((r: { role: string }) => ['admin', 'direccion'].includes(r.role))
    }
  }

  // Fetch current_season + hojas de Google de ESTE club (sin fallback a Getafe)
  const { data: settingsRow } = await sb
    .from('club_settings')
    .select('current_season, inscriptions_sheet_id, inscriptions_form_gids, coaches_sheet_id, coaches_gid')
    .eq('club_id', clubId)
    .single()
  const currentSeason: string = settingsRow?.current_season ?? ''
  const inscriptionsSheetId: string | null = settingsRow?.inscriptions_sheet_id ?? null
  const inscriptionsFormGids: string[] = (settingsRow?.inscriptions_form_gids ?? '')
    .split(',').map((s: string) => s.trim()).filter(Boolean)
  const coachesSheetId: string | null = settingsRow?.coaches_sheet_id ?? null
  const coachesGid: string | null = settingsRow?.coaches_gid ?? null
  // bumpSeason: "2025/26" → "2026/27"
  const nextSeason = (() => {
    const m = currentSeason.match(/^(\d{4})\/(\d{2})$/)
    if (m) {
      const y1 = parseInt(m[1]) + 1
      const y2short = parseInt(m[2]) + 1
      return `${y1}/${String(y2short).padStart(2, '0')}`
    }
    return ''
  })()

  const [playersResult, teamsResult, draftTeamsResult] = await Promise.all([
    sb
      .from('players')
      .select('*, teams:team_id(id, name), next_team:next_team_id(id, name)')
      .eq('club_id', clubId)
      // Include rows where status IS NULL or status != 'low'
      // (PostgREST .neq excludes NULL values, so we use .or() instead)
      .or('status.is.null,status.neq.low')
      .order('last_name')
      .limit(2000),
    sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name'),
    nextSeason
      ? sb
          .from('teams')
          .select('id, name, season')
          .eq('club_id', clubId)
          .eq('season', nextSeason)
          .order('name')
      : Promise.resolve({ data: [] }),
  ])
  const players = (playersResult.data ?? []) as any[]
  const teams = (teamsResult.data ?? []) as { id: string; name: string }[]
  const draftTeams = (draftTeamsResult.data ?? []) as { id: string; name: string; season: string }[]

  // Build coachMap: team_id → first coach name (active + draft teams)
  const allTeamIds = [
    ...teams.map((t: { id: string }) => t.id),
    ...draftTeams.map((t: { id: string }) => t.id),
  ]
  const teamIds = allTeamIds
  const { data: coachRows } = teamIds.length > 0
    ? await sb
        .from('team_coaches')
        .select('team_id, club_members(full_name)')
        .in('team_id', teamIds)
    : { data: [] }

  const coachMap: Record<string, string> = {}
  for (const row of (coachRows ?? [])) {
    if (!coachMap[row.team_id] && row.club_members?.full_name) {
      coachMap[row.team_id] = row.club_members.full_name
    }
  }

  // Get player IDs that have trial letters
  const { getTrialLetterPlayerIds } = await import('@/features/jugadores/actions/player.actions')
  const trialLetterPlayerIds = await getTrialLetterPlayerIds(clubId)
  const trialLetterIds = Array.from(trialLetterPlayerIds)

  // ── Pagos 26/27: qué ha pagado cada jugador ───────────────────────────────
  // La BD puede guardar la temporada como '2026/27' o '2026-27' — buscamos ambas
  const nextSeasonDb = nextSeason.replace('/', '-')   // "2026-27" para la BD
  const { data: nextSeasonPayments } = nextSeason
    ? await sb
        .from('quota_payments')
        .select('player_id, concept, amount_paid, status')
        .eq('club_id', clubId)
        .or(`season.eq.${nextSeason},season.eq.${nextSeasonDb}`)
        .eq('status', 'paid')
    : { data: [] }

  // Construir mapas: jugador → conceptos pagados
  const paidConcepts: Record<string, Set<string>> = {}
  for (const p of (nextSeasonPayments ?? [])) {
    if (!paidConcepts[p.player_id]) paidConcepts[p.player_id] = new Set()
    paidConcepts[p.player_id].add((p.concept ?? '').toLowerCase())
  }
  // paid26Status: 'none' | 'reserva' | 'cuota' (cuota = pagó algo más que reserva)
  const paid26Status: Record<string, 'none' | 'reserva' | 'cuota'> = {}
  for (const player of players) {
    const concepts = paidConcepts[player.id]
    if (!concepts || concepts.size === 0) {
      paid26Status[player.id] = 'none'
    } else {
      const hasNonReserva = [...concepts].some(c => !c.includes('reserva'))
      paid26Status[player.id] = hasNonReserva ? 'cuota' : 'reserva'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Seguimiento de inscripciones" />
      <div className="flex-1 p-6">
        <InscripcionesTable
          players={players}
          teams={teams}
          draftTeams={draftTeams.length > 0 ? draftTeams : undefined}
          coachMap={coachMap}
          isAdmin={isAdmin}
          trialLetterPlayerIds={trialLetterIds}
          paid26Status={paid26Status}
          nextSeason={nextSeason}
          inscriptionsSheetId={inscriptionsSheetId}
          inscriptionsFormGids={inscriptionsFormGids}
          coachesSheetId={coachesSheetId}
          coachesGid={coachesGid}
        />
      </div>
    </div>
  )
}
