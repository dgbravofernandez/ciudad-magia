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

export async function updateTrackedCompetition(
  id: string,
  fields: Partial<{
    nombre_competicion: string
    nombre_grupo: string
    codigo_equipo_nuestro: string
    nombre_equipo_nuestro: string
    umbral_amarillas: number
    active: boolean
  }>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('rffm_tracked_competitions')
      .update(fields)
      .eq('id', id)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/scouting/rffm')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Auto-detecta el código del equipo nuestro en una competición seguida
 * buscando en el calendario un equipo cuyo nombre contenga el del club.
 * Útil cuando el usuario añadió la competición sin saber el código.
 */
export async function autoDetectOurTeamCode(
  trackedCompId: string,
  needle: string = 'GETAFE',
): Promise<{ success: boolean; error?: string; codigo?: string; nombre?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data: comp, error: cErr } = await sb
      .from('rffm_tracked_competitions')
      .select('cod_temporada, cod_tipojuego, cod_competicion, cod_grupo')
      .eq('id', trackedCompId)
      .eq('club_id', clubId)
      .single()
    if (cErr || !comp) return { success: false, error: 'Competición no encontrada' }

    const { getCalendar } = await import('@/lib/rffm/calendar')
    const matches = await getCalendar(comp.cod_temporada, comp.cod_tipojuego, comp.cod_competicion, comp.cod_grupo)
    if (!matches.length) return { success: false, error: 'No hay partidos sincronizados en esta competición' }

    const upperNeedle = needle.toUpperCase()
    const candidates = new Map<string, string>()
    for (const m of matches) {
      if (m.equipo_local && m.equipo_local.toUpperCase().includes(upperNeedle) && m.codigo_equipo_local) {
        candidates.set(m.codigo_equipo_local, m.equipo_local)
      }
      if (m.equipo_visitante && m.equipo_visitante.toUpperCase().includes(upperNeedle) && m.codigo_equipo_visitante) {
        candidates.set(m.codigo_equipo_visitante, m.equipo_visitante)
      }
    }
    if (candidates.size === 0) {
      return { success: false, error: `No se encontró ningún equipo con "${needle}" en el calendario` }
    }
    // Coge el primero (en F11/Aficionado normalmente solo hay uno por grupo)
    const [[codigo, nombre]] = candidates.entries()

    await sb
      .from('rffm_tracked_competitions')
      .update({ codigo_equipo_nuestro: codigo, nombre_equipo_nuestro: nombre })
      .eq('id', trackedCompId)
      .eq('club_id', clubId)

    revalidatePath('/scouting/rffm')
    return { success: true, codigo, nombre }
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

// ── Enrich on-demand ───────────────────────────────────────────

import { enrichSignalsBatch } from '@/lib/rffm/sync/syncEnrich'
import { syncStandings } from '@/lib/rffm/sync/syncStandings'

export async function refreshStandingsNow(): Promise<{
  success: boolean; error?: string;
  result?: { processed: number; totalRows: number; errors: number }
}> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const r = await syncStandings(clubId)
    revalidatePath('/scouting/rffm')
    return {
      success: true,
      result: { processed: r.processed, totalRows: r.totalRows, errors: r.errors },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function enrichSignalsNow(
  batchSize: number = 50,
): Promise<{ success: boolean; error?: string; result?: { attempted: number; enriched: number; failed: number; pending: number } }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // Cap razonable: 100 perfiles ≈ 50s con rate limit, deja margen para Vercel 60s
    const safeBatch = Math.max(1, Math.min(batchSize, 100))
    const r = await enrichSignalsBatch(clubId, safeBatch)
    revalidatePath('/scouting/rffm')
    return {
      success: true,
      result: { attempted: r.attempted, enriched: r.enriched, failed: r.failed, pending: r.pending },
    }
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

// ── PDF export ────────────────────────────────────────────────

export async function exportSignalPdf(signalId: string): Promise<{
  success: boolean
  error?: string
  filename?: string
  base64?: string
}> {
  try {
    const { clubId, memberId } = await getClubContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: signal, error } = await sb
      .from('rffm_scouting_signals')
      .select('*')
      .eq('id', signalId)
      .eq('club_id', clubId)
      .single()

    if (error || !signal) return { success: false, error: error?.message ?? 'No encontrado' }

    let generatedBy = 'Equipo de scouting'
    if (memberId) {
      const { data: member } = await sb
        .from('club_members')
        .select('name')
        .eq('id', memberId)
        .single()
      if (member?.name) generatedBy = member.name
    }

    const { generateRffmSignalPDF } = await import('@/lib/pdf/generate-rffm-signal')
    const pdf = await generateRffmSignalPDF({
      nombreJugador: signal.nombre_jugador,
      nombreEquipo: signal.nombre_equipo,
      nombreCompeticion: signal.nombre_competicion,
      nombreGrupo: signal.nombre_grupo ?? '',
      goles: Number(signal.goles ?? 0),
      partidosJugados: Number(signal.partidos_jugados ?? 0),
      golesPenalti: Number(signal.goles_penalti ?? 0),
      golesPorPartido: Number(signal.goles_por_partido ?? 0),
      divisionLevel: Number(signal.division_level ?? 0),
      valorScore: Number(signal.valor_score ?? 0),
      anioNacimiento: signal.anio_nacimiento ?? null,
      codjugador: signal.codjugador,
      generatedBy,
      generatedAt: new Date().toISOString(),
    })

    const safeName = (signal.nombre_jugador as string).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')
    return {
      success: true,
      filename: `scouting_${safeName}.pdf`,
      base64: pdf.toString('base64'),
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
