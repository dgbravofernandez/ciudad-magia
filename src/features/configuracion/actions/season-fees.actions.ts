'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export interface SeasonFee {
  id: string
  club_id: string
  season: string
  team_id: string | null
  concept: string
  amount: number
  sort_order: number
}

function canEdit(roles: string[]): boolean {
  return roles.some((r) => ['admin', 'direccion'].includes(r))
}

export async function listSeasonFees(season: string): Promise<SeasonFee[]> {
  const { clubId } = await getClubContext()
  if (!clubId) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('season_fees')
    .select('*')
    .eq('club_id', clubId)
    .eq('season', season)
    .order('sort_order', { ascending: true })
    .order('concept', { ascending: true })
  return (data ?? []) as SeasonFee[]
}

export async function upsertSeasonFee(input: {
  id?: string
  season: string
  team_id: string | null
  concept: string
  amount: number
  sort_order?: number
}) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!canEdit(roles)) return { success: false, error: 'Sin permisos' }
    if (!input.concept.trim()) return { success: false, error: 'Concepto requerido' }
    if (input.amount < 0) return { success: false, error: 'Importe inválido' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const payload = {
      club_id: clubId,
      season: input.season,
      team_id: input.team_id,
      concept: input.concept.trim(),
      amount: input.amount,
      sort_order: input.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { error } = await sb.from('season_fees').update(payload).eq('id', input.id)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await sb.from('season_fees').insert(payload)
      if (error) return { success: false, error: error.message }
    }
    revalidatePath('/configuracion/cuotas')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteSeasonFee(id: string) {
  try {
    const { roles } = await getClubContext()
    if (!canEdit(roles)) return { success: false, error: 'Sin permisos' }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('season_fees').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/configuracion/cuotas')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Devuelve el importe a aplicar: prioriza cuota específica del equipo,
 * y hace fallback a la cuota por defecto de la temporada.
 */
export async function resolveFee(
  season: string,
  teamId: string | null,
  concept: string
): Promise<number | null> {
  const { clubId } = await getClubContext()
  if (!clubId) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data } = await sb
    .from('season_fees')
    .select('amount, team_id')
    .eq('club_id', clubId)
    .eq('season', season)
    .eq('concept', concept)

  const rows = (data ?? []) as Array<{ amount: number; team_id: string | null }>
  const teamRow = teamId ? rows.find((r) => r.team_id === teamId) : null
  const defaultRow = rows.find((r) => r.team_id === null)
  return teamRow?.amount ?? defaultRow?.amount ?? null
}
