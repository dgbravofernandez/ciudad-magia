import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { ExpensesPage } from '@/features/contabilidad/components/ExpensesPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gastos' }

export default async function GastosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let clubId = await getClubId()
  if (!clubId) {
    const headersList = await headers()
    clubId = headersList.get('x-club-id') ?? ''
  }
  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members').select('club_id').eq('user_id', user.id).eq('active', true).limit(1).single()
      clubId = member?.club_id ?? ''
    }
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString().slice(0, 10)

  const { data: expensesRaw } = await sb
    .from('expenses')
    .select('*')
    .eq('club_id', clubId)
    .gte('expense_date', monthStart)
    .lte('expense_date', monthEnd)
    .order('expense_date', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expenses = (expensesRaw ?? []) as any[]
  const totalExpenses = expenses.reduce((sum: number, e: { amount: number }) => sum + (e.amount ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Gastos" />
      <div className="flex-1 p-6">
        <ExpensesPage
          clubId={clubId}
          expenses={expenses}
          totalExpensesThisMonth={totalExpenses}
        />
      </div>
    </div>
  )
}
