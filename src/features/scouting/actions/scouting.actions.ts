'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

type ScoutingStatus = 'new' | 'watching' | 'contacted' | 'signed' | 'dropped'

export async function createScoutingReport(input: {
  rival_team: string
  player_name?: string
  dorsal?: string
  position?: string
  approx_age?: number
  comment?: string
  interest_level?: number
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { clubId, memberId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    if (!input.rival_team?.trim()) {
      return { success: false, error: 'El equipo rival es obligatorio' }
    }

    const { data, error } = await sb
      .from('scouting_reports')
      .insert({
        club_id: clubId,
        reported_by: memberId,
        rival_team: input.rival_team.trim(),
        player_name: input.player_name?.trim() || null,
        dorsal: input.dorsal?.trim() || null,
        position: input.position?.trim() || null,
        approx_age: input.approx_age ?? null,
        comment: input.comment?.trim() || null,
        interest_level: input.interest_level ?? 3,
        status: 'new',
      })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting')
    return { success: true, id: (data as { id: string }).id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateScoutingReport(input: {
  id: string
  rival_team?: string
  player_name?: string | null
  dorsal?: string | null
  position?: string | null
  approx_age?: number | null
  comment?: string | null
  interest_level?: number
  status?: ScoutingStatus
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.rival_team !== undefined) patch.rival_team = input.rival_team
    if (input.player_name !== undefined) patch.player_name = input.player_name
    if (input.dorsal !== undefined) patch.dorsal = input.dorsal
    if (input.position !== undefined) patch.position = input.position
    if (input.approx_age !== undefined) patch.approx_age = input.approx_age
    if (input.comment !== undefined) patch.comment = input.comment
    if (input.interest_level !== undefined) patch.interest_level = input.interest_level
    if (input.status !== undefined) patch.status = input.status

    const { error } = await sb
      .from('scouting_reports')
      .update(patch)
      .eq('id', input.id)
      .eq('club_id', clubId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteScoutingReport(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('scouting_reports').delete().eq('id', id).eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
