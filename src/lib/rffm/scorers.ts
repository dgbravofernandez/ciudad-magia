import { fetchRffmSSR } from './client'
import type { RffmScorerEntry, RffmCompeticion, RffmGrupo } from './types'

// ── Types for the classification page (used to enumerate groups) ──

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

// ── Enumerate ALL competitions + groups for a season ──────────

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
 * Fetches all competitions and groups for a given season/tipojuego,
 * by reading them from the clasificaciones SSR page.
 * Uses the first competition to get the groups structure, then iterates.
 */
export async function getAllGroupRefs(
  codTemporada: string,
  codTipojuego: string
): Promise<CompetitionGroupRef[]> {
  // We need at least one competition to load the page.
  // Fetch the page without specifying a competition to get the full list.
  const data = await fetchRffmSSR<ClasificacionesPageProps>(
    'competicion/clasificaciones',
    { temporada: codTemporada, tipojuego: codTipojuego }
  )

  const competitions = data.competitions ?? []
  if (competitions.length === 0) return []

  const result: CompetitionGroupRef[] = []

  // For each competition, load its groups
  for (const comp of competitions) {
    // Fetch the page for this competition to get its groups
    const compData = await fetchRffmSSR<ClasificacionesPageProps>(
      'competicion/clasificaciones',
      {
        temporada: codTemporada,
        tipojuego: codTipojuego,
        competicion: comp.codigo,
      }
    )

    const groups = compData.groups ?? []
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

// ── Full sweep: ALL groups in ALL tipojuegos ───────────────────

export interface GroupScorersResult {
  codCompeticion: string
  codGrupo: string
  nombreCompeticion: string
  nombreGrupo: string
  codTipojuego: string
  scorers: RffmScorerEntry[]
}

/**
 * Sweeps ALL groups across ALL tipojuegos for a season.
 * Returns scorers for every group that has the scorers feature enabled.
 * This is the main entry point for the global scouting sweep.
 */
export async function sweepAllGroupScorers(
  codTemporada: string,
  tiposjuego: string[] = ['1', '2', '3', '4', '5']
): Promise<GroupScorersResult[]> {
  const results: GroupScorersResult[] = []

  for (const codTipojuego of tiposjuego) {
    let groupRefs: CompetitionGroupRef[]
    try {
      groupRefs = await getAllGroupRefs(codTemporada, codTipojuego)
    } catch {
      continue  // this tipojuego may not exist for this season
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
