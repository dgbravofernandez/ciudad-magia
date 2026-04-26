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

  // Buscamos un array de equipos en pageProps. Probamos las rutas
  // más probables; si no encontramos, devolvemos vacío sin lanzar
  // (el cron lo registra como standings sin filas en lugar de error).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any[] | null = null
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
  // Algunos endpoints anidan: clasificacion.equipos[]
  if (!raw && data?.clasificacion && Array.isArray(data.clasificacion.equipos)) {
    raw = data.clasificacion.equipos
  }
  if (!raw) return []

  const rows: StandingRow[] = []
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const codigo = pickStr(r, 'codigo_equipo', 'codigoEquipo', 'codigo', 'cod_equipo')
    const nombre = pickStr(r, 'nombre_equipo', 'nombreEquipo', 'nombre', 'equipo')
    if (!codigo || !nombre) continue
    rows.push({
      posicion: pickNum(r, 'posicion', 'pos', 'puesto') || (i + 1),
      codigo_equipo: codigo,
      nombre_equipo: nombre,
      pj: pickNum(r, 'partidos_jugados', 'pj', 'jugados'),
      pg: pickNum(r, 'partidos_ganados', 'pg', 'ganados'),
      pe: pickNum(r, 'partidos_empatados', 'pe', 'empatados'),
      pp: pickNum(r, 'partidos_perdidos', 'pp', 'perdidos'),
      gf: pickNum(r, 'goles_favor', 'gf', 'goles_a_favor'),
      gc: pickNum(r, 'goles_contra', 'gc', 'goles_en_contra'),
      pts: pickNum(r, 'puntos', 'pts'),
    })
  }
  return rows
}
