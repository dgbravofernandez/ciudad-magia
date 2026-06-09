/**
 * Lógica pura de distribución de pagos sobre registros pendientes.
 * Sin dependencias de BD ni contexto — testeable en aislamiento.
 */

export interface PendingRecord {
  id: string
  amount_due: number | string
  amount_paid: number | string
}

export interface PaymentApplication {
  id: string
  /** Nuevo importe pagado acumulado en este registro */
  newAmountPaid: number
  /** Estado resultante: 'paid' si cubre la deuda, 'pending' si es pago parcial */
  newStatus: 'paid' | 'pending'
}

/**
 * Aplica un importe de pago sobre una lista de registros pendientes (orden cronológico).
 * Cubre cada registro completo antes de pasar al siguiente.
 * Si el importe no llega a cubrir un registro, se registra pago parcial.
 *
 * @returns Lista de actualizaciones a aplicar en BD (solo los registros tocados)
 */
export function applyPaymentToRecords(
  pendingRecords: PendingRecord[],
  paymentAmount: number,
): PaymentApplication[] {
  const applications: PaymentApplication[] = []
  let remaining = paymentAmount

  for (const rec of pendingRecords) {
    if (remaining <= 0) break

    const due = Number(rec.amount_due) - Number(rec.amount_paid)
    if (due <= 0) continue  // ya cubierto (raro en pending, pero defensivo)

    if (remaining >= due) {
      // Pago completo de este registro
      applications.push({
        id: rec.id,
        newAmountPaid: Number(rec.amount_due),
        newStatus: 'paid',
      })
      remaining = parseFloat((remaining - due).toFixed(2))
    } else {
      // Pago parcial — cubre lo que queda del importe
      applications.push({
        id: rec.id,
        newAmountPaid: parseFloat((Number(rec.amount_paid) + remaining).toFixed(2)),
        newStatus: 'pending',
      })
      remaining = 0
    }
  }

  return applications
}
