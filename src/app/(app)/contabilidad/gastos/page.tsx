import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { ExpensesPage } from '@/features/contabilidad/components/ExpensesPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Gastos' }

export default async function GastosPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const supabase = await createClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('club_id', clubId)
    .gte('expense_date', monthStart.slice(0, 10))
    .lte('expense_date', monthEnd.slice(0, 10))
    .order('expense_date', { ascending: false })

  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Gastos" />
      <div className="flex-1 p-6">
        <ExpensesPage
          clubId={clubId}
          expenses={expenses ?? []}
          totalExpensesThisMonth={totalExpenses}
        />
      </div>
    </div>
  )
}
