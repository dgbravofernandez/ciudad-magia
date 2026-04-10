import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { CoachesGrid } from '@/features/entrenadores/components/CoachesGrid'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cuerpo técnico' }

export default async function CoachesStaffPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  /* ── clubId: header first, then fallback to first club in DB ── */
  let clubId = await getClubId()
  if (!clubId) {
    const { data: anyClub } = await sb.from('clubs').select('id').limit(1).single()
    clubId = anyClub?.id ?? ''
  }

  /* ── isAdmin: header first, then fallback via admin client ── */
  const headersList = await headers()
  let memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]

  if (memberRoles.length === 0) {
    // Try to resolve member_id from header, else from auth user
    let memberId = headersList.get('x-member-id') ?? ''
    if (!memberId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await sb
          .from('club_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('club_id', clubId)
          .limit(1)
          .single()
        memberId = member?.id ?? ''
      }
    }
    if (memberId) {
      const { data: roles } = await sb
        .from('club_member_roles')
        .select('role')
        .eq('member_id', memberId)
      memberRoles = (roles ?? []).map((r: { role: string }) => r.role)
    }
  }

  const isAdmin = memberRoles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))

  const { data: coachRoles } = await sb
    .from('club_member_roles')
    .select('member_id, role, team_id')
    .in('role', ['entrenador', 'coordinador'])

  const coachMemberIds = [...new Set((coachRoles ?? []).map((r: { member_id: string }) => r.member_id))] as string[]

  const { data: coaches } = coachMemberIds.length > 0
    ? await sb
        .from('club_members')
        .select('*')
        .eq('club_id', clubId)
        .eq('active', true)
        .in('id', coachMemberIds)
        .order('full_name')
    : { data: [] }

  // Get team assignments from team_coaches
  const { data: teamAssignments } = coachMemberIds.length > 0
    ? await sb
        .from('team_coaches')
        .select('member_id, role, teams(id, name)')
        .in('member_id', coachMemberIds)
    : { data: [] }

  // Get session counts per coach
  const { data: sessionCounts } = coachMemberIds.length > 0
    ? await sb
        .from('sessions')
        .select('logged_by')
        .in('logged_by', coachMemberIds)
        .eq('club_id', clubId)
    : { data: [] }

  const sessionCountMap: Record<string, number> = {}
  for (const s of (sessionCounts ?? [])) {
    if (s.logged_by) sessionCountMap[s.logged_by] = (sessionCountMap[s.logged_by] ?? 0) + 1
  }

  // Build role map per member
  const roleMap: Record<string, string[]> = {}
  for (const r of (coachRoles ?? [])) {
    if (!roleMap[r.member_id]) roleMap[r.member_id] = []
    if (!roleMap[r.member_id].includes(r.role)) roleMap[r.member_id].push(r.role)
  }

  // Build team map per coach
  const teamMap: Record<string, { id: string; name: string }[]> = {}
  for (const t of (teamAssignments ?? [])) {
    if (!teamMap[t.member_id]) teamMap[t.member_id] = []
    if (t.teams) teamMap[t.member_id].push(t.teams)
  }

  // Get coordinator team assignments from club_member_roles (role=coordinador + team_id)
  const { data: coordRoleRows } = coachMemberIds.length > 0
    ? await sb
        .from('club_member_roles')
        .select('member_id, team_id, teams:team_id(id, name)')
        .eq('role', 'coordinador')
        .not('team_id', 'is', null)
        .in('member_id', coachMemberIds)
    : { data: [] }

  const coordTeamMap: Record<string, { id: string; name: string }[]> = {}
  for (const ca of (coordRoleRows ?? [])) {
    if (!coordTeamMap[ca.member_id]) coordTeamMap[ca.member_id] = []
    if (ca.teams) coordTeamMap[ca.member_id].push(ca.teams)
  }

  // Get all active teams for assignment
  const { data: allTeams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  const enrichedCoaches = (coaches ?? []).map((c: { id: string; form_sent?: boolean; form_sent_at?: string | null }) => ({
    ...c,
    roles: roleMap[c.id] ?? [],
    teams: teamMap[c.id] ?? [],
    coordinatorTeams: coordTeamMap[c.id] ?? [],
    sessionCount: sessionCountMap[c.id] ?? 0,
    form_sent: c.form_sent ?? false,
    form_sent_at: c.form_sent_at ?? null,
  }))

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Cuerpo técnico" />
      <div className="flex-1 p-6">
        <CoachesGrid coaches={enrichedCoaches} allTeams={allTeams ?? []} isAdmin={isAdmin} clubId={clubId} />
      </div>
    </div>
  )
}
