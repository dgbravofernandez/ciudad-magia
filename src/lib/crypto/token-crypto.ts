import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// ──────────────────────────────────────────────────────────────
// Cifrado en reposo de secretos sensibles (SEC-5).
// Usado para `google_refresh_token` en club_settings.
//
// Formato del valor cifrado:  enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
//
// RETROCOMPATIBILIDAD: `decryptToken` devuelve tal cual cualquier valor que
// NO empiece por `enc:v1:` — así los tokens en texto plano ya guardados siguen
// funcionando hasta que el club reconecta (y se reescriben cifrados).
// ──────────────────────────────────────────────────────────────

const PREFIX = 'enc:v1:'
// Sal fija para derivar la clave desde APP_SECRET (que es de alta entropía).
// La aleatoriedad real por mensaje la aporta el IV.
const KEY_SALT = 'cluberly:token-crypto:v1'

function deriveKey(): Buffer {
  const secret = process.env.APP_SECRET
  if (!secret) throw new Error('APP_SECRET no configurado — no se puede cifrar/descifrar')
  return scryptSync(secret, KEY_SALT, 32)
}

/** Cifra un secreto. Lanza si falta APP_SECRET. */
export function encryptToken(plain: string): string {
  const key = deriveKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/**
 * Descifra un valor producido por `encryptToken`.
 * - `null`/vacío → `null`.
 * - Valor sin prefijo `enc:v1:` → se devuelve tal cual (texto plano legado).
 */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null
  if (!stored.startsWith(PREFIX)) return stored // legado en texto plano
  const [, , ivB64, tagB64, ctB64] = stored.split(':')
  if (!ivB64 || !tagB64 || !ctB64) return null
  const key = deriveKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  return pt.toString('utf8')
}

/**
 * Revoca un refresh_token en Google (best-effort). No lanza: si falla, se
 * registra y se continúa (la limpieza en BD es lo prioritario).
 */
export async function revokeGoogleToken(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: refreshToken }).toString(),
    })
  } catch (e) {
    console.warn('[token-crypto] no se pudo revocar el token en Google:', (e as Error).message)
  }
}
