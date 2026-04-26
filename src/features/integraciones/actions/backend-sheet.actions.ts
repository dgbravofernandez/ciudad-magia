'use server'

import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { exportClubToBackendSheet, type BackendExportResult } from '@/lib/google/backend-export'
import { checkSheetAccess } from '@/lib/google/sheets-writer'

export async function exportToBackendSheet(
  spreadsheetId: string,
): Promise<{ success: boolean; error?: string; result?: BackendExportResult }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    if (!spreadsheetId || spreadsheetId.length < 20) {
      return { success: false, error: 'Falta el ID de la hoja de cálculo' }
    }
    const result = await exportClubToBackendSheet(clubId, spreadsheetId)
    revalidatePath('/configuracion/integraciones')
    return { success: true, result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function checkBackendSheet(
  spreadsheetId: string,
): Promise<{ success: boolean; error?: string; data?: { title: string; url: string; tabs: string[] } }> {
  try {
    const { roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    const data = await checkSheetAccess(spreadsheetId)
    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
