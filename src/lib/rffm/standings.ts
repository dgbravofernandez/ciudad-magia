import { fetchRffmSSR } from './client'

// ──────────────────────────────────────────────────────────────
// RFFM clasificaciones (standings) scraper.
// URL pública: https://www.rffm.es/competicion/clasificaciones
//   ?temporada=21&competicion=24037913&grupo=24037915&jornada=27&tipojuego=1
// Internamente usa el mismo patrón Next.js SSR _next/data/.../*.json
// ──────────────────────────────────────────────────────────────

export interface StandingRow {
  posicion: number
  codigo_equipo: string
  nombre_equipo: string
  pj: number
  pg: number
  pe: number
  pp: number
  gf: number
  gc: number
  pts: number
}

// El shape exacto de la respuesta no está documentado; parseamos
// defensivamente probando varios nombres de campo conocidos en RFFM.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickNum(row: any, ...keys: string[]): number {
  for (const k of keys) {
    const v = row?.[k]
    if (v == null) continue
    const n = typeof v === 'number' ? v : parseInt(String(v), 10)
    if (Number.isFinite(n)) return n
  }
  return 0
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickStr(row: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = row?.[k]
    if (v != null && String(v).trim()) return String(v)
  }
  return ''
}

export async function getStandings(
  codTemporada: string,
  codTipojuego: string,
  codCompeticion: string,
  codGrupo: string,
  jornada?: string,
): Promise<StandingRow[]> {
  const params: Record<string, string> = {
    temporada: codTemporada,
    tipojuego: codTipojuego,
    competicion: codCompeticion,
    grupo: codGrupo,
  }
  if (jornada) params.jornada = jornada

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await fetchRffmSSR<any>('competicion/clasificaciones', params)

  // RFFM real shape: pageProps.standings.clasificacion[]
  // Buscamos defensivamente en varias rutas posibles.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any[] | null = null

  // Ruta principal RFFM
  if (data?.standings?.clasificacion && Array.isArray(data.standings.clasificacion)) {
    raw = data.standings.clasificacion
  }
  // Fallbacks por si cambia el shape
  if (!raw) {
    const candidates: string[] = [
      'clasificacion',
      'clasificaciones',
      'tabla',
      'standings',
      'equipos',
    ]
    for (const k of candidates) {
      const v = data?.[k]
      if (Array.isArray(v) && v.length) { raw = v; break }
    }
  }
  if (!raw && data?.clasificacion?.equipos && Array.isArray(data.clasificacion.equipos)) {
    raw = data.clasificacion.equipos
  }
  if (!raw) return []

  const rows: StandingRow[] = []
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    // RFFM usa 'codequipo' (sin underscore) y 'nombre'
    const codigo = pickStr(r, 'codequipo', 'codigo_equipo', 'codigoEquipo', 'codigo', 'cod_equipo')
    const nombre = pickStr(r, 'nombre', 'nombre_equipo', 'nombreEquipo', 'equipo')
    if (!codigo || !nombre) continue
    rows.push({
      posicion: pickNum(r, 'posicion', 'pos', 'puesto') || (i + 1),
      codigo_equipo: codigo,
      nombre_equipo: nombre,
      pj: pickNum(r, 'jugados', 'partidos_jugados', 'pj'),
      pg: pickNum(r, 'ganados', 'partidos_ganados', 'pg'),
      pe: pickNum(r, 'empatados', 'partidos_empatados', 'pe'),
      pp: pickNum(r, 'perdidos', 'partidos_perdidos', 'pp'),
      gf: pickNum(r, 'goles_a_favor', 'goles_favor', 'gf'),
      gc: pickNum(r, 'goles_en_contra', 'goles_contra', 'gc'),
      pts: pickNum(r, 'puntos', 'pts'),
    })
  }
  return rows
}
