'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { getNextSeason } from '@/lib/utils/currency'

const LEGACY_CONCEPT = 'Cuota mensual'

export type ReconDiag = 'al_dia' | 'infra' | 'sobre' | 'sin_tarifa' | 'revisar' | 'manual_hno'

export interface ReconRow {
  playerId: string
  nombre: string
  equipo: string
  hermanos: number                  // nº de hermanos en el club (familia)
  conceptosActuales: string
  emitidoActual: number
  pagadoReal: number
  tarifaBase: number                // tarifa del equipo sin descuentos
  tarifaCorrecta: number            // con descuento de hermanos aplicado
  pendienteNuevo: number            // tras aplicar pp si procede
  ppAplicado: boolean
  diagnostico: ReconDiag
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function previewLegacyCuotaReconciliation(): Promise<{
  success: boolean; error?: string; season?: string; rows?: ReconRow[]
  totals?: { jugadores: number; pagadoReal: number; tarifaCorrecta: number; revisar: number }
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const season = getNextSeason()
    const feesSeason = season.replace('-', '/')

    // Config de descuentos
    const { data: cs } = await sb.from('club_settings')
      .select('quota_amounts, sibling_discount_enabled, sibling_discount_percent')
      .eq('club_id', clubId).single()
    const ppPct = Number(cs?.quota_amounts?.earlyPayDiscount ?? 0)
    const sibEnabled = !!cs?.sibling_discount_enabled
    const sibPct = Number(cs?.sibling_discount_percent ?? 0)

    // Filas de cuota de la temporada
    type Row = { player_id: string; concept: string; amount_due: number; amount_paid: number }
    const allRows = (await fetchAllRows(() => sb.from('quota_payments')
      .select('player_id, concept, amount_due, amount_paid')
      .eq('club_id', clubId).eq('season', season).neq('status', 'refunded'))) as Row[]

    const affected = new Set<string>(allRows.filter(r => r.concept === LEGACY_CONCEPT).map(r => r.player_id))
    if (affected.size === 0) return { success: true, season, rows: [], totals: { jugadores: 0, pagadoReal: 0, tarifaCorrecta: 0, revisar: 0 } }

    // Jugadores afectados
    const affPlayers = await fetchAllRows(() => sb.from('players')
      .select('id, first_name, last_name, next_team_id, team_id, family_group_id')
      .eq('club_id', clubId).in('id', Array.from(affected)))
    type P = { id: string; first_name: string; last_name: string; next_team_id: string | null; team_id: string | null; family_group_id: string | null }
    const pmap = new Map<string, P>((affPlayers as P[]).map(p => [p.id, p]))

    // Equipos + tarifa base por equipo
    const { data: teams } = await sb.from('teams').select('id, name').eq('club_id', clubId)
    const teamName = new Map<string, string>((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))
    const fees = await fetchAllRows(() => sb.from('season_fees')
      .select('team_id, amount').eq('club_id', clubId).in('season', [feesSeason, season]).neq('concept', 'Pago Completo'))
    const teamFee = new Map<string, number>()
    for (const f of fees as Array<{ team_id: string; amount: number }>) {
      teamFee.set(f.team_id, (teamFee.get(f.team_id) ?? 0) + Number(f.amount))
    }
    const baseTarifa = (p: P) => {
      const tid = p.next_team_id ?? p.team_id
      return tid ? (teamFee.get(tid) ?? 0) : 0
    }

    // Familias: para calcular hermanos y la cuota más barata necesitamos TODOS los
    // miembros activos de cada familia involucrada (no solo los afectados).
    const familyIds = Array.from(new Set((affPlayers as P[]).map(p => p.family_group_id).filter(Boolean))) as string[]
    const famMembers = familyIds.length > 0
      ? await fetchAllRows(() => sb.from('players')
          .select('id, next_team_id, team_id, family_group_id')
          .eq('club_id', clubId).neq('status', 'low').in('family_group_id', familyIds))
      : []
    const famByGroup = new Map<string, P[]>()
    for (const m of famMembers as P[]) {
      const g = m.family_group_id!; const arr = famByGroup.get(g) ?? []; arr.push(m); famByGroup.set(g, arr)
    }

    // Pagos por jugador afectado
    const rowsByPlayer = new Map<string, Row[]>()
    for (const r of allRows) {
      if (!affected.has(r.player_id)) continue
      const a = rowsByPlayer.get(r.player_id) ?? []; a.push(r); rowsByPlayer.set(r.player_id, a)
    }

    const out: ReconRow[] = []
    for (const [pid, prows] of rowsByPlayer) {
      const p = pmap.get(pid)!
      const base = baseTarifa(p)
      const pagado = round2(prows.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0))
      const emitido = round2(prows.reduce((s, r) => s + Number(r.amount_due ?? 0), 0))

      // Hermanos
      const fam = p.family_group_id ? (famByGroup.get(p.family_group_id) ?? []) : []
      const hermanos = fam.length

      // Tarifa correcta con descuento de hermanos (2 hermanos: 40% al más barato).
      let tarifaCorrecta = base
      let manualHno = false
      if (sibEnabled && sibPct > 0 && hermanos >= 2) {
        if (hermanos >= 3) {
          manualHno = true   // 3º hermano = cuota fija 120€: no se auto-aplica, revisar a mano
        } else {
          // SOLO el hermano más barato lleva el 40% (desempate determinista por id).
          // El otro paga íntegro. (Evita el doble-descuento en hermanos del mismo equipo.)
          const sorted = [...fam].sort((a, b) => (baseTarifa(a) - baseTarifa(b)) || a.id.localeCompare(b.id))
          if (sorted[0]?.id === p.id) tarifaCorrecta = round2(base * (1 - sibPct / 100))
        }
      }

      // Pronto pago: si lo pagado cubre la tarifa con 5% → al día
      const ppTarget = round2(tarifaCorrecta * (1 - ppPct / 100))
      const ppAplicado = ppPct > 0 && pagado >= ppTarget - 0.5 && pagado <= tarifaCorrecta + 0.5
      const pendienteNuevo = ppAplicado ? 0 : round2(Math.max(0, tarifaCorrecta - pagado))

      // Diagnóstico
      let diag: ReconDiag
      if (base === 0) diag = 'sin_tarifa'
      else if (pagado > tarifaCorrecta + 1) diag = 'revisar'   // pagó de más → posible concepto ajeno (campamento/torneo)
      else if (manualHno) diag = 'manual_hno'
      else if (pendienteNuevo <= 0.01) diag = 'al_dia'
      else if (emitido > tarifaCorrecta + 0.01) diag = 'sobre'
      else diag = 'infra'

      out.push({
        playerId: pid,
        nombre: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        equipo: (p.next_team_id ?? p.team_id) ? (teamName.get((p.next_team_id ?? p.team_id)!) ?? '—') : '—',
        hermanos,
        conceptosActuales: prows.sort((a, b) => a.concept.localeCompare(b.concept))
          .map(r => `${r.concept}:${Number(r.amount_due)}/${Number(r.amount_paid)}`).join(' · '),
        emitidoActual: emitido,
        pagadoReal: pagado,
        tarifaBase: round2(base),
        tarifaCorrecta,
        pendienteNuevo,
        ppAplicado,
        diagnostico: diag,
      })
    }
    out.sort((a, b) => a.equipo.localeCompare(b.equipo, 'es') || a.nombre.localeCompare(b.nombre, 'es'))

    return {
      success: true, season, rows: out,
      totals: {
        jugadores: out.length,
        pagadoReal: round2(out.reduce((s, r) => s + r.pagadoReal, 0)),
        tarifaCorrecta: round2(out.reduce((s, r) => s + r.tarifaCorrecta, 0)),
        revisar: out.filter(r => r.diagnostico === 'revisar' || r.diagnostico === 'manual_hno' || r.diagnostico === 'sin_tarifa').length,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
