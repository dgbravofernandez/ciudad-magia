import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { TorneosPage } from '@/features/torneos/components/TorneosPage'

export const dynamic = 'force-dynamic'

export default async function Torneos() {
  const { clubId } = await getClubContext()
  const supabase = createAdminClient()

  const { data: torneos } = await supabase
    .from('tournaments')
    .select('*')
    .eq('club_id', clubId)
    .order('start_date', { ascending: false })

  return <TorneosPage torneos={torneos ?? []} clubId={clubId} />
}
