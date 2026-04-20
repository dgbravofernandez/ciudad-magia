import { NextRequest, NextResponse } from 'next/server'
import { generateWeekSessions } from '@/features/entrenadores/actions/schedule.actions'

// Called by Vercel Cron every Sunday at 22:00 UTC (≈ Sunday 23:00 Europe/Madrid).
// Generates training sessions for the upcoming week from each team's recurring schedule.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-vercel-cron')
  const cronSecret = process.env.CRON_SECRET

  if (!cronHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // No clubId → iterate over ALL clubs with active slots
    const result = await generateWeekSessions()
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    )
  }
}
