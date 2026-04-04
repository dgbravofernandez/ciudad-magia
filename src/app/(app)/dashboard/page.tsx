import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { DashboardView } from '@/features/dashboard/components/DashboardView'

export default async function DashboardPage() {
  const hdrs = await headers()
  const clubId = hdrs.get('x-club-id')!
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  // Parallel fetches
  const [playersRes, sessionsRes, paymentsRes, expensesRes] = await Promise.all([
    supabase.from('players').select('id, status').eq('club_id', clubId),
    supabase.from('sessions').select('id, date, session_type').eq('club_id', clubId).gte('date', new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from('quota_payments').select('amount, paid_at').eq('club_id', clubId).gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    sb.from('expenses').select('amount').eq('club_id', clubId).gte('date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])

  const totalPlayers = playersRes.data?.length ?? 0
  const activePlayers = playersRes.data?.filter((p: {status: string}) => p.status === 'active').length ?? 0
  const sessionsThisMonth = sessionsRes.data?.length ?? 0
  const revenueThisMonth = paymentsRes.data?.reduce((s: number, p: {amount: unknown}) => s + Number(p.amount), 0) ?? 0
  const expensesThisMonth = expensesRes.data?.reduce((s: number, e: {amount: unknown}) => s + Number(e.amount), 0) ?? 0

  return (
    <DashboardView
      totalPlayers={totalPlayers}
      activePlayers={activePlayers}
      sessionsThisMonth={sessionsThisMonth}
      revenueThisMonth={revenueThisMonth}
      expensesThisMonth={expensesThisMonth}
    />
  )
}
