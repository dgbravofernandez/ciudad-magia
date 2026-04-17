import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { TorneoDetail } from '@/features/torneos/components/TorneoDetail'
import { TorneoExternoDetail } from '@/features/torneos/components/TorneoExternoDetail'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TorneoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: torneo } = await sb
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .eq('club_id', clubId)
    .single()

  if (!torneo) notFound()

  if (torneo.kind === 'external') {
    const [budgetRes, itemsRes, attendeesRes, playersRes] = await Promise.all([
      sb.from('tournament_budget').select('*').eq('tournament_id', id).maybeSingle(),
      sb.from('tournament_budget_items').select('*').eq('tournament_id', id).order('created_at'),
      sb.from('tournament_attendees')
        .select('*, player:player_id(id, first_name, last_name, tutor_name, tutor_email, team_id, teams:team_id(name))')
        .eq('tournament_id', id)
        .order('created_at'),
      sb.from('players')
        .select('id, first_name, last_name, team_id, teams:team_id(name)')
        .eq('club_id', clubId)
        .eq('status', 'active')
        .order('last_name'),
    ])

    return (
      <TorneoExternoDetail
        torneo={torneo}
        budget={budgetRes.data ?? null}
        items={itemsRes.data ?? []}
        attendees={attendeesRes.data ?? []}
        allPlayers={playersRes.data ?? []}
      />
    )
  }

  // Torneo local (existing behaviour)
  const [equiposRes, gruposRes, partidosRes] = await Promise.all([
    sb.from('tournament_teams').select('*').eq('tournament_id', id).order('name'),
    sb.from('tournament_groups').select('*').eq('tournament_id', id).order('name'),
    sb.from('tournament_matches').select('*, home_team:home_team_id(name), away_team:away_team_id(name), group:group_id(name)').eq('tournament_id', id).order('match_date'),
  ])

  return (
    <TorneoDetail
      torneo={torneo}
      equipos={equiposRes.data ?? []}
      grupos={gruposRes.data ?? []}
      partidos={partidosRes.data ?? []}
    />
  )
}
