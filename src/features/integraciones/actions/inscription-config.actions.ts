'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { revalidatePath } from 'next/cache'

// Config del formulario de inscripción nativo: abrir/cerrar y obtener el enlace público.

export async function getInscriptionConfig(): Promise<{ open: boolean; slug: string | null }> {
  try {
    const { sb, clubId } = await getScopedClient()
    const [{ data: settings }, { data: club }] = await Promise.all([
      sb.from('club_settings').select('inscription_open').eq('club_id', clubId).maybeSingle(),
      sb.from('clubs').select('slug').eq('id', clubId).maybeSingle(),
    ])
    return { open: !!settings?.inscription_open, slug: club?.slug ?? null }
  } catch {
    return { open: false, slug: null }
  }
}

export async function setInscriptionOpen(open: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    const { error } = await sb.from('club_settings').update({ inscription_open: open }).eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/configuracion/integraciones')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
