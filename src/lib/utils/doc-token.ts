import { createHmac, timingSafeEqual } from 'crypto'

// Token firmado por jugador para la página pública de subida de documentos
// (/subir-documentos/[token]). Stateless: HMAC del playerId con APP_SECRET, sin
// columna en BD. Permite que la familia suba docs SOLO del jugador del enlace.

const SECRET = process.env.APP_SECRET ?? 'cluberly-doc-token-fallback'

function sign(playerId: string): string {
  return createHmac('sha256', SECRET).update(playerId).digest('base64url').slice(0, 20)
}

export function makeDocToken(playerId: string): string {
  return `${playerId}.${sign(playerId)}`
}

export function verifyDocToken(token: string): string | null {
  const i = (token ?? '').lastIndexOf('.')
  if (i <= 0) return null
  const playerId = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expected = sign(playerId)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return playerId
}

/** URL pública de subida de documentos de un jugador concreto. */
export function playerDocUploadUrl(playerId: string, base?: string): string {
  const b = base ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
  return `${b}/subir-documentos/${makeDocToken(playerId)}`
}
