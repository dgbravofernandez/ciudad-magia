'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export interface CreateTournamentInput {
  name: string
  category?: string | null
  format: 'league' | 'cup' | 'mixed'
  start_date?: string | null
  end_date?: string | null
  location?: string | null
}

export async function createTournament(input: CreateTournamentInput): Promise<{
  success: boolean
  error?: string
  id?: string
}> {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

  const name = input.name?.trim()
  if (!name) return { success: false, error: 'El nombre es obligatorio' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data, error } = await sb
    .from('tournaments')
    .insert({
      club_id: clubId,
      name,
      category: input.category?.trim() || null,
      format: input.format,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      location: input.location?.trim() || null,
      status: 'upcoming',
      created_by: memberId ?? null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/torneos')
  return { success: true, id: data.id }
}

export async function deleteTournament(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb
    .from('tournaments')
    .delete()
    .eq('id', id)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/torneos')
  return { success: true }
}
