import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data: pa } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!pa) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  await adm.from('platform_integrations').delete().eq('user_id', user.id).eq('provider', 'google_calendar')
  return NextResponse.json({ success: true })
}
