'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'

export interface RffmHealth {
  trackedTotal: number
  trackedMissingTeamCode: number
  trackedNeverSynced: number
  actasPending: number
  enrichPending: number
  enrichExhausted: number
  signalsTotal: number
  lastFullSyncAt: string | null
  lastFullSyncStatus: 'success' | 'partial' | 'error' | 'timeout' | 'running' | null
  lastFullSyncErrorDetail: string | null
  hasZombies: boolean         // syncs en running > 10 min
  // Resumen agregado para semáforo
  status: 'green' | 'amber' | 'red' | 'empty'
  summary: string             // 1 línea legible
}

/**
 * Devuelve un snapshot agregado del estado del módulo RFFM para mostrar
 * un health banner en la UI. Pensado para la página /scouting/rffm.
 */
export async function getRffmHealth(): Promise<RffmHealth> {
  const empty: RffmHealth = {
    trackedTotal: 0,
    trackedMissingTeamCode: 0,
    trackedNeverSynced: 0,
    actasPending: 0,
    enrichPending: 0,
    enrichExhausted: 0,
    signalsTotal: 0,
    lastFullSyncAt: null,
    lastFullSyncStatus: null,
    lastFullSyncErrorDetail: null,
    hasZombies: false,
    status: 'empty',
    summary: 'Sin configurar — pulsa "⚡ Configurar desde RFFM" para empezar.',
  }

  try {
    const { sb, clubId } = await getScopedClient()
    if (!clubId) return empty

    const cutoffStale = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const cutoff10min = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const [
      { count: trackedTotal },
      { count: missingTeamCode },
      { count: neverSynced },
      { count: actasPending },
      { count: enrichPending },
      { count: enrichExhausted },
      { count: signalsTotal },
      { data: lastSync },
      { count: zombies },
    ] = await Promise.all([
      sb.from('rffm_tracked_competitions').select('*', { count: 'exact', head: true }).eq('club_id', clubId),
      sb.from('rffm_tracked_competitions').select('*', { count: 'exact', head: true }).eq('club_id', clubId).is('codigo_equipo_nuestro', null),
      sb.from('rffm_tracked_competitions').select('*', { count: 'exact', head: true }).eq('club_id', clubId).or(`last_calendar_sync.is.null,last_calendar_sync.lt.${cutoffStale}`),
      sb.from('rffm_matches').select('*', { count: 'exact', head: true }).eq('club_id', clubId).eq('acta_cerrada', true).is('acta_synced_at', null),
      sb.from('rffm_scouting_signals').select('*', { count: 'exact', head: true }).eq('club_id', clubId).neq('estado', 'descartado').is('anio_nacimiento', null).gte('goles', 10).lt('enrich_attempts', 3),
      sb.from('rffm_scouting_signals').select('*', { count: 'exact', head: true }).eq('club_id', clubId).neq('estado', 'descartado').is('anio_nacimiento', null).gte('goles', 10).gte('enrich_attempts', 3),
      sb.from('rffm_scouting_signals').select('*', { count: 'exact', head: true }).eq('club_id', clubId).neq('estado', 'descartado').gte('goles', 10),
      sb.from('rffm_sync_log')
        .select('sync_type, status, started_at, finished_at, error_detail')
        .eq('club_id', clubId)
        .in('sync_type', ['full', 'calendar', 'actas'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('rffm_sync_log')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('status', 'running')
        .lt('started_at', cutoff10min),
    ])

    const total = trackedTotal ?? 0
    if (total === 0) return empty

    const lastFullSyncAt = lastSync?.started_at ?? null
    const lastFullSyncStatus = (lastSync?.status as RffmHealth['lastFullSyncStatus']) ?? null
    const lastFullSyncErrorDetail = lastSync?.error_detail ?? null
    const hasZombies = (zombies ?? 0) > 0

    // Lógica de semáforo
    const missing = missingTeamCode ?? 0
    const stale = neverSynced ?? 0
    const actas = actasPending ?? 0
    const enrich = enrichPending ?? 0
    const enrichBad = enrichExhausted ?? 0

    let status: RffmHealth['status'] = 'green'
    const reasons: string[] = []

    // Red: bloqueantes
    if (missing > 5) { status = 'red'; reasons.push(`${missing} competiciones sin código de equipo`) }
    if (lastFullSyncStatus === 'error' || lastFullSyncStatus === 'timeout') {
      status = 'red'
      reasons.push(`último sync falló (${lastFullSyncStatus})`)
    }

    // Amber: degradaciones
    if (status !== 'red') {
      if (missing > 0) { status = 'amber'; reasons.push(`${missing} competiciones sin código de equipo`) }
      if (stale > 0) { status = 'amber'; reasons.push(`${stale} competiciones sin sincronizar (>7 días)`) }
      if (actas > 30) { status = 'amber'; reasons.push(`${actas} actas pendientes`) }
      if (enrich > 200) { status = 'amber'; reasons.push(`${enrich} perfiles sin año`) }
      if (hasZombies) { status = 'amber'; reasons.push('sincronizaciones colgadas') }
    }

    let summary = ''
    if (status === 'green') {
      const lastH = lastFullSyncAt ? Math.round((Date.now() - new Date(lastFullSyncAt).getTime()) / (60 * 60 * 1000)) : null
      summary = `${total} competiciones · ${signalsTotal ?? 0} goleadores rivales${lastH != null ? ` · sync hace ${lastH}h` : ''}`
    } else {
      summary = reasons.join(' · ')
    }

    return {
      trackedTotal: total,
      trackedMissingTeamCode: missing,
      trackedNeverSynced: stale,
      actasPending: actas,
      enrichPending: enrich,
      enrichExhausted: enrichBad,
      signalsTotal: signalsTotal ?? 0,
      lastFullSyncAt,
      lastFullSyncStatus,
      lastFullSyncErrorDetail,
      hasZombies,
      status,
      summary,
    }
  } catch {
    return empty
  }
}
