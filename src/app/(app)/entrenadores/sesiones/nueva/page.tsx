import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
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
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  const memberId = headersList.get('x-member-id')!

  const supabase = await createClient()

  let teamsQuery = supabase
    .from('teams')
    .select('id, name, season')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  // Coaches only see their teams
  if (
    memberRoles.includes('entrenador') &&
    !memberRoles.some((r: string) => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))
  ) {
    const { data: coachTeams } = await supabase
      .from('team_coaches')
      .select('team_id')
      .eq('member_id', memberId)
    const teamIds = (coachTeams ?? []).map((t) => t.team_id)
    if (teamIds.length > 0) {
      teamsQuery = teamsQuery.in('id', teamIds)
    }
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
