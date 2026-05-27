import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ClubProvider } from '@/context/ClubContext'
import { UserProvider } from '@/context/UserContext'
import { ClubThemeProvider } from '@/components/layout/ClubThemeProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner'
import { TrialBanner } from '@/components/layout/TrialBanner'
import type { Role } from '@/types/roles'

// Nunca cachear el layout — necesitamos datos frescos de member.must_change_password
export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  let clubId = headersList.get('x-club-id')
  let memberId = headersList.get('x-member-id')
  let rolesHeader = headersList.get('x-user-roles')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any

  // Fallback: if middleware headers missing, look up from session directly
  if (!clubId || !memberId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login?e=L1_nouser')

    const { data: memberRow, error: memberErr } = await adminClient
      .from('club_members')
      .select('id, club_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!memberRow) redirect(`/login?e=L2_nomember&err=${encodeURIComponent(memberErr?.message ?? 'unknown')}`)

    const { data: roleRows } = await adminClient
      .from('club_member_roles')
      .select('role')
      .eq('member_id', memberRow.id)

    clubId = memberRow.club_id
    memberId = memberRow.id
    rolesHeader = JSON.stringify((roleRows ?? []).map((r: { role: string }) => r.role))
  }

  const roles: Role[] = rolesHeader ? JSON.parse(rolesHeader) : []
  const isImpersonating = headersList.get('x-impersonating') === 'true'
  const supabase = adminClient

  // Fetch club data
  const [{ data: club }, { data: settings }, { data: member }] =
    await Promise.all([
      supabase.from('clubs').select('*').eq('id', clubId!).single(),
      supabase.from('club_settings').select('*').eq('club_id', clubId!).single(),
      supabase.from('club_members').select('*').eq('id', memberId!).single(),
    ])

  if (!club || !member) {
    redirect(`/login?e=L3_noclub&cid=${clubId?.substring(0,8)}&mid=${memberId?.substring(0,8)}`)
  }

  // Forzar cambio de contraseña en el primer login (cuenta creada por admin)
  if (member.must_change_password) {
    redirect('/cambiar-password')
  }

  return (
    <ClubProvider value={{ club, settings }}>
      <UserProvider member={member} roles={roles}>
        <ClubThemeProvider club={club} />
        {isImpersonating && (
          <ImpersonationBanner clubName={club.name} />
        )}
        <Suspense>
          <TrialBanner />
        </Suspense>
        <div className={`flex h-screen overflow-hidden bg-background ${isImpersonating ? 'pt-10' : ''}`}>
          <Sidebar />
          <div className="flex-1 flex flex-col lg:ml-64 overflow-hidden">
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </UserProvider>
    </ClubProvider>
  )
}
