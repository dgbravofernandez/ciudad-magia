/**
 * Tests para las utilidades de contabilidad:
 *  - toDbMethod   — mapeo de etiquetas de UI al enum de BD
 *  - EMAIL_BATCH_CAP / CLUB_IBAN — documentan los valores contrato
 */
import { describe, it, expect } from 'vitest'
import { toDbMethod, EMAIL_BATCH_CAP, CLUB_IBAN } from '@/lib/contabilidad/constants'

describe('toDbMethod', () => {
  it('convierte "efectivo" → "cash"', () => {
    expect(toDbMethod('efectivo')).toBe('cash')
  })

  it('convierte "tarjeta" → "card"', () => {
    expect(toDbMethod('tarjeta')).toBe('card')
  })

  it('convierte "transferencia" → "transfer"', () => {
    expect(toDbMethod('transferencia')).toBe('transfer')
  })

  it('pasa-a-través valores ya normalizados "cash"', () => {
    expect(toDbMethod('cash')).toBe('cash')
  })

  it('pasa-a-través valores ya normalizados "card"', () => {
    expect(toDbMethod('card')).toBe('card')
  })

  it('pasa-a-través valores ya normalizados "transfer"', () => {
    expect(toDbMethod('transfer')).toBe('transfer')
  })

  it('valor desconocido se devuelve sin cambios (safe fallback)', () => {
    expect(toDbMethod('bizum')).toBe('bizum')
    expect(toDbMethod('')).toBe('')
    expect(toDbMethod('EFECTIVO')).toBe('EFECTIVO') // case-sensitive
  })
})

describe('EMAIL_BATCH_CAP', () => {
  it('es exactamente 15 — garantiza timeout < 30s en Vercel (15 × 2s)', () => {
    expect(EMAIL_BATCH_CAP).toBe(15)
  })

  it('es un número positivo', () => {
    expect(EMAIL_BATCH_CAP).toBeGreaterThan(0)
  })
})

describe('CLUB_IBAN', () => {
  it('tiene el formato IBAN correcto (sin espacios tiene 24 caracteres)', () => {
    const noSpaces = CLUB_IBAN.replace(/\s/g, '')
    expect(noSpaces).toHaveLength(24)
  })

  it('empieza con ES (banco español)', () => {
    expect(CLUB_IBAN.startsWith('ES')).toBe(true)
  })

  it('el valor exacto del IBAN no cambia sin querer (test de regresión)', () => {
    expect(CLUB_IBAN).toBe('ES58 3067 0163 1028 0449 8729')
  })
})
