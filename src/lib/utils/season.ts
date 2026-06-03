/**
 * Lógica pura de temporadas — sin BD, sin 'use server'. Testeable y única fuente.
 * Formato de temporada en BD: 'YYYY/YY' (ej. '2025/26'). También acepta 'YYYY/YYYY'.
 */

/**
 * Devuelve la temporada siguiente.
 * '2025/26' → '2026/27'   ·   '2025/2026' → '2026/2027'
 * @throws Error si el formato no es reconocido.
 */
export function bumpSeason(season: string): string {
  const match = season.match(/^(\d{4})\/(\d{2})$/)
  if (!match) {
    // Formato de año completo '2025/2026'
    const fullMatch = season.match(/^(\d{4})\/(\d{4})$/)
    if (fullMatch) {
      const y1 = parseInt(fullMatch[1]) + 1
      const y2 = parseInt(fullMatch[2]) + 1
      return `${y1}/${y2}`
    }
    throw new Error(`Formato de temporada no reconocido: "${season}". Se esperaba "YYYY/YY" o "YYYY/YYYY".`)
  }
  const y1 = parseInt(match[1]) + 1
  const y2 = parseInt(match[2])
  const y2full = y2 >= 90 ? 1900 + y2 : 2000 + y2
  const y2next = y2full + 1
  return `${y1}/${String(y2next).slice(-2)}`
}
