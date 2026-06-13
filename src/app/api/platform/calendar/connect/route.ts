import { NextRequest, NextResponse } from 'next/server'
import { headers, cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getOAuthClient, GOOGLE_SCOPES } from '@/lib/google/oauth'
import { GOOGLE_CALENDAR_SCOPES } from '@/lib/google/calendar'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

async function isSuperadmin(): Promise<string | null> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? user.id : null
}

export async function GET() {
  void headers
  const userId = await isSuperadmin()
  if (!userId) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  // CSRF nonce + binding al user_id
  const nonce = randomBytes(32).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('platform_oauth_nonce', nonce, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 600, path: '/' })

  const oauth = getOAuthClient()
  const url = oauth.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [...GOOGLE_SCOPES, ...GOOGLE_CALENDAR_SCOPES],
    state: Buffer.from(JSON.stringify({ userId, nonce, intent: 'platform_calendar' })).toString('base64url'),
  })

  return NextResponse.redirect(url)
}
