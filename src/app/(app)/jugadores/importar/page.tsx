import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { ImportarJugadores } from '@/features/jugadores/components/ImportarJugadores'

export default async function ImportarPage() {
  const clubId = await getClubId()
  const supabase = createAdminClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  return <ImportarJugadores clubId={clubId} teams={teams ?? []} />
}
