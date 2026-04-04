import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { TorneosPage } from '@/features/torneos/components/TorneosPage'

export default async function Torneos() {
  const hdrs = await headers()
  const clubId = hdrs.get('x-club-id')!
  const supabase = await createClient()

  const { data: torneos } = await supabase
    .from('tournaments')
    .select('*')
    .eq('club_id', clubId)
    .order('start_date', { ascending: false })

  return <TorneosPage torneos={torneos ?? []} clubId={clubId} />
}
