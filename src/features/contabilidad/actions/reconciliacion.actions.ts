'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { getNextSeason } from '@/lib/utils/currency'

const LEGACY_CONCEPT = 'Cuota mensual'
const PROPER_CONCEPTS = ['Reserva', 'Cuota 1', 'Cuota 2', 'Cuota 3']

export interface ReconRow {
  playerId: string
  nombre: string
  equipo: string
  hasSibling: boolean
  conceptosActuales: string         // resumen legible "Cuota 1:130/130 · Cuota mensual:190/190 …"
  emitidoActual: number
  pagadoReal: number
  tarifaCorrecta: number            // tarifa base del equipo (sin descuentos)
  pendienteNuevo: number            // max(0, tarifaCorrecta - pagadoReal)
  diagnostico: 'infra' | 'sobre' | 'ok' | 'sin_tarifa'
}

/**
 * PREVISUALIZACIÓN (solo lectura) de la reconciliación del concepto legado
 * "Cuota mensual". No modifica nada. Para cada jugador afectado calcula su
 * estado actual y el correcto según la tarifa del equipo.
 */
export async function previewLegacyCuotaReconciliation(): Promise<{
  success: boolean; error?: string; season?: string; rows?: ReconRow[]
  totals?: { jugadores: number; emitidoActual: number; pagadoReal: number; tarifaCorrecta: number }
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const season = getNextSeason()                 // '2026-27'
    const feesSeason = season.replace('-', '/')    // '2026/27'

    // 1. Todas las filas de cuota de la temporada
    type Row = { player_id: string; concept: string; amount_due: number; amount_paid: number }
    const allRows = (await fetchAllRows(() => sb.from('quota_payments')
      .select('player_id, concept, amount_due, amount_paid')
      .eq('club_id', clubId).eq('season', season).neq('status', 'refunded'))) as Row[]

    // 2. Jugadores afectados = los que tienen alguna fila "Cuota mensual"
    const affected = new Set<string>(
      allRows.filter(r => r.concept === LEGACY_CONCEPT).map(r => r.player_id))
    if (affected.size === 0) return { success: true, season, rows: [], totals: { jugadores: 0, emitidoActual: 0, pagadoReal: 0, tarifaCorrecta: 0 } }

    // 3. Datos de jugador + equipo
    const players = await fetchAllRows(() => sb.from('players')
      .select('id, first_name, last_name, next_team_id, team_id, family_group_id')
      .eq('club_id', clubId).in('id', Array.from(affected)))
    const playerMap = new Map<string, { name: string; teamId: string | null; sibling: boolean }>()
    for (const p of players as Array<{ id: string; first_name: string; last_name: string; next_team_id: string | null; team_id: string | null; family_group_id: string | null }>) {
      playerMap.set(p.id, {
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        teamId: p.next_team_id ?? p.team_id,
        sibling: !!p.family_group_id,
      })
    }

    // 4. Nombre de equipo + tarifa base por equipo (suma de season_fees excl. Pago Completo)
    const { data: teams } = await sb.from('teams').select('id, name').eq('club_id', clubId)
    const teamName = new Map<string, string>((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))
    const fees = await fetchAllRows(() => sb.from('season_fees')
      .select('team_id, concept, amount')
      .eq('club_id', clubId).in('season', [feesSeason, season]).neq('concept', 'Pago Completo'))
    const teamFee = new Map<string, number>()
    for (const f of fees as Array<{ team_id: string; amount: number }>) {
      teamFee.set(f.team_id, (teamFee.get(f.team_id) ?? 0) + Number(f.amount))
    }

    // 5. Construir filas de preview
    const byPlayer = new Map<string, Row[]>()
    for (const r of allRows) {
      if (!affected.has(r.player_id)) continue
      const arr = byPlayer.get(r.player_id) ?? []
      arr.push(r); byPlayer.set(r.player_id, arr)
    }

    const rows: ReconRow[] = []
    for (const [pid, prows] of byPlayer) {
      const pinfo = playerMap.get(pid)
      const emitido = round2(prows.reduce((s, r) => s + Number(r.amount_due ?? 0), 0))
      const pagado = round2(prows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0))
      const tarifa = pinfo?.teamId ? (teamFee.get(pinfo.teamId) ?? 0) : 0
      const resumen = prows
        .sort((a, b) => a.concept.localeCompare(b.concept))
        .map(r => `${r.concept}:${Number(r.amount_due)}/${Number(r.amount_paid)}`)
        .join(' · ')
      let diag: ReconRow['diagnostico'] = 'ok'
      if (tarifa === 0) diag = 'sin_tarifa'
      else if (emitido < tarifa - 0.01) diag = 'infra'
      else if (emitido > tarifa + 0.01) diag = 'sobre'
      rows.push({
        playerId: pid,
        nombre: pinfo?.name ?? pid,
        equipo: pinfo?.teamId ? (teamName.get(pinfo.teamId) ?? '—') : '—',
        hasSibling: pinfo?.sibling ?? false,
        conceptosActuales: resumen,
        emitidoActual: emitido,
        pagadoReal: pagado,
        tarifaCorrecta: round2(tarifa),
        pendienteNuevo: round2(Math.max(0, tarifa - pagado)),
        diagnostico: diag,
      })
    }
    rows.sort((a, b) => a.equipo.localeCompare(b.equipo, 'es') || a.nombre.localeCompare(b.nombre, 'es'))

    const totals = {
      jugadores: rows.length,
      emitidoActual: round2(rows.reduce((s, r) => s + r.emitidoActual, 0)),
      pagadoReal: round2(rows.reduce((s, r) => s + r.pagadoReal, 0)),
      tarifaCorrecta: round2(rows.reduce((s, r) => s + r.tarifaCorrecta, 0)),
    }
    return { success: true, season, rows, totals }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
