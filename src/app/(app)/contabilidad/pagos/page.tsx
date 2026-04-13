import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { PaymentRegistration } from '@/features/contabilidad/components/PaymentRegistration'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pagos de Cuotas' }
export const maxDuration = 30

export default async function PagosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  /* ── clubId with fallback ── */
  let clubId = await getClubId()
  const headersList = await headers()
  if (!clubId) clubId = headersList.get('x-club-id') ?? ''

  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members').select('club_id').eq('user_id', user.id).eq('active', true).limit(1).single()
      clubId = member?.club_id ?? ''
    }
  }
  if (!clubId) {
    const { data: anyClub } = await sb.from('clubs').select('id').limit(1).single()
    clubId = anyClub?.id ?? ''
  }

  /* ── Resolve roles for permission check ── */
  const PAYMENT_ROLES = ['admin', 'direccion', 'director_deportivo']
  const memberRoles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  let canRegisterPayments = memberRoles.some(r => PAYMENT_ROLES.includes(r))

  // Always fallback to DB if headers didn't grant access
  if (!canRegisterPayments) {
    // Try memberId from header first
    let memberId = headersList.get('x-member-id') ?? ''
    // If no memberId in header, resolve from auth
    if (!memberId) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: m } = await sb
          .from('club_members').select('id').eq('user_id', user.id).eq('club_id', clubId).eq('active', true).single()
        memberId = m?.id ?? ''
      }
    }
    if (memberId) {
      const { data: roles } = await sb
        .from('club_member_roles').select('role').eq('member_id', memberId)
      canRegisterPayments = (roles ?? []).some((r: { role: string }) => PAYMENT_ROLES.includes(r.role))
    }
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // KPI: total paid this month
  const { data: paidThisMonth } = await sb
    .from('quota_payments')
    .select('amount_paid')
    .eq('club_id', clubId)
    .eq('status', 'paid')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)

  const totalPaidThisMonth = (paidThisMonth ?? []).reduce((sum: number, p: { amount_paid: number }) => sum + (p.amount_paid ?? 0), 0)

  // KPI: total pending
  const { data: pendingPayments } = await sb
    .from('quota_payments')
    .select('amount_due, amount_paid')
    .eq('club_id', clubId)
    .eq('status', 'pending')

  const totalPending = (pendingPayments ?? []).reduce(
    (sum: number, p: { amount_due: number; amount_paid: number }) => sum + ((p.amount_due ?? 0) - (p.amount_paid ?? 0)),
    0
  )

  // KPI: players with debt (distinct player_ids with pending payments)
  const { data: playersWithDebt } = await sb
    .from('quota_payments')
    .select('player_id')
    .eq('club_id', clubId)
    .eq('status', 'pending')

  const uniqueDebtors = new Set((playersWithDebt ?? []).map((p: { player_id: string }) => p.player_id)).size

  // All players with team assigned (no nested joins)
  const season = getCurrentSeason()
  const { data: players } = await sb
    .from('players')
    .select('id, first_name, last_name, dni, tutor_email, tutor_name, team_id')
    .eq('club_id', clubId)
    .neq('status', 'low')
    .order('last_name')

  // Fetch teams separately
  const { data: teams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)

  const teamMap: Record<string, { id: string; name: string }> = {}
  for (const t of (teams ?? [])) {
    teamMap[t.id] = t
  }

  // Enrich players with team data
  const enrichedPlayers = (players ?? []).map((p: { team_id: string | null }) => ({
    ...p,
    teams: p.team_id ? teamMap[p.team_id] ?? null : null,
  }))

  const { data: seasonPayments } = await sb
    .from('quota_payments')
    .select('*')
    .eq('club_id', clubId)
    .eq('season', season)
    .order('created_at', { ascending: false })

  // Fetch quota config
  const { data: settings } = await sb
    .from('club_settings')
    .select('quota_amounts')
    .eq('club_id', clubId)
    .single()

  const quotaAmounts = settings?.quota_amounts ?? {
    annual: 360,
    earlyPayDiscount: 5,
    installments: [
      { label: '1er plazo', amount: 120, deadline: '07-01' },
      { label: '2do plazo', amount: 120, deadline: '09-01' },
      { label: '3er plazo', amount: 120, deadline: '11-01' },
    ],
    teams: {},
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Pagos de Cuotas" />
      <div className="flex-1 p-6">
        <PaymentRegistration
          clubId={clubId}
          totalPaidThisMonth={totalPaidThisMonth}
          totalPending={totalPending}
          playersWithDebtCount={uniqueDebtors}
          players={enrichedPlayers}
          payments={seasonPayments ?? []}
          canRegisterPayments={canRegisterPayments}
          quotaAmounts={quotaAmounts}
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
