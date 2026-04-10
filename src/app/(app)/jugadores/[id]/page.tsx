import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { PlayerCard } from '@/features/jugadores/components/PlayerCard'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: player } = await sb
    .from('players')
    .select('first_name, last_name')
    .eq('id', id)
    .single()

  if (!player) return { title: 'Jugador no encontrado' }
  return { title: `${player.first_name} ${player.last_name}` }
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  /* ── clubId with fallback ── */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  let clubId = await getClubId()
  if (!clubId) {
    const { data: anyClub } = await sb.from('clubs').select('id').limit(1).single()
    clubId = anyClub?.id ?? ''
  }

  /* ── isAdmin / roles with fallback ── */
  const headersList = await headers()
  let memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  const memberName = headersList.get('x-member-name') ?? 'Usuario'

  if (memberRoles.length === 0) {
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

  /* ── Fetch player (no nested joins — they fail silently in production) ── */
  const { data: player } = await sb
    .from('players')
    .select('*')
    .eq('id', id)
    .eq('club_id', clubId)
    .single()

  if (!player) notFound()

  // Enrich with team data separately
  if (player.team_id) {
    const { data: team } = await sb
      .from('teams')
      .select('id, name')
      .eq('id', player.team_id)
      .single()
    player.teams = team ?? null
  } else {
    player.teams = null
  }

  // Also enrich next_team if present
  if (player.next_team_id) {
    const { data: nextTeam } = await sb
      .from('teams')
      .select('id, name')
      .eq('id', player.next_team_id)
      .single()
    player.next_team = nextTeam ?? null
  }

  /* ── Fetch related data in parallel ── */
  const [
    { data: stats },
    { data: injuries },
    { data: payments },
    { data: sanctions },
    { data: observations },
  ] = await Promise.all([
    sb
      .from('player_season_stats')
      .select('*')
      .eq('player_id', id)
      .order('season', { ascending: false }),
    sb
      .from('injuries')
      .select('*')
      .eq('player_id', id)
      .order('injured_at', { ascending: false }),
    sb
      .from('quota_payments')
      .select('*')
      .eq('player_id', id)
      .order('season', { ascending: false })
      .order('month', { ascending: false })
      .limit(24),
    sb
      .from('player_sanctions')
      .select('*')
      .eq('player_id', id)
      .eq('active', true),
    sb
      .from('player_observations')
      .select('id, category, comment, author_name, created_at')
      .eq('player_id', id)
      .order('created_at', { ascending: false }),
  ])

  const canAddInjury = memberRoles.some(r =>
    ['admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador'].includes(r)
  )

  return (
    <div className="flex flex-col h-full">
      <Topbar title={`${player.first_name} ${player.last_name}`} />
      <div className="flex-1 p-6">
        <PlayerCard
          player={player}
          stats={stats ?? []}
          injuries={injuries ?? []}
          payments={payments ?? []}
          sanctions={sanctions ?? []}
          observations={observations ?? []}
          canAddInjury={canAddInjury}
          authorName={memberName}
        />
      </div>
    </div>
  )
}
