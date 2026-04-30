// ──────────────────────────────────────────────────────────────
// Bulk import de competiciones del club desde PDF + RFFM API
//
// Recibe filas parseadas del PDF (Equipo, Categoría, Competición, Grupo)
// y para cada una busca en la RFFM:
//   1. cod_tipojuego (heurística por keywords F-7/Futsal en categoría)
//   2. cod_competicion (match por tokens de Categoría/Competición vs /api/competitions)
//   3. cod_grupo (match por nombre vs /api/groups)
//   4. codigo_equipo_nuestro (match por tokens del equipo vs equipos_club del /fichaclub)
// ──────────────────────────────────────────────────────────────

import { fetchRffmAPI, fetchRffmSSR } from './client'
import type { PdfRow } from './parse-club-pdf'
import { CURRENT_SEASON } from './constants'

interface RffmCompetition {
  codigo: string
  nombre: string
  codigo_tipo_juego?: string
}
interface RffmGroup {
  codigo: string
  nombre: string
  total_jornadas?: string
}
interface RffmEquipoClub {
  codigo_equipo: string
  categoria: string
  nombre_equipo: string
  en_competicion?: string
}
interface FichaClubResponse {
  club?: {
    codigo?: string
    nombre_club?: string
    equipos_club?: RffmEquipoClub[]
  }
}

export interface MatchedRow {
  pdf: PdfRow
  cod_temporada: string
  cod_tipojuego: string
  cod_competicion: string | null
  cod_grupo: string | null
  nombre_competicion: string | null
  nombre_grupo: string | null
  codigo_equipo_nuestro: string | null
  nombre_equipo_nuestro: string | null
  // diagnóstico
  reason: string                  // "OK" | "no competition match" | "no group match" | "no team match"
  competitionCandidates: number
  groupCandidates: number
}

export interface ImportResult {
  matched: MatchedRow[]
  total: number
  okCount: number          // todos los códigos resueltos
  partialCount: number     // al menos competition resuelto
  failedCount: number      // sin nada resuelto
}

// ── Tokenización para matching ────────────────────────────────────

const STOPWORDS = new Set([
  'CF','FC','EF','AD','CD','CDE','UD','CP','AC','SAD','SD','AGR',
  'DE','DEL','LA','EL','LOS','LAS','Y','I','AT','ATCO','CLUB',
  'DEPORTIVO','POL','POLIDEPORTIVO','ESCUELA','FUTBOL','FÚTBOL',
  'GRUPO','SUBGRUPO',
])

function tokenize(s: string): string[] {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/F[-]?7/g, 'F7')   // normalizar F-7 → F7
    .replace(/F[-]?11/g, 'F11')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w) && !/^\d{4,}$/.test(w))
}

function tokensInclude(haystack: string[], needles: string[]): boolean {
  if (needles.length === 0) return false
  const set = new Set(haystack)
  return needles.every(n => set.has(n))
}

