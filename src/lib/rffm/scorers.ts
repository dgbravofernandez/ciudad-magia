/**
 * RFFM Scorers (Goleadores) sweep
 *
 * RFFM is a Next.js app that loads competition/group/scorer data client-side
 * via its own REST API (not SSR). The correct endpoints are:
 *
 *   GET /api/competitions?temporada=21&tipojuego=2   → competitions[]
 *   GET /api/groups?competicion=X                    → groups[]
 *   GET /api/scorers?idGroup=Y&idCompetition=X       → { goles: [] }
 *
 * gameTypes (RFFM internal):
 *   tipojuego=1 → Fútbol 11
 *   tipojuego=2 → Fútbol 7
 *   tipojuego=3 → Fútbol Sala
 *   tipojuego=4 → Fútbol 5
 */

import { fetchRffmAPI } from './client'
import type { RffmScorerEntry } from './types'
import { SCORER_SWEEP_TIPOJUEGOS } from './constants'

// ── Types ──────────────────────────────────────────────────────

/** Shape returned by /api/competitions */
type ApiCompeticion = {
  codigo: string
  nombre: string
  codigo_tipo_juego?: string
  TipoJuego?: string
  goleadores?: string      // "1" = scorers enabled at competition level
  [key: string]: unknown
}

/** Shape returned by /api/groups */
type ApiGrupo = {
  codigo: string
  nombre: string
  total_jornadas?: string
  total_equipos?: string
  clasificacion_goleadores?: string   // "1" = scorers enabled
  ver_clasificacion?: string
  orden?: string
}

/** Shape returned by /api/scorers */
type ApiScorers = {
  estado?: string
  sesion_ok?: string
  competicion?: string
  grupo?: string
  goles?: RffmScorerEntry[]
}

// ── Single group scorers ───────────────────────────────────────

export async function getScorers(
  _codTemporada: string,
  _codTipojuego: string,
  codCompeticion: string,
  codGrupo: string
): Promise<RffmScorerEntry[]> {
  try {
    const data = await fetchRffmAPI<ApiScorers>('scorers', {
      idCompetition: codCompeticion,
      idGroup: codGrupo,
    })
    return data?.goles ?? []
  } catch {
    return []
  }
}

// ── Enumerate ALL competitions + groups ────────────────────────

export interface CompetitionGroupRef {
  codTemporada: string
  codTipojuego: string
  codCompeticion: string
  codGrupo: string
  nombreCompeticion: string
  nombreGrupo: string
  hasScorers: boolean
}

/**
 * Fetches all competitions and all their groups for a given tipojuego.
 *
 * Strategy:
 * 1. GET /api/competitions?temporada=21&tipojuego=X
 * 2. For each competition, GET /api/groups?competicion=X
 * 3. Filter groups where clasificacion_goleadores === '1'
 */
export async function getAllGroupRefs(
  codTemporada: string,
  codTipojuego: string
): Promise<CompetitionGroupRef[]> {
  let competitions: ApiCompeticion[] = []

  try {
    competitions = await fetchRffmAPI<ApiCompeticion[]>('competitions', {
      temporada: codTemporada,
      tipojuego: codTipojuego,
    })
  } catch {
    return []
  }

  if (!Array.isArray(competitions) || competitions.length === 0) return []

  const result: CompetitionGroupRef[] = []

  for (const comp of competitions) {
    // Skip competitions with scorers explicitly disabled
    if (comp.goleadores === '0') continue

    let groups: ApiGrupo[] = []
    try {
      groups = await fetchRffmAPI<ApiGrupo[]>('groups', {
        competicion: comp.codigo,
      })
    } catch {
      continue
    }

    if (!Array.isArray(groups)) continue

    for (const group of groups) {
      result.push({
        codTemporada,
        codTipojuego,
        codCompeticion: comp.codigo,
        codGrupo: group.codigo,
        nombreCompeticion: comp.nombre,
        nombreGrupo: group.nombre,
        hasScorers: group.clasificacion_goleadores === '1',
      })
    }
  }

  return result
}

// ── Full sweep: goleadores from ALL groups ─────────────────────

export interface GroupScorersResult {
  codCompeticion: string
  codGrupo: string
  nombreCompeticion: string
  nombreGrupo: string
  codTipojuego: string
  scorers: RffmScorerEntry[]
}

/**
 * Sweeps ALL groups across the given tipojuegos for a season.
 * Defaults to F7 + F11 only (SCORER_SWEEP_TIPOJUEGOS = ['1','2']).
 * Returns scorers for every group that has the scorers feature enabled.
 */
export async function sweepAllGroupScorers(
  codTemporada: string,
  tiposjuego: string[] = SCORER_SWEEP_TIPOJUEGOS
): Promise<GroupScorersResult[]> {
  const results: GroupScorersResult[] = []

  for (const codTipojuego of tiposjuego) {
    let groupRefs: CompetitionGroupRef[]
    try {
      groupRefs = await getAllGroupRefs(codTemporada, codTipojuego)
    } catch {
      continue
    }

    const scorerGroups = groupRefs.filter(g => g.hasScorers)

    for (const ref of scorerGroups) {
      const scorers = await getScorers(
        ref.codTemporada,
        ref.codTipojuego,
        ref.codCompeticion,
        ref.codGrupo
      )
      if (scorers.length > 0) {
        results.push({
          codCompeticion: ref.codCompeticion,
          codGrupo: ref.codGrupo,
          nombreCompeticion: ref.nombreCompeticion,
          nombreGrupo: ref.nombreGrupo,
          codTipojuego: ref.codTipojuego,
          scorers,
        })
      }
    }
  }

  return results
}
