import { describe, it, expect } from 'vitest'
import { aggregateByPlayer, paymentStatus } from '@/lib/contabilidad/payments-report'

describe('aggregateByPlayer', () => {
  it('suma amount_due y amount_paid por jugador a través de varias filas', () => {
    const rows = [
      { player_id: 'p1', amount_due: 130, amount_paid: 130 },
      { player_id: 'p1', amount_due: 130, amount_paid: 130 },
      { player_id: 'p1', amount_due: 130, amount_paid: 107.5 }, // Cuota 3 parcial
      { player_id: 'p1', amount_due: 60, amount_paid: 60 },     // Reserva
    ]
    const agg = aggregateByPlayer(rows)
    expect(agg.p1.due).toBe(450)
    expect(agg.p1.paid).toBe(427.5)
  })

  it('INF-1: cuenta los pagos parciales (filas pending con amount_paid>0)', () => {
    // Si solo se contara status='paid' el pagado saldría 0; aquí debe sumar.
    const rows = [{ player_id: 'p2', amount_due: 130, amount_paid: 50 }]
    expect(aggregateByPlayer(rows).p2.paid).toBe(50)
  })

  it('tolera amount nulos y valores en string (NUMERIC de supabase-js)', () => {
    const rows = [
      { player_id: 'p3', amount_due: '130.00', amount_paid: null },
      { player_id: 'p3', amount_due: null, amount_paid: '20.50' },
    ]
    const agg = aggregateByPlayer(rows)
    expect(agg.p3.due).toBe(130)
    expect(agg.p3.paid).toBe(20.5)
  })

  it('ignora filas sin player_id y separa por jugador', () => {
    const rows = [
      { player_id: '', amount_due: 99, amount_paid: 99 },
      { player_id: 'a', amount_due: 10, amount_paid: 0 },
      { player_id: 'b', amount_due: 20, amount_paid: 20 },
    ]
    const agg = aggregateByPlayer(rows)
    expect(Object.keys(agg).sort()).toEqual(['a', 'b'])
    expect(agg.a).toEqual({ due: 10, paid: 0 })
  })
})

describe('paymentStatus', () => {
  it('sincuota cuando no hay cuota y 0/0', () => {
    expect(paymentStatus(0, 0, false)).toBe('sincuota')
  })
  it('aldia cuando pagado >= debido', () => {
    expect(paymentStatus(450, 450, true)).toBe('aldia')
    expect(paymentStatus(450, 460, true)).toBe('aldia') // sobrepago
  })
  it('parcial cuando ha pagado algo pero queda pendiente', () => {
    expect(paymentStatus(450, 427.5, true)).toBe('parcial')
  })
  it('pendiente cuando tiene cuota pero 0 pagado', () => {
    expect(paymentStatus(450, 0, true)).toBe('pendiente')
  })
  it('no marca parcial por errores de redondeo de céntimos', () => {
    // 450 - 449.999 ≈ 0 → al día, no "parcial" por 0,001
    expect(paymentStatus(450, 449.999, true)).toBe('aldia')
  })
})
