import { headers, cookies } from 'next/headers'
import { createClient } from './server'
import { createAdminClient } from './admin'

/**
 * Resolves the club_id for the current user.
 * Tries middleware header first; falls back to DB lookup via verified auth session.
 * Uses getUser() (network call) for reliable session verification in Server Actions.
 *
 * MULTI-CLUB: si el usuario pertenece a varios clubs y no hay header, respeta la
 * cookie `preferred_club_id` (la que fija el selector de club). Sin cookie → el más
 * reciente. NUNCA usar `.single()` aquí: con 2+ membresías PostgREST lanza error.
 */
async function lookupMemberBySession(): Promise<{ id: string; club_id: string } | null> {
  const supabase = await createClient()
  // getUser() makes a network call to verify the token — more reliable than getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members } = await (admin as any)
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })

  const list = (members ?? []) as { id: string; club_id: string }[]
  if (list.length === 0) return null
  if (list.length === 1) return list[0]

  // Varios clubs → respetar el club preferido (cookie del selector)
  try {
    const cookieStore = await cookies()
    const preferred = cookieStore.get('preferred_club_id')?.value
    if (preferred) {
      const match = list.find(m => m.club_id === preferred)
      if (match) return match
    }
  } catch {
    // cookies() no disponible en algún contexto — usar el más reciente
  }
  return list[0]
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
