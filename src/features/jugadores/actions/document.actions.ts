'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { revalidatePath } from 'next/cache'

// Subida nativa de documentos de jugador a Supabase Storage (bucket privado
// 'player-docs', migración 063). Reemplaza la dependencia de Google Forms/Drive.
// Guarda una signed URL de larga duración en la columna correspondiente de players.

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

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
// Signed URL de larga duración (10 años): la URL se guarda en players.<col> y la
// muestra DocRow directamente. Posible hardening futuro: guardar el path y firmar
// bajo demanda en cada visualización.
const SIGN_TTL_SECONDS = 60 * 60 * 24 * 365 * 10

export async function uploadPlayerDocument(
  playerId: string,
  docType: string,
  formData: FormData
): Promise<{ success: boolean; error?: string; url?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion', 'coordinador'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

    const column = DOC_COLUMNS[docType as DocType]
    if (!column) return { success: false, error: 'Tipo de documento no válido' }

    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: 'No se recibió ningún archivo' }
    }
    if (file.size > MAX_BYTES) return { success: false, error: 'El archivo supera los 8 MB' }
    if (!ALLOWED_MIME.has(file.type)) {
      return { success: false, error: 'Formato no permitido (JPG, PNG, WEBP o PDF)' }
    }

    // El jugador debe pertenecer a este club (aislamiento multi-tenant)
    const { data: player } = await sb
      .from('players').select('id').eq('id', playerId).eq('club_id', clubId).single()
    if (!player) return { success: false, error: 'Jugador no encontrado' }

    const ext = (file.type.split('/')[1] ?? 'bin').toLowerCase().replace('jpeg', 'jpg')
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `${clubId}/${playerId}/${docType}-${Date.now()}-${rand}.${ext}`

    const { error: upErr } = await sb.storage
      .from('player-docs')
      .upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) return { success: false, error: upErr.message }

    const { data: signed, error: signErr } = await sb.storage
      .from('player-docs').createSignedUrl(path, SIGN_TTL_SECONDS)
    if (signErr || !signed?.signedUrl) {
      return { success: false, error: signErr?.message ?? 'No se pudo generar la URL del documento' }
    }

    const { error: updErr } = await sb
      .from('players').update({ [column]: signed.signedUrl }).eq('id', playerId).eq('club_id', clubId)
    if (updErr) return { success: false, error: updErr.message }

    revalidatePath(`/jugadores/${playerId}`)
    return { success: true, url: signed.signedUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
