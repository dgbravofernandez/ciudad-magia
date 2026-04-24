// ──────────────────────────────────────────────────────────────
// Division level mapping — used to weight valor_score
// Higher level = goal worth more for scouting purposes
// ──────────────────────────────────────────────────────────────

const DIVISION_KEYWORDS: Array<{ keywords: string[]; level: number }> = [
  { keywords: ['DIVISIÓN DE HONOR', 'DIVISION DE HONOR', 'HONOR'], level: 10 },
  { keywords: ['PREFERENTE'], level: 8 },
  { keywords: ['PRIMERA DIVISIÓN', 'PRIMERA DIVISION', '1ª DIVISIÓN', '1ª DIVISION'], level: 7 },
  { keywords: ['PRIMERA'], level: 6 },
  { keywords: ['SEGUNDA DIVISIÓN', 'SEGUNDA DIVISION', '2ª DIVISIÓN', '2ª DIVISION'], level: 5 },
  { keywords: ['SEGUNDA'], level: 4 },
  { keywords: ['TERCERA'], level: 3 },
  { keywords: ['CUARTA', 'REGIONAL'], level: 2 },
]

/**
 * Returns a 1–10 division level for a competition name.
 * Higher = more competitive. Used as multiplier for valor_score.
 */
export function getDivisionLevel(nombreCompeticion: string): number {
  const upper = nombreCompeticion.toUpperCase()
  for (const { keywords, level } of DIVISION_KEYWORDS) {
    if (keywords.some(kw => upper.includes(kw))) {
      return level
    }
  }
  return 1  // unknown / lowest
}
