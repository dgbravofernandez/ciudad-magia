'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { exportClubToBackendSheet, type BackendExportResult } from '@/lib/google/backend-export'
import { checkSheetAccess } from '@/lib/google/sheets-writer'

export interface BackendSheetConfig {
  sheetId: string | null
  lastSync: string | null
  serviceAccountEmail: string | null
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
      .select('backend_sheet_id, backend_sheet_last_sync')
      .eq('club_id', clubId)
      .single()

    // Email del service account: lo extraemos del JSON privado o de la env
    let serviceAccountEmail: string | null = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null
    const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!serviceAccountEmail && keyB64) {
      try {
        const raw = keyB64.startsWith('{') ? keyB64 : Buffer.from(keyB64, 'base64').toString('utf8')
        const json = JSON.parse(raw) as { client_email?: string }
        serviceAccountEmail = json.client_email ?? null
      } catch {
        // ignoramos
      }
    }

    return {
      success: true,
      config: {
        sheetId: (data?.backend_sheet_id as string) ?? null,
        lastSync: (data?.backend_sheet_last_sync as string) ?? null,
        serviceAccountEmail,
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
      .select('backend_sheet_id')
      .eq('club_id', clubId)
      .single()
    const sheetId = settings?.backend_sheet_id as string | undefined
    if (!sheetId) {
      return { success: false, error: 'Configura primero el ID de la hoja' }
    }

    const result = await exportClubToBackendSheet(clubId, sheetId)

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
      .select('backend_sheet_id')
      .eq('club_id', clubId)
      .single()
    const sheetId = settings?.backend_sheet_id as string | undefined
    if (!sheetId) {
      return { success: false, error: 'Configura primero el ID de la hoja' }
    }
    const data = await checkSheetAccess(sheetId)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
