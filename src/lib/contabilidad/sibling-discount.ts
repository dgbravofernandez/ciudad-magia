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
 * Devuelve el id del hermano que debe recibir el descuento, o null si no aplica
 * (menos de 2 hermanos con cuota > 0).
 */
export function discountedSiblingId(siblings: SiblingAnnual[]): string | null {
  const eligible = siblings.filter(s => s.annual > 0)
  if (eligible.length < 2) return null
  return [...eligible].sort((a, b) => (a.annual - b.annual) || a.id.localeCompare(b.id))[0].id
}
