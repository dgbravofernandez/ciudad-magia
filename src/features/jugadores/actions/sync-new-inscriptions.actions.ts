'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { revalidatePath } from 'next/cache'

// ──────────────────────────────────────────────────────────────
// Importar jugadores NUEVOS desde un Google Sheet de inscripciones
// (distinto al de renovaciones — para jugadores que no están en el club)
// El Sheet debe ser público o compartido para que se pueda leer via CSV export
// ──────────────────────────────────────────────────────────────

export interface NewPlayerRow {
  first_name: string
  last_name: string
  tutor_email: string
  tutor_phone: string
  tutor_name: string
  birth_date: string   // YYYY-MM-DD o vacío
  dni: string
  categoria: string    // texto libre, para asignar a un equipo después
  raw: string[]        // fila original
}

export interface NewInscriptionsPreview {
  toCreate: NewPlayerRow[]
  alreadyExist: { name: string; reason: string }[]
  sheetRows: number
  error?: string
}

function extractSheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
  if (match) return match[1]
  return urlOrId.trim()
}

function parseDate(raw: string): string {
  if (!raw) return ''
  // Intentar DD/MM/YYYY → YYYY-MM-DD
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
  // Ya en formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return ''
}

function detectColumn(headers: string[], keywords: string[]): number {
  const h = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
  const kw = keywords.map(k => k.toLowerCase())
  for (const kwd of kw) {
    const idx = h.findIndex(col => col.includes(kwd))
    if (idx >= 0) return idx
  }
  return -1
}

async function fetchSheetCsv(sheetId: string, gid = '0'): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`No se pudo leer el Sheet (HTTP ${res.status}). Asegúrate de que es público.`)
  const text = await res.text()
  return text.split('\n').map(line => {
    const cols: string[] = []
    let cur = ''
    let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    cols.push(cur.trim())
    return cols
  }).filter(row => row.some(c => c.trim()))
}

export async function previewNewInscriptions(sheetUrlOrId: string): Promise<NewInscriptionsPreview> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { toCreate: [], alreadyExist: [], sheetRows: 0, error: 'Sin permisos' }
    }

    const sheetId = extractSheetId(sheetUrlOrId)
    const rows = await fetchSheetCsv(sheetId)
    if (rows.length < 2) return { toCreate: [], alreadyExist: [], sheetRows: 0, error: 'El Sheet está vacío o solo tiene cabecera' }

    const headers = rows[0]
    const dataRows = rows.slice(1)

    // Detectar columnas
    const colNombre    = detectColumn(headers, ['nombre', 'name', 'first'])
    const colApellidos = detectColumn(headers, ['apellido', 'apellidos', 'last', 'surname'])
    const colEmail     = detectColumn(headers, ['email', 'correo', 'mail'])
    const colTelefono  = detectColumn(headers, ['telefono', 'tel', 'phone', 'movil', 'contacto'])
    const colTutor     = detectColumn(headers, ['tutor', 'padre', 'madre', 'responsable', 'familiar'])
    const colFechaNac  = detectColumn(headers, ['fecha', 'nacimiento', 'birth', 'nacido', 'nac'])
    const colDni       = detectColumn(headers, ['dni', 'nif', 'documento', 'id'])
    const colCategoria = detectColumn(headers, ['categoria', 'category', 'equipo', 'team', 'grupo', 'division'])

    if (colNombre < 0 && colApellidos < 0) {
      return { toCreate: [], alreadyExist: [], sheetRows: dataRows.length, error: 'No se encontró columna de nombre en el Sheet' }
    }

    const { data: existingPlayers } = await sb
      .from('players')
      .select('dni, tutor_email, first_name, last_name')
      .eq('club_id', clubId)

    const existingDnis = new Set((existingPlayers ?? []).map((p: { dni: string }) => p.dni?.trim().toLowerCase()).filter(Boolean))
    const existingEmails = new Set((existingPlayers ?? []).map((p: { tutor_email: string }) => p.tutor_email?.trim().toLowerCase()).filter(Boolean))

    const toCreate: NewPlayerRow[] = []
    const alreadyExist: { name: string; reason: string }[] = []

    for (const row of dataRows) {
      const g = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
      const firstName  = g(colNombre)
      const lastName   = g(colApellidos)
      const email      = g(colEmail).toLowerCase()
      const phone      = g(colTelefono)
      const tutorName  = g(colTutor)
      const fechaNac   = parseDate(g(colFechaNac))
      const dni        = g(colDni).toUpperCase()
      const categoria  = g(colCategoria)
      const name       = `${firstName} ${lastName}`.trim()
      if (!name) continue

      // Deduplicar
      if (dni && existingDnis.has(dni.toLowerCase())) {
        alreadyExist.push({ name, reason: `DNI ${dni} ya existe` }); continue
      }
      if (email && existingEmails.has(email)) {
        alreadyExist.push({ name, reason: `Email ${email} ya existe` }); continue
      }

      toCreate.push({ first_name: firstName, last_name: lastName, tutor_email: email, tutor_phone: phone, tutor_name: tutorName, birth_date: fechaNac, dni, categoria, raw: row })
    }

    return { toCreate, alreadyExist, sheetRows: dataRows.length }
  } catch (e) {
    return { toCreate: [], alreadyExist: [], sheetRows: 0, error: (e as Error).message }
  }
}

