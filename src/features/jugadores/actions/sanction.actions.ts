'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { revalidatePath } from 'next/cache'

function requireStaff(roles: string[]) {
  if (!roles.some((r) => ['admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador'].includes(r))) {
    throw new Error('Sin permisos')
  }
}

async function verifyClub(sb: any, sanctionId: string, clubId: string) {
  const { data } = await sb
    .from('player_sanctions')
    .select('club_id')
    .eq('id', sanctionId)
    .single()
  return data && data.club_id === clubId
}

export async function updateSanction(
  sanctionId: string,
  patch: { matches_banned?: number; matches_served?: number; active?: boolean; competition?: string; reason?: string }
) {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    requireStaff(roles)
    if (!(await verifyClub(sb, sanctionId, clubId))) return { success: false, error: 'Sanción no encontrada' }

    const { error } = await sb.from('player_sanctions').update(patch).eq('id', sanctionId).eq('club_id', clubId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/jugadores/sanciones')
    revalidatePath('/jugadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteSanction(sanctionId: string) {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Solo dirección puede eliminar sanciones' }
    }
    if (!(await verifyClub(sb, sanctionId, clubId))) return { success: false, error: 'Sanción no encontrada' }

    const { error } = await sb.from('player_sanctions').delete().eq('id', sanctionId).eq('club_id', clubId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/jugadores/sanciones')
    revalidatePath('/jugadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
