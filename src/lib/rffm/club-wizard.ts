// ──────────────────────────────────────────────────────────────
// Wizard 1-click: detecta TODAS las competiciones del club RFFM
// partiendo solo del codigo_club. Sin PDF, sin matching manual.
//
// Estrategia:
//   1. /fichaclub/{codigoClub} → equipos_club[] (codigo_equipo + categoria)
//   2. Cachear /api/competitions?tipojuego=X (3 fetches max)
//   3. Para cada equipo del club:
//      a) Detectar tipojuego del texto de categoría
//      b) Buscar TODAS las competiciones que matchean por nombre (puede
//         haber varias: Liga + Copa + Fase final)
//      c) Para cada competición candidata:
//         - Fetch /api/groups?competicion=X (cached)
//         - Fetch standings de cada grupo (cached) → verificar codigo_equipo
//         - Si está en standings, registrar (cod_competicion, cod_grupo)
//   4. Devolver un MatchedRow[] con TODAS las competiciones detectadas
//      (un equipo puede generar 2-3 entries: Liga, Copa, Subgrupo fase 2)
// ──────────────────────────────────────────────────────────────

import { fetchRffmSSR } from './client'
import { getStandings } from './standings'
import {
  RffmCache,
  tokenize,
  type FichaClubResponse,
  type MatchedRow,
  type RffmEquipoClub,
  type RffmCompetition,
  type RffmGroup,
} from './club-importer'
import { CURRENT_SEASON } from './constants'
import type { PdfRow } from './parse-club-pdf'

// ── Concurrency helper (fan-out controlado) ────────────────────

