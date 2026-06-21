/**
 * Lógica PURA de agregación del informe de pagos (sin BD, sin 'use server').
 * Testeable y única fuente de verdad para los totales por jugador del informe.
 *
 * Blinda los bugs INF-1/INF-3:
 *  - Se suma `amount_paid` de TODAS las filas (los pagos parciales viven en
 *    filas con status='pending'); el caller ya excluye las 'refunded'.
 *  - El estado del jugador se deriva por diferencia, no por status de fila.
 */

export interface QuotaRow {
  player_id: string
  amount_due: number | string | null
  amount_paid: number | string | null
}

export type PlayerAgg = { due: number; paid: number }

/** Agrega importes por jugador. Suma amount_due y amount_paid de cada fila. */
export function aggregateByPlayer(rows: QuotaRow[]): Record<string, PlayerAgg> {
  const out: Record<string, PlayerAgg> = {}
  for (const r of rows) {
    if (!r.player_id) continue
    const acc = out[r.player_id] ?? (out[r.player_id] = { due: 0, paid: 0 })
    acc.due += Number(r.amount_due ?? 0)
    acc.paid += Number(r.amount_paid ?? 0)
  }
  return out
}

export type PaymentStatus = 'sincuota' | 'aldia' | 'parcial' | 'pendiente'

/**
 * Estado de pago de un jugador.
 *  - sincuota: no tiene cuota asignada (sin filas) y 0/0.
 *  - aldia: pagado >= debido (pendiente <= 0).
 *  - parcial: ha pagado algo pero queda pendiente.
 *  - pendiente: cuota asignada pero 0 pagado.
 */
export function paymentStatus(due: number, paid: number, hasCuota: boolean): PaymentStatus {
  if (!hasCuota && due === 0 && paid === 0) return 'sincuota'
  const pending = round2(due - paid)
  if (pending <= 0) return 'aldia'
  if (paid > 0) return 'parcial'
  return 'pendiente'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
