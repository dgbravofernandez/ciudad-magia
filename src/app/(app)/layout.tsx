import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ClubProvider } from '@/context/ClubContext'
import { UserProvider } from '@/context/UserContext'
import { ClubThemeProvider } from '@/components/layout/ClubThemeProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import type { Role } from '@/types/roles'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  let clubId = headersList.get('x-club-id')
  let memberId = headersList.get('x-member-id')
  let rolesHeader = headersList.get('x-user-roles')

  const adminClient = createAdminClient()

  // Fallback: if middleware headers missing, look up from session directly
  if (!clubId || !memberId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: memberRow } = await adminClient
      .from('club_members')
      .select('id, club_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!memberRow) redirect('/login')

    const { data: roleRows } = await adminClient
      .from('club_member_roles')
      .select('role')
      .eq('member_id', memberRow.id)

    clubId = memberRow.club_id
    memberId = memberRow.id
    rolesHeader = JSON.stringify((roleRows ?? []).map((r: { role: string }) => r.role))
  }

  const roles: Role[] = rolesHeader ? JSON.parse(rolesHeader) : []
  const supabase = adminClient

  // Fetch club data
  const [{ data: club }, { data: settings }, { data: member }] =
    await Promise.all([
      supabase.from('clubs').select('*').eq('id', clubId).single(),
      supabase.from('club_settings').select('*').eq('club_id', clubId).single(),
      supabase.from('club_members').select('*').eq('id', memberId).single(),
    ])

  if (!club || !member) {
    redirect('/login?error=no_club')
  }

  return (
    <ClubProvider value={{ club, settings }}>
      <UserProvider member={member} roles={roles}>
        <ClubThemeProvider club={club} />
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col lg:ml-64 overflow-hidden">
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </UserProvider>
    </ClubProvider>
  )
}
