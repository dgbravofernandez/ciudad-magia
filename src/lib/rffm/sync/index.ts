import { createAdminClient } from '@/lib/supabase/admin'
import { syncCalendar } from './syncCalendar'
import { syncActas } from './syncActas'
import { syncCardAlerts } from './syncCardAlerts'
import { syncAllScorers } from './syncAllScorers'
import { enrichSignalsBatch } from './syncEnrich'
import { syncStandings } from './syncStandings'
import { CURRENT_SEASON } from '../constants'
import type { SyncResult } from '../types'

export type SyncType = 'full' | 'calendar' | 'actas' | 'scorers' | 'scorers_f7' | 'scorers_f11' | 'card_alerts' | 'enrich' | 'standings'

/**
 * Main orchestrator — runs the requested sync type and logs to rffm_sync_log.
 */
export async function runSync(
  clubId: string,
  syncType: SyncType,
  options?: { codTemporada?: string; actasLimit?: number; enrichProfiles?: boolean; enrichBatchSize?: number }
): Promise<SyncResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const codTemporada = options?.codTemporada ?? CURRENT_SEASON

  // ── Create log entry ──────────────────────────────────────────
  const { data: logRow } = await sb
    .from('rffm_sync_log')
    .insert({
      club_id: clubId,
      sync_type: syncType,
      status: 'running',
    })
    .select('id')
    .single()
  const logId = logRow?.id

  const result: SyncResult = {
    success: false,
    competitionsProcessed: 0,
    actasProcessed: 0,
    playersFetched: 0,
    signalsCreated: 0,
    errorsCount: 0,
  }

  try {
    if (syncType === 'full' || syncType === 'calendar') {
      const cal = await syncCalendar(clubId)
      result.competitionsProcessed += cal.processed
      result.errorsCount += cal.errors
      if (cal.errorDetail.length) result.errorDetail = cal.errorDetail.join('; ')
    }

    if (syncType === 'full' || syncType === 'actas') {
      // En 'full' limitamos actas a 15 para que el total quepa en 60s
      // (calendar ~27s + 15 actas × ~1.5s = ~50s). El resto cae en el
      // cron diario de actas a las 01:00.
      const actasLimit = syncType === 'full' ? 15 : options?.actasLimit
      const actas = await syncActas(clubId, actasLimit)
      result.actasProcessed += actas.processed
      result.errorsCount += actas.errors
    }

    if (syncType === 'full' || syncType === 'card_alerts') {
      const alerts = await syncCardAlerts(clubId)
      result.errorsCount += alerts.errors
    }

    // 'scorers'/'scorers_f7'/'scorers_f11' YA NO van en 'full' — son
    // demasiado pesados (sweep de TODOS los grupos RFFM) y revientan
    // los 60s de Vercel Hobby. Se ejecutan por separado (cron domingo
    // o botones dedicados).
    if (
      syncType === 'scorers' ||
      syncType === 'scorers_f7' ||
      syncType === 'scorers_f11'
    ) {
      const tiposjuego =
        syncType === 'scorers_f7' ? ['2'] :
        syncType === 'scorers_f11' ? ['1'] :
        undefined
      const scorers = await syncAllScorers(clubId, codTemporada, tiposjuego, { enrich: false })
      result.signalsCreated += scorers.signalsCreated
      result.playersFetched += scorers.playersFetched
      result.errorsCount += scorers.errors
      if (scorers.errorDetail.length) {
        result.errorDetail = [result.errorDetail, ...scorers.errorDetail].filter(Boolean).join('; ')
      }
    }

    if (syncType === 'enrich') {
      const er = await enrichSignalsBatch(clubId, options?.enrichBatchSize)
      result.playersFetched += er.enriched
      result.errorsCount += er.failed
      if (er.errors.length) {
        result.errorDetail = [result.errorDetail, ...er.errors].filter(Boolean).join('; ')
      }
    }

    // 'standings' fuera de 'full' también — son 67 llamadas (~27s)
    // que se acumulan al calendar+actas y revientan el budget.
    // Cron diario a las 02:00 + botón "Refrescar clasificaciones".
    if (syncType === 'standings') {
      const st = await syncStandings(clubId)
      result.errorsCount += st.errors
      if (st.errorDetail.length) {
        result.errorDetail = [result.errorDetail, ...st.errorDetail].filter(Boolean).join('; ')
      }
    }

    result.success = result.errorsCount === 0 || (
      result.competitionsProcessed + result.actasProcessed + result.signalsCreated > 0
    )
  } catch (e) {
    result.success = false
    result.errorDetail = (e as Error).message
    result.errorsCount++
  }

  // ── Update log entry ──────────────────────────────────────────
  if (logId) {
    await sb
      .from('rffm_sync_log')
      .update({
        status: result.success ? (result.errorsCount > 0 ? 'partial' : 'success') : 'error',
        competitions_processed: result.competitionsProcessed,
        actas_processed: result.actasProcessed,
        players_fetched: result.playersFetched,
        signals_created: result.signalsCreated,
        errors_count: result.errorsCount,
        error_detail: result.errorDetail ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', logId)
  }

  return result
}
