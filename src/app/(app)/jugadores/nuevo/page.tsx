import { getClubId } from '@/lib/supabase/get-club-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlayerForm } from '@/features/jugadores/components/PlayerForm'
import { Topbar } from '@/components/layout/Topbar'

function bumpSeason(season: string): string {
  const m = season.match(/^(\d{4})\/(\d{2})$/)
  if (m) {
    const y1 = parseInt(m[1]) + 1
    const y2short = parseInt(m[2])
    const y2full = y2short >= 90 ? 1900 + y2short : 2000 + y2short
    return `${y1}/${String(y2full + 1).slice(-2)}`
  }
  return season
}

export default async function NewPlayerPage() {
  const clubId = await getClubId()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Temporada actual → calcular la siguiente
  const { data: settings } = await sb
    .from('club_settings')
    .select('current_season')
    .eq('club_id', clubId)
    .single()

  const currentSeason: string = settings?.current_season ?? '2025/26'
  const nextSeason = bumpSeason(currentSeason)

  // Equipos de la próxima temporada (borrador, active=false)
  const { data: nextTeams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('season', nextSeason)
    .order('name')

  // Fallback: si no hay equipos 26/27, mostrar los activos actuales
  let teams = nextTeams ?? []
  if (teams.length === 0) {
    const { data: activeTeams } = await sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name')
    teams = activeTeams ?? []
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Nuevo jugador" />
      <div className="flex-1 p-6">
        <PlayerForm teams={teams} nextSeason={nextSeason} />
      </div>
    </div>
  )
}
