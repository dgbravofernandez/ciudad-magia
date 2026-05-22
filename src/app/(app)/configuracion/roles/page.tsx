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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Paso 1: miembros + equipos en paralelo (sin joins anidados)
  const [{ data: rawMembers, error: membersErr }, { data: teams }] = await Promise.all([
    sb
      .from('club_members')
      .select('id, full_name, email, phone, active, created_at, user_id')
      .eq('club_id', clubId)
      .order('full_name'),
    sb
      .from('teams')
      .select('id, name')
      .eq('club_id', clubId)
      .order('name'),
  ])

  if (membersErr) {
    console.error('[RolesPage] Error loading members:', membersErr)
  }

  // Paso 2: roles para estos miembros concretos
  const memberIds: string[] = (rawMembers ?? []).map((m: { id: string }) => m.id)
  const { data: rawRoles } = memberIds.length > 0
    ? await sb.from('club_member_roles').select('member_id, role, team_id').in('member_id', memberIds)
    : { data: [] }

  // Agrupar roles por member_id
  const rolesByMember: Record<string, { role: string; team_id: string | null }[]> = {}
  for (const r of (rawRoles ?? [])) {
    if (!rolesByMember[r.member_id]) rolesByMember[r.member_id] = []
    rolesByMember[r.member_id].push({ role: r.role, team_id: r.team_id ?? null })
  }

  const members = (rawMembers ?? []).map((m: {
    id: string; full_name: string; email: string | null; phone: string | null;
    active: boolean; created_at: string; user_id: string | null
  }) => ({
    ...m,
    club_member_roles: rolesByMember[m.id] ?? [],
  }))

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Roles y accesos" />
      <div className="flex-1 p-6">
        <MembersPage members={members as never} teams={teams ?? []} />
      </div>
    </div>
  )
}
