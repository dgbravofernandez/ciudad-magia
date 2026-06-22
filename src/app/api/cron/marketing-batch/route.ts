import { NextRequest, NextResponse } from 'next/server'
import { runCampaignBatch } from '@/features/marketing/actions/campaign.actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300  // hasta 5 min para envío con espaciado

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron/marketing-batch] CRON_SECRET no configurado')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const authHeader = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') === '1'
  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runCampaignBatch({ force: true })
  console.log('[cron/marketing-batch]', JSON.stringify(result))
  return NextResponse.json(result)
}
