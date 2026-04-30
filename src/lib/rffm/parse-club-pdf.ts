// ──────────────────────────────────────────────────────────────
// Parser del PDF "NFG_VisCompeticiones_Club" de RFFM
// Lista todas las competiciones donde participa cada equipo del club
// con 4 columnas: Equipo | Categoría | Competición | Grupo
//
// El PDF tiene una tabla concatenada en texto plano. Las filas
// empiezan SIEMPRE con el nombre del club + sufijo "A"/"B"/etc, y
// terminan con un patrón conocido de grupo (Grupo X, GRUPO X,
// SUBGRUPO XX X, TERCERA RONDA, GRUPO ÚNICO, etc.).
// ──────────────────────────────────────────────────────────────

export interface PdfRow {
  equipo: string         // "E.F. CIUDAD DE GETAFE 'A'"
  categoria: string      // "PRIMERA DIVISION AUTONOMICA AFICIONADO"
  competicion: string    // "COPA DE AFICIONADOS RFFM 2025/2026"
  grupo: string          // "TERCERA RONDA" / "Grupo 4" / etc.
  raw: string            // línea original (para debug)
}

export interface PdfParseResult {
  clubName: string | null
  season: string | null
  rows: PdfRow[]
  unparsed: string[]   // líneas que parecían filas pero no se pudieron parsear
}

// Patrones conocidos para el final de cada fila (columna Grupo)
const GROUP_PATTERNS = [
  /\b(GRUPO\s+ÚNICO)\s*$/i,
  /\b(SUBGRUPO\s+\d+\s*[A-Z]?)\s*$/i,
  /\b(SUBGRUPO\s+\d+\s*[A-Z]?)\b\s*$/i,
  /\b((?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA)\s+RONDA)\s*$/i,
  /\b(GRUPO\s+\d+(?:\s*[A-Z])?)\s*$/i,
  /\b(Grupo\s+\d+(?:\s*[A-Z])?)\s*$/,
]

function findGroupAtEnd(line: string): { grupo: string; rest: string } | null {
  for (const pat of GROUP_PATTERNS) {
    const m = line.match(pat)
    if (m && m.index != null) {
      return {
        grupo: m[1].trim(),
        rest: line.slice(0, m.index).trim(),
      }
    }
  }
  return null
}

// Categorías conocidas en RFFM (orden importa: más específicas primero)
const CATEGORY_PATTERNS = [
  // F-7 / F7 explícitos
  /\bDIVISION\s+DE\s+HONOR\s+ALEVIN\b/i,
  /\bDIVISION\s+DE\s+HONOR\s+CADETE\b/i,
  /\bDIVISION\s+DE\s+HONOR\s+INFANTIL\b/i,
  /\bDIVISION\s+DE\s+HONOR\s+JUVENIL\b/i,
  /\bPRIMERA\s+DIVISION\s+AUTONOMICA\s+AFICIONADO\b/i,
  /\bPRIMERA\s+DIVISION\s+AUTONOMICA\s+INFANTIL\b/i,
  /\bPRIMERA\s+DIVISION\s+AUTONOMICA\s+BENJAMIN\s+F[-]?7\b/i,
  /\bPRIMERA\s+DIVISION\s+AUTONÓMICA\s+FEMENINO\b/i,
  /\bLIGA\s+NACIONAL\s+JUVENIL\b/i,
  /\bPREFERENTE\s+AFICIONADO\b/i,
  /\bPREFERENTE\s+JUVENIL\b/i,
  /\bPREFERENTE\s+CADETE\b/i,
  /\bPREFERENTE\s+INFANTIL\b/i,
  /\bPREFERENTE\s+ALEVIN\s+F[-]?7\b/i,
  /\bPREFERENTE\s+ALEVIN\b/i,
  /\bPREFERENTE\s+BENJAMIN\s+F[-]?7?\b/i,
  /\bPREFERENTE\s+PREBENJAMIN\b/i,
  /\bPREFERENTE\s+FEMENINO\s+CADETE\b/i,
  /\bPREFERENTE\s+FEMENINO\s+ALEVIN\s+F[-]?7\b/i,
  /\bPRIMERA\s+AFICIONADO\b/i,
  /\bPRIMERA\s+JUVENIL\b/i,
  /\bPRIMERA\s+CADETE\b/i,
  /\bPRIMERA\s+ALEVIN\b/i,
  /\bPRIMERA\s+BENJAMIN\s+F[-]?7?\b/i,
  /\bPRIMERA\s+PREBENJAMIN\b/i,
  /\bPRIMERA\s+FEMENINO\s+INFANTIL\s+F[-]?7\b/i,
  /\bPRIMERA\s+BENJAMIN\s+FEMENINO\s+F[-]?7\b/i,
  /\bSEGUNDA\s+JUVENIL\b/i,
  /\bSEGUNDA\s+CADETE\b/i,
  /\bSEGUNDA\s+INFANTIL\b/i,
  /\bSEGUNDA\s+ALEVIN\s+F[-]?7\b/i,
  /\bDEBUTANTE\b/i,
]

