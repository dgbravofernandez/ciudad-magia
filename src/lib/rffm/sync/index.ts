import { createAdminClient } from '@/lib/supabase/admin'
import { syncCalendar } from './syncCalendar'
import { syncActas } from './syncActas'
import { syncCardAlerts } from './syncCardAlerts'
import { syncAllScorers } from './syncAllScorers'
import { CURRENT_SEASON } from '../constants'
import type { SyncResult } from '../types'

export type SyncType = 'full' | 'calendar' | 'actas' | 'scorers' | 'card_alerts'

/**
 * Main orchestrator — runs the requested sync type and logs to rffm_sync_log.
 */
export async function runSync(
  clubId: string,
  syncType: SyncType,
  options?: { codTemporada?: string; actasLimit?: number }
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
      const actas = await syncActas(clubId, options?.actasLimit)
      result.actasProcessed += actas.processed
      result.errorsCount += actas.errors
    }

    if (syncType === 'full' || syncType === 'card_alerts') {
      const alerts = await syncCardAlerts(clubId)
      result.errorsCount += alerts.errors
    }

    if (syncType === 'full' || syncType === 'scorers') {
      const scorers = await syncAllScorers(clubId, codTemporada)
      result.signalsCreated += scorers.signalsCreated
      result.playersFetched += scorers.playersFetched
      result.errorsCount += scorers.errors
      if (scorers.errorDetail.length) {
        result.errorDetail = [result.errorDetail, ...scorers.errorDetail].filter(Boolean).join('; ')
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
