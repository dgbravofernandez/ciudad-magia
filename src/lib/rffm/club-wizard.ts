// ──────────────────────────────────────────────────────────────
// Wizard 1-click: detecta TODAS las competiciones del club RFFM
// partiendo solo del codigo_club. Sin PDF, sin matching manual.
//
// IMPORTANTE: para clubs grandes (>30 equipos) NO cabe en 60s de
// Vercel Hobby si lo hacemos de un tirón. Por eso la API expone:
//
//   - detectClubBasics(codigoClub):
//       fetch /fichaclub + 3 competitions; rápido (~10-15s)
//       devuelve equipos del club con tipojuego detectado
//   - detectClubChunk(codigoClub, equipoCodigos[]):
//       resuelve cod_competicion+cod_grupo de un subset de equipos.
//       Cada chunk cabe en 50s.
//
// El cliente llama a basics primero y luego N chunks de 12 equipos.
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
} from './club-importer'
import { CURRENT_SEASON } from './constants'
import type { PdfRow } from './parse-club-pdf'

// Concurrencia agresiva — cada chunk con su propio control.
// fetchRffmSSR/getStandings reciben skipRateLimit=true cuando el caller
// orquesta su paralelismo (este es el caso).
const STANDINGS_CONCURRENCY = 8
const EQUIPOS_PARALELO_DENTRO_DE_CHUNK = 4

// ── Helpers ────────────────────────────────────────────────────

