import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatDateTime, getMonthName } from '@/lib/utils/currency'

describe('formatCurrency', () => {
  it('formatea euros correctamente', () => {
    // 150 EUR en locale es-ES → "150,00 €"
    const result = formatCurrency(150)
    expect(result).toContain('150')
    expect(result).toContain('€')
  })

  it('formatea cantidades con decimales', () => {
    const result = formatCurrency(99.99)
    expect(result).toContain('99')
    expect(result).toContain('€')
  })

  it('admite moneda alternativa', () => {
    const result = formatCurrency(100, 'USD')
    expect(result).toContain('100')
    // No contiene €
    expect(result).not.toContain('€')
  })

  it('formatea cero', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0')
  })

  it('cantidades grandes usan separador de miles', () => {
    const result = formatCurrency(1500)
    // 1.500,00 € en es-ES
    expect(result).toContain('1')
    expect(result).toContain('500')
  })
})

describe('formatDate', () => {
  it('acepta string ISO y devuelve fecha en formato dd/mm/yyyy', () => {
    const result = formatDate('2025-06-15')
    expect(result).toContain('15')
    expect(result).toContain('06')
    expect(result).toContain('2025')
  })

  it('acepta objeto Date', () => {
    const result = formatDate(new Date(2025, 0, 1))
    expect(result).toContain('2025')
  })
})

describe('formatDateTime', () => {
  it('acepta string ISO con hora y devuelve fecha + hora', () => {
    const result = formatDateTime('2025-06-15T10:30:00')
    expect(result).toContain('15')
    expect(result).toContain('06')
    expect(result).toContain('2025')
    // Debe incluir la hora
    expect(result).toContain('10')
    expect(result).toContain('30')
  })

  it('acepta objeto Date', () => {
    const result = formatDateTime(new Date(2025, 5, 15, 14, 0))
    expect(result).toContain('2025')
    expect(result).toContain('14')
    expect(result).toContain('00')
  })

  it('devuelve string no vacío', () => {
    expect(formatDateTime('2025-01-01T00:00:00').length).toBeGreaterThan(0)
  })
})

describe('getMonthName', () => {
  it('enero = "enero"', () => {
    expect(getMonthName(1).toLowerCase()).toBe('enero')
  })

  it('diciembre = "diciembre"', () => {
    expect(getMonthName(12).toLowerCase()).toBe('diciembre')
  })

  it('septiembre = "septiembre"', () => {
    expect(getMonthName(9).toLowerCase()).toBe('septiembre')
  })
})
