import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IntegrationsView } from '@/features/marketing/components/IntegrationsView'

export const dynamic = 'force-dynamic'

export default async function IntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>
}) {
  void headers
  const sp = await searchParams
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data: integration } = await adm
    .from('platform_integrations')
    .select('provider, calendar_email, updated_at')
    .eq('user_id', user.id)
    .eq('provider', 'google_calendar')
    .maybeSingle()

  return (
    <IntegrationsView
      gcalConnected={!!integration}
      gcalEmail={integration?.calendar_email ?? null}
      gcalSince={integration?.updated_at ?? null}
      banner={sp.gcal ?? null}
    />
  )
}
