/**
 * Lógica PURA del descuento de hermanos (sin BD). Testeable y única fuente.
 *
 * Regla: el hermano con la cuota anual MÁS BARATA recibe el descuento (40%);
 * el resto paga íntegro. En caso de empate de importe, se elige de forma
 * DETERMINISTA por id para no dar el descuento a dos hermanos a la vez
 * (bug histórico cuando iban al mismo equipo).
 */

export interface SiblingAnnual {
  id: string
  annual: number
}

/**
 * Devuelve el id del hermano que debe recibir el descuento %, o null si no aplica
 * (menos de 2 hermanos con cuota > 0).
 */
export function discountedSiblingId(siblings: SiblingAnnual[]): string | null {
  const eligible = siblings.filter(s => s.annual > 0)
  if (eligible.length < 2) return null
  return [...eligible].sort((a, b) => (a.annual - b.annual) || a.id.localeCompare(b.id))[0].id
}

export type SiblingKind = 'full' | 'percent' | 'fixed'

/**
 * Plan de descuento por hermano (con cuota > 0), ordenados por importe:
 *  - el MÁS BARATO  → 'percent' (40% configurable)
 *  - el MÁS CARO    → 'full' (paga íntegro)
 *  - los del medio (3º en adelante) → 'fixed' (cuota fija configurable, p.ej. 120€)
 * Hermanos sin cuota (annual 0) → 'full'. Desempate determinista por id.
 * Importes y % se pasan desde la config del club; aquí NO hay valores fijos.
 */
export function siblingDiscountPlan(siblings: SiblingAnnual[]): Record<string, SiblingKind> {
  const plan: Record<string, SiblingKind> = {}
  for (const s of siblings) plan[s.id] = 'full'
  const eligible = siblings.filter(s => s.annual > 0)
  if (eligible.length < 2) return plan
  const sorted = [...eligible].sort((a, b) => (a.annual - b.annual) || a.id.localeCompare(b.id))
  const cheapestId = sorted[0].id
  const dearestId = sorted[sorted.length - 1].id
  for (const s of eligible) {
    if (s.id === cheapestId) plan[s.id] = 'percent'
    else if (s.id === dearestId) plan[s.id] = 'full'
    else plan[s.id] = 'fixed'
  }
  return plan
}
