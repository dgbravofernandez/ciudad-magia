import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { LiveMatch } from '@/features/entrenadores/components/LiveMatch'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Partido' }

export default async function PartidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      teams(id, name)
    `)
    .eq('id', id)
    .eq('club_id', clubId)
    .single()

  if (!session) notFound()

  // Players for lineup
  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, dorsal_number, position')
    .eq('team_id', session.team_id)
    .eq('status', 'active')
    .order('dorsal_number', { ascending: true, nullsFirst: false })

  // Match events
  const { data: events } = await supabase
    .from('match_events')
    .select(`
      *,
      players:player_id(first_name, last_name, dorsal_number),
      player_out:player_out_id(first_name, last_name, dorsal_number)
    `)
    .eq('session_id', id)
    .order('minute', { ascending: true })

  // Club settings for sanction threshold
  const { data: settings } = await supabase
    .from('club_settings')
    .select('sanction_yellow_threshold, sanction_matches')
    .eq('club_id', clubId)
    .single()

  // Player season yellow card counts
  const playerIds = (players ?? []).map((p) => p.id)
  let yellowCardCounts: Record<string, number> = {}

  if (playerIds.length > 0) {
    const { data: stats } = await supabase
      .from('player_season_stats')
      .select('player_id, yellow_cards')
      .in('player_id', playerIds)
      .eq('club_id', clubId)

    for (const s of stats ?? []) {
      yellowCardCounts[s.player_id] = s.yellow_cards ?? 0
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Partido" />
      <div className="flex-1 p-6">
        <LiveMatch
          session={session}
          players={players ?? []}
          initialEvents={events ?? []}
          yellowCardCounts={yellowCardCounts}
          sanctionThreshold={settings?.sanction_yellow_threshold ?? 5}
          sanctionMatches={settings?.sanction_matches ?? 1}
        />
      </div>
    </div>
  )
}
