import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { headers } from 'next/headers'
import { CashRegisterPage } from '@/features/contabilidad/components/CashRegisterPage'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30
export const metadata: Metadata = { title: 'Caja' }

export default async function CajaPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  let clubId = await getClubId()
  const headersList = await headers()
  if (!clubId) clubId = headersList.get('x-club-id') ?? ''
  const memberId = headersList.get('x-member-id') ?? ''

  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members').select('club_id').eq('user_id', user.id).eq('active', true).limit(1).single()
      clubId = member?.club_id ?? ''
    }
  }

  // Get club settings (for cash register float)
  const { data: clubSettings } = await sb
    .from('club_settings')
    .select('cash_register_float')
    .eq('club_id', clubId)
    .single()
  const cashRegisterFloat: number = clubSettings?.cash_register_float ?? 0

  // Get the last cash close to determine period start
  const { data: lastClose } = await sb
    .from('cash_closes')
    .select('period_end, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  // Period starts from the date of the last close (not the day after).
  // Movements on that same date but created BEFORE the close are excluded in JS below.
  // This covers both: close happened today AND close happened a previous day with
  // movements added after the close on that same date.
  let periodStart: string
  let lastCloseAt: string | null = null
  if (lastClose?.period_end) {
    periodStart = lastClose.period_end
    if (lastClose.created_at) {
      const closeTs = new Date(lastClose.created_at)
      closeTs.setMinutes(closeTs.getMinutes() + 1)
      lastCloseAt = closeTs.toISOString()
    }
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  }
  const periodEnd = today

  // Fetch cash movements from period start to now
  const { data: movements } = await sb
    .from('cash_movements')
    .select('*')
    .eq('club_id', clubId)
    .gte('movement_date', periodStart)
    .lte('movement_date', periodEnd)
    .order('created_at', { ascending: false })

  // Fetch cash close history
  const { data: closes } = await sb
    .from('cash_closes')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Calculate system totals — DB uses English enum values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let movs = (movements ?? []) as any[]
  // Drop movements on the close date that were created before (or at) the close timestamp.
  // This handles: close today, close yesterday with post-close movements, etc.
  if (lastClose?.created_at && lastClose?.period_end) {
    movs = movs.filter((m) => {
      if (m.movement_date === lastClose.period_end) {
        return m.created_at > lastClose.created_at
      }
      return true
    })
  }
  const systemCash = movs
    .filter((m) => m.payment_method === 'cash')
    .reduce((sum: number, m) => sum + (m.type === 'income' ? m.amount : -m.amount), 0)

  const systemCard = movs
    .filter((m) => m.payment_method === 'card')
    .reduce((sum: number, m) => sum + (m.type === 'income' ? m.amount : -m.amount), 0)

  // ── Enriquecer movimientos con nombre de jugador/equipo ──────────────────

  // 1. Movimientos de cuotas → quota_payments → players → teams
  const paymentIds = movs
    .filter((m) => m.related_payment_id)
    .map((m) => m.related_payment_id)

  let movementDetails: { id: string; player_id: string; player_name: string; team_name: string }[] = []
  if (paymentIds.length > 0) {
    const { data: paymentRows } = await sb
      .from('quota_payments')
      .select('id, player_id')
      .in('id', paymentIds)

    if (paymentRows && paymentRows.length > 0) {
      const playerIds = [...new Set(paymentRows.map((p: { player_id: string }) => p.player_id))]
      const { data: playerRows } = await sb
        .from('players')
        .select('id, first_name, last_name, team_id')
        .in('id', playerIds)

      const teamIds = [...new Set((playerRows ?? []).filter((p: { team_id: string | null }) => p.team_id).map((p: { team_id: string }) => p.team_id))]
      const { data: teamRows } = teamIds.length > 0
        ? await sb.from('teams').select('id, name').in('id', teamIds)
        : { data: [] }

      const teamMap: Record<string, string> = {}
      for (const t of (teamRows ?? [])) teamMap[t.id] = t.name

      const playerMap: Record<string, { name: string; team: string }> = {}
      for (const p of (playerRows ?? [])) {
        playerMap[p.id] = {
          name: `${p.first_name} ${p.last_name}`,
          team: p.team_id ? teamMap[p.team_id] ?? '' : '',
        }
      }

      movementDetails = paymentRows.map((pr: { id: string; player_id: string }) => ({
        id: pr.id,
        player_id: pr.player_id,
        player_name: playerMap[pr.player_id]?.name ?? '',
        team_name: playerMap[pr.player_id]?.team ?? '',
      }))
    }
  }

  // 2. Movimientos de actividades → activity_charges → activities + players
  const activityChargeIds = movs
    .filter((m) => m.related_activity_charge_id)
    .map((m) => m.related_activity_charge_id)

  let activityDetails: { charge_id: string; player_name: string; activity_name: string }[] = []
  if (activityChargeIds.length > 0) {
    const { data: chargeRows } = await sb
      .from('activity_charges')
      .select('id, player_id, participant_name, activity_id')
      .in('id', activityChargeIds)

    if (chargeRows && chargeRows.length > 0) {
      // Cargar actividades
      const activityIds = [...new Set(chargeRows.map((c: { activity_id: string }) => c.activity_id))]
      const { data: activityRows } = await sb
        .from('activities')
        .select('id, name')
        .in('id', activityIds)
      const activityMap: Record<string, string> = {}
      for (const a of (activityRows ?? [])) activityMap[a.id] = a.name

      // Cargar nombres de jugadores del club
      const playerIds = [...new Set(chargeRows
        .filter((c: { player_id: string | null }) => c.player_id)
        .map((c: { player_id: string }) => c.player_id))]
      const activityPlayerMap: Record<string, string> = {}
      if (playerIds.length > 0) {
        const { data: pRows } = await sb
          .from('players')
          .select('id, first_name, last_name')
          .in('id', playerIds)
        for (const p of (pRows ?? [])) {
          activityPlayerMap[p.id] = `${p.first_name} ${p.last_name}`.trim()
        }
      }

      activityDetails = chargeRows.map((c: { id: string; player_id: string | null; participant_name: string | null; activity_id: string }) => ({
        charge_id: c.id,
        player_name: (c.player_id ? activityPlayerMap[c.player_id] : null) ?? c.participant_name ?? '',
        activity_name: activityMap[c.activity_id] ?? 'Actividad',
      }))
    }
  }

  // Resolver si el usuario actual es superadmin (comparación server-side — nunca exponer el email al cliente)
  const supabaseUser = await createClient()
  const { data: { user: authUser } } = await supabaseUser.auth.getUser()
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL
  const isSuperUser = !!(superAdminEmail && authUser?.email === superAdminEmail)

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Cierre de Caja" />
      <div className="flex-1 p-6">
        <CashRegisterPage
          clubId={clubId}
          memberId={memberId}
          isSuperUser={isSuperUser}
          systemCash={systemCash}
          systemCard={systemCard}
          periodStart={periodStart}
          periodEnd={periodEnd}
          closes={closes ?? []}
          movements={movs}
          movementDetails={movementDetails}
          activityDetails={activityDetails}
          cashRegisterFloat={cashRegisterFloat}
          lastCloseAt={lastCloseAt}
        />
      </div>
    </div>
  )
}
