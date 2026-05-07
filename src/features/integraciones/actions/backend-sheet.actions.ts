'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { exportClubToBackendSheet, type BackendExportResult } from '@/lib/google/backend-export'
import { checkSheetAccess, createSpreadsheet } from '@/lib/google/sheets-writer'
import { getOAuthClient, GOOGLE_SCOPES } from '@/lib/google/oauth'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

export interface BackendSheetConfig {
  sheetId: string | null
  lastSync: string | null
  serviceAccountEmail: string | null
  googleEmail: string | null          // cuenta OAuth conectada
  hasOAuthToken: boolean              // ¿hay refresh_token guardado?
  hasServiceAccount: boolean          // ¿hay SA en env vars?
}

/**
 * Devuelve la configuración guardada en BD + el email de la service
 * account que el usuario tiene que poner como "Editor" en la hoja.
 */
export async function getBackendSheetConfig(): Promise<{
  success: boolean
  error?: string
  config?: BackendSheetConfig
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data } = await sb
      .from('club_settings')
      .select('backend_sheet_id, backend_sheet_last_sync, google_refresh_token, google_service_email')
      .eq('club_id', clubId)
      .single()

    // Email del service account (solo para info, ya no es necesario compartir manualmente)
    let serviceAccountEmail: string | null = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null
    const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!serviceAccountEmail && keyB64) {
      try {
        const raw = keyB64.startsWith('{') ? keyB64 : Buffer.from(keyB64, 'base64').toString('utf8')
        const json = JSON.parse(raw) as { client_email?: string }
        serviceAccountEmail = json.client_email ?? null
      } catch { /* ignoramos */ }
    }

    return {
      success: true,
      config: {
        sheetId: (data?.backend_sheet_id as string) ?? null,
        lastSync: (data?.backend_sheet_last_sync as string) ?? null,
        serviceAccountEmail,
        googleEmail: (data?.google_service_email as string) ?? null,
        hasOAuthToken: !!(data?.google_refresh_token),
        hasServiceAccount: !!(serviceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Guarda el ID de la hoja en club_settings. Acepta el ID o la URL
 * completa, y extrae el ID si viene URL.
 */
export async function saveBackendSheetId(input: string): Promise<{ success: boolean; error?: string; sheetId?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }

    // Extraer ID si pasaron una URL
    const trimmed = input.trim()
    let sheetId = trimmed
    const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)
    if (urlMatch) sheetId = urlMatch[1]
    if (!sheetId || sheetId.length < 20) {
      return { success: false, error: 'ID inválido. Pega el ID o la URL completa de la hoja.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('club_settings')
      .update({ backend_sheet_id: sheetId })
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/configuracion/integraciones')
    return { success: true, sheetId }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function exportToBackendSheet(): Promise<{
  success: boolean
  error?: string
  result?: BackendExportResult
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: settings } = await sb
      .from('club_settings')
      .select('backend_sheet_id, google_refresh_token')
      .eq('club_id', clubId)
      .single()
    const sheetId = settings?.backend_sheet_id as string | undefined
    if (!sheetId) {
      return { success: false, error: 'Configura primero el ID de la hoja' }
    }
    const refreshToken = settings?.google_refresh_token as string | null

    const result = await exportClubToBackendSheet(clubId, sheetId, refreshToken)

    // Guardar timestamp del último export
    await sb
      .from('club_settings')
      .update({ backend_sheet_last_sync: new Date().toISOString() })
      .eq('club_id', clubId)

    revalidatePath('/configuracion/integraciones')
    return { success: true, result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Genera la URL de autorización OAuth para conectar la cuenta Google del usuario.
 * Devuelve la URL — el cliente hace window.location.href con ella.
 */
export async function getGoogleAuthUrl(): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }

    // SEC-1: Generar nonce aleatorio y guardarlo en cookie httpOnly
    // para prevenir ataques CSRF en el callback OAuth.
    const nonce = randomBytes(32).toString('hex')
    const cookieStore = await cookies()
    cookieStore.set('oauth_nonce', nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutos para completar el flujo OAuth
      path: '/',
    })

    const oauth = getOAuthClient()
    const state = Buffer.from(JSON.stringify({ clubId, nonce })).toString('base64url')
    const url = oauth.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      prompt: 'consent',   // fuerza que Google envíe siempre el refresh_token
      state,
    })
    return { success: true, url }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Desconecta la cuenta Google eliminando el refresh_token guardado */
export async function disconnectGoogle(): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    await sb
      .from('club_settings')
      .update({ google_refresh_token: null, google_service_email: null })
      .eq('club_id', clubId)
    revalidatePath('/configuracion/integraciones')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Crea una nueva hoja de Google Sheets gestionada por la service account
 * y guarda su ID en club_settings. El usuario no necesita configurar nada.
 */
export async function createBackendSheet(): Promise<{
  success: boolean
  error?: string
  sheetId?: string
  url?: string
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: settings } = await sb
      .from('club_settings')
      .select('google_refresh_token')
      .eq('club_id', clubId)
      .single()
    const refreshToken = settings?.google_refresh_token as string | null
    const { id, url } = await createSpreadsheet('Ciudad Magia — Datos del Club', refreshToken)
    const { error } = await sb
      .from('club_settings')
      .update({ backend_sheet_id: id })
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/configuracion/integraciones')
    return { success: true, sheetId: id, url }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function checkBackendSheet(): Promise<{
  success: boolean
  error?: string
  data?: { title: string; url: string; tabs: string[] }
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: settings } = await sb
      .from('club_settings')
      .select('backend_sheet_id, google_refresh_token')
      .eq('club_id', clubId)
      .single()
    const sheetId = settings?.backend_sheet_id as string | undefined
    if (!sheetId) {
      return { success: false, error: 'Configura primero el ID de la hoja' }
    }
    const refreshToken = settings?.google_refresh_token as string | null
    const data = await checkSheetAccess(sheetId, refreshToken)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
