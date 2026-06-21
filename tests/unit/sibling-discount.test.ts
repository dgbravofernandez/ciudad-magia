import { describe, it, expect } from 'vitest'
import { discountedSiblingId } from '@/lib/contabilidad/sibling-discount'

describe('discountedSiblingId', () => {
  it('null si hay menos de 2 hermanos con cuota', () => {
    expect(discountedSiblingId([])).toBeNull()
    expect(discountedSiblingId([{ id: 'a', annual: 450 }])).toBeNull()
  })

  it('elige al más barato', () => {
    expect(discountedSiblingId([
      { id: 'a', annual: 450 },
      { id: 'b', annual: 420 },
    ])).toBe('b')
  })

  it('EMPATE: solo UNO recibe el descuento (determinista por id) — bug del doble 40%', () => {
    // Brais y Aitor, ambos Benjamín A (420). Antes recibían el 40% los dos.
    const id = discountedSiblingId([
      { id: 'aitor', annual: 420 },
      { id: 'brais', annual: 420 },
    ])
    expect(id).toBe('aitor') // menor id alfabético, determinista y estable
  })

  it('ignora hermanos sin cuota (annual 0) al contar y elegir', () => {
    expect(discountedSiblingId([
      { id: 'a', annual: 0 },
      { id: 'b', annual: 450 },
    ])).toBeNull() // solo 1 elegible
    expect(discountedSiblingId([
      { id: 'a', annual: 0 },
      { id: 'b', annual: 450 },
      { id: 'c', annual: 420 },
    ])).toBe('c')
  })

  it('es estable: misma entrada → mismo resultado', () => {
    const sibs = [{ id: 'x', annual: 450 }, { id: 'y', annual: 450 }, { id: 'z', annual: 420 }]
    expect(discountedSiblingId(sibs)).toBe('z')
    expect(discountedSiblingId(sibs)).toBe('z')
  })
})
