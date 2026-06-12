import { NextRequest, NextResponse } from 'next/server'
import { sendDemoReminders } from '@/features/marketing/actions/demos.actions'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendDemoReminders({ force: true })
  console.log('[cron/demo-reminders]', JSON.stringify(result))
  return NextResponse.json(result)
}