async function pMap<I, O>(items: I[], fn: (item: I) => Promise<O>, concurrency: number): Promise<O[]> {
  const results: O[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      try {
        results[idx] = await fn(items[idx])
      } catch (e) {
        // Capturamos pero no rompemos el batch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results[idx] = { __err: (e as Error).message } as any
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

// ── Tipojuego helpers ──────────────────────────────────────────

function detectTipoJuegoFromCategoria(categoria: string): string {
  const text = categoria.toUpperCase()
  if (/\b(FUTSAL|SALA)\b/.test(text)) return '4'
  if (/F[-]?7\b|FUTBOL[-\s]?7|FÚTBOL[-\s]?7/.test(text)) return '2'
  return '1'
}

// Heurística: hay competiciones donde el equipo aparece pero su
// "categoria" en fichaclub no es exactamente el mismo nombre. Ej:
// equipo en "PRIMERA AFICIONADO" categoria, pero también juega
// "COPA DE AFICIONADOS RFFM". Retornamos las competitions cuyo
// nombre comparte tokens significativos.
function findCompetitionCandidates(
  categoria: string,
  comps: RffmCompetition[],
): RffmCompetition[] {
  const catTokens = tokenize(categoria)
  if (catTokens.length === 0) return []

  // Match estricto: TODOS los tokens del categoria están en el comp
  const strictMatches: RffmCompetition[] = []
  // Match parcial: ≥60% tokens coinciden + heurísticas (Copa, Fase, etc.)
  const partialMatches: RffmCompetition[] = []

  for (const c of comps) {
    const apiTokens = tokenize(c.nombre)
    const apiSet = new Set(apiTokens)
    let hits = 0
    for (const t of catTokens) if (apiSet.has(t)) hits++
    const ratio = hits / catTokens.length
    if (ratio >= 0.99) strictMatches.push(c)
    else if (ratio >= 0.6) partialMatches.push(c)
  }

  // Devuelve ambas listas concatenadas, strict primero
  return [...strictMatches, ...partialMatches]
}

// ── Cache de standings (clave: cod_competicion + cod_grupo) ────

class StandingsCache {
  private cache = new Map<string, Set<string>>()  // key → Set<codigo_equipo>

  async getTeamCodesInGroup(
    cod_temporada: string,
    cod_tipojuego: string,
    cod_competicion: string,
    cod_grupo: string,
  ): Promise<Set<string>> {
    const key = `${cod_competicion}_${cod_grupo}`
    if (this.cache.has(key)) return this.cache.get(key)!
    try {
      const standings = await getStandings(cod_temporada, cod_tipojuego, cod_competicion, cod_grupo)
      const codes = new Set(standings.map(s => s.codigo_equipo))
      this.cache.set(key, codes)
      return codes
    } catch {
      this.cache.set(key, new Set())
      return new Set()
    }
  }
}

// ── Función principal del wizard ───────────────────────────────

export interface WizardResult {
  matched: MatchedRow[]      // Una entry por (equipo × competición × grupo) detectada
  total: number              // Equipos del club
  okCount: number            // Equipos con al menos 1 competición detectada
  failedCount: number        // Equipos sin ninguna competición detectada
  competitionCount: number   // Total de tracked_competitions a crear
  durationMs: number
  warnings: string[]
}

export async function detectClubCompetitions(
  codigoClub: string,
  codTemporada: string = CURRENT_SEASON,
): Promise<WizardResult> {
  const t0 = Date.now()
  const warnings: string[] = []

  // 1. Fetch fichaclub para obtener equipos_club[]
  let equiposClub: RffmEquipoClub[] = []
  let nombreClub = ''
  try {
    const ficha = await fetchRffmSSR<FichaClubResponse>(`fichaclub/${codigoClub}`)
    equiposClub = ficha.club?.equipos_club ?? []
    nombreClub = ficha.club?.nombre_club ?? ''
  } catch (e) {
    throw new Error(`No se pudo cargar fichaclub/${codigoClub}: ${(e as Error).message}`)
  }
  if (!equiposClub.length) {
    throw new Error(`El club ${codigoClub} no tiene equipos en RFFM. Verifica que el código es correcto.`)
  }

  // 2. Cachear competitions por tipojuego (3 unique max)
  const cache = new RffmCache()
  const standingsCache = new StandingsCache()
  const tipojuegosUsados = new Set<string>()
  for (const e of equiposClub) tipojuegosUsados.add(detectTipoJuegoFromCategoria(e.categoria))
  // Pre-cachear competitions de los tipojuego usados
  await Promise.all([...tipojuegosUsados].map(tj => cache.getCompetitions(tj, codTemporada)))

  // 3. Para cada equipo, detectar todas sus competiciones+grupos
  const allMatched: MatchedRow[] = []
  const equipoStatus = new Map<string, { found: number; tried: number }>()

  // Fan-out: procesamos los 67 equipos en paralelo (concurrency 6 para no saturar)
  await pMap(equiposClub, async (eq) => {
    const cod_tipojuego = detectTipoJuegoFromCategoria(eq.categoria)
    const comps = await cache.getCompetitions(cod_tipojuego, codTemporada)
    const candidates = findCompetitionCandidates(eq.categoria, comps)

    equipoStatus.set(eq.codigo_equipo, { found: 0, tried: candidates.length })

    if (candidates.length === 0) {
      warnings.push(`Equipo "${eq.nombre_equipo}" (${eq.codigo_equipo}): ninguna competición de RFFM coincide con "${eq.categoria}"`)
      return
    }

    // Para cada candidate, ver en qué grupo está nuestro equipo
    for (const comp of candidates) {
      const groups = await cache.getGroups(comp.codigo)
      if (groups.length === 0) continue

      // Verificar standings de cada grupo (paralelo entre grupos de la misma competición)
      const grupoChecks = await Promise.all(groups.map(async (g) => {
        const codes = await standingsCache.getTeamCodesInGroup(
          codTemporada, cod_tipojuego, comp.codigo, g.codigo,
        )
        return { group: g, hasOurTeam: codes.has(eq.codigo_equipo) }
      }))

      for (const check of grupoChecks) {
        if (!check.hasOurTeam) continue
        // Match — añadimos al resultado
        const fakePdfRow: PdfRow = {
          equipo: eq.nombre_equipo,
          categoria: eq.categoria,
          competicion: comp.nombre,
          grupo: check.group.nombre,
          raw: `${eq.nombre_equipo} | ${eq.categoria} | ${comp.nombre} | ${check.group.nombre}`,
        }
        allMatched.push({
          pdf: fakePdfRow,
          cod_temporada: codTemporada,
          cod_tipojuego,
          cod_competicion: comp.codigo,
          cod_grupo: check.group.codigo,
          nombre_competicion: comp.nombre,
          nombre_grupo: check.group.nombre,
          codigo_equipo_nuestro: eq.codigo_equipo,
          nombre_equipo_nuestro: eq.nombre_equipo,
          reason: 'OK (auto-detectado desde fichaclub)',
          competitionCandidates: candidates.length,
          groupCandidates: groups.length,
        })
        const st = equipoStatus.get(eq.codigo_equipo)!
        st.found++
      }
    }
  }, 6)

  // 4. Compute counts
  let okCount = 0
  let failedCount = 0
  for (const st of equipoStatus.values()) {
    if (st.found > 0) okCount++
    else failedCount++
  }

  return {
    matched: allMatched,
    total: equiposClub.length,
    okCount,
    failedCount,
    competitionCount: allMatched.length,
    durationMs: Date.now() - t0,
    warnings,
  }
}

export interface WizardPreview extends WizardResult {
  nombreClub: string
}
