import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const h = await headers()
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()

  if (!user) return NextResponse.json({ error: 'no_session' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data: paRow } = await adm.from('platform_admins').select('user_id, email').eq('user_id', user.id).maybeSingle()
  const isSuperAdmin = !!paRow

  // Solo superadmins ven los detalles internos
  if (!isSuperAdmin) {
    return NextResponse.json({
      auth: { user_id: user.id, email: user.email },
      superadmin: false,
    })
  }

  return NextResponse.json({
    auth: { user_id: user.id, email: user.email },
    superadmin: true,
    headers_seen_by_server: {
      'x-platform-role': h.get('x-platform-role'),
      'x-club-id': h.get('x-club-id'),
      'x-user-roles': h.get('x-user-roles'),
      'x-user-email': h.get('x-user-email'),
    },
    platform_admins_lookup: { found: true, row: paRow },
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  })
}
