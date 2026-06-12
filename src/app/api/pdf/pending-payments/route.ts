import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubId } from '@/lib/supabase/get-club-id'
import { generatePendingPaymentsPDF, type PendingPaymentRow } from '@/lib/pdf/generate-pending-payments'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // ── Club del usuario — cookie-aware para multi-club ────────────────
  // (antes cogía el membership más reciente e ignoraba el club seleccionado)
  const clubId = await getClubId()
  if (!clubId) return new Response('Forbidden', { status: 403 })

  // ── Parsear filtros ────────────────────────────────────────────────
  const url = req.nextUrl
  const season = url.searchParams.get('season') ?? '2025-26'
  const teamIdsParam = url.searchParams.get('teams') ?? ''   // CSV de IDs (vacío = todos)
  const conceptsParam = url.searchParams.get('concepts') ?? '' // CSV de conceptos
  const categoriesParam = url.searchParams.get('categories') ?? '' // CSV de categorías
  const amountMinParam = url.searchParams.get('amountMin') ?? '' // importe mínimo
  const teamIds = teamIdsParam ? teamIdsParam.split(',').filter(Boolean) : []
  const concepts = conceptsParam ? conceptsParam.split(',').filter(Boolean) : []
  const categories = categoriesParam ? categoriesParam.split(',').filter(Boolean) : []
  const amountMin = amountMinParam ? parseFloat(amountMinParam) : null

  // Helper: categoría por año de nacimiento
  function getCategory(birthDate: string | null | undefined): string {
    if (!birthDate) return '—'
    const birthYear = new Date(birthDate).getFullYear()
    const seasonYear = parseInt(season.split('-')[0])
    const age = seasonYear - birthYear
    if (age <= 5) return 'Prebenjamín'
    if (age <= 7) return 'Benjamín'
    if (age <= 9) return 'Alevín'
    if (age <= 11) return 'Infantil'
    if (age <= 13) return 'Cadete'
    if (age <= 15) return 'Juvenil'
    return 'Sénior'
  }

  // Aceptar season en formato dash (2025-26) y slash (2025/26)
  const seasonAlt = season.includes('/') ? season.replace('/', '-') : season.replace('-', '/')

  // ── 1. Pagos pendientes (sin join — los joins fallan silenciosamente) ─────
  let pq = sb
    .from('quota_payments')
    .select('id, player_id, amount_due, amount_paid, payment_date, concept, admin_comment, is_special_case, season')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .in('season', [season, seasonAlt])
  if (concepts.length > 0) {
    pq = pq.in('concept', concepts)
  }
  const { data: pendings } = await pq

  if (!pendings || pendings.length === 0) {
    return await buildEmptyPdfResponse(sb, clubId, season, [], [], [], undefined)
  }

  // ── 2. Jugadores referenciados ─────────────────────────────────────
  const playerIds = Array.from(new Set(pendings.map((p: { player_id: string }) => p.player_id)))
  const { data: players } = await sb
    .from('players')
    .select('id, first_name, last_name, team_id, tutor_email, tutor_phone, birth_date')
    .eq('club_id', clubId)
    .in('id', playerIds)

  // ── 3. Equipos ─────────────────────────────────────────────────────
  const allTeamIds = Array.from(new Set((players ?? [])
    .map((p: { team_id: string | null }) => p.team_id)
    .filter((id: string | null) => id !== null)))
  const { data: teams } = allTeamIds.length > 0
    ? await sb.from('teams').select('id, name').eq('club_id', clubId).in('id', allTeamIds)
    : { data: [] }
  const teamMap = new Map<string, string>(
    (teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name])
  )

  // ── 4. Última fecha de pago por jugador (status='paid') ────────────
  const { data: lastPaidPayments } = await sb
    .from('quota_payments')
    .select('player_id, payment_date')
    .eq('club_id', clubId)
    .eq('status', 'paid')
    .in('player_id', playerIds)
    .order('payment_date', { ascending: false })
  const lastPaidMap = new Map<string, string>()
  for (const lp of (lastPaidPayments ?? [])) {
    if (!lastPaidMap.has(lp.player_id) && lp.payment_date) {
      lastPaidMap.set(lp.player_id, lp.payment_date)
    }
  }

  // ── 5. Agregar por jugador, filtrando por equipos seleccionados ────
  const byPlayer = new Map<string, PendingPaymentRow>()
  type PendingRowDb = {
    player_id: string; amount_due: number | string; amount_paid: number | string;
    payment_date: string | null; admin_comment: string | null; is_special_case: boolean | null
  }
  const playerMap = new Map<string, { id: string; first_name: string; last_name: string; team_id: string | null; tutor_email: string | null; tutor_phone: string | null; birth_date: string | null }>(
    (players ?? []).map((p: { id: string; first_name: string; last_name: string; team_id: string | null; tutor_email: string | null; tutor_phone: string | null; birth_date: string | null }) => [p.id, p])
  )

  for (const row of pendings as PendingRowDb[]) {
    const player = playerMap.get(row.player_id)
    if (!player) continue
    if (teamIds.length > 0 && (!player.team_id || !teamIds.includes(player.team_id))) continue
    if (categories.length > 0 && !categories.includes(getCategory(player.birth_date))) continue

    const amount = (Number(row.amount_due) || 0) - (Number(row.amount_paid) || 0)
    if (amount <= 0) continue

    const existing = byPlayer.get(player.id)
    if (existing) {
      existing.pending_amount += amount
      if (row.admin_comment && !existing.admin_comment) existing.admin_comment = row.admin_comment
      if (row.is_special_case) existing.is_special_case = true
    } else {
      byPlayer.set(player.id, {
        player_name: `${player.first_name} ${player.last_name}`.trim(),
        team_name: player.team_id ? (teamMap.get(player.team_id) ?? '—') : '—',
        tutor_email: player.tutor_email,
        tutor_phone: player.tutor_phone,
        pending_amount: amount,
        last_payment_date: lastPaidMap.get(player.id) ?? null,
        admin_comment: row.admin_comment,
        is_special_case: !!row.is_special_case,
      })
    }
  }

  let rows = Array.from(byPlayer.values()).sort((a, b) => b.pending_amount - a.pending_amount)
  if (amountMin !== null && !isNaN(amountMin) && amountMin > 0) {
    rows = rows.filter((r) => r.pending_amount >= amountMin)
  }

  // ── 6. Branding ────────────────────────────────────────────────────
  const { data: clubData } = await sb
    .from('clubs').select('name, logo_url, primary_color').eq('id', clubId).single()

  // Nombres de los equipos seleccionados para mostrar en filtros del PDF
  const teamNamesSelected = teamIds.length > 0
    ? teamIds.map((id: string) => teamMap.get(id) ?? id)
    : []

  const pdfBytes = await generatePendingPaymentsPDF({
    rows,
    season,
    filters: { teams: teamNamesSelected, concepts, categories, amountMin: amountMin ?? undefined },
    clubName: clubData?.name ?? 'Escuela de Fútbol Ciudad de Getafe',
    primaryColor: clubData?.primary_color ?? undefined,
    logoUrl: clubData?.logo_url ?? null,
  })

  const filename = `pagos-pendientes-${season.replace('/', '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function buildEmptyPdfResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any, clubId: string, season: string, teamNamesSelected: string[], concepts: string[], categories: string[], amountMin: number | undefined
) {
  const { data: clubData } = await sb
    .from('clubs').select('name, logo_url, primary_color').eq('id', clubId).single()
  const pdfBytes = await generatePendingPaymentsPDF({
    rows: [],
    season,
    filters: { teams: teamNamesSelected, concepts, categories, amountMin },
    clubName: clubData?.name ?? 'Escuela de Fútbol Ciudad de Getafe',
    primaryColor: clubData?.primary_color ?? undefined,
    logoUrl: clubData?.logo_url ?? null,
  })
  const filename = `pagos-pendientes-${season.replace('/', '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
