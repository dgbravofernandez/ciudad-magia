import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { InfanciaPage } from '@/features/personal/infancia/components/InfanciaPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Coordinador de Infancia' }

export default async function InfanciaPageRoute() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  // Fetch unresolved incidents, high severity first
  const { data: incidents } = await supabase
    .from('session_incidents')
    .select(`
      *,
      teams(id, name)
    `)
    .eq('club_id', clubId)
    .eq('resolved', false)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  // Fetch meeting proposals for this club
  const { data: meetings } = await supabase
    .from('meeting_proposals')
    .select(`
      *,
      proposer:proposed_by(full_name),
      target:target_member_id(full_name)
    `)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch coordinadores for the meeting form
  const { data: coordinators } = await supabase
    .from('club_members')
    .select(`
      id,
      full_name,
      club_member_roles(role)
    `)
    .eq('club_id', clubId)
    .eq('active', true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coordinatorMembers = (coordinators ?? []).filter((m: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m.club_member_roles as Array<{ role: string }>)?.some((r: any) =>
      ['admin', 'coordinador', 'direccion', 'infancia'].includes(r.role)
    )
  )

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Coordinador de Infancia" />
      <div className="flex-1 p-6">
        <InfanciaPage
          incidents={incidents ?? []}
          meetings={meetings ?? []}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          coordinators={coordinatorMembers.map((m: any) => ({ id: m.id, full_name: m.full_name }))}
        />
      </div>
    </div>
  )
}
