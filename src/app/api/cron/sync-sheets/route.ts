import { NextRequest, NextResponse } from 'next/server'
import { previewInscriptionSync, applyInscriptionSync } from '@/features/jugadores/actions/sync-inscriptions.actions'
import { INSCRIPTIONS_SHEET_ID } from '@/features/jugadores/constants'

// This endpoint is called by Vercel Cron at 00:00 and 12:00 UTC daily
export async function GET(req: NextRequest) {
  // Security: only allow Vercel cron or internal calls
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET

  if (!cronHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
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

    const [mainRes, form1Res, form2Res] = await Promise.all([
      fetch(`https://docs.google.com/spreadsheets/d/${INSCRIPTIONS_SHEET_ID}/export?format=csv&gid=0`),
      fetch(`https://docs.google.com/spreadsheets/d/${INSCRIPTIONS_SHEET_ID}/export?format=csv&gid=1234867596`),
      fetch(`https://docs.google.com/spreadsheets/d/${INSCRIPTIONS_SHEET_ID}/export?format=csv&gid=1385952206`),
    ])

    if (!mainRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch main sheet' }, { status: 500 })
    }

    const mainRows = parseCSV(await mainRes.text())
    const formRows1 = form1Res.ok ? parseCSV(await form1Res.text()) : []
    const formRows2 = form2Res.ok ? parseCSV(await form2Res.text()) : []

    const preview = await previewInscriptionSync(mainRows, formRows1, formRows2)
    if (preview.error) {
      return NextResponse.json({ error: preview.error }, { status: 500 })
    }

    if (preview.matches.length === 0) {
      return NextResponse.json({ message: 'No changes', updated: 0 })
    }

    const { updated, error } = await applyInscriptionSync(preview.matches)
    if (error) {
      return NextResponse.json({ error }, { status: 500 })
    }

    const withForm = preview.matches.filter(m => m.forms_link).length
    const withResp = preview.matches.filter(m => m.wants_to_continue !== null).length

    return NextResponse.json({
      success: true,
      updated,
      withForm,
      withResp,
      unmatched: preview.unmatched,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
