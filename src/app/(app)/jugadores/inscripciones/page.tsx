import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InscripcionesTable } from '@/features/jugadores/components/InscripcionesTable'
import { Topbar } from '@/components/layout/Topbar'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Seguimiento de inscripciones' }
export const maxDuration = 30

export default async function InscripcionesPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Resolve clubId
  const headersList = await headers()
  let clubId = headersList.get('x-club-id') ?? ''
  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members').select('club_id').eq('user_id', user.id).eq('active', true).single()
      clubId = member?.club_id ?? ''
    }
  }
  if (!clubId) {
    const { data: anyClub } = await sb.from('clubs').select('id').limit(1).single()
    clubId = anyClub?.id ?? ''
  }

  // Resolve isAdmin
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  let isAdmin = memberRoles.some(r => ['admin', 'direccion'].includes(r))
  if (!isAdmin && memberRoles.length === 0) {
    const memberId = headersList.get('x-member-id') ?? ''
    if (memberId) {
      const { data: roles } = await sb
        .from('club_member_roles').select('role').eq('member_id', memberId)
      isAdmin = (roles ?? []).some((r: { role: string }) => ['admin', 'direccion'].includes(r.role))
    }
  }

  const [playersResult, teamsResult] = await Promise.all([
    sb
      .from('players')
      .select('*, teams:team_id(id, name), next_team:next_team_id(id, name)')
      .eq('club_id', clubId)
      .neq('status', 'low')
      .order('last_name'),
    sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name'),
  ])
  const players = (playersResult.data ?? []) as any[]
  const teams = (teamsResult.data ?? []) as { id: string; name: string }[]

  // Build coachMap: team_id → first coach name
  const teamIds = teams.map((t: { id: string }) => t.id)
  const { data: coachRows } = teamIds.length > 0
    ? await sb
        .from('team_coaches')
        .select('team_id, club_members(full_name)')
        .in('team_id', teamIds)
    : { data: [] }

  const coachMap: Record<string, string> = {}
  for (const row of (coachRows ?? [])) {
    if (!coachMap[row.team_id] && row.club_members?.full_name) {
      coachMap[row.team_id] = row.club_members.full_name
    }
  }

  // Get player IDs that have trial letters
  const { getTrialLetterPlayerIds } = await import('@/features/jugadores/actions/player.actions')
  const trialLetterPlayerIds = await getTrialLetterPlayerIds(clubId)
  const trialLetterIds = Array.from(trialLetterPlayerIds)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Seguimiento de inscripciones" />
      <div className="flex-1 p-6">
        <InscripcionesTable
          players={players}
          teams={teams}
          coachMap={coachMap}
          isAdmin={isAdmin}
          trialLetterPlayerIds={trialLetterIds}
        />
      </div>
    </div>
  )
}
