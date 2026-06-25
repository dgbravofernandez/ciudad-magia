'use server'
/* eslint-disable no-restricted-imports -- acción PÚBLICA token-based, sin sesión:
   no puede usar getScopedClient. La autorización es el HMAC del enlace por jugador. */

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { verifyDocToken, playerDocUploadUrl } from '@/lib/utils/doc-token'
import { sendHtmlEmail } from '@/lib/email/send'
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
  clubLogo?: string | null
  brand?: string         // primary_color del club (corporativo)
  spanish?: boolean
  have?: Record<string, boolean>
}

/** Datos para la página: nombre, club + branding, si es español, qué docs ya tiene. */
export async function getPlayerDocInfo(token: string): Promise<PlayerDocInfo> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const r = await resolvePlayer(sb, token)
    if (r.error || !r.player) return { ok: false, error: r.error }
    const p = r.player
    const { data: club } = await sb.from('clubs').select('name, logo_url, primary_color').eq('id', p.club_id).maybeSingle()
    const have: Record<string, boolean> = {}
    for (const [k, col] of Object.entries(DOC_COLUMNS)) have[k] = !!p[col]
    return {
      ok: true,
      name: `${p.first_name} ${p.last_name}`.trim(),
      clubName: club?.name ?? 'el club',
      clubLogo: club?.logo_url ?? null,
      brand: club?.primary_color || '#2563eb',
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

// ── Solicitar documentos al tutor con la lista EXACTA elegida en la ficha ──
// Acción protegida (admin/dirección/coordinador). Envía email custom con el link
// nativo del jugador y la lista de docs solicitados (etiquetas + texto libre).
const REQUEST_DOC_LABELS: Record<string, string> = {
  photo:          'Foto del jugador (tipo carnet)',
  dni_front:      'DNI/NIE — cara 1',
  dni_back:       'DNI/NIE — cara 2 / Libro de familia',
  birth_cert:     'Certificado de nacimiento',
  nie:            'NIE del jugador',
  passport:       'Pasaporte',
  residency_cert: 'Permiso de residencia / empadronamiento',
}

export async function requestPlayerDocs(
  playerId: string,
  docTypes: string[],
  extra?: string,
): Promise<{ success: boolean; error?: string; emailSent?: boolean }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some((r: string) => ['admin', 'direccion', 'coordinador'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: player } = await sb.from('players')
      .select('id, first_name, last_name, tutor_name, tutor_email')
      .eq('id', playerId).eq('club_id', clubId).single()
    if (!player) return { success: false, error: 'Jugador no encontrado' }
    if (!player.tutor_email) return { success: false, error: 'El jugador no tiene email de tutor' }

    const { data: club } = await sb.from('clubs').select('name, primary_color').eq('id', clubId).single()
    const clubName = club?.name ?? 'El Club'
    const brand = club?.primary_color || '#2563eb'

    const items = (docTypes ?? []).map(k => REQUEST_DOC_LABELS[k]).filter(Boolean)
    const extraTxt = (extra ?? '').trim()
    if (extraTxt) items.push(extraTxt)
    if (items.length === 0) return { success: false, error: 'Selecciona al menos un documento.' }

    const uploadUrl = playerDocUploadUrl(playerId)
    const playerName = `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()
    const tutorName  = player.tutor_name || playerName
    const subject = `Documentación pendiente — ${playerName} (${clubName})`
    const list = items.map(i => `<li><strong>${i}</strong></li>`).join('')
    const html = `<div style="font-family:Arial,sans-serif;padding:25px;border:4px solid ${brand};border-radius:15px;color:#333;max-width:560px">
      <h2 style="color:#000;text-align:center;margin-top:0">Solicitud de documentación</h2>
      <p>Hola <strong>${tutorName}</strong>,</p>
      <p>Para tramitar la ficha de <strong>${playerName}</strong> en ${clubName} necesitamos la siguiente documentación:</p>
      <ul style="line-height:1.8">${list}</ul>
      <p>Sube los documentos en este enlace (es seguro, solo para este jugador):</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${uploadUrl}" style="background:${brand};color:#fff;padding:13px 28px;border-radius:8px;font-weight:bold;text-decoration:none;font-size:15px;display:inline-block">
          Subir documentación →
        </a>
      </div>
      <p style="font-size:0.85em;color:#888;text-align:center">O copia este enlace:<br>${uploadUrl}</p>
      <p style="font-size:0.9em;color:#666"><em>Si tienes cualquier duda, contesta a este correo.</em></p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
      <p style="text-align:center;font-size:0.9em">Atentamente,<br><strong>${clubName}</strong></p>
    </div>`

    const { sent } = await sendHtmlEmail({ to: player.tutor_email, subject, html })

    // Log a communications (para el historial de la ficha)
    await sb.from('communications').insert({
      club_id: clubId,
      subject,
      body_html: html,
      template_id: null,
      recipient_type: 'individual',
      recipient_ids: [playerId],
      status: sent ? 'sent' : 'error',
      sent_at: new Date().toISOString(),
    })
    // Marcar flag de docs solicitados (para el badge "Pendiente/Enviado" en la UI)
    await sb.from('players').update({ email_request_docs_sent: true }).eq('id', playerId).eq('club_id', clubId)
    revalidatePath(`/jugadores/${playerId}`)
    revalidatePath('/jugadores/inscripciones')
    return { success: true, emailSent: sent }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
