import { headers } from 'next/headers'
import { createClient } from './server'
import { createAdminClient } from './admin'

/**
 * Resolves the club_id for the current user.
 * Tries middleware header first; falls back to DB lookup via verified auth session.
 * Uses getUser() (network call) for reliable session verification in Server Actions.
 */
async function lookupMemberBySession(): Promise<{ id: string; club_id: string } | null> {
  const supabase = await createClient()
  // getUser() makes a network call to verify the token — more reliable than getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (admin as any)
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  return member ?? null
}

export async function getClubId(): Promise<string> {
  const headersList = await headers()
  const fromHeader = headersList.get('x-club-id') ?? ''
  if (fromHeader) return fromHeader

  const member = await lookupMemberBySession()
  return member?.club_id ?? ''
}

export async function getClubContext(): Promise<{
  clubId: string
  memberId: string
  roles: string[]
}> {
  const headersList = await headers()
  const fromHeader = headersList.get('x-club-id') ?? ''
  const memberIdHeader = headersList.get('x-member-id') ?? ''
  const rolesHeader = headersList.get('x-user-roles') ?? '[]'

  if (fromHeader && memberIdHeader) {
    return {
      clubId: fromHeader,
      memberId: memberIdHeader,
      roles: JSON.parse(rolesHeader) as string[],
    }
  }

  const member = await lookupMemberBySession()
  if (!member) return { clubId: '', memberId: '', roles: [] }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roleRows } = await (admin as any)
    .from('club_member_roles')
    .select('role')
    .eq('member_id', member.id)

  return {
    clubId: member.club_id ?? '',
    memberId: member.id ?? '',
    roles: (roleRows ?? []).map((r: { role: string }) => r.role),
  }
}
