import { describe, it, expect } from 'vitest'
import { formatCurrency, getNextSeason, getActiveSeasons } from '@/lib/utils/currency'

describe('formatCurrency', () => {
  it('formatea euros en es-ES con 2 decimales', () => {
    // Intl en es-ES usa NBSP antes del símbolo €; comprobamos las partes clave
    const out = formatCurrency(60)
    expect(out).toContain('60,00')
    expect(out).toContain('€')
  })

  it('formatea decimales correctamente', () => {
    expect(formatCurrency(427.5)).toContain('427,50')
  })

  it('formatea cero', () => {
    expect(formatCurrency(0)).toContain('0,00')
  })
})

describe('getNextSeason (formato YYYY-YY)', () => {
  it('avanza una temporada', () => {
    expect(getNextSeason('2025-26')).toBe('2026-27')
  })

  it('devuelve el input si el formato no coincide', () => {
    expect(getNextSeason('2025/26')).toBe('2025/26')
  })
})

describe('getActiveSeasons', () => {
  it('devuelve exactamente dos temporadas [actual, siguiente]', () => {
    const seasons = getActiveSeasons()
    expect(seasons).toHaveLength(2)
    expect(getNextSeason(seasons[0])).toBe(seasons[1])
  })
})
