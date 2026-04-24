'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { runSync, type SyncType } from '@/lib/rffm/sync'

// ── Sync ──────────────────────────────────────────────────────

export async function triggerRffmSync(
  syncType: SyncType = 'full',
  codTemporada?: string
): Promise<{ success: boolean; error?: string; result?: Record<string, unknown> }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const result = await runSync(clubId, syncType, { codTemporada })
    revalidatePath('/scouting/rffm')
    return { success: true, result: result as unknown as Record<string, unknown> }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Tracked competitions CRUD ─────────────────────────────────

export async function addTrackedCompetition(input: {
  cod_temporada: string
  cod_tipojuego: string
  cod_competicion: string
  cod_grupo: string
  nombre_competicion: string
  nombre_grupo: string
  codigo_equipo_nuestro: string
  nombre_equipo_nuestro: string
  umbral_amarillas?: number
}): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data, error } = await sb
      .from('rffm_tracked_competitions')
      .insert({ club_id: clubId, ...input, umbral_amarillas: input.umbral_amarillas ?? 5 })
      .select('id')
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting/rffm')
    return { success: true, id: (data as { id: string }).id }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeTrackedCompetition(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('rffm_tracked_competitions')
      .delete()
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Scouting signals management ───────────────────────────────

export async function updateSignalStatus(
  id: string,
  estado: 'nuevo' | 'visto' | 'descartado' | 'captado'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('rffm_scouting_signals')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function captureSignalToScouting(signalId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo', 'coordinador'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: signal, error: sigErr } = await sb
      .from('rffm_scouting_signals')
      .select('*')
      .eq('id', signalId)
      .eq('club_id', clubId)
      .single()

    if (sigErr || !signal) return { success: false, error: 'Señal no encontrada' }

    // Create scouting report
    const { data: report, error: repErr } = await sb
      .from('scouting_reports')
      .insert({
        club_id: clubId,
        reported_by: memberId,
        rival_team: signal.nombre_equipo,
        player_name: signal.nombre_jugador,
        position: null,
        comment: `Señal RFFM: ${signal.goles} goles en ${signal.partidos_jugados} partidos (${signal.goles_por_partido}/p) — ${signal.nombre_competicion} ${signal.nombre_grupo}. Año nac: ${signal.anio_nacimiento ?? 'desconocido'}`,
        interest_level: 4,
        status: 'watching',
      })
      .select('id')
      .single()

    if (repErr) return { success: false, error: repErr.message }

    // Link signal to report
    await sb
      .from('rffm_scouting_signals')
      .update({
        estado: 'captado',
        scouting_report_id: (report as { id: string }).id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signalId)

    revalidatePath('/scouting')
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Sync status (last log entry) ──────────────────────────────

export async function getLastSyncStatus(syncType?: string): Promise<{
  success: boolean
  data?: Record<string, unknown>
  error?: string
}> {
  try {
    const { clubId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    let q = sb
      .from('rffm_sync_log')
      .select('*')
      .eq('club_id', clubId)
      .order('started_at', { ascending: false })
      .limit(1)
    if (syncType) q = q.eq('sync_type', syncType)
    const { data, error } = await q.single()
    if (error && error.code !== 'PGRST116') return { success: false, error: error.message }
    return { success: true, data: data as Record<string, unknown> }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
