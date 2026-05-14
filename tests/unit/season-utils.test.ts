import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getNextSeason, getCurrentSeason, getActiveSeasons } from '@/lib/utils/currency'

describe('getNextSeason', () => {
  it('avanza año inicio y mantiene formato YYYY-YY', () => {
    expect(getNextSeason('2025-26')).toBe('2026-27')
  })

  it('transición 2029-30 → 2030-31', () => {
    expect(getNextSeason('2029-30')).toBe('2030-31')
  })

  it('transición 2099-00 → año 2100', () => {
    expect(getNextSeason('2099-00')).toBe('2100-01')
  })

  it('devuelve input intacto si no cumple formato', () => {
    expect(getNextSeason('mala-temporada')).toBe('mala-temporada')
  })

  it('usa getCurrentSeason si no se pasa argumento', () => {
    const result = getNextSeason()
    // Debe ser distinto a la temporada actual
    expect(result).not.toBe(getCurrentSeason())
    // Y tener formato YYYY-YY
    expect(result).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('getCurrentSeason', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('en septiembre devuelve temporada que empieza ese año', () => {
    vi.setSystemTime(new Date('2025-09-01'))
    expect(getCurrentSeason()).toBe('2025-26')
  })

  it('en agosto devuelve temporada del año anterior', () => {
    vi.setSystemTime(new Date('2026-08-31'))
    expect(getCurrentSeason()).toBe('2025-26')
  })

  it('en enero devuelve temporada del año anterior', () => {
    vi.setSystemTime(new Date('2026-01-15'))
    expect(getCurrentSeason()).toBe('2025-26')
  })

  it('en diciembre devuelve temporada que empezó ese año', () => {
    vi.setSystemTime(new Date('2025-12-31'))
    expect(getCurrentSeason()).toBe('2025-26')
  })
})

describe('getActiveSeasons', () => {
  it('devuelve array de dos elementos', () => {
    const seasons = getActiveSeasons()
    expect(seasons).toHaveLength(2)
  })

  it('el segundo es la siguiente al primero', () => {
    const [cur, next] = getActiveSeasons()
    expect(getNextSeason(cur)).toBe(next)
  })
})
