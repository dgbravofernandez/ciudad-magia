import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateCashClosePDF } from '@/lib/pdf/generate-cash-close'
import type { CashCloseMovement } from '@/lib/pdf/generate-cash-close'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ closeId: string }> },
) {
  // ── Auth ──────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { closeId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // ── Fetch the cash close record ───────────────────────────────────
  const { data: close, error: closeErr } = await sb
    .from('cash_closes')
    .select('*')
    .eq('id', closeId)
    .single()

  if (closeErr || !close) {
    return new Response('Not found', { status: 404 })
  }

  // ── Verify user belongs to this club ─────────────────────────────
  const { data: member } = await sb
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('club_id', close.club_id)
    .eq('active', true)
    .limit(1)
    .single()

  if (!member) {
    return new Response('Forbidden', { status: 403 })
  }

  // ── Fetch club branding ──────────────────────────────────────────
  const { data: clubData } = await sb
    .from('clubs')
    .select('name, logo_url, primary_color')
    .eq('id', close.club_id)
    .single()

  // ── Fetch movements for the close period ─────────────────────────
  const { data: movements } = await sb
    .from('cash_movements')
    .select('*, source')
    .eq('club_id', close.club_id)
    .gte('movement_date', close.period_start)
    .lte('movement_date', close.period_end)
    .order('movement_date', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movs = (movements ?? []) as any[]

  // ── Enrich with player / team names (cuotas + torneos + ropa) ────
  // Collect player_ids from all 3 related tables
  const paymentIds   = movs.filter((m) => m.related_payment_id).map((m) => m.related_payment_id as string)
  const attendeeIds  = movs.filter((m) => m.related_tournament_attendee_id).map((m) => m.related_tournament_attendee_id as string)
  const clothingIds  = movs.filter((m) => m.related_clothing_order_id).map((m) => m.related_clothing_order_id as string)

  // movement_id → player_id (and source-specific info)
  const movPlayerId: Record<string, string> = {}      // related_id → player_id
  const paymentSeasonMap: Record<string, string> = {}  // payment_id → season
  const paymentConceptMap: Record<string, string> = {} // payment_id → concept (Cuota 1, Reserva…)

  if (paymentIds.length > 0) {
    const { data } = await sb.from('quota_payments').select('id, player_id, season, concept').in('id', paymentIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? [])) {
      if (r.player_id) movPlayerId[r.id] = r.player_id
      if (r.season)   paymentSeasonMap[r.id]  = r.season
      if (r.concept)  paymentConceptMap[r.id] = r.concept
    }
  }
  if (attendeeIds.length > 0) {
    const { data } = await sb.from('tournament_attendees').select('id, player_id').in('id', attendeeIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? [])) if (r.player_id) movPlayerId[r.id] = r.player_id
  }
  if (clothingIds.length > 0) {
    const { data } = await sb.from('clothing_orders').select('id, player_id').in('id', clothingIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (data ?? [])) if (r.player_id) movPlayerId[r.id] = r.player_id
  }

  // Resolve all player_ids → {name, team}
  const allPlayerIds = [...new Set(Object.values(movPlayerId))]
  const playerMap: Record<string, { name: string; team: string; nextTeam: string }> = {}

  if (allPlayerIds.length > 0) {
    // Fetch both team_id (current) and next_team_id (26/27) so we can pick the right one
    const { data: playerRows } = await sb
      .from('players')
      .select('id, first_name, last_name, team_id, next_team_id')
      .in('id', allPlayerIds)

    // Collect all team ids (current + next) for a single teams query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTeamIds = [...new Set((playerRows ?? []).flatMap((p: any) => [p.team_id, p.next_team_id].filter(Boolean)))]

    const { data: teamRows } = allTeamIds.length > 0
      ? await sb.from('teams').select('id, name').in('id', allTeamIds)
      : { data: [] }

    const teamMap: Record<string, string> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const t of (teamRows ?? [])) teamMap[t.id] = t.name

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (playerRows ?? [])) {
      playerMap[p.id] = {
        name:        `${p.first_name} ${p.last_name}`.trim(),
        team:        p.team_id      ? (teamMap[p.team_id]      ?? '') : '',
        nextTeam:    p.next_team_id ? (teamMap[p.next_team_id] ?? '') : '',
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getNames(m: any): { player_name: string; team_name: string } {
    const relatedId  = m.related_payment_id ?? m.related_tournament_attendee_id ?? m.related_clothing_order_id
    const playerId   = relatedId ? movPlayerId[relatedId] : null
    if (!playerId || !playerMap[playerId]) return { player_name: '', team_name: '' }
    const p          = playerMap[playerId] as { name: string; team: string; nextTeam: string }
    const season     = m.related_payment_id ? (paymentSeasonMap[m.related_payment_id] ?? null) : null
    // For 26/27 payments use the next-season team; otherwise current team
    // season stored as '2026-27' (hyphen) OR '2026/27' (slash) — normalise both
    const isNextSeason = season === '2026/27' || season === '2026-27'
    const teamName     = isNextSeason ? (p.nextTeam || p.team) : p.team
    return { player_name: p.name, team_name: teamName }
  }

  const enriched: CashCloseMovement[] = movs.map((m) => {
    const { player_name, team_name } = getNames(m)
    const season  = m.related_payment_id ? (paymentSeasonMap[m.related_payment_id] ?? null) : null
    const concept = m.related_payment_id ? (paymentConceptMap[m.related_payment_id] ?? null) : null
    return {
      player_name,
      team_name,
      amount:         m.amount,
      payment_method: m.payment_method,
      movement_date:  m.movement_date,
      description:    m.description ?? '',
      type:           m.type as 'income' | 'expense',
      source:         m.source ?? null,
      season,
      concept,
    }
  })

  // ── Generate PDF ─────────────────────────────────────────────────
  const cardByDay: Array<{ date: string; system: number; real: number }> =
    Array.isArray(close.card_by_day) ? close.card_by_day : []

  const pdfBuffer = await generateCashClosePDF({
    periodStart:  close.period_start,
    periodEnd:    close.period_end,
    closedAt:     close.created_at,
    systemCash:   close.system_cash,
    realCash:     close.real_cash,
    systemCard:   close.system_card,
    realCard:     close.real_card,
    notes:        close.notes ?? null,
    movements:    enriched,
    clubName:     clubData?.name ?? undefined,
    primaryColor: clubData?.primary_color ?? undefined,
    logoUrl:      clubData?.logo_url ?? undefined,
    cardByDay,
  })

  const filename = `Arqueo_${close.period_start}_${close.period_end}.pdf`

  return new Response(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdfBuffer.length.toString(),
    },
  })
}