function extractCategoria(rest: string): { categoria: string; competicion: string } | null {
  for (const pat of CATEGORY_PATTERNS) {
    const m = rest.match(pat)
    if (m && m.index != null) {
      const categoria = m[0].trim()
      const competicion = rest.replace(pat, '').replace(/\s+/g, ' ').trim()
      return { categoria, competicion: competicion || categoria }
    }
  }
  return null
}

/**
 * Parsea el texto extraído del PDF de RFFM y devuelve las filas estructuradas.
 *
 * `clubNameHint` es el nombre del club tal como aparece en BD (ej. "E.F. Ciudad de Getafe")
 * — se usa para detectar el inicio de cada fila. Si no se pasa, se intenta detectar de la
 * cabecera del PDF (tipo "ESCUELA FUTBOL CIUDAD DE GETAFE").
 */
export function parseClubCompetitionsText(text: string, clubNameHint?: string): PdfParseResult {
  // Detectar nombre del club y temporada en cabecera
  let clubName: string | null = null
  let season: string | null = null
  const clubMatch = text.match(/^([A-ZÁÉÍÓÚÑ. ]{8,})\s*(?:Temporada\s*:?\s*)?(\d{4}-\d{4})?/m)
  if (clubMatch) {
    clubName = clubMatch[1].trim() || null
    season = clubMatch[2] ?? null
  }
  const seasonMatch = text.match(/Temporada\s*:?\s*(\d{4}[-/]\d{2,4})/i)
  if (seasonMatch) season = seasonMatch[1]

  // Construir patrón de prefijo de equipo desde el nombre del club:
  // de "E.F. Ciudad de Getafe" → tokens significativos [CIUDAD, GETAFE]
  // → patrón regex que matchea cualquier prefijo que contenga ambos en orden
  const STOPWORDS = new Set(['CF','FC','EF','AD','CD','CDE','UD','CP','AC','SAD','SD','AGR','DE','DEL','LA','EL','LOS','LAS','Y','I','AT','ATCO','CLUB','DEPORTIVO','POL','POLIDEPORTIVO','ESCUELA','FUTBOL','FÚTBOL'])
  const sourceForTokens = (clubNameHint || clubName || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  const significantTokens = sourceForTokens
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))

  // Si no hay tokens del nombre del club, fallback: buscar "GETAFE" (legacy)
  const fallbackTokens = significantTokens.length > 0 ? significantTokens : ['GETAFE']

  // Patrón: cualquier secuencia de palabras (incluyendo abreviaturas con puntos)
  // que contenga TODOS los tokens significativos del club, opcionalmente seguido
  // de sufijo letra entre comillas. Ej: 'E.F. CIUDAD DE GETAFE "A"'
  // Regex laxo: empieza al inicio de la línea, captura hasta el último token + opcional sufijo
  const tokensPattern = fallbackTokens.map(t => `\\b${t}\\b`).join('[^\\n]*?')
  const TEAM_PREFIX_RE = new RegExp(`^([A-ZÁÉÍÓÚÑ.][A-ZÁÉÍÓÚÑ.\\s]*?${tokensPattern}(?:\\s+["'][A-Z]["'])?)`, 'i')

  // Dividir texto en líneas significativas
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  const rows: PdfRow[] = []
  const unparsed: string[] = []

  for (const line of lines) {
    if (!TEAM_PREFIX_RE.test(line)) continue
    // Saltar la fila de cabecera del PDF (contiene la palabra "Temporada" o "Equipo Categoría")
    if (/^equipo\s+categor/i.test(line)) continue
    // Extraer equipo + sufijo
    const teamMatch = line.match(TEAM_PREFIX_RE)
    if (!teamMatch) continue
    const equipo = teamMatch[0].trim()
    const afterTeam = line.slice(teamMatch[0].length).trim()

    const grupoExtract = findGroupAtEnd(afterTeam)
    if (!grupoExtract) { unparsed.push(line); continue }

    const catExtract = extractCategoria(grupoExtract.rest)
    if (!catExtract) { unparsed.push(line); continue }

    rows.push({
      equipo,
      categoria: catExtract.categoria,
      competicion: catExtract.competicion,
      grupo: grupoExtract.grupo,
      raw: line,
    })
  }

  return { clubName, season, rows, unparsed }
}

/**
 * Lee y parsea un PDF como Buffer (vía pdf-parse, dynamic import).
 */
export async function parseClubCompetitionsPdf(buffer: Buffer, clubNameHint?: string): Promise<PdfParseResult> {
  const mod = await import('pdf-parse')
  const pdfParse = (mod as { default: (b: Buffer) => Promise<{ text: string }> }).default
  const { text } = await pdfParse(buffer)
  return parseClubCompetitionsText(text, clubNameHint)
}
