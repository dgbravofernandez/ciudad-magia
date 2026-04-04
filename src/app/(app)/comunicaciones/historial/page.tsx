import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { HistorialComunicaciones } from '@/features/comunicaciones/components/HistorialComunicaciones'

export default async function HistorialPage() {
  const hdrs = await headers()
  const clubId = hdrs.get('x-club-id')!
  const supabase = await createClient()

  const { data: comms } = await supabase
    .from('communications')
    .select('*, communication_recipients(count)')
    .eq('club_id', clubId)
    .order('sent_at', { ascending: false })
    .limit(50)

  return <HistorialComunicaciones communications={comms ?? []} />
}
