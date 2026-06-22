'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'

export interface SiblingPlayer {
  id: string
  first_name: string
  last_name: string
  family_group_id: string | null
}

/** Vincula dos jugadores como hermanos (mismo family_group_id) */
export async function linkSiblings(
  playerId1: string,
  playerId2: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

    // Verificar que ambos pertenecen al club
    const { data: players, error: fetchErr } = await sb
      .from('players')
      .select('id, first_name, last_name, family_group_id')
      .in('id', [playerId1, playerId2])
      .eq('club_id', clubId)

    if (fetchErr || !players || players.length !== 2) {
      return { success: false, error: 'Jugadores no encontrados o no pertenecen al club' }
    }

    // Reutilizar el family_group_id existente si alguno ya tiene uno, o crear nuevo
    const existingGroupId = players.find((p: SiblingPlayer) => p.family_group_id)?.family_group_id
    const groupId = existingGroupId ?? randomUUID()

    // Si alguno ya tenía un grupo diferente, extender ese grupo a ambos
    const { error: updateErr } = await sb
      .from('players')
      .update({ family_group_id: groupId })
      .in('id', [playerId1, playerId2])
      .eq('club_id', clubId)

    if (updateErr) return { success: false, error: updateErr.message }

    revalidatePath('/jugadores')
    revalidatePath('/jugadores/inscripciones')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Desvincula un jugador de su grupo familiar */
export async function unlinkSibling(
  playerId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

    const { error } = await sb
      .from('players')
      .update({ family_group_id: null })
      .eq('id', playerId)
      .eq('club_id', clubId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/jugadores')
    revalidatePath('/jugadores/inscripciones')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Devuelve todos los hermanos de un jugador (mismo family_group_id, excluyendo al propio) */
export async function getSiblings(
  playerId: string,
): Promise<{ siblings: SiblingPlayer[]; error?: string }> {
  try {
    const { sb, clubId } = await getScopedClient()

    const { data: player } = await sb
      .from('players')
      .select('family_group_id')
      .eq('id', playerId)
      .eq('club_id', clubId)
      .single()

    if (!player?.family_group_id) return { siblings: [] }

    const { data: siblings, error } = await sb
      .from('players')
      .select('id, first_name, last_name, family_group_id')
      .eq('club_id', clubId)
      .eq('family_group_id', player.family_group_id)
      .neq('id', playerId)

    if (error) return { siblings: [], error: error.message }
    return { siblings: siblings ?? [] }
  } catch (e) {
    return { siblings: [], error: (e as Error).message }
  }
}

/** Busca jugadores activos del club para vincular como hermano */
export async function searchPlayersForSibling(
  query: string,
  excludeId: string,
): Promise<SiblingPlayer[]> {
  if (!query.trim() || query.length < 2) return []
  try {
    const { sb, clubId } = await getScopedClient()

    const { data } = await sb
      .from('players')
      .select('id, first_name, last_name, family_group_id')
      .eq('club_id', clubId)
      .eq('status', 'active')
      .neq('id', excludeId)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
      .order('last_name')
      .limit(20)

    return (data ?? []) as SiblingPlayer[]
  } catch {
    return []
  }
}
