// ──────────────────────────────────────────────────────────────
// Parser heurístico de PDFs de extractos bancarios españoles.
// Detecta filas con: fecha (dd/mm/yyyy o dd-mm-yyyy o dd.mm.yyyy),
// importe (con coma decimal y opcional EUR/€) y concepto entre medias.
// ──────────────────────────────────────────────────────────────

export interface ParsedTransfer {
  date: string         // YYYY-MM-DD
  amount: number       // siempre positivo
  concept: string
  payer?: string       // ordenante, si se puede extraer
  raw: string          // línea original (para debug)
}

const DATE_RE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/
// Importe: 1.234,56 | 34,50 | 100.00 — opcional con €/EUR
const AMOUNT_RE = /(?<![\d,.])(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})\s*(?:€|EUR|EUROS)?/i

export async function parseBankPdf(buffer: Buffer): Promise<ParsedTransfer[]> {
  // Carga dinámica para evitar problemas de bundling de pdf-parse
  const mod = await import('pdf-parse')
  const pdfParse = (mod as { default: (b: Buffer) => Promise<{ text: string }> }).default
  const { text } = await pdfParse(buffer)
  return extractTransfersFromText(text)
}

export function extractTransfersFromText(text: string): ParsedTransfer[] {
  // Normaliza: une líneas que claramente son continuación (sin fecha al inicio)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  // Combina líneas: una "transacción lógica" empieza con una línea que
  // contiene fecha al principio. Las siguientes sin fecha son continuación.
  const blocks: string[] = []
  let current = ''
  for (const line of lines) {
    if (DATE_RE.test(line.slice(0, 12))) {
      if (current) blocks.push(current)
      current = line
    } else {
      if (current) current += ' ' + line
    }
  }
  if (current) blocks.push(current)

  const out: ParsedTransfer[] = []
  for (const block of blocks) {
    const parsed = parseBlock(block)
    if (parsed) out.push(parsed)
  }
  // Dedupe (mismo día + mismo importe + concepto similar) → quédate con el primero
  const seen = new Set<string>()
  return out.filter(t => {
    const key = `${t.date}|${t.amount.toFixed(2)}|${t.concept.slice(0, 30).toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseBlock(block: string): ParsedTransfer | null {
  const dateMatch = block.match(DATE_RE)
  if (!dateMatch) return null

  // Solo nos interesan abonos/ingresos (positivos). Los cargos no se aceptan
  // como transferencias entrantes. Heurística: si la línea contiene "-NN,NN"
  // antes del importe, es un cargo (gasto) → ignoramos.
  // Pero si no hay forma clara, asumimos abono.
  const isCargo = /-\s*\d/.test(block) && !/transferencia\s+a\s+favor/i.test(block)

  // Buscamos TODOS los importes de la línea y nos quedamos con el último
  // (suele ser el importe del movimiento; los anteriores pueden ser saldos
  // anteriores). Si solo hay uno, ese es.
  const amounts = [...block.matchAll(new RegExp(AMOUNT_RE, 'gi'))]
  if (amounts.length === 0) return null
  const amountStr = amounts[amounts.length - 1][1]
  const amount = parseAmount(amountStr)
  if (!amount || amount <= 0) return null
  if (isCargo) return null

  const isoDate = normalizeDate(dateMatch[1], dateMatch[2], dateMatch[3])
  if (!isoDate) return null

  // Concepto = todo entre la fecha y el importe final, limpio
  const dateEnd = block.indexOf(dateMatch[0]) + dateMatch[0].length
  const amountIndex = block.lastIndexOf(amountStr)
  let concept = block.slice(dateEnd, amountIndex)
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-•·|]+|[\s\-•·|]+$/g, '')
    .trim()

  // Si hay una segunda fecha en el concepto (fecha valor), recórtala
  concept = concept.replace(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g, '').trim()

  if (!concept || concept.length < 3) return null

  // Filtrar líneas que claramente NO son transferencias entrantes
  const conceptLower = concept.toLowerCase()
  const blockedKeywords = [
    'comisi', 'mantenim', 'cuota tarjeta', 'cargo tarjeta', 'devoluci',
    'recibo', 'sepa adeudo', 'domiciliaci', 'cargo bizum',
    'transferencia emitida', 'transferencia ordenada',
  ]
  if (blockedKeywords.some(k => conceptLower.includes(k))) return null

  // Intenta extraer ordenante (después de "ORDENANTE:" o "DE:")
  let payer: string | undefined
  const ordenanteMatch = concept.match(/(?:ordenante|de|emisor|remitente)[:\s]+([^,;|]+)/i)
  if (ordenanteMatch) payer = ordenanteMatch[1].trim()

  return { date: isoDate, amount, concept, payer, raw: block }
}

function parseAmount(s: string): number {
  // "1.234,56" → 1234.56 ; "34,50" → 34.50 ; "100.00" → 100.00
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(s)
}

function normalizeDate(d: string, m: string, y: string): string | null {
  let day = parseInt(d, 10)
  let month = parseInt(m, 10)
  let year = parseInt(y, 10)
  if (year < 100) year += 2000
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  // Si parece dd/mm pero el mes y día están al revés (raro en España), no lo arreglamos.
  if (month > 12) [day, month] = [month, day]
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

// ──────────────────────────────────────────────────────────────
// Fuzzy match de concepto contra nombres de jugadores/tutores
// ──────────────────────────────────────────────────────────────

export interface PlayerCandidate {
  id: string
  first_name: string
  last_name: string
  tutor_name?: string | null
}

export interface MatchResult {
  playerId: string | null
  confidence: number   // 0–1
  matchedOn: 'player' | 'tutor' | 'none'
}

export function matchConceptToPlayer(
  concept: string,
  payer: string | undefined,
  players: PlayerCandidate[]
): MatchResult {
  const haystack = normalize(`${concept} ${payer ?? ''}`)
  if (!haystack) return { playerId: null, confidence: 0, matchedOn: 'none' }

  let best: MatchResult = { playerId: null, confidence: 0, matchedOn: 'none' }

  for (const p of players) {
    const playerFull = normalize(`${p.first_name} ${p.last_name}`)
    const tutor = p.tutor_name ? normalize(p.tutor_name) : ''

    const playerScore = scoreMatch(haystack, playerFull)
    const tutorScore = tutor ? scoreMatch(haystack, tutor) : 0

    const score = Math.max(playerScore, tutorScore)
    if (score > best.confidence) {
      best = {
        playerId: p.id,
        confidence: score,
        matchedOn: playerScore >= tutorScore ? 'player' : 'tutor',
      }
    }
  }

  return best
}

function normalize(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Score: cuántas palabras del nombre del jugador (>2 letras) aparecen en el concepto
function scoreMatch(haystack: string, needle: string): number {
  if (!needle) return 0
  const words = needle.split(' ').filter(w => w.length >= 3)
  if (words.length === 0) return 0
  let hits = 0
  for (const w of words) {
    if (haystack.includes(w)) hits++
  }
  // Score = ratio de palabras encontradas. Bonus si match exacto de 2+ palabras.
  let score = hits / words.length
  if (hits >= 2) score = Math.min(1, score + 0.15)
  return Number(score.toFixed(2))
}
