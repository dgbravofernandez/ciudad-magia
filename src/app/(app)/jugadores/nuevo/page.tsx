import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { PlayerForm } from '@/features/jugadores/components/PlayerForm'
import { Topbar } from '@/components/layout/Topbar'

export default async function NewPlayerPage() {
  const clubId = await getClubId()
  const supabase = await createClient()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Nuevo jugador" />
      <div className="flex-1 p-6">
        <PlayerForm teams={teams ?? []} />
      </div>
    </div>
  )
}