export async function importNewInscriptions(rows: NewPlayerRow[]): Promise<{
  success: boolean
  created: number
  skipped: number
  error?: string
}> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, created: 0, skipped: 0, error: 'Sin permisos' }
    }
    if (!rows.length) return { success: true, created: 0, skipped: 0 }

    // SEC: Re-validar deduplicación server-side — nunca confiar en los rows del cliente
    const { data: existingPlayers } = await sb
      .from('players')
      .select('dni, tutor_email')
      .eq('club_id', clubId)
    const existingDnis = new Set<string>(
      (existingPlayers ?? []).map((p: { dni: string }) => p.dni?.trim().toLowerCase()).filter(Boolean)
    )
    const existingEmails = new Set<string>(
      (existingPlayers ?? []).map((p: { tutor_email: string }) => p.tutor_email?.trim().toLowerCase()).filter(Boolean)
    )

    let created = 0
    let skipped = 0

    for (const row of rows) {
      // Rechazar duplicados que el cliente pudo haber omitido
      const dniKey = row.dni?.trim().toLowerCase()
      const emailKey = row.tutor_email?.trim().toLowerCase()
      if (dniKey && existingDnis.has(dniKey)) { skipped++; continue }
      if (emailKey && existingEmails.has(emailKey)) { skipped++; continue }

      const { error } = await sb.from('players').insert({
        club_id: clubId,
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        tutor_email: row.tutor_email || null,
        tutor_phone: row.tutor_phone || null,
        tutor_name: row.tutor_name || null,
        birth_date: row.birth_date || null,
        dni: row.dni || null,
        status: 'active',
        notes: row.categoria ? `Categoría solicitada: ${row.categoria}` : null,
      })
      if (error) { skipped++; continue }
      created++
    }

    revalidatePath('/jugadores')
    return { success: true, created, skipped }
  } catch (e) {
    return { success: false, created: 0, skipped: 0, error: (e as Error).message }
  }
}

/**
 * Guarda la URL del Sheet de nuevas inscripciones en club_settings
 */
