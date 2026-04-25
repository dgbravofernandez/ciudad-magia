import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { BankTransfersPage } from '@/features/contabilidad/components/BankTransfersPage'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Transferencias bancarias' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function TransferenciasPage() {
  const { clubId, roles } = await getClubContext()
  const canManage = roles.some(r => ['admin', 'direccion'].includes(r))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [{ data: transfers }, { data: uploads }, { data: players }, { data: teams }] = await Promise.all([
    sb.from('bank_transfers')
      .select('*')
      .eq('club_id', clubId)
      .order('transfer_date', { ascending: false })
      .limit(500),
    sb.from('bank_transfer_uploads')
      .select('*')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })
      .limit(50),
    sb.from('players')
      .select('id, first_name, last_name, tutor_name, team_id')
      .eq('club_id', clubId)
      .neq('status', 'low')
      .order('last_name'),
    sb.from('teams')
      .select('id, name')
      .eq('club_id', clubId),
  ])

  const teamMap: Record<string, string> = {}
  for (const t of (teams ?? [])) teamMap[t.id] = t.name

  const enrichedPlayers = (players ?? []).map((p: { id: string; first_name: string; last_name: string; tutor_name: string | null; team_id: string | null }) => ({
    ...p,
    team_name: p.team_id ? teamMap[p.team_id] ?? null : null,
  }))

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Transferencias bancarias" />
      <div className="flex-1 p-6">
        <BankTransfersPage
          canManage={canManage}
          transfers={transfers ?? []}
          uploads={uploads ?? []}
          players={enrichedPlayers}
        />
      </div>
    </div>
  )
}
