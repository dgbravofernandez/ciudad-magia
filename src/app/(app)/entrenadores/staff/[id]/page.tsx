import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { CoachCard } from '@/features/entrenadores/components/CoachCard'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('club_members').select('full_name').eq('id', id).single()
  return { title: data?.full_name ?? 'Entrenador/a' }
}

export default async function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const clubId = await getClubId()
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const headersList = await headers()
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  const isAdmin = memberRoles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))

  const { data: member } = await sb
    .from('club_members')
    .select('*')
    .eq('id', id)
    .eq('club_id', clubId)
    .single()

  if (!member) notFound()

  const [
    { data: roles },
    { data: teamAssignments },
    { data: sessions },
    { data: observations },
    { data: allTeams },
    { data: coordAssignments },
  ] = await Promise.all([
    sb.from('club_member_roles').select('role, team_id').eq('member_id', id),
    sb.from('team_coaches').select('team_id, role, teams(id, name, categories(name))').eq('member_id', id),
    sb.from('sessions')
      .select('id, session_type, session_date, opponent, score_home, score_away, team_id, teams(name)')
      .eq('logged_by', id)
      .eq('club_id', clubId)
      .order('session_date', { ascending: false })
      .limit(50),
    sb.from('coordinator_observations')
      .select('id, team_id, nivel_rating, ajeno_rating, notes, created_at, period, season, teams(name)')
      .eq('observer_id', id)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(40),
    sb.from('teams').select('id, name').eq('club_id', clubId).eq('active', true).order('name'),
    sb.from('coordinator_team_assignments')
      .select('team_id, teams(id, name, categories(name))')
      .eq('member_id', id),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title={member.full_name} />
      <div className="flex-1 p-6">
        <CoachCard
          member={member}
          roles={roles ?? []}
          teamAssignments={teamAssignments ?? []}
          coordAssignments={coordAssignments ?? []}
          sessions={sessions ?? []}
          observations={observations ?? []}
          allTeams={allTeams ?? []}
          isAdmin={isAdmin}
          clubId={clubId}
        />
      </div>
    </div>
  )
}
