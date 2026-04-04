import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { CashRegisterPage } from '@/features/contabilidad/components/CashRegisterPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Caja' }

export default async function CajaPage() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!
  const memberId = headersList.get('x-member-id')!

  const supabase = await createClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  // Fetch cash movements for current month
  const { data: movements } = await supabase
    .from('cash_movements')
    .select('*')
    .eq('club_id', clubId)
    .gte('movement_date', monthStart)
    .lte('movement_date', monthEnd)
    .order('movement_date', { ascending: false })

  // Fetch cash close history
  const { data: closes } = await supabase
    .from('cash_closes')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Calculate system totals from movements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movs = (movements ?? []) as any[]
  const systemCash = movs
    .filter((m) => m.payment_method === 'efectivo')
    .reduce((sum: number, m) => sum + (m.type === 'income' ? m.amount : -m.amount), 0)

  const systemCard = movs
    .filter((m) => m.payment_method === 'tarjeta')
    .reduce((sum: number, m) => sum + (m.type === 'income' ? m.amount : -m.amount), 0)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Cierre de Caja" />
      <div className="flex-1 p-6">
        <CashRegisterPage
          clubId={clubId}
          memberId={memberId}
          systemCash={systemCash}
          systemCard={systemCard}
          periodStart={monthStart}
          periodEnd={monthEnd}
          closes={closes ?? []}
        />
      </div>
    </div>
  )
}
