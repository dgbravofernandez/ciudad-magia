import { createAdminClient } from '@/lib/supabase/admin'
import { writeTab } from './sheets-writer'

// ──────────────────────────────────────────────────────────────
// Backend export — vuelca a Google Sheets las tablas importantes
// del CRM en pestañas independientes para consulta/respaldo.
// ──────────────────────────────────────────────────────────────

type Row = (string | number | null)[]

interface TabResult {
  tab: string
  rows: number
  error?: string
}

export interface BackendExportResult {
  ok: boolean
  spreadsheetId: string
  tabs: TabResult[]
  totalRows: number
  errorCount: number
  durationMs: number
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  // Postgres date "YYYY-MM-DD" o ISO timestamp
  return String(d).slice(0, 10)
}
function fmtMoney(n: number | null | undefined): number {
  return typeof n === 'number' ? n : (n ? Number(n) : 0)
}
function s(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

export async function exportClubToBackendSheet(
  clubId: string,
  spreadsheetId: string,
): Promise<BackendExportResult> {
  const t0 = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const tabs: TabResult[] = []
  let totalRows = 0
  let errorCount = 0

  async function exportTab(tab: string, headers: string[], dataRows: Row[]) {
    try {
      const rows: Row[] = [headers, ...dataRows]
      await writeTab(spreadsheetId, tab, rows)
      tabs.push({ tab, rows: dataRows.length })
      totalRows += dataRows.length
    } catch (e) {
      errorCount++
      tabs.push({ tab, rows: 0, error: (e as Error).message })
    }
  }

  // Mapas auxiliares: equipos
  const { data: teams } = await sb.from('teams').select('id, name, season').eq('club_id', clubId)
  const teamName = new Map<string, string>()
  for (const t of (teams ?? [])) teamName.set(t.id, t.name)

  // ── 1) Jugadores ──────────────────────────────────────────────
  const { data: players } = await sb
    .from('players')
    .select('id, first_name, last_name, dni, birth_date, gender, position, status, team_id, next_team_id, tutor_name, tutor_email, tutor_phone, address, notes, forms_link, wants_to_continue, meets_requirements, made_reservation, created_at')
    .eq('club_id', clubId)
    .order('last_name')

  await exportTab(
    'Jugadores',
    [
      'Apellidos', 'Nombre', 'DNI', 'Fecha nac.', 'Género', 'Posición', 'Estado',
      'Equipo 25/26', 'Equipo 26/27',
      'Tutor', 'Email tutor', 'Teléfono tutor', 'Dirección',
      'Forms link', '¿Continúa?', '¿Cumple requisitos?', '¿Reservó?',
      'Notas', 'Alta',
    ],
    (players ?? []).map((p: Record<string, unknown>) => [
      s(p.last_name), s(p.first_name), s(p.dni), fmtDate(p.birth_date as string),
      s(p.gender), s(p.position), s(p.status),
      s(p.team_id ? teamName.get(p.team_id as string) : ''),
      s(p.next_team_id ? teamName.get(p.next_team_id as string) : ''),
      s(p.tutor_name), s(p.tutor_email), s(p.tutor_phone), s(p.address),
      s(p.forms_link),
      p.wants_to_continue == null ? '' : (p.wants_to_continue ? 'SÍ' : 'NO'),
      p.meets_requirements == null ? '' : (p.meets_requirements ? 'SÍ' : 'NO'),
      p.made_reservation == null ? '' : (p.made_reservation ? 'SÍ' : 'NO'),
      s(p.notes),
      fmtDate(p.created_at as string),
    ]),
  )

  // ── 2) Equipos ────────────────────────────────────────────────
  const { data: teamsFull } = await sb
    .from('teams')
    .select('id, name, season, active, category_id, coordinator_id, club_member_roles!fk_cmr_team(member_id)')
    .eq('club_id', clubId)
    .order('name')

  await exportTab(
    'Equipos',
    ['Nombre', 'Temporada', 'Activo', 'ID'],
    (teamsFull ?? []).map((t: Record<string, unknown>) => [
      s(t.name), s(t.season), t.active ? 'SÍ' : 'NO', s(t.id),
    ]),
  )

  // ── 3) Cuerpo técnico ─────────────────────────────────────────
  const { data: members } = await sb
    .from('club_members')
    .select('id, full_name, email, phone, active, role, club_member_roles(role, team_id)')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('full_name')

  await exportTab(
    'Cuerpo técnico',
    ['Nombre', 'Email', 'Teléfono', 'Roles', 'Equipos'],
    (members ?? []).map((m: Record<string, unknown>) => {
      const roles = ((m.club_member_roles as Array<{ role: string; team_id: string | null }>) ?? [])
      const rolesStr = [...new Set(roles.map(r => r.role))].join(', ') || s(m.role)
      const equipos = roles.map(r => r.team_id ? teamName.get(r.team_id) : null).filter(Boolean).join(', ')
      return [s(m.full_name), s(m.email), s(m.phone), rolesStr, equipos]
    }),
  )

  // Mapa de jugadores para joins en pagos / lesiones
  const playerLabel = new Map<string, string>()
  for (const p of (players ?? [])) {
    playerLabel.set(p.id, `${p.last_name ?? ''}, ${p.first_name ?? ''}`.trim())
  }

  // ── 4) Pagos de cuotas ────────────────────────────────────────
  const { data: payments } = await sb
    .from('quota_payments')
    .select('id, player_id, season, month, concept, amount_due, amount_paid, payment_date, payment_method, status, notes, created_at')
    .eq('club_id', clubId)
    .order('payment_date', { ascending: false, nullsFirst: false })
    .limit(5000)

  await exportTab(
    'Pagos',
    ['Jugador', 'Temporada', 'Mes', 'Concepto', 'Importe debido', 'Importe pagado', 'Fecha pago', 'Método', 'Estado', 'Notas', 'Creado'],
    (payments ?? []).map((p: Record<string, unknown>) => [
      s(playerLabel.get(p.player_id as string)),
      s(p.season), s(p.month), s(p.concept),
      fmtMoney(p.amount_due as number), fmtMoney(p.amount_paid as number),
      fmtDate(p.payment_date as string),
      s(p.payment_method), s(p.status), s(p.notes),
      fmtDate(p.created_at as string),
    ]),
  )

  // ── 5) Gastos ─────────────────────────────────────────────────
  const { data: expenses } = await sb
    .from('expenses')
    .select('id, category, description, amount, expense_date, payment_method, receipt_url, created_at')
    .eq('club_id', clubId)
    .order('expense_date', { ascending: false, nullsFirst: false })
    .limit(5000)

  await exportTab(
    'Gastos',
    ['Fecha', 'Categoría', 'Descripción', 'Importe', 'Método', 'Recibo URL', 'Creado'],
    (expenses ?? []).map((e: Record<string, unknown>) => [
      fmtDate(e.expense_date as string), s(e.category), s(e.description),
      fmtMoney(e.amount as number), s(e.payment_method), s(e.receipt_url),
      fmtDate(e.created_at as string),
    ]),
  )

  // ── 6) Transferencias bancarias ───────────────────────────────
  const { data: transfers } = await sb
    .from('bank_transfers')
    .select('id, transfer_date, amount, concept, payer, status, matched_player_id, match_confidence, notes, created_at')
    .eq('club_id', clubId)
    .order('transfer_date', { ascending: false })
    .limit(5000)

  await exportTab(
    'Transferencias',
    ['Fecha', 'Importe', 'Concepto', 'Ordenante', 'Estado', 'Jugador asignado', 'Confianza match', 'Notas', 'Creado'],
    (transfers ?? []).map((t: Record<string, unknown>) => [
      fmtDate(t.transfer_date as string),
      fmtMoney(t.amount as number),
      s(t.concept), s(t.payer), s(t.status),
      s(playerLabel.get(t.matched_player_id as string)),
      t.match_confidence != null ? Number(t.match_confidence) : null,
      s(t.notes),
      fmtDate(t.created_at as string),
    ]),
  )

  // ── 7) Cierres de caja ────────────────────────────────────────
  const { data: closes } = await sb
    .from('cash_closes')
    .select('id, close_date, cash_system, cash_real, card_system, card_real, difference, signed_by, notes, created_at')
    .eq('club_id', clubId)
    .order('close_date', { ascending: false })
    .limit(1000)

  await exportTab(
    'Cierres caja',
    ['Fecha', 'Efectivo sistema', 'Efectivo real', 'Tarjeta sistema', 'Tarjeta real', 'Diferencia', 'Firmado por', 'Notas', 'Creado'],
    (closes ?? []).map((c: Record<string, unknown>) => [
      fmtDate(c.close_date as string),
      fmtMoney(c.cash_system as number), fmtMoney(c.cash_real as number),
      fmtMoney(c.card_system as number), fmtMoney(c.card_real as number),
      fmtMoney(c.difference as number),
      s(c.signed_by), s(c.notes),
      fmtDate(c.created_at as string),
    ]),
  )

  // ── 8) Documentos: trial letters ──────────────────────────────
  const { data: trials } = await sb
    .from('trial_letters')
    .select('id, player_id, destination_club, trial_dates, sent_at, pdf_url, signed_by, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(2000)

  await exportTab(
    'Cartas de prueba',
    ['Jugador', 'Club destino', 'Fechas prueba', 'Enviada', 'PDF URL', 'Firmado por', 'Creada'],
    (trials ?? []).map((tr: Record<string, unknown>) => [
      s(playerLabel.get(tr.player_id as string)),
      s(tr.destination_club),
      s(tr.trial_dates),
      fmtDate(tr.sent_at as string),
      s(tr.pdf_url),
      s(tr.signed_by),
      fmtDate(tr.created_at as string),
    ]),
  )

  // ── 9) Lesiones ───────────────────────────────────────────────
  const { data: injuries } = await sb
    .from('injuries')
    .select('id, player_id, injury_type, description, injury_date, recovery_estimated, recovery_actual, status, created_at')
    .eq('club_id', clubId)
    .order('injury_date', { ascending: false, nullsFirst: false })
    .limit(2000)

  await exportTab(
    'Lesiones',
    ['Jugador', 'Tipo', 'Descripción', 'Fecha lesión', 'Recup. estimada', 'Recup. real', 'Estado', 'Creado'],
    (injuries ?? []).map((i: Record<string, unknown>) => [
      s(playerLabel.get(i.player_id as string)),
      s(i.injury_type), s(i.description),
      fmtDate(i.injury_date as string),
      fmtDate(i.recovery_estimated as string),
      fmtDate(i.recovery_actual as string),
      s(i.status),
      fmtDate(i.created_at as string),
    ]),
  )

  // ── 10) Sanciones ─────────────────────────────────────────────
  const { data: sanctions } = await sb
    .from('player_sanctions')
    .select('id, player_id, reason, matches_remaining, active, sanction_date, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(2000)

  await exportTab(
    'Sanciones',
    ['Jugador', 'Motivo', 'Partidos restantes', 'Activa', 'Fecha sanción', 'Creada'],
    (sanctions ?? []).map((sn: Record<string, unknown>) => [
      s(playerLabel.get(sn.player_id as string)),
      s(sn.reason),
      s(sn.matches_remaining),
      sn.active ? 'SÍ' : 'NO',
      fmtDate(sn.sanction_date as string),
      fmtDate(sn.created_at as string),
    ]),
  )

  return {
    ok: errorCount === 0,
    spreadsheetId,
    tabs,
    totalRows,
    errorCount,
    durationMs: Date.now() - t0,
  }
}
