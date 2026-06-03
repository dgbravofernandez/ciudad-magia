import { describe, it, expect } from 'vitest'
import { toDbMethod } from '@/lib/contabilidad/constants'

describe('toDbMethod', () => {
  it('mapea etiquetas en español al enum de BD', () => {
    expect(toDbMethod('efectivo')).toBe('cash')
    expect(toDbMethod('tarjeta')).toBe('card')
    expect(toDbMethod('transferencia')).toBe('transfer')
  })

  it('deja pasar valores ya normalizados', () => {
    expect(toDbMethod('cash')).toBe('cash')
    expect(toDbMethod('card')).toBe('card')
    expect(toDbMethod('transfer')).toBe('transfer')
  })

  it('devuelve el valor sin cambios si no está en el mapa (safe fallback)', () => {
    expect(toDbMethod('bizum')).toBe('bizum')
    expect(toDbMethod('')).toBe('')
  })
})
