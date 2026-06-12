import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
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

  // Resolución robusta multi-club (header → cookie preferida → más reciente),
  // idéntica a la de las páginas para que cabecera y contenido muestren el MISMO club.
  const { clubId, memberId, roles: ctxRoles } = await getClubContext()
  if (!clubId || !memberId) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminClient = createAdminClient() as any

  const roles = ctxRoles as Role[]
  const isImpersonating = headersList.get('x-impersonating') === 'true'
  const isSuperAdmin = headersList.get('x-platform-role') === 'superadmin'
  const supabase = adminClient

  // Fetch club data
  const [{ data: club }, { data: settings }, { data: member }] =
    await Promise.all([
      supabase.from('clubs').select('*').eq('id', clubId!).single(),
      supabase.from('club_settings').select('*').eq('club_id', clubId!).single(),
      supabase.from('club_members').select('*').eq('id', memberId!).single(),
    ])

  if (!club || !member) {
    redirect('/login?error=no_club')
  }

  // Forzar cambio de contraseña en el primer login (cuenta creada por admin)
  if (member.must_change_password) {
    redirect('/cambiar-password')
  }

  return (
    <ClubProvider value={{ club, settings }}>
      <UserProvider member={member} roles={roles} isSuperAdmin={isSuperAdmin}>
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
