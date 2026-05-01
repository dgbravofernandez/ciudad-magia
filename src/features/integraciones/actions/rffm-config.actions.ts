'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

/**
 * Helper interno: lee el codigo_club RFFM del club_settings.
 * Usado por las features que necesitan llamar a /fichaclub/{X} sin
 * pedirle al usuario que lo escriba cada vez.
 */
export async function getClubRffmCodigo(): Promise<string | null> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data } = await sb
      .from('club_settings')
      .select('rffm_codigo_club')
      .eq('club_id', clubId)
      .single()
    return (data?.rffm_codigo_club as string | undefined) || null
  } catch {
    return null
  }
}

export async function getRffmConfig(): Promise<{
  success: boolean
  error?: string
  codigoClub?: string | null
}> {
  try {
    const { roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    const codigoClub = await getClubRffmCodigo()
    return { success: true, codigoClub }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function saveRffmCodigoClub(codigo: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }

    // Aceptar URL o ID. Extraer del path /fichaclub/{X} si pasa URL completa.
    const trimmed = codigo.trim()
    let codigoClub = trimmed
    const urlMatch = trimmed.match(/\/fichaclub\/(\d+)/)
    if (urlMatch) codigoClub = urlMatch[1]
    if (!/^\d{2,8}$/.test(codigoClub)) {
      return { success: false, error: 'Código inválido. Pega solo el número (ej. 3824) o la URL /fichaclub/3824' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('club_settings')
      .update({ rffm_codigo_club: codigoClub })
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/configuracion/integraciones')
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
