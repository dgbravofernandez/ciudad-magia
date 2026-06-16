import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { PaymentRegistration } from '@/features/contabilidad/components/PaymentRegistration'
import { SeasonSelector } from '@/features/contabilidad/components/SeasonSelector'
import { Topbar } from '@/components/layout/Topbar'
import { getActiveSeasons, getCurrentSeason } from '@/lib/utils/currency'
import { getReminderHistory } from '@/features/contabilidad/actions/accounting.actions'
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
  if (!clubId) return <div className="p-6 text-muted-foreground">No se pudo determinar el club.</div>

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

  // Límites del mes en hora de Madrid — payment_date es DATE y el servidor corre en UTC.
  // Sin esto, entre las 22:00/23:00 UTC del último día del mes y medianoche, el KPI
  // mostraba el mes anterior (Vercel = UTC, club = Europe/Madrid).
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayMadrid = fmt.format(new Date())            // YYYY-MM-DD en Madrid
  const [yearStr, monthStr] = todayMadrid.split('-')
  const monthStart = `${yearStr}-${monthStr}-01`
  const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate()
  const monthEnd = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`

  // KPI: total recaudado este mes — incluye pagos parciales (status='pending' pero
  // con amount_paid > 0) para no perder transferencias y cuotas con dto pronto pago.
  const { data: paidThisMonth } = await sb
    .from('quota_payments')
    .select('amount_paid')
    .eq('club_id', clubId)
    .eq('season', season)
    .neq('status', 'refunded')
    .gt('amount_paid', 0)
    .gte('payment_date', monthStart)
    .lte('payment_date', monthEnd)

  const totalPaidThisMonth = (paidThisMonth ?? []).reduce(
    (sum: number, p: { amount_paid: number }) => sum + (p.amount_paid ?? 0),
    0,
  )

  // KPI: total pending y deudores en la temporada seleccionada.
  // Por diferencia real (amount_due - amount_paid), no por status — alineado con
  // la lista de pendientes del componente y con registerPayment.
  const { data: pendingPayments } = await sb
    .from('quota_payments')
    .select('player_id, amount_due, amount_paid')
    .eq('club_id', clubId)
    .eq('season', season)
    .neq('status', 'refunded')

  const debtRows = ((pendingPayments ?? []) as { player_id: string; amount_due: number; amount_paid: number }[])
    .filter(p => ((p.amount_due ?? 0) - (p.amount_paid ?? 0)) > 0)

  const totalPending = debtRows.reduce(
    (sum, p) => sum + ((p.amount_due ?? 0) - (p.amount_paid ?? 0)),
    0,
  )

  const uniqueDebtors = new Set(debtRows.map(p => p.player_id)).size

  // Jugadores — incluir next_team_id para vista 26/27 + teléfono tutor
  const { data: players } = await sb
    .from('players')
    .select('id, first_name, last_name, dni, tutor_email, tutor_name, tutor_phone, team_id, next_team_id, birth_date, is_special_case, special_case_reason')
    .eq('club_id', clubId)
    .neq('status', 'low')
    .order('last_name')

  // Teams — activos para temporada actual; borradores (inactive) para próxima temporada
  // Cargar todos los equipos (activos + borradores) — next_team_id puede apuntar a cualquiera
  const { data: teams } = await sb
    .from('teams')
    .select('id, name')
    .eq('club_id', clubId)

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

  // Historial de avisos de cuota enviados
  const reminderHistory = await getReminderHistory().catch(() => ({}))

  // Cuotas por temporada (season_fees) — fuente principal.
  // Intentar ambos formatos: '2025/26' (barra, configuración manual) y '2025-26'
  // (guión, formato de getCurrentSeason) — hay inconsistencia histórica en la BD.
  const feesSeason = season.replace('-', '/')  // '2025-26' → '2025/26'
  const { data: seasonFeesSlash } = await sb
    .from('season_fees')
    .select('team_id, concept, amount')
    .eq('club_id', clubId)
    .eq('season', feesSeason)
  const { data: seasonFeesDash } = await sb
    .from('season_fees')
    .select('team_id, concept, amount')
    .eq('club_id', clubId)
    .eq('season', season)
  // Usar el que tenga datos; si ambos tienen, el slash tiene preferencia (fuente manual)
  const seasonFees = (seasonFeesSlash ?? []).length > 0 ? seasonFeesSlash : seasonFeesDash

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
          <SeasonSelector season={season} seasons={seasons} />
        </div>

        <PaymentRegistration
          clubId={clubId}
          season={season}
          isNextSeason={isNextSeason}
          totalPaidThisMonth={totalPaidThisMonth}
          totalPending={totalPending}
          playersWithDebtCount={uniqueDebtors}
          players={enrichedPlayers}
          payments={seasonPayments ?? []}
          canRegisterPayments={canRegisterPayments}
          quotaAmounts={quotaAmounts}
          seasonFees={(seasonFees ?? []) as Array<{ team_id: string | null; concept: string; amount: number }>}
          teams={(teams ?? []) as { id: string; name: string }[]}
          reminderHistory={reminderHistory}
        />
      </div>
    </div>
  )
}
