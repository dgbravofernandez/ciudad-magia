import { fetchRffmSSR } from './client'
import type { RffmScorerEntry, RffmCompeticion, RffmGrupo } from './types'
import { SCORER_SWEEP_TIPOJUEGOS } from './constants'

// ── Types ──────────────────────────────────────────────────────

interface ClasificacionesPageProps {
  competitions: RffmCompeticion[]
  groups: RffmGrupo[]
  seasons: Array<{ codigo: string; nombre: string }>
  gameTypes: Array<{ codigo: string; nombre: string }>
}

interface GoleadoresPageProps {
  scorers: {
    estado: string
    sesion_ok: string
    competicion: string
    grupo: string
    goles: RffmScorerEntry[]
  }
  group: RffmGrupo
  competition: RffmCompeticion
  competitions: RffmCompeticion[]
}

// ── Single group scorers ───────────────────────────────────────

export async function getScorers(
  codTemporada: string,
  codTipojuego: string,
  codCompeticion: string,
  codGrupo: string
): Promise<RffmScorerEntry[]> {
  try {
    const data = await fetchRffmSSR<GoleadoresPageProps>(
      'competicion/goleadores',
      {
        temporada: codTemporada,
        tipojuego: codTipojuego,
        competicion: codCompeticion,
        grupo: codGrupo,
      }
    )
    return data.scorers?.goles ?? []
  } catch {
    return []  // group may not have scorers enabled
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
 * Fetches all competitions and all their groups for a given season+tipojuego.
 *
 * Strategy:
 * 1. Load /clasificaciones without competition → get competitions[]
 * 2. If competitions[] is empty, bail out (tipojuego doesn't exist this season)
 * 3. For each competition, load its groups by fetching the page with ?competicion=X
 *    (the groups[] change depending on which competition is selected)
 */
export async function getAllGroupRefs(
  codTemporada: string,
  codTipojuego: string
): Promise<CompetitionGroupRef[]> {
  let competitions: RffmCompeticion[] = []

  // First: get the list of competitions for this tipojuego
  try {
    const data = await fetchRffmSSR<ClasificacionesPageProps>(
      'competicion/clasificaciones',
      { temporada: codTemporada, tipojuego: codTipojuego }
    )
    competitions = data.competitions ?? []
  } catch {
    return []  // tipojuego doesn't exist for this season
  }

  if (competitions.length === 0) return []

  const result: CompetitionGroupRef[] = []

  for (const comp of competitions) {
    // Skip competitions with no groups expected
    if (comp.total_grupos === '0') continue

    let groups: RffmGrupo[] = []
    try {
      const compData = await fetchRffmSSR<ClasificacionesPageProps>(
        'competicion/clasificaciones',
        {
          temporada: codTemporada,
          tipojuego: codTipojuego,
          competicion: comp.codigo,
        }
      )
      groups = compData.groups ?? []
    } catch {
      continue
    }

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
 * Defaults to F7 + F11 only (SCORER_SWEEP_TIPOJUEGOS).
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
