import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { ActivitiesList } from '@/features/contabilidad/components/ActivitiesList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Actividades' }
export const dynamic = 'force-dynamic'

export default async function ActividadesPage() {
  const { clubId } = await getClubContext()
  if (!clubId) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Actividades" />
        <div className="p-6 text-sm text-muted-foreground">No autenticado.</div>
      </div>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: activities } = await sb
    .from('activities')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })

  const ids = ((activities ?? []) as Array<{ id: string }>).map((a) => a.id)

  // Totales por actividad (para cabecera rápida)
  const totals: Record<string, { income: number; paid: number; pending: number; expense: number }> = {}
  if (ids.length > 0) {
    const [{ data: charges }, { data: expenses }] = await Promise.all([
      sb.from('activity_charges').select('activity_id, amount, paid').in('activity_id', ids),
      sb.from('activity_expenses').select('activity_id, amount').in('activity_id', ids),
    ])
    for (const id of ids) {
      totals[id] = { income: 0, paid: 0, pending: 0, expense: 0 }
    }
    for (const c of (charges ?? []) as Array<{ activity_id: string; amount: number; paid: boolean }>) {
      const t = totals[c.activity_id]
      if (!t) continue
      const amount = Number(c.amount)
      t.income += amount
      if (c.paid) t.paid += amount
      else t.pending += amount
    }
    for (const e of (expenses ?? []) as Array<{ activity_id: string; amount: number }>) {
      const t = totals[e.activity_id]
      if (!t) continue
      t.expense += Number(e.amount)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Actividades" />
      <div className="flex-1 p-6">
        <ActivitiesList activities={activities ?? []} totals={totals} />
      </div>
    </div>
  )
}
