import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { Topbar } from '@/components/layout/Topbar'
import { MembersPage } from '@/features/configuracion/components/MembersPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Roles y accesos' }
export const dynamic = 'force-dynamic'

export default async function RolesPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const sb = createAdminClient()

  const [{ data: members }, { data: teams }] = await Promise.all([
    sb
      .from('club_members')
      .select(`
        id, full_name, email, phone, active, created_at, user_id,
        club_member_roles(role, team_id, teams(name))
      `)
      .eq('club_id', clubId)
      .order('full_name'),
    sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name'),
  ])

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Roles y accesos" />
      <div className="flex-1 p-6">
        <MembersPage members={(members ?? []) as never} teams={teams ?? []} />
      </div>
    </div>
  )
}
