import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { DireccionPage } from '@/features/personal/direccion/components/DireccionPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Dirección' }

export default async function DireccionPageRoute() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch direction calendar events for next 30 days
  const { data: events } = await supabase
    .from('direction_calendar_events')
    .select('*')
    .eq('club_id', clubId)
    .gte('start_at', now.toISOString())
    .lte('start_at', in30Days)
    .order('start_at', { ascending: true })

  // Fetch last 10 scouting reports
  const { data: scoutingReports } = await supabase
    .from('scouting_reports')
    .select(`
      *,
      reporter:reported_by(full_name)
    `)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(10)

  // KPIs
  const { count: activePlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'active')

  const { count: pendingPayments } = await supabase
    .from('quota_payments')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'pending')

  const { count: activeInjuries } = await supabase
    .from('injuries')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'active')

  const { count: scoutingCount } = await supabase
    .from('scouting_reports')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)

  // Club members for attendees
  const { data: members } = await supabase
    .from('club_members')
    .select('id, full_name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('full_name')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Dirección" />
      <div className="flex-1 p-6">
        <DireccionPage
          clubId={clubId}
          events={events ?? []}
          scoutingReports={scoutingReports ?? []}
          activePlayers={activePlayers ?? 0}
          pendingPayments={pendingPayments ?? 0}
          activeInjuries={activeInjuries ?? 0}
          scoutingCount={scoutingCount ?? 0}
          members={members ?? []}
        />
      </div>
    </div>
  )
}
