import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { Topbar } from '@/components/layout/Topbar'
import { ActivityDetail } from '@/features/contabilidad/components/ActivityDetail'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Actividad' }
export const dynamic = 'force-dynamic'

export default async function ActividadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { clubId } = await getClubContext()
  if (!clubId) return <div className="p-6 text-sm">No autenticado</div>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [{ data: activity }, { data: charges }, { data: expenses }, { data: players }] =
    await Promise.all([
      sb.from('activities').select('*').eq('id', id).eq('club_id', clubId).single(),
      sb
        .from('activity_charges')
        .select('*')
        .eq('activity_id', id)
        .order('created_at', { ascending: false }),
      sb
        .from('activity_expenses')
        .select('*')
        .eq('activity_id', id)
        .order('expense_date', { ascending: false }),
      sb
        .from('players')
        .select('id, first_name, last_name')
        .eq('club_id', clubId)
        .neq('status', 'low')
        .order('last_name'),
    ])

  if (!activity) {
    return (
      <div className="flex flex-col h-full">
        <Topbar title="Actividad" />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Actividad no encontrada.</p>
          <Link href="/contabilidad/actividades" className="text-sm text-blue-600 hover:underline">
            ← Volver
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title={activity.name} />
      <div className="flex-1 p-6">
        <ActivityDetail
          activity={activity}
          charges={charges ?? []}
          expenses={expenses ?? []}
          players={(players ?? []) as Array<{ id: string; first_name: string; last_name: string }>}
        />
      </div>
    </div>
  )
}
