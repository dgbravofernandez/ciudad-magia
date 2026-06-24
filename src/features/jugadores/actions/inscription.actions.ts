'use server'
/* eslint-disable no-restricted-imports -- acción PÚBLICA sin sesión: no puede usar
   getScopedClient (depende de headers de auth). Usa admin client + slug del club. */

// Acciones PÚBLICAS del formulario de inscripción nativo (sin auth).
// La familia rellena /inscripcion/[slug]; aquí se crea el jugador 'pendiente' y
// se guardan sus documentos (subidos directo a Storage vía signed upload URL).
// Nada va a producción sin revisión: todo entra status='pending'.

import { createAdminClient } from '@/lib/supabase/admin'
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
const SIGN_TTL_SECONDS = 60 * 60 * 24 * 365 * 10  // 10 años
const MAX_PENDING_PER_HOUR = 40                    // anti-abuso simple por club

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveOpenClub(sb: any, slug: string): Promise<{ club?: { id: string; name: string }; error?: string }> {
  const { data: club } = await sb.from('clubs').select('id, name').eq('slug', slug).maybeSingle()
  if (!club) return { error: 'Club no encontrado' }
  const { data: settings } = await sb.from('club_settings')
    .select('inscription_open').eq('club_id', club.id).maybeSingle()
  if (!settings?.inscription_open) return { error: 'Las inscripciones de este club están cerradas' }
  return { club }
}

/**
 * Devuelve una signed upload URL para que el navegador suba un documento DIRECTO
 * a Storage (sin pasar por el server action → no infla su payload). Valida que el
 * club existe y tiene inscripciones abiertas. El path queda bajo {clubId}/...
 */
export async function getInscriptionUploadTicket(
  slug: string, docType: string, ext: string,
): Promise<{ success: boolean; error?: string; path?: string; token?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolveOpenClub(sb, slug)
    if (r.error || !r.club) return { success: false, error: r.error }
    if (!DOC_COLUMNS[docType as DocType]) return { success: false, error: 'Tipo de documento no válido' }
    const e = (ext || '').toLowerCase().replace('jpeg', 'jpg')
    if (!ALLOWED_EXT.has(e)) return { success: false, error: 'Formato no permitido (JPG, PNG, WEBP o PDF)' }

    const rand = Math.random().toString(36).slice(2, 10)
    const path = `${r.club.id}/inscripcion/${Date.now()}-${rand}/${docType}.${e}`
    const { data, error } = await sb.storage.from('player-docs').createSignedUploadUrl(path)
    if (error || !data?.token) return { success: false, error: error?.message ?? 'No se pudo preparar la subida' }
    return { success: true, path, token: data.token }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export interface InscriptionInput {
  first_name: string
  last_name: string
  birth_date?: string | null
  dni?: string | null
  spanish_nationality?: boolean | null
  tutor_name?: string | null
  tutor_email?: string | null
  tutor_phone?: string | null
  categoria?: string | null
  consent: boolean
  website?: string          // honeypot: relleno = bot
  docs?: Array<{ docType: string; path: string }>
}

/**
 * Registra la inscripción: crea el jugador 'pendiente' (source='inscription_form')
 * y enlaza los documentos ya subidos a Storage. El club los revisa en la app.
 */
export async function submitInscription(
  slug: string, input: InscriptionInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolveOpenClub(sb, slug)
    if (r.error || !r.club) return { success: false, error: r.error }
    const clubId = r.club.id

    if (input.website) return { success: false, error: 'Solicitud no válida' }   // honeypot
    if (!input.consent) return { success: false, error: 'Debes aceptar el tratamiento de datos' }
    const first = (input.first_name || '').trim()
    const last = (input.last_name || '').trim()
    if (!first || !last) return { success: false, error: 'Nombre y apellidos son obligatorios' }
    const email = (input.tutor_email || '').trim().toLowerCase()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'El email del tutor no es válido' }

    // Anti-abuso: límite de inscripciones por club y hora
    const sinceHour = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await sb.from('players')
      .select('id', { count: 'exact', head: true })
      .eq('club_id', clubId).eq('source', 'inscription_form').gte('created_at', sinceHour)
    if ((count ?? 0) >= MAX_PENDING_PER_HOUR) {
      return { success: false, error: 'Se han recibido demasiadas inscripciones ahora mismo. Inténtalo en unos minutos.' }
    }

    const { data: player, error } = await sb.from('players').insert({
      club_id: clubId,
      first_name: first,
      last_name: last,
      birth_date: input.birth_date || null,
      dni: (input.dni || '').trim().toUpperCase() || null,
      nationality: input.spanish_nationality === false ? null : 'ES',
      spanish_nationality: typeof input.spanish_nationality === 'boolean' ? input.spanish_nationality : null,
      tutor_name: (input.tutor_name || '').trim() || null,
      tutor_email: email || null,
      tutor_phone: (input.tutor_phone || '').trim() || null,
      notes: input.categoria ? `Categoría solicitada: ${input.categoria}` : null,
      status: 'pending',
      source: 'inscription_form',
    }).select('id').single()
    if (error || !player) return { success: false, error: error?.message ?? 'No se pudo registrar la inscripción' }

    // Enlazar documentos: firmar cada path (validando que pertenece a este club)
    for (const d of (input.docs ?? [])) {
      const col = DOC_COLUMNS[d.docType as DocType]
      if (!col || !d.path || !d.path.startsWith(`${clubId}/`)) continue   // seguridad: path del propio club
      const { data: signed } = await sb.storage.from('player-docs').createSignedUrl(d.path, SIGN_TTL_SECONDS)
      if (signed?.signedUrl) {
        await sb.from('players').update({ [col]: signed.signedUrl }).eq('id', player.id).eq('club_id', clubId)
      }
    }

    revalidatePath('/jugadores/inscripciones')
    revalidatePath('/jugadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
