import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runSync } from '@/lib/rffm/sync'

// Vercel Hobby max 60s. Full scorer sweep + enrichment may need it all.
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Protected by CRON_SECRET (same as other cron endpoints)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')

  if (
    !cronHeader &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const syncType = (req.nextUrl.searchParams.get('type') as 'full' | 'calendar' | 'actas' | 'scorers' | 'scorers_f7' | 'scorers_f11' | 'card_alerts' | 'enrich') ?? 'full'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Run sync for all clubs (in multi-tenant setup, just Ciudad Magia for now)
  const { data: clubs } = await sb.from('clubs').select('id')

  const results = []
  for (const club of (clubs ?? [])) {
    try {
      const result = await runSync(club.id, syncType)
      results.push({ clubId: club.id, ...result })
    } catch (e) {
      results.push({ clubId: club.id, success: false, error: (e as Error).message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
