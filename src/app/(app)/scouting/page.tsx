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

  const sb = createAdminClient()

  const { data: reports } = await sb
    .from('scouting_reports')
    .select(`
      *,
      reporter:reported_by(full_name)
    `)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Scouting" />
      <div className="flex-1 p-6">
        <ScoutingListPage reports={(reports ?? []) as never} />
      </div>
    </div>
  )
}
