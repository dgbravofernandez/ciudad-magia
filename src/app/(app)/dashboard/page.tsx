import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { DashboardView } from '@/features/dashboard/components/DashboardView'

export const dynamic = 'force-dynamic'

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + delta)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default async function DashboardPage() {
  const { clubId } = await getClubContext()
  if (!clubId) {
    return <div className="p-6 text-sm text-muted-foreground">No autenticado.</div>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const now = new Date()
  const monthStart = toISODate(startOfMonth(now))
  const today = toISODate(now)
  const in7Days = toISODate(addDays(now, 7))

  // Rango últimos 6 meses para el chart
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const sixMonthsAgoIso = toISODate(sixMonthsAgo)

  const [
    playersRes,
    injuriesRes,
    sessionsMonthRes,
    sessionsUpcomingRes,
    paymentsMonthRes,
    expensesMonthRes,
    paymentsChartRes,
    sessionsChartRes,
    attendanceMonthRes,
    birthdayPlayersRes,
  ] = await Promise.all([
    sb
      .from('players')
      .select('id, first_name, last_name, status, date_of_birth, team_id, teams(name)')
      .eq('club_id', clubId),
    sb
      .from('injuries')
      .select('id, player_id, status')
      .eq('club_id', clubId)
      .in('status', ['active', 'recovering']),
    sb
      .from('sessions')
      .select('id, session_type')
      .eq('club_id', clubId)
      .gte('session_date', monthStart)
      .lte('session_date', today),
    sb
      .from('sessions')
      .select('id, session_date, start_time, opponent, session_type, teams(name)')
      .eq('club_id', clubId)
      .gte('session_date', today)
      .lte('session_date', in7Days)
      .order('session_date', { ascending: true })
      .limit(10),
    sb
      .from('quota_payments')
      .select('amount')
      .eq('club_id', clubId)
      .gte('payment_date', monthStart),
    sb
      .from('expenses')
      .select('amount')
      .eq('club_id', clubId)
      .gte('expense_date', monthStart),
    sb
      .from('quota_payments')
      .select('amount, payment_date')
      .eq('club_id', clubId)
      .gte('payment_date', sixMonthsAgoIso),
    sb
      .from('sessions')
      .select('session_date')
      .eq('club_id', clubId)
      .gte('session_date', sixMonthsAgoIso),
    sb
      .from('session_attendance')
      .select('status, sessions!inner(session_type, session_date, club_id)')
      .eq('sessions.club_id', clubId)
      .eq('sessions.session_type', 'training')
      .gte('sessions.session_date', monthStart)
      .lte('sessions.session_date', today),
    // Todos los jugadores con fecha de nacimiento para calcular próximos cumpleaños
    sb
      .from('players')
      .select('id, first_name, last_name, date_of_birth, teams(name)')
      .eq('club_id', clubId)
      .not('date_of_birth', 'is', null),
  ])

  const players = (playersRes.data ?? []) as Array<{ id: string; status: string }>
  const totalPlayers = players.length
  const activePlayers = players.filter((p) => p.status === 'active').length
  const injuredPlayers = new Set(
    ((injuriesRes.data ?? []) as Array<{ player_id: string }>).map((i) => i.player_id)
  ).size

  const sessionsThisMonth = (sessionsMonthRes.data ?? []).length
  const matchesThisMonth = (sessionsMonthRes.data ?? []).filter(
    (s: { session_type: string }) => s.session_type === 'match' || s.session_type === 'friendly'
  ).length

  const revenueThisMonth = (paymentsMonthRes.data ?? []).reduce(
    (acc: number, p: { amount: unknown }) => acc + Number(p.amount ?? 0),
    0
  )
  const expensesThisMonth = (expensesMonthRes.data ?? []).reduce(
    (acc: number, e: { amount: unknown }) => acc + Number(e.amount ?? 0),
    0
  )

  // Asistencia media del mes
  const attendanceRows = (attendanceMonthRes.data ?? []) as Array<{ status: string }>
  const attendanceTotal = attendanceRows.length
  const attendancePresent = attendanceRows.filter((a) => a.status === 'present').length
  const attendancePct =
    attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 1000) / 10 : 0

  // Chart últimos 6 meses
  const monthsMap: Record<string, { ingresos: number; sesiones: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthsMap[key] = { ingresos: 0, sesiones: 0 }
  }
  for (const p of (paymentsChartRes.data ?? []) as Array<{
    amount: unknown
    payment_date: string | null
  }>) {
    if (!p.payment_date) continue
    const key = p.payment_date.substring(0, 7)
    if (monthsMap[key]) monthsMap[key].ingresos += Number(p.amount ?? 0)
  }
  for (const s of (sessionsChartRes.data ?? []) as Array<{ session_date: string }>) {
    const key = s.session_date.substring(0, 7)
    if (monthsMap[key]) monthsMap[key].sesiones += 1
  }
  const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const monthlyChart = Object.entries(monthsMap).map(([key, v]) => {
    const [, m] = key.split('-')
    return { mes: MONTH_LABELS[parseInt(m, 10) - 1], ...v }
  })

  // Próximas sesiones (simplificadas para el componente)
  const upcomingSessions = ((sessionsUpcomingRes.data ?? []) as Array<{
    id: string
    session_date: string
    start_time: string | null
    opponent: string | null
    session_type: string
    teams: { name?: string } | Array<{ name?: string }> | null
  }>).map((s) => {
    const team = Array.isArray(s.teams) ? s.teams[0] : s.teams
    return {
      id: s.id,
      session_date: s.session_date,
      start_time: s.start_time ? String(s.start_time).slice(0, 5) : null,
      opponent: s.opponent,
      session_type: s.session_type,
      team_name: team?.name ?? '',
    }
  })

  // Próximos cumpleaños (próximos 14 días)
  const birthdayWindow = 14
  const upcomingBirthdays = ((birthdayPlayersRes.data ?? []) as Array<{
    id: string
    first_name: string
    last_name: string
    date_of_birth: string
    teams: { name?: string } | Array<{ name?: string }> | null
  }>)
    .map((p) => {
      const dob = new Date(p.date_of_birth)
      const nextBday = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
      if (nextBday < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        nextBday.setFullYear(now.getFullYear() + 1)
      }
      const diffDays = Math.round(
        (nextBday.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
          86400000
      )
      const team = Array.isArray(p.teams) ? p.teams[0] : p.teams
      const age = nextBday.getFullYear() - dob.getFullYear()
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        team_name: team?.name ?? '',
        next_bday: toISODate(nextBday),
        days: diffDays,
        age,
      }
    })
    .filter((b) => b.days <= birthdayWindow)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8)

  return (
    <DashboardView
      totalPlayers={totalPlayers}
      activePlayers={activePlayers}
      injuredPlayers={injuredPlayers}
      sessionsThisMonth={sessionsThisMonth}
      matchesThisMonth={matchesThisMonth}
      revenueThisMonth={revenueThisMonth}
      expensesThisMonth={expensesThisMonth}
      attendancePct={attendancePct}
      attendanceSamples={attendanceTotal}
      monthlyChart={monthlyChart}
      upcomingSessions={upcomingSessions}
      upcomingBirthdays={upcomingBirthdays}
    />
  )
}
