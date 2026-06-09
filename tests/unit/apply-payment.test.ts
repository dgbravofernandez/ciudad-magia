/**
 * Tests para applyPaymentToRecords — distribución de pagos sobre cuotas pendientes.
 * Cubre los escenarios del mundo real de Ciudad Magia (F11/F7/Femenino/Chupetes).
 */
import { describe, it, expect } from 'vitest'
import { applyPaymentToRecords, type PendingRecord } from '@/lib/contabilidad/apply-payment'

// Helpers
const rec = (id: string, due: number, paid = 0): PendingRecord => ({ id, amount_due: due, amount_paid: paid })

describe('applyPaymentToRecords', () => {
  // ── Caso base ──────────────────────────────────────────────────────────────

  it('pago exacto de un registro lo marca como paid', () => {
    const result = applyPaymentToRecords([rec('r1', 60)], 60)
    expect(result).toEqual([{ id: 'r1', newAmountPaid: 60, newStatus: 'paid' }])
  })

  it('pago de 0 no toca ningún registro', () => {
    const result = applyPaymentToRecords([rec('r1', 60)], 0)
    expect(result).toHaveLength(0)
  })

  it('lista vacía devuelve array vacío', () => {
    expect(applyPaymentToRecords([], 450)).toHaveLength(0)
  })

  // ── Cuota completa F11 (Reserva 60 + C1 130 + C2 130 + C3 130 = 450) ──────

  it('pago 450€ cubre los 4 registros F11 completos', () => {
    const records = [rec('r1', 60), rec('r2', 130), rec('r3', 130), rec('r4', 130)]
    const result = applyPaymentToRecords(records, 450)
    expect(result).toHaveLength(4)
    expect(result.every(r => r.newStatus === 'paid')).toBe(true)
    expect(result[0]).toMatchObject({ id: 'r1', newAmountPaid: 60, newStatus: 'paid' })
    expect(result[3]).toMatchObject({ id: 'r4', newAmountPaid: 130, newStatus: 'paid' })
  })

  it('pago 60€ cubre solo Reserva, deja Cuotas 1/2/3 intactas', () => {
    const records = [rec('r1', 60), rec('r2', 130), rec('r3', 130), rec('r4', 130)]
    const result = applyPaymentToRecords(records, 60)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'r1', newAmountPaid: 60, newStatus: 'paid' })
  })

  it('pago 190€ cubre Reserva + Cuota 1 y para', () => {
    const records = [rec('r1', 60), rec('r2', 130), rec('r3', 130), rec('r4', 130)]
    const result = applyPaymentToRecords(records, 190)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: 'r1', newAmountPaid: 60, newStatus: 'paid' })
    expect(result[1]).toMatchObject({ id: 'r2', newAmountPaid: 130, newStatus: 'paid' })
  })

  // ── Cuota completa F7 (Reserva 60 + C1 120 + C2 120 + C3 120 = 420) ───────

  it('pago 420€ cubre los 4 registros F7 completos', () => {
    const records = [rec('r1', 60), rec('r2', 120), rec('r3', 120), rec('r4', 120)]
    const result = applyPaymentToRecords(records, 420)
    expect(result).toHaveLength(4)
    expect(result.every(r => r.newStatus === 'paid')).toBe(true)
  })

  // ── Cuota completa Femenino (60 + 80 + 80 + 90 = 310) ────────────────────

  it('pago 310€ cubre los 4 registros Femenino completos', () => {
    const records = [rec('r1', 60), rec('r2', 80), rec('r3', 80), rec('r4', 90)]
    const result = applyPaymentToRecords(records, 310)
    expect(result).toHaveLength(4)
    expect(result.every(r => r.newStatus === 'paid')).toBe(true)
  })

  // ── Pago parcial ──────────────────────────────────────────────────────────

  it('pago parcial que no cubre el primer registro crea entrada pending', () => {
    const records = [rec('r1', 60), rec('r2', 130)]
    const result = applyPaymentToRecords(records, 30)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'r1', newAmountPaid: 30, newStatus: 'pending' })
  })

  it('pago que cubre un registro y llega parcial al siguiente', () => {
    const records = [rec('r1', 60), rec('r2', 130)]
    const result = applyPaymentToRecords(records, 100)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ id: 'r1', newAmountPaid: 60, newStatus: 'paid' })
    expect(result[1]).toMatchObject({ id: 'r2', newAmountPaid: 40, newStatus: 'pending' })
  })

  // ── Registro ya parcialmente pagado ──────────────────────────────────────

  it('registro con pago previo acumula correctamente', () => {
    const records = [rec('r1', 130, 50)]  // ya pagó 50, debe 80 más
    const result = applyPaymentToRecords(records, 80)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'r1', newAmountPaid: 130, newStatus: 'paid' })
  })

  it('registro ya cubierto (due=0) se salta', () => {
    const records = [rec('r1', 60, 60), rec('r2', 130, 0)]
    const result = applyPaymentToRecords(records, 130)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('r2')
  })

  // ── Pago superior al total pendiente ─────────────────────────────────────

  it('pago mayor que la deuda total cubre todo (sin crear registro extra)', () => {
    const records = [rec('r1', 60), rec('r2', 130)]
    const result = applyPaymentToRecords(records, 500)
    expect(result).toHaveLength(2)
    expect(result.every(r => r.newStatus === 'paid')).toBe(true)
  })

  // ── Tipos numéricos como string (como vienen de Supabase) ─────────────────

  it('acepta amount_due y amount_paid como strings (formato Supabase)', () => {
    const records = [{ id: 'r1', amount_due: '60.00', amount_paid: '0.00' }]
    const result = applyPaymentToRecords(records, 60)
    expect(result[0]).toMatchObject({ id: 'r1', newAmountPaid: 60, newStatus: 'paid' })
  })

  // ── Descuento hermano (importes con decimales) ────────────────────────────

  it('maneja importes con decimales sin drift de punto flotante', () => {
    // Hermano F11: 70€/cuota × 3 = 210 + 60 reserva = 270
    const records = [rec('r1', 60), rec('r2', 70), rec('r3', 70), rec('r4', 70)]
    const result = applyPaymentToRecords(records, 270)
    expect(result).toHaveLength(4)
    expect(result.every(r => r.newStatus === 'paid')).toBe(true)
  })
})
