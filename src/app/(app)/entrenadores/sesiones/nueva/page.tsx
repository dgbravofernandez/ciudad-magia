import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { SessionForm } from '@/features/entrenadores/components/SessionForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Nueva Sesión' }

export default async function NuevaSesionPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const params = await searchParams
  const { clubId, memberId, roles } = await getClubContext()
  const supabase = createAdminClient()

  // Build teams query
  let teamsQuery = supabase
    .from('teams')
    .select('id, name, season')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  // Coaches only see their teams (fallback to all teams if no assignment found)
  if (
    roles.includes('entrenador') &&
    !roles.some((r: string) => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))
  ) {
    const { data: coachTeams } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('member_id', memberId)
    const teamIds = (coachTeams ?? []).map((t: { team_id: string }) => t.team_id)
    // If coach has assigned teams, filter to those; otherwise show all (graceful fallback)
    if (teamIds.length > 0) {
      teamsQuery = teamsQuery.in('id', teamIds)
    }
    // If teamIds is empty, show all club teams so the coach can still create a session
  }

  const { data: teams } = await teamsQuery

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Nueva Sesión" />
      <div className="flex-1 p-6 max-w-2xl">
        <SessionForm teams={teams ?? []} defaultTeamId={params.team} />
      </div>
    </div>
  )
}
