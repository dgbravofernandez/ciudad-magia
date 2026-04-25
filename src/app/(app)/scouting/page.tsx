import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { ScoutingListPage } from '@/features/scouting/components/ScoutingListPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Scouting' }
export const dynamic = 'force-dynamic'

export default async function ScoutingPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: reports, error } = await sb
    .from('scouting_reports')
    .select('*, reporter:club_members!scouting_reports_reported_by_fkey(full_name)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) console.error('scouting list query error', error)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Scouting" />
      <div className="flex-1 p-6">
        <ScoutingListPage reports={(reports ?? []) as never} />
      </div>
    </div>
  )
}
