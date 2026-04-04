import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { TorneoDetail } from '@/features/torneos/components/TorneoDetail'
import { notFound } from 'next/navigation'

export default async function TorneoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hdrs = await headers()
  const clubId = hdrs.get('x-club-id')!
  const supabase = await createClient()

  const [torneoRes, equiposRes, gruposRes, partidosRes] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).eq('club_id', clubId).single(),
    supabase.from('tournament_teams').select('*').eq('tournament_id', id).order('name'),
    supabase.from('tournament_groups').select('*').eq('tournament_id', id).order('name'),
    supabase.from('tournament_matches').select('*, home_team:home_team_id(name), away_team:away_team_id(name), group:group_id(name)').eq('tournament_id', id).order('match_date'),
  ])

  if (!torneoRes.data) notFound()

  return (
    <TorneoDetail
      torneo={torneoRes.data}
      equipos={equiposRes.data ?? []}
      grupos={gruposRes.data ?? []}
      partidos={partidosRes.data ?? []}
    />
  )
}
