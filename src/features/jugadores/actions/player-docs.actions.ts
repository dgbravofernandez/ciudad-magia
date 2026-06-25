'use server'
/* eslint-disable no-restricted-imports -- acción PÚBLICA token-based, sin sesión:
   no puede usar getScopedClient. La autorización es el HMAC del enlace por jugador. */

import { createAdminClient } from '@/lib/supabase/admin'
import { verifyDocToken } from '@/lib/utils/doc-token'
import { revalidatePath } from 'next/cache'

const DOC_COLUMNS = {
  photo:          'photo_url',
  dni_front:      'dni_front_url',
  dni_back:       'dni_back_url',
  birth_cert:     'birth_cert_url',
  residency_cert: 'residency_cert_url',
  passport:       'passport_url',
  nie:            'nie_url',
} as const
type DocType = keyof typeof DOC_COLUMNS

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf'])
const SIGN_TTL_SECONDS = 60 * 60 * 24 * 365 * 10

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePlayer(sb: any, token: string) {
  const playerId = verifyDocToken(token)
  if (!playerId) return { error: 'Enlace no válido o caducado' as const }
  const { data: player } = await sb.from('players')
    .select('id, club_id, first_name, last_name, spanish_nationality, photo_url, dni_front_url, dni_back_url, birth_cert_url, residency_cert_url, passport_url, nie_url')
    .eq('id', playerId).maybeSingle()
  if (!player) return { error: 'Jugador no encontrado' as const }
  return { player }
}

export interface PlayerDocInfo {
  ok: boolean
  error?: string
  name?: string
  clubName?: string
  spanish?: boolean
  have?: Record<string, boolean>
}

/** Datos para la página: nombre, club, si es español, qué docs ya tiene. */
export async function getPlayerDocInfo(token: string): Promise<PlayerDocInfo> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolvePlayer(sb, token)
    if (r.error || !r.player) return { ok: false, error: r.error }
    const p = r.player
    const { data: club } = await sb.from('clubs').select('name').eq('id', p.club_id).maybeSingle()
    const have: Record<string, boolean> = {}
    for (const [k, col] of Object.entries(DOC_COLUMNS)) have[k] = !!p[col]
    return {
      ok: true,
      name: `${p.first_name} ${p.last_name}`.trim(),
      clubName: club?.name ?? 'el club',
      spanish: p.spanish_nationality !== false,
      have,
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Signed upload URL para subir un doc directo a Storage (bucket player-docs). */
export async function getPlayerDocUploadTicket(
  token: string, docType: string, ext: string,
): Promise<{ success: boolean; error?: string; path?: string; uploadToken?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolvePlayer(sb, token)
    if (r.error || !r.player) return { success: false, error: r.error }
    if (!DOC_COLUMNS[docType as DocType]) return { success: false, error: 'Tipo de documento no válido' }
    const e = (ext || '').toLowerCase().replace('jpeg', 'jpg')
    if (!ALLOWED_EXT.has(e)) return { success: false, error: 'Formato no permitido (JPG, PNG, WEBP o PDF)' }

    const rand = Math.random().toString(36).slice(2, 10)
    const path = `${r.player.club_id}/${r.player.id}/${docType}-${Date.now()}-${rand}.${e}`
    const { data, error } = await sb.storage.from('player-docs').createSignedUploadUrl(path)
    if (error || !data?.token) return { success: false, error: error?.message ?? 'No se pudo preparar la subida' }
    return { success: true, path, uploadToken: data.token }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Adjunta los documentos subidos (paths) al jugador del token. */
export async function submitPlayerDocs(
  token: string, docs: Array<{ docType: string; path: string }>,
): Promise<{ success: boolean; error?: string; saved?: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolvePlayer(sb, token)
    if (r.error || !r.player) return { success: false, error: r.error }
    const { id: playerId, club_id: clubId } = r.player
    let saved = 0
    for (const d of (docs ?? [])) {
      const col = DOC_COLUMNS[d.docType as DocType]
      if (!col || !d.path || !d.path.startsWith(`${clubId}/`)) continue   // seguridad: path del club
      const { data: signed } = await sb.storage.from('player-docs').createSignedUrl(d.path, SIGN_TTL_SECONDS)
      if (signed?.signedUrl) {
        const { error } = await sb.from('players').update({ [col]: signed.signedUrl }).eq('id', playerId).eq('club_id', clubId)
        if (!error) saved++
      }
    }
    revalidatePath(`/jugadores/${playerId}`)
    return { success: true, saved }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
