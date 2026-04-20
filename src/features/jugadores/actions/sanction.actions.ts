'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

function requireStaff(roles: string[]) {
  if (!roles.some((r) => ['admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador'].includes(r))) {
    throw new Error('Sin permisos')
  }
}

async function verifyClub(sanctionId: string, clubId: string) {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
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
    const { clubId, roles } = await getClubContext()
    requireStaff(roles)
    if (!(await verifyClub(sanctionId, clubId))) return { success: false, error: 'Sanción no encontrada' }

    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('player_sanctions').update(patch).eq('id', sanctionId)
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
    const { clubId, roles } = await getClubContext()
    if (!roles.some((r: string) => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Solo dirección puede eliminar sanciones' }
    }
    if (!(await verifyClub(sanctionId, clubId))) return { success: false, error: 'Sanción no encontrada' }

    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('player_sanctions').delete().eq('id', sanctionId)
    if (error) return { success: false, error: error.message }

    revalidatePath('/jugadores/sanciones')
    revalidatePath('/jugadores')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
