import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { PaymentRegistration } from '@/features/contabilidad/components/PaymentRegistration'
import { Topbar } from '@/components/layout/Topbar'
import { getActiveSeasons, getCurrentSeason } from '@/lib/utils/currency'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pagos de Cuotas' }
export const maxDuration = 30
export const dynamic = 'force-dynamic'

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  const params = await searchParams
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

  if (!canRegisterPayments) {
    let memberId = headersList.get('x-member-id') ?? ''
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

  /* ── Season selection ── */
  const seasons = getActiveSeasons() // ['2025-26', '2026-27']
  const currentSeason = getCurrentSeason()
  const season = params.season && seasons.includes(params.season) ? params.season : currentSeason
  const isNextSeason = season !== currentSeason

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // KPI: total paid this month (en la temporada seleccionada)
  const { data: paidThisMonth } = await sb
    .from('quota_payments')
    .select('amount_paid')
    .eq('club_id', clubId)
    .eq('season', season)
    .eq('status', 'paid')
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)

  const totalPaidThisMonth = (paidThisMonth ?? []).reduce(
    (sum: number, p: { amount_paid: number }) => sum + (p.amount_paid ?? 0),
    0,
  )

  // KPI: total pending en la temporada seleccionada
  const { data: pendingPayments } = await sb
    .from('quota_payments')
    .select('amount_due, amount_paid')
    .eq('club_id', clubId)
    .eq('season', season)
    .eq('status', 'pending')

  const totalPending = (pendingPayments ?? []).reduce(
    (sum: number, p: { amount_due: number; amount_paid: number }) =>
      sum + ((p.amount_due ?? 0) - (p.amount_paid ?? 0)),
    0,
  )

  // KPI: players with debt
  const { data: playersWithDebt } = await sb
    .from('quota_payments')
    .select('player_id')
    .eq('club_id', clubId)
    .eq('season', season)
    .eq('status', 'pending')

  const uniqueDebtors = new Set(
    (playersWithDebt ?? []).map((p: { player_id: string }) => p.player_id),
  ).size

  // Jugadores — incluir next_team_id para vista 26/27
  const { data: players } = await sb
    .from('players')
    .select('id, first_name, last_name, dni, tutor_email, tutor_name, team_id, next_team_id')
    .eq('club_id', clubId)
    .neq('status', 'low')
    .order('last_name')

  // Teams
  const { data: teams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)
    .eq('active', true)

  const teamMap: Record<string, { id: string; name: string }> = {}
  for (const t of (teams ?? [])) {
    teamMap[t.id] = t
  }

  // Según temporada, usar team_id (actual) o next_team_id (próxima)
  const enrichedPlayers = (players ?? []).map(
    (p: { team_id: string | null; next_team_id: string | null }) => {
      const activeTeamId = isNextSeason ? p.next_team_id : p.team_id
      return {
        ...p,
        teams: activeTeamId ? teamMap[activeTeamId] ?? null : null,
      }
    },
  )

  // Payments de la temporada seleccionada
  const { data: seasonPayments } = await sb
    .from('quota_payments')
    .select('*')
    .eq('club_id', clubId)
    .eq('season', season)
    .order('created_at', { ascending: false })

  // Cuotas por temporada (season_fees) — fuente principal
  const { data: seasonFees } = await sb
    .from('season_fees')
    .select('team_id, concept, amount')
    .eq('club_id', clubId)
    .eq('season', season)

  // Fallback legacy quota_amounts (temporada actual)
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
      <div className="flex-1 p-6 space-y-4">
        {/* Season banner + selector */}
        <div
          className={`rounded-xl border px-4 py-3 flex items-center justify-between flex-wrap gap-3 ${
            isNextSeason
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <div>
            <p className="text-sm font-semibold">
              {isNextSeason
                ? `Temporada ${season} — Reservas y altas próxima temporada`
                : `Temporada ${season} — En curso`}
            </p>
            <p className="text-xs opacity-80">
              {isNextSeason
                ? 'Los pagos se imputan al equipo 26/27 del jugador (next_team_id).'
                : 'Los pagos se imputan al equipo actual del jugador.'}
            </p>
          </div>
          <form method="GET" className="flex items-center gap-2">
            <label className="text-xs font-medium">Temporada</label>
            <select
              name="season"
              defaultValue={season}
              onChange={(e) => {
                const form = e.currentTarget.form
                if (form) form.submit()
              }}
              className="input w-auto text-sm bg-white"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </form>
        </div>

        <PaymentRegistration
          clubId={clubId}
          season={season}
          totalPaidThisMonth={totalPaidThisMonth}
          totalPending={totalPending}
          playersWithDebtCount={uniqueDebtors}
          players={enrichedPlayers}
          payments={seasonPayments ?? []}
          canRegisterPayments={canRegisterPayments}
          quotaAmounts={quotaAmounts}
          seasonFees={(seasonFees ?? []) as Array<{ team_id: string | null; concept: string; amount: number }>}
        />
      </div>
    </div>
  )
}
