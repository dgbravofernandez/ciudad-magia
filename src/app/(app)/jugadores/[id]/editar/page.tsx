import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { notFound } from 'next/navigation'
import { PlayerForm } from '@/features/jugadores/components/PlayerForm'
import { Topbar } from '@/components/layout/Topbar'

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  let clubId = await getClubId()
  if (!clubId) notFound()

  const [{ data: player }, { data: currentTeams }, { data: nextTeams }] = await Promise.all([
    sb
      .from('players')
      .select('*')
      .eq('id', id)
      .eq('club_id', clubId)
      .single(),
    // Equipos temporada actual (active=true)
    sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name'),
    // Equipos próxima temporada (active=false, season 26/27)
    sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', false)
      .order('name'),
  ])

  if (!player) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = player as any

  return (
    <div className="flex flex-col h-full">
      <Topbar title={`Editar — ${p.first_name} ${p.last_name}`} />
      <div className="flex-1 p-6">
        <PlayerForm player={p} teams={currentTeams ?? []} nextTeams={nextTeams ?? []} />
      </div>
    </div>
  )
}