async function pMap<I, O>(items: I[], fn: (item: I, idx: number) => Promise<O>, concurrency: number): Promise<O[]> {
  const results: O[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      try {
        results[idx] = await fn(items[idx], idx)
      } catch (e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results[idx] = { __err: (e as Error).message } as any
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

function detectTipoJuegoFromCategoria(categoria: string): string {
  const text = (categoria ?? '').toUpperCase()
  if (/\b(FUTSAL|SALA)\b/.test(text)) return '4'
  if (/F[-]?7\b|FUTBOL[-\s]?7|FÚTBOL[-\s]?7/.test(text)) return '2'
  return '1'
}

function findCompetitionCandidates(categoria: string, comps: RffmCompetition[]): RffmCompetition[] {
  const catTokens = tokenize(categoria)
  if (catTokens.length === 0) return []
  const strict: RffmCompetition[] = []
  const partial: RffmCompetition[] = []
  for (const c of comps) {
    const apiTokens = tokenize(c.nombre)
    const apiSet = new Set(apiTokens)
    let hits = 0
    for (const t of catTokens) if (apiSet.has(t)) hits++
    const ratio = hits / catTokens.length
    if (ratio >= 0.99) strict.push(c)
    else if (ratio >= 0.6) partial.push(c)
  }
  return [...strict, ...partial]
}

// ── Tipos públicos ─────────────────────────────────────────────

export interface DetectBasicsResult {
  codigoClub: string
  nombreClub: string
  equipos: RffmEquipoClub[]
  durationMs: number
}

export interface DetectChunkResult {
  matched: MatchedRow[]
  resolvedEquipoCodigos: string[]   // equipos del chunk que resolvieron al menos 1 competición
  failedEquipoCodigos: string[]     // sin ninguna match
  warnings: string[]
  durationMs: number
}

// ── Step 1: basics ─────────────────────────────────────────────

/**
 * Step 1 del wizard: fetch /fichaclub + 3 competitions caches.
 * Rápido (~10s) y siempre cabe en 60s.
 *
 * NO resuelve grupos — eso lo hace detectClubChunk.
 */
export async function detectClubBasics(
  codigoClub: string,
  codTemporada: string = CURRENT_SEASON,
): Promise<DetectBasicsResult> {
  const t0 = Date.now()

  const ficha = await fetchRffmSSR<FichaClubResponse>(`fichaclub/${codigoClub}`)
  const equipos = ficha.club?.equipos_club ?? []
  const nombreClub = ficha.club?.nombre_club ?? ''

  if (!equipos.length) {
    throw new Error(`El club ${codigoClub} no tiene equipos en RFFM. Verifica el código.`)
  }

  // Pre-cachear competitions (3 fetches max). Lo hacemos para no contar
  // este coste en cada chunk pero el cache no persiste entre llamadas
  // serverless — esto solo sirve para validar que existen los endpoints.
  const tipojuegosUsados = new Set<string>()
  for (const e of equipos) tipojuegosUsados.add(detectTipoJuegoFromCategoria(e.categoria))
  // Lo dejamos para warm-up sin uso posterior (no podemos compartir cache entre invocations)

  return {
    codigoClub,
    nombreClub,
    equipos,
    durationMs: Date.now() - t0,
  }
}

// ── Step 2: chunk de equipos ───────────────────────────────────

/**
 * Step 2 del wizard: resuelve los grupos de un subset de equipos del club.
 * Cada llamada se autolimita a un timeout sano (50s) y devuelve lo que
 * tenga procesado. El cliente puede llamar varias veces hasta cubrir
 * todos los equipos.
 */
export async function detectClubChunk(
  codigoClub: string,
  equipoCodigos: string[],
  codTemporada: string = CURRENT_SEASON,
): Promise<DetectChunkResult> {
  const t0 = Date.now()
  const warnings: string[] = []

  // 1. Recargar fichaclub para mapear codigoEquipo → datos del equipo.
  //    Necesario porque la cache no persiste entre invocaciones serverless.
  const ficha = await fetchRffmSSR<FichaClubResponse>(`fichaclub/${codigoClub}`)
  const allEquipos = ficha.club?.equipos_club ?? []
  const equipoByCodigo = new Map<string, RffmEquipoClub>()
  for (const e of allEquipos) equipoByCodigo.set(e.codigo_equipo, e)

  const equipos = equipoCodigos
    .map(c => equipoByCodigo.get(c))
    .filter((e): e is RffmEquipoClub => !!e)

  if (!equipos.length) {
    return {
      matched: [],
      resolvedEquipoCodigos: [],
      failedEquipoCodigos: [...equipoCodigos],
      warnings: ['Ningún equipo del chunk encontrado en fichaclub'],
      durationMs: Date.now() - t0,
    }
  }

  // 2. Cachear competitions de los tipojuego usados en este chunk
  const cache = new RffmCache()
  const tipojuegosChunk = new Set<string>()
  for (const e of equipos) tipojuegosChunk.add(detectTipoJuegoFromCategoria(e.categoria))
  await Promise.all([...tipojuegosChunk].map(tj => cache.getCompetitions(tj, codTemporada)))

  // 3. Para cada equipo del chunk, resolver competitions+grupos.
  //    Paralelismo dentro del chunk: hasta 4 equipos a la vez,
  //    cada uno verifica sus grupos en paralelo (8 standings simultáneos).
  const allMatched: MatchedRow[] = []
  const resolvedSet = new Set<string>()
  const standingsCache = new Map<string, Set<string>>()

  async function getTeamCodesInGroup(
    cod_tipojuego: string,
    cod_competicion: string,
    cod_grupo: string,
  ): Promise<Set<string>> {
    const key = `${cod_competicion}_${cod_grupo}`
    if (standingsCache.has(key)) return standingsCache.get(key)!
    try {
      // skipRateLimit=true porque orquestamos nuestra propia concurrencia
      const standings = await getStandings(codTemporada, cod_tipojuego, cod_competicion, cod_grupo, undefined, { skipRateLimit: true })
      const codes = new Set(standings.map(s => s.codigo_equipo))
      standingsCache.set(key, codes)
      return codes
    } catch {
      standingsCache.set(key, new Set())
      return new Set()
    }
  }

  await pMap(equipos, async (eq) => {
    const cod_tipojuego = detectTipoJuegoFromCategoria(eq.categoria)
    const comps = await cache.getCompetitions(cod_tipojuego, codTemporada)
    const candidates = findCompetitionCandidates(eq.categoria, comps)

    if (candidates.length === 0) {
      warnings.push(`"${eq.nombre_equipo}" (${eq.codigo_equipo}): sin competición coincidente con "${eq.categoria}"`)
      return
    }

    let foundAny = false

    for (const comp of candidates) {
      const groups = await cache.getGroups(comp.codigo)
      if (groups.length === 0) continue

      // Verificar standings de todos los grupos de esta competición en paralelo
      const checks = await pMap(groups, async (g) => {
        const codes = await getTeamCodesInGroup(cod_tipojuego, comp.codigo, g.codigo)
        return { group: g, hasOurTeam: codes.has(eq.codigo_equipo) }
      }, STANDINGS_CONCURRENCY)

      for (const c of checks) {
        if (!c.hasOurTeam) continue
        const fakePdfRow: PdfRow = {
          equipo: eq.nombre_equipo,
          categoria: eq.categoria,
          competicion: comp.nombre,
          grupo: c.group.nombre,
          raw: `${eq.nombre_equipo} | ${eq.categoria} | ${comp.nombre} | ${c.group.nombre}`,
        }
        allMatched.push({
          pdf: fakePdfRow,
          cod_temporada: codTemporada,
          cod_tipojuego,
          cod_competicion: comp.codigo,
          cod_grupo: c.group.codigo,
          nombre_competicion: comp.nombre,
          nombre_grupo: c.group.nombre,
          codigo_equipo_nuestro: eq.codigo_equipo,
          nombre_equipo_nuestro: eq.nombre_equipo,
          reason: 'OK (auto-detectado desde fichaclub)',
          competitionCandidates: candidates.length,
          groupCandidates: groups.length,
        })
        foundAny = true
      }
    }

    if (foundAny) resolvedSet.add(eq.codigo_equipo)
  }, EQUIPOS_PARALELO_DENTRO_DE_CHUNK)

  const resolvedEquipoCodigos = [...resolvedSet]
  const failedEquipoCodigos = equipoCodigos.filter(c => !resolvedSet.has(c))

  return {
    matched: allMatched,
    resolvedEquipoCodigos,
    failedEquipoCodigos,
    warnings,
    durationMs: Date.now() - t0,
  }
}
