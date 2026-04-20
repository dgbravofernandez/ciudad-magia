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

  // Get ALL club members (staff) — not just those with entrenador/coordinador role
  const { data: coaches } = await sb
    .from('club_members')
    .select('*')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('full_name')

  const allMemberIds = (coaches ?? []).map((c: { id: string }) => c.id) as string[]

  // Get all roles for these members
  const { data: coachRoles } = allMemberIds.length > 0
    ? await sb
        .from('club_member_roles')
        .select('member_id, role, team_id')
        .in('member_id', allMemberIds)
    : { data: [] }

  // Get ALL teams (active + inactive) — so joins no dejan huecos si el team está marcado inactivo
  const { data: allTeamsRaw } = await sb
    .from('teams')
    .select('id, name, active')
    .eq('club_id', clubId)
    .order('name')
  const teamsById: Record<string, { id: string; name: string }> = {}
  for (const t of (allTeamsRaw ?? []) as Array<{ id: string; name: string; active: boolean }>) {
    teamsById[t.id] = { id: t.id, name: t.name }
  }

  // Team assignments from team_coaches — sin embed, join manual en JS
  const { data: teamAssignments } = allMemberIds.length > 0
    ? await sb
        .from('team_coaches')
        .select('member_id, role, team_id')
        .in('member_id', allMemberIds)
    : { data: [] }

  // Get session counts per coach
  const { data: sessionCounts } = allMemberIds.length > 0
    ? await sb
        .from('sessions')
        .select('logged_by')
        .in('logged_by', allMemberIds)
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

  // Build team maps: entrenador → teamMap, coordinador → coordTeamMap
  // Fuente primaria: team_coaches.role (['entrenador','coordinador'])
  // Fuente secundaria: club_member_roles.team_id (cuando un coordinador tiene team asignado por rol)
  const teamMap: Record<string, { id: string; name: string }[]> = {}
  const coordTeamMap: Record<string, { id: string; name: string }[]> = {}

  function addTo(
    map: Record<string, { id: string; name: string }[]>,
    memberId: string,
    teamId: string | null | undefined
  ) {
    if (!memberId || !teamId) return
    const team = teamsById[teamId]
    if (!team) return
    if (!map[memberId]) map[memberId] = []
    if (!map[memberId].some((t) => t.id === team.id)) map[memberId].push(team)
  }

  for (const t of (teamAssignments ?? []) as Array<{ member_id: string; role: string | null; team_id: string }>) {
    const role = (t.role ?? 'entrenador').toLowerCase()
    if (role === 'coordinador') addTo(coordTeamMap, t.member_id, t.team_id)
    else addTo(teamMap, t.member_id, t.team_id)
  }

  // club_member_roles.team_id como refuerzo (ej: un coordinador tiene team_id en su rol)
  for (const r of (coachRoles ?? []) as Array<{ member_id: string; role: string; team_id: string | null }>) {
    if (!r.team_id) continue
    const role = r.role.toLowerCase()
    if (role === 'coordinador' || role === 'director_deportivo') addTo(coordTeamMap, r.member_id, r.team_id)
    else if (role === 'entrenador') addTo(teamMap, r.member_id, r.team_id)
  }

  const allTeams = (allTeamsRaw ?? [])
    .filter((t: { active: boolean }) => t.active !== false)
    .map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))

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
