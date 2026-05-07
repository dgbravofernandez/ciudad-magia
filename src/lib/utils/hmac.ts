/**
 * Utilidades HMAC para cookies sensibles.
 *
 * EDGE RUNTIME COMPATIBLE — usa Web Crypto API (crypto.subtle)
 * disponible tanto en Node.js 18+ como en Edge Runtime de Next.js.
 */

const ALGO = { name: 'HMAC', hash: 'SHA-256' }

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALGO,
    false,
    ['sign', 'verify']
  )
}

/** Genera valor firmado: `${payload}.${hexSignature}` */
export async function signValue(payload: string, secret: string): Promise<string> {
  const key = await getKey(secret)
  const sig = await crypto.subtle.sign(ALGO.name, key, new TextEncoder().encode(payload))
  const hex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `${payload}.${hex}`
}

/**
 * Verifica un valor firmado. Devuelve el payload original si es válido,
 * o `null` si la firma no coincide o el formato es incorrecto.
 */
export async function verifyValue(signed: string, secret: string): Promise<string | null> {
  const lastDot = signed.lastIndexOf('.')
  if (lastDot < 0) return null
  const payload = signed.slice(0, lastDot)
  const sigHex  = signed.slice(lastDot + 1)

  const key = await getKey(secret)
  const sigBytes = new Uint8Array(
    sigHex.match(/.{1,2}/g)?.map(h => parseInt(h, 16)) ?? []
  )
  if (sigBytes.length === 0) return null

  // Comparación en tiempo constante vía subtle.verify
  const valid = await crypto.subtle.verify(ALGO.name, key, sigBytes, new TextEncoder().encode(payload))
  return valid ? payload : null
}
