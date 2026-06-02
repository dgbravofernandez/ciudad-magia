import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { CuotasConfig } from '@/features/configuracion/components/CuotasConfig'
import { SeasonFeesManager } from '@/features/configuracion/components/SeasonFeesManager'
import { FeeCalculator, type FeePlan } from '@/features/configuracion/components/FeeCalculator'
import { Topbar } from '@/components/layout/Topbar'
import { getActiveSeasons } from '@/lib/utils/currency'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configuracion de Cuotas' }

export default async function CuotasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let clubId = await getClubId()
  if (!clubId) {
    const hdrs = await headers()
    clubId = hdrs.get('x-club-id') ?? ''
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

  // Cargar settings, equipos y season_fees en paralelo
  const [settingsRes, teamsRes] = await Promise.all([
    sb.from('club_settings').select('*').eq('club_id', clubId).single(),
    sb.from('teams').select('id, name, active').eq('club_id', clubId).order('name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = settingsRes.data as any
  const siblingDiscountPct     = settings?.sibling_discount_percent ?? 40
  const earlyPaymentDiscountPct = 5  // TODO: añadir campo a club_settings si clubs lo necesitan personalizar

  // Construir FeePlan[] desde season_fees de la temporada activa o la siguiente
  // Buscamos en 2026/27 primero, luego en current_season como fallback
  const targetSeason = '2026/27'
  const { data: rawFees } = await sb
    .from('season_fees')
    .select('id, concept, amount, team_id, sort_order')
    .eq('club_id', clubId)
    .eq('season', targetSeason)
    .order('sort_order', { ascending: true })

  // Construir planes: agrupar por team_id, derivar reserva + cuotas + pcTotal
  const plans: FeePlan[] = []
  if (rawFees && rawFees.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teams: Record<string, { id: string; name: string }> = {}
    for (const t of (teamsRes.data ?? [])) {
      teams[t.id] = { id: t.id, name: t.name }
    }

    // Agrupar filas por team_id (null = plan genérico)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grouped = new Map<string | null, any[]>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of rawFees as any[]) {
      const key = row.team_id ?? '__generic__'
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    }

    for (const [teamKey, rows] of grouped.entries()) {
      if (teamKey === '__generic__') continue  // saltar filas sin equipo asignado
      const teamName = teams[teamKey as string]?.name ?? teamKey ?? ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reservaRow = rows.find((r: any) => /reserva/i.test(r.concept))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pcRow      = rows.find((r: any) => /pago.?completo/i.test(r.concept))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cuotaRows  = rows.filter((r: any) => /^cuota\s*\d+/i.test(r.concept))

      const reserva   = parseFloat(reservaRow?.amount ?? '0')
      const cuotas    = cuotaRows.map((r: any) => parseFloat(r.amount))
      const pcTotal   = parseFloat(pcRow?.amount ?? '0')
      const totalBase = reserva + cuotas.reduce((a: number, b: number) => a + b, 0)

      if (totalBase === 0) continue  // saltar equipos sin datos útiles

      plans.push({
        key:       teamKey as string,
        label:     teamName,
        reserva,
        cuotas,
        pcTotal:   pcTotal || parseFloat((totalBase * (1 - earlyPaymentDiscountPct / 100)).toFixed(2)),
        totalBase,
      })
    }

    // Ordenar por totalBase desc (de mayor a menor cuota)
    plans.sort((a, b) => b.totalBase - a.totalBase)
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Configuracion de Cuotas" />
      <div className="flex-1 p-6 space-y-6 max-w-4xl">
        <CuotasConfig
          clubId={clubId}
          settings={settings}
          teams={teamsRes.data ?? []}
        />
        <FeeCalculator
          plans={plans}
          siblingDiscountPct={siblingDiscountPct}
          earlyPaymentDiscountPct={earlyPaymentDiscountPct}
        />
        <SeasonFeesManager
          seasons={getActiveSeasons()}
          teams={teamsRes.data ?? []}
        />
      </div>
    </div>
  )
}
