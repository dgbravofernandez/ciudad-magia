import { describe, it, expect } from 'vitest'
import { signValue, verifyValue } from '@/lib/utils/hmac'

const SECRET = 'test-secret-for-unit-tests'

describe('signValue / verifyValue', () => {
  it('firma y verifica un payload simple', async () => {
    const signed = await signValue('hello-world', SECRET)
    const result = await verifyValue(signed, SECRET)
    expect(result).toBe('hello-world')
  })

  it('el payload firmado incluye el texto original', async () => {
    const payload = 'club-id:user-id'
    const signed = await signValue(payload, SECRET)
    expect(signed.startsWith(payload + '.')).toBe(true)
  })

  it('verifica payload con puntos en el texto', async () => {
    const payload = '550e8400-e29b-41d4-a716-446655440000:abc-def'
    const signed = await signValue(payload, SECRET)
    const result = await verifyValue(signed, SECRET)
    expect(result).toBe(payload)
  })

  it('rechaza firma con clave incorrecta', async () => {
    const signed = await signValue('my-payload', SECRET)
    const result = await verifyValue(signed, 'wrong-secret')
    expect(result).toBeNull()
  })

  it('rechaza firma manipulada', async () => {
    const signed = await signValue('my-payload', SECRET)
    const tampered = signed.slice(0, -4) + 'dead'
    const result = await verifyValue(tampered, SECRET)
    expect(result).toBeNull()
  })

  it('rechaza string sin punto separador', async () => {
    const result = await verifyValue('no-dot-here', SECRET)
    expect(result).toBeNull()
  })

  it('rechaza string vacío', async () => {
    const result = await verifyValue('', SECRET)
    expect(result).toBeNull()
  })

  it('rechaza firma con solo separador', async () => {
    const result = await verifyValue('.', SECRET)
    expect(result).toBeNull()
  })

  it('firmas distintas para payloads distintos', async () => {
    const s1 = await signValue('payload-1', SECRET)
    const s2 = await signValue('payload-2', SECRET)
    expect(s1).not.toBe(s2)
  })

  it('misma clave produce firma determinista', async () => {
    const s1 = await signValue('same', SECRET)
    const s2 = await signValue('same', SECRET)
    expect(s1).toBe(s2)
  })
})
