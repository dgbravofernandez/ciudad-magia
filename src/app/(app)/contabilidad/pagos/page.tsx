import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { PaymentRegistration } from '@/features/contabilidad/components/PaymentRegistration'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pagos de Cuotas' }

export default async function PagosPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // KPI: total paid this month
  const { data: paidThisMonth } = await supabase
    .from('quota_payments')
    .select('amount_paid')
    .eq('club_id', clubId)
    .eq('status', 'paid')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)

  const totalPaidThisMonth = (paidThisMonth ?? []).reduce((sum, p) => sum + (p.amount_paid ?? 0), 0)

  // KPI: total pending
  const { data: pendingPayments } = await supabase
    .from('quota_payments')
    .select('amount_due, amount_paid')
    .eq('club_id', clubId)
    .eq('status', 'pending')

  const totalPending = (pendingPayments ?? []).reduce(
    (sum, p) => sum + ((p.amount_due ?? 0) - (p.amount_paid ?? 0)),
    0
  )

  // KPI: players with debt (distinct player_ids with pending payments)
  const { data: playersWithDebt } = await supabase
    .from('quota_payments')
    .select('player_id')
    .eq('club_id', clubId)
    .eq('status', 'pending')

  const uniqueDebtors = new Set((playersWithDebt ?? []).map((p) => p.player_id)).size

  // All players with their payment status for current season
  const season = getCurrentSeason()
  const { data: players } = await supabase
    .from('players')
    .select(`
      id,
      first_name,
      last_name,
      dni,
      tutor_email,
      tutor_name,
      teams(id, name)
    `)
    .eq('club_id', clubId)
    .eq('status', 'active')
    .order('last_name')

  const { data: seasonPayments } = await supabase
    .from('quota_payments')
    .select('*')
    .eq('club_id', clubId)
    .eq('season', season)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Pagos de Cuotas" />
      <div className="flex-1 p-6">
        <PaymentRegistration
          clubId={clubId}
          totalPaidThisMonth={totalPaidThisMonth}
          totalPending={totalPending}
          playersWithDebtCount={uniqueDebtors}
          players={players ?? []}
          payments={seasonPayments ?? []}
        />
      </div>
    </div>
  )
}

function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 9) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}
