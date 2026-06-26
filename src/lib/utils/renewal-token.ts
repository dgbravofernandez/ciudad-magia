import { createHmac, timingSafeEqual } from 'crypto'

// Token firmado por jugador para la página pública de RENOVACIÓN
// (/renovacion/[token]). Stateless: HMAC del playerId con APP_SECRET,
// namespaced con prefijo 'r:' para que NO se confunda con doc-token.ts
// (otro endpoint público, distinta finalidad — evita reusar un token de
// docs como token de renovación o viceversa).

const SECRET = process.env.APP_SECRET ?? 'cluberly-renewal-token-fallback'
const NAMESPACE = 'r:'

function sign(playerId: string): string {
  return createHmac('sha256', SECRET).update(NAMESPACE + playerId).digest('base64url').slice(0, 20)
}

export function makeRenewalToken(playerId: string): string {
  return `${playerId}.${sign(playerId)}`
}

export function verifyRenewalToken(token: string): string | null {
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

/** URL pública de renovación de un jugador concreto. */
export function playerRenewalUrl(playerId: string, base?: string): string {
  const b = base ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
  return `${b}/renovacion/${makeRenewalToken(playerId)}`
}