function normGroup(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Detectar tipo_juego desde categoría/competición ───────────────

function detectTipoJuego(row: PdfRow): string {
  const text = `${row.categoria} ${row.competicion}`.toUpperCase()
  if (/\b(FUTSAL|SALA)\b/.test(text)) return '4'
  if (/F[-]?7\b|FUTBOL[-\s]?7|FÚTBOL[-\s]?7/.test(text)) return '2'
  return '1'  // default F11
}

// ── Cache de fetches RFFM ─────────────────────────────────────────

class RffmCache {
  private competitions = new Map<string, RffmCompetition[]>()
  private groups = new Map<string, RffmGroup[]>()

  async getCompetitions(codTipojuego: string, codTemporada: string): Promise<RffmCompetition[]> {
    const key = `${codTemporada}_${codTipojuego}`
    if (this.competitions.has(key)) return this.competitions.get(key)!
    try {
      const data = await fetchRffmAPI<RffmCompetition[]>('competitions', {
        temporada: codTemporada,
        tipojuego: codTipojuego,
      })
      const arr = Array.isArray(data) ? data : []
      this.competitions.set(key, arr)
      return arr
    } catch {
      this.competitions.set(key, [])
      return []
    }
  }

  async getGroups(codCompeticion: string): Promise<RffmGroup[]> {
    if (this.groups.has(codCompeticion)) return this.groups.get(codCompeticion)!
    try {
      const data = await fetchRffmAPI<RffmGroup[]>('groups', { competicion: codCompeticion })
      const arr = Array.isArray(data) ? data : []
      this.groups.set(codCompeticion, arr)
      return arr
    } catch {
      this.groups.set(codCompeticion, [])
      return []
    }
  }
}

// ── Match contra una competición de RFFM ──────────────────────────

function matchCompetition(row: PdfRow, comps: RffmCompetition[]): RffmCompetition | null {
  // Combinar categoría + competición del PDF: cubre los 2 nombres que da el PDF
  const pdfTokens = [...new Set([...tokenize(row.categoria), ...tokenize(row.competicion)])]
  if (pdfTokens.length === 0) return null

  let bestMatch: RffmCompetition | null = null
  let bestScore = 0
  for (const c of comps) {
    const apiTokens = tokenize(c.nombre)
    const apiSet = new Set(apiTokens)
    let hits = 0
    for (const t of pdfTokens) if (apiSet.has(t)) hits++
    // Score: requiere al menos 60% de los tokens del PDF presentes en API,
    // ponderado por cuán específico es el match (penaliza API names mucho más largos)
    const ratio = hits / pdfTokens.length
    if (ratio >= 0.6 && hits > bestScore) {
      bestScore = hits
      bestMatch = c
    }
  }
  return bestMatch
}

// ── Match contra un grupo de RFFM ─────────────────────────────────

function matchGroup(pdfGrupo: string, groups: RffmGroup[]): RffmGroup | null {
  const norm = normGroup(pdfGrupo)
  // Match exacto primero
  for (const g of groups) {
    if (normGroup(g.nombre) === norm) return g
  }
  // Fallback: match por tokens (Grupo 2 vs Grupo Único, etc.)
  const pdfTokens = tokenize(pdfGrupo)
  if (pdfTokens.length === 0) return null
  for (const g of groups) {
    const apiTokens = tokenize(g.nombre)
    if (tokensInclude(apiTokens, pdfTokens) || tokensInclude(pdfTokens, apiTokens)) {
      return g
    }
  }
  return null
}

// ── Match equipo del club ─────────────────────────────────────────

function matchEquipoClub(rowEquipo: string, rowCategoria: string, equipos: RffmEquipoClub[]): RffmEquipoClub | null {
  // El PDF da equipo como "E.F. CIUDAD DE GETAFE 'A'" — extraemos el sufijo (A, B, C...)
  const equipoTokens = tokenize(rowEquipo)
  const sufijoMatch = rowEquipo.match(/['""]\s*([A-Z])\s*['""]/)
  const sufijo = sufijoMatch ? sufijoMatch[1].toUpperCase() : null

  // Categoría del PDF se compara con equipos_club[i].categoria
  const catTokens = tokenize(rowCategoria)

  let bestMatch: RffmEquipoClub | null = null
  let bestScore = 0
  for (const e of equipos) {
    // Sufijo letra debe coincidir si el equipo lo tiene
    const eSufijoMatch = e.nombre_equipo.match(/['""]\s*([A-Z])\s*['""]/)
    const eSufijo = eSufijoMatch ? eSufijoMatch[1].toUpperCase() : null
    if (sufijo && eSufijo && sufijo !== eSufijo) continue
    if (sufijo && !eSufijo) continue   // PDF tiene sufijo pero equipo no
    if (!sufijo && eSufijo) continue   // PDF sin sufijo pero equipo sí

    // Categoría debe matchear (al menos 60% tokens)
    const eCatTokens = tokenize(e.categoria)
    if (catTokens.length === 0 || eCatTokens.length === 0) continue
    let catHits = 0
    const eCatSet = new Set(eCatTokens)
    for (const t of catTokens) if (eCatSet.has(t)) catHits++
    const catRatio = catHits / catTokens.length
    if (catRatio < 0.5) continue

    // Score: hits de equipo + bonus de categoría
    const eEquipoTokens = tokenize(e.nombre_equipo)
    const eEqSet = new Set(eEquipoTokens)
    let eqHits = 0
    for (const t of equipoTokens) if (eEqSet.has(t)) eqHits++
    const score = eqHits * 10 + catHits

    if (score > bestScore) {
      bestScore = score
      bestMatch = e
    }
  }

  return bestMatch
}

// ── Función principal: importa lista de PdfRow ────────────────────

export async function importClubFromPdfRows(
  rows: PdfRow[],
  codigoClub: string,
  codTemporada: string = CURRENT_SEASON,
): Promise<ImportResult> {
  // 1. Cargar equipos_club del fichaclub (1 fetch SSR)
  let equiposClub: RffmEquipoClub[] = []
  try {
    const ficha = await fetchRffmSSR<FichaClubResponse>(`fichaclub/${codigoClub}`)
    equiposClub = ficha.club?.equipos_club ?? []
  } catch {
    // Continúa sin equipos_club: codigo_equipo_nuestro quedará null
  }

  const cache = new RffmCache()
  const matched: MatchedRow[] = []

  // Procesamos secuencialmente para respetar rate limit RFFM
  for (const pdf of rows) {
    const cod_tipojuego = detectTipoJuego(pdf)

    // 1. Match competición
    const comps = await cache.getCompetitions(cod_tipojuego, codTemporada)
    const comp = matchCompetition(pdf, comps)
    if (!comp) {
      matched.push({
        pdf, cod_temporada: codTemporada, cod_tipojuego,
        cod_competicion: null, cod_grupo: null,
        nombre_competicion: null, nombre_grupo: null,
        codigo_equipo_nuestro: null, nombre_equipo_nuestro: null,
        reason: `Sin match en /api/competitions tipojuego=${cod_tipojuego}`,
        competitionCandidates: comps.length,
        groupCandidates: 0,
      })
      continue
    }

    // 2. Match grupo
    const groups = await cache.getGroups(comp.codigo)
    const grp = matchGroup(pdf.grupo, groups)

    // 3. Match equipo del club
    const eqClub = matchEquipoClub(pdf.equipo, pdf.categoria, equiposClub)

    matched.push({
      pdf,
      cod_temporada: codTemporada,
      cod_tipojuego,
      cod_competicion: comp.codigo,
      cod_grupo: grp?.codigo ?? null,
      nombre_competicion: comp.nombre,
      nombre_grupo: grp?.nombre ?? null,
      codigo_equipo_nuestro: eqClub?.codigo_equipo ?? null,
      nombre_equipo_nuestro: eqClub?.nombre_equipo ?? null,
      reason: !grp ? 'OK competition, sin grupo' :
              !eqClub ? 'OK competition+grupo, sin equipo' : 'OK',
      competitionCandidates: comps.length,
      groupCandidates: groups.length,
    })
  }

  const okCount = matched.filter(m => m.cod_competicion && m.cod_grupo && m.codigo_equipo_nuestro).length
  const partialCount = matched.filter(m => m.cod_competicion && (!m.cod_grupo || !m.codigo_equipo_nuestro)).length
  const failedCount = matched.filter(m => !m.cod_competicion).length

  return {
    matched,
    total: rows.length,
    okCount,
    partialCount,
    failedCount,
  }
}
