import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { FisioPage } from '@/features/personal/fisio/components/FisioPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Fisioterapia' }

export default async function FisioPageRoute() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  // Fetch active injuries with player name + team
  const { data: injuries } = await supabase
    .from('injuries')
    .select(`
      *,
      players(id, first_name, last_name, photo_url, teams(id, name))
    `)
    .eq('club_id', clubId)
    .eq('status', 'active')
    .order('injured_at', { ascending: false })

  // Fetch fisio appointments
  const { data: appointments } = await supabase
    .from('fisio_appointments')
    .select(`
      *,
      players(id, first_name, last_name)
    `)
    .eq('club_id', clubId)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(30)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Fisioterapia" />
      <div className="flex-1 p-6">
        <FisioPage injuries={injuries ?? []} appointments={appointments ?? []} />
      </div>
    </div>
  )
}
