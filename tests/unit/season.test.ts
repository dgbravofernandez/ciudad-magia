import { describe, it, expect } from 'vitest'
import { bumpSeason } from '@/lib/utils/season'

describe('bumpSeason', () => {
  it('avanza formato corto YYYY/YY', () => {
    expect(bumpSeason('2025/26')).toBe('2026/27')
    expect(bumpSeason('2024/25')).toBe('2025/26')
  })

  it('avanza correctamente en cambio de década', () => {
    expect(bumpSeason('2029/30')).toBe('2030/31')
  })

  it('avanza correctamente en cambio de siglo (99 → 00)', () => {
    expect(bumpSeason('1999/00')).toBe('2000/01')
  })

  it('avanza formato largo YYYY/YYYY', () => {
    expect(bumpSeason('2025/2026')).toBe('2026/2027')
  })

  it('lanza error con formato no reconocido', () => {
    expect(() => bumpSeason('25-26')).toThrow()
    expect(() => bumpSeason('temporada')).toThrow()
    expect(() => bumpSeason('')).toThrow()
  })

  it('es idempotente al encadenar (sin drift)', () => {
    expect(bumpSeason(bumpSeason('2025/26'))).toBe('2027/28')
  })
})
