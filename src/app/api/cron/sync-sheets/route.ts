import { NextRequest, NextResponse } from 'next/server'
import { previewInscriptionSync, applyInscriptionSync } from '@/features/jugadores/actions/sync-inscriptions.actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

function parseCSV(text: string): string[][] {
  return text.split('\n').map(line => {
    const result: string[] = []
    let cur = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    result.push(cur.trim())
    return result
  })
}

// This endpoint is called by Vercel Cron at 00:00 and 12:00 UTC daily.
// Multi-tenant: sincroniza CADA club con SU PROPIA hoja (club_settings.inscriptions_sheet_id).
// Sin hoja configurada → se omite (nunca fallback a la hoja de otro club).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET not configured — refusing request')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!cronHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    logger.info({ action: 'syncSheets', phase: 'start' })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Clubs con hoja de inscripciones configurada
    const { data: configs } = await sb
      .from('club_settings')
      .select('club_id, inscriptions_sheet_id, inscriptions_form_gids')
      .not('inscriptions_sheet_id', 'is', null)

    type SyncResult = { clubId: string; updated?: number; unmatched?: number; skipped?: string; error?: string }
    type ClubCfg = { club_id: string; inscriptions_sheet_id: string; inscriptions_form_gids: string | null }

    // NEW-3: procesamiento concurrente con límite. A 1000 clubs secuencial son ~2.7h;
    // con concurrencia 5, baja a ~30 min. Límite bajo (5) para no saturar Google Sheets export API.
    const CONCURRENCY = 5

    async function syncOneClub(cfg: ClubCfg): Promise<SyncResult> {
      const sheetId = cfg.inscriptions_sheet_id
      if (!sheetId) return { clubId: cfg.club_id, skipped: 'no_sheet' }

      try {
        const gids = (cfg.inscriptions_form_gids ?? '').split(',').map(s => s.trim()).filter(Boolean)
        const [mainRes, ...formResults] = await Promise.all([
          fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`),
          ...gids.map(gid => fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`)),
        ])

        if (!mainRes.ok) return { clubId: cfg.club_id, error: 'fetch_main_failed' }

        const mainRows = parseCSV(await mainRes.text())
        const formRows1 = formResults[0]?.ok ? parseCSV(await formResults[0].text()) : []
        const formRows2 = formResults[1]?.ok ? parseCSV(await formResults[1].text()) : []

        const preview = await previewInscriptionSync(mainRows, formRows1, formRows2, cfg.club_id)
        if (preview.error) return { clubId: cfg.club_id, error: preview.error }
        if (preview.matches.length === 0) return { clubId: cfg.club_id, updated: 0, unmatched: preview.unmatched }

        const { updated, error } = await applyInscriptionSync(preview.matches, cfg.club_id)
        if (error) return { clubId: cfg.club_id, error }
        return { clubId: cfg.club_id, updated, unmatched: preview.unmatched }
      } catch (e) {
        return { clubId: cfg.club_id, error: e instanceof Error ? e.message : String(e) }
      }
    }

    const cfgs = (configs ?? []) as ClubCfg[]
    const results: SyncResult[] = []
    // Pool fijo de N workers — cada uno consume jobs hasta que el cursor se agota
    let cursor = 0
    const workers = Array.from({ length: Math.min(CONCURRENCY, cfgs.length) }, async () => {
      while (true) {
        const i = cursor++
        if (i >= cfgs.length) break
        const res = await syncOneClub(cfgs[i])
        results.push(res)
      }
    })
    await Promise.all(workers)

    const totalUpdated = results.reduce((s, r) => s + (r.updated ?? 0), 0)
    logger.info({ action: 'syncSheets', phase: 'done', clubs: results.length, totalUpdated })
    return NextResponse.json({ success: true, clubs: results.length, totalUpdated, results, timestamp: new Date().toISOString() })
  } catch (err) {
    logger.error({ action: 'syncSheets', error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
