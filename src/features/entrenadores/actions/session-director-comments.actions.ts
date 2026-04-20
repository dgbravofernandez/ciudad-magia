'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

const DIRECTOR_ROLES = ['admin', 'direccion', 'director_deportivo']

function canWrite(roles: string[]) {
  return roles.some((r) => DIRECTOR_ROLES.includes(r))
}

export async function addSessionDirectorComment(input: {
  session_id: string
  comment: string
  visible_to_coach?: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'No tienes permiso' }
    if (!input.comment?.trim()) return { success: false, error: 'El comentario no puede estar vacío' }

    const sb = createAdminClient()
    const { error } = await sb.from('session_director_comments').insert({
      club_id: clubId,
      session_id: input.session_id,
      author_id: memberId,
      comment: input.comment.trim(),
      visible_to_coach: input.visible_to_coach ?? true,
    })
    if (error) return { success: false, error: error.message }
    revalidatePath(`/entrenadores/sesiones/${input.session_id}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateSessionDirectorComment(input: {
  id: string
  comment?: string
  visible_to_coach?: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'No tienes permiso' }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.comment !== undefined) patch.comment = input.comment.trim()
    if (input.visible_to_coach !== undefined) patch.visible_to_coach = input.visible_to_coach

    const sb = createAdminClient()
    const { error } = await sb
      .from('session_director_comments')
      .update(patch)
      .eq('id', input.id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteSessionDirectorComment(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canWrite(roles)) return { success: false, error: 'No tienes permiso' }
    const sb = createAdminClient()
    const { error } = await sb
      .from('session_director_comments')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