export async function saveNewInscriptionsSheetId(urlOrId: string): Promise<{ success: boolean; error?: string; sheetId?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const sheetId = extractSheetId(urlOrId)
    const { error } = await sb.from('club_settings')
      .update({ new_inscriptions_sheet_id: sheetId }).eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/configuracion/planificacion')
    return { success: true, sheetId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Lee el sheetId guardado en club_settings
 */
export async function getNewInscriptionsSheetId(): Promise<{ sheetId: string | null }> {
  try {
    const { sb, clubId } = await getScopedClient()
    const { data } = await sb.from('club_settings')
      .select('new_inscriptions_sheet_id').eq('club_id', clubId).single()
    return { sheetId: (data?.new_inscriptions_sheet_id as string) ?? null }
  } catch {
    return { sheetId: null }
  }
}

/**
 * Versión para el CRON (sin sesión): auto-crea jugadores NUEVOS 'pendientes' desde
 * la hoja de inscripciones nuevas de un club concreto, con dedup por DNI/email.
 * Reusa la misma detección de columnas que el flujo manual. source='google_form'.
 * No envía emails ni asigna equipo — el club revisa los pendientes en la app.
 */
export async function autoImportNewInscriptions(
  clubId: string,
): Promise<{ created: number; skipped: number; error?: string }> {
  try {
    if (!clubId) return { created: 0, skipped: 0, error: 'no_club' }
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: settings } = await sb.from('club_settings')
      .select('new_inscriptions_sheet_id').eq('club_id', clubId).maybeSingle()
    const sheetId: string | null = settings?.new_inscriptions_sheet_id ?? null
    if (!sheetId) return { created: 0, skipped: 0 }   // club sin hoja de altas nuevas

    const rows = await fetchSheetCsv(extractSheetId(sheetId))
    if (rows.length < 2) return { created: 0, skipped: 0 }

    const headers = rows[0]
    const dataRows = rows.slice(1)
    const colNombre    = detectColumn(headers, ['nombre', 'name', 'first'])
    const colApellidos = detectColumn(headers, ['apellido', 'apellidos', 'last', 'surname'])
    const colEmail     = detectColumn(headers, ['email', 'correo', 'mail'])
    const colTelefono  = detectColumn(headers, ['telefono', 'tel', 'phone', 'movil', 'contacto'])
    const colTutor     = detectColumn(headers, ['tutor', 'padre', 'madre', 'responsable', 'familiar'])
    const colFechaNac  = detectColumn(headers, ['fecha', 'nacimiento', 'birth', 'nacido', 'nac'])
    const colDni       = detectColumn(headers, ['dni', 'nif', 'documento', 'id'])
    const colCategoria = detectColumn(headers, ['categoria', 'category', 'equipo', 'team', 'grupo', 'division'])
    if (colNombre < 0 && colApellidos < 0) return { created: 0, skipped: 0, error: 'sin_columna_nombre' }

    const { data: existing } = await sb.from('players')
      .select('dni, tutor_email').eq('club_id', clubId)
    const existingDnis = new Set<string>((existing ?? [])
      .map((p: { dni: string }) => p.dni?.trim().toLowerCase()).filter(Boolean))
    const existingEmails = new Set<string>((existing ?? [])
      .map((p: { tutor_email: string }) => p.tutor_email?.trim().toLowerCase()).filter(Boolean))

    let created = 0, skipped = 0
    for (const row of dataRows) {
      const g = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')
      const firstName = g(colNombre)
      const lastName  = g(colApellidos)
      const name = `${firstName} ${lastName}`.trim()
      if (!name) { skipped++; continue }
      const email = g(colEmail).toLowerCase()
      const dni   = g(colDni).toUpperCase()
      if (dni && existingDnis.has(dni.toLowerCase())) { skipped++; continue }
      if (email && existingEmails.has(email)) { skipped++; continue }

      const categoria = g(colCategoria)
      const { error } = await sb.from('players').insert({
        club_id: clubId,
        first_name: firstName || null,
        last_name: lastName || null,
        tutor_email: email || null,
        tutor_phone: g(colTelefono) || null,
        tutor_name: g(colTutor) || null,
        birth_date: parseDate(g(colFechaNac)) || null,
        dni: dni || null,
        status: 'pending',
        source: 'google_form',
        notes: categoria ? `Categoría solicitada: ${categoria}` : null,
      })
      if (error) { skipped++; continue }
      // marcar como vistos dentro de esta pasada (evita duplicar si la hoja repite fila)
      if (dni) existingDnis.add(dni.toLowerCase())
      if (email) existingEmails.add(email)
      created++
    }
    return { created, skipped }
  } catch (e) {
    return { created: 0, skipped: 0, error: (e as Error).message }
  }
}
