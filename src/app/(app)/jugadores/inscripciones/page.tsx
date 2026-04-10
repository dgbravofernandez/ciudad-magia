import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { InscripcionesTable } from '@/features/jugadores/components/InscripcionesTable'
import { Topbar } from '@/components/layout/Topbar'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Seguimiento de inscripciones' }

export default async function InscripcionesPage() {
  const clubId = await getClubId()
  const supabase = await createClient()
  const headersList = await headers()
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  const isAdmin = memberRoles.some(r => ['admin', 'direccion'].includes(r))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [playersResult, teamsResult] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('players')
      .select('*, teams:team_id(id, name), next_team:next_team_id(id, name)')
      .eq('club_id', clubId)
      .neq('status', 'low')
      .order('last_name'),
    supabase
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name'),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players = (playersResult.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teams = (teamsResult.data ?? []) as { id: string; name: string }[]

  // Build coachMap: team_id → first coach name
  const teamIds = (teams ?? []).map((t: { id: string }) => t.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: coachRows } = teamIds.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await (supabase as any)
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

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Seguimiento de inscripciones" />
      <div className="flex-1 p-6">
        <InscripcionesTable players={players} teams={teams} coachMap={coachMap} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
