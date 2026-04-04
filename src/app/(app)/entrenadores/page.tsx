import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { TeamsOverview } from '@/features/entrenadores/components/TeamsOverview'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Entrenadores' }

export default async function EntrenadoresPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  const memberId = headersList.get('x-member-id')!

  const supabase = await createClient()

  // Get teams with their coaches
  let teamsQuery = supabase
    .from('teams')
    .select(`
      *,
      team_coaches(
        member_id,
        club_members(full_name, email)
      )
    `)
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  // Coaches only see their own teams
  if (memberRoles.includes('entrenador') && !memberRoles.some((r: string) => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))) {
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

  // Get last and next sessions per team
  const teamIds = (teams ?? []).map((t) => t.id)

  let lastSessions: Record<string, string> = {}
  let nextSessions: Record<string, string> = {}

  if (teamIds.length > 0) {
    const now = new Date().toISOString()

    const { data: past } = await supabase
      .from('sessions')
      .select('id, team_id, session_date, session_type')
      .in('team_id', teamIds)
      .lt('session_date', now)
      .order('session_date', { ascending: false })

    const { data: future } = await supabase
      .from('sessions')
      .select('id, team_id, session_date, session_type')
      .in('team_id', teamIds)
      .gte('session_date', now)
      .order('session_date', { ascending: true })

    for (const s of past ?? []) {
      if (!lastSessions[s.team_id]) lastSessions[s.team_id] = s.session_date
    }
    for (const s of future ?? []) {
      if (!nextSessions[s.team_id]) nextSessions[s.team_id] = s.session_date
    }
  }

  // Get observations summary for coordinators
  const { data: observations } = await supabase
    .from('coordinator_observations')
    .select('team_id, nivel_rating, ajeno_rating, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Entrenadores" />
      <div className="flex-1 p-6">
        <TeamsOverview
          teams={teams ?? []}
          lastSessions={lastSessions}
          nextSessions={nextSessions}
          observations={observations ?? []}
          memberRoles={memberRoles}
          memberId={memberId}
        />
      </div>
    </div>
  )
}
