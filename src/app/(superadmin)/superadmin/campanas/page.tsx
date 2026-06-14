import { createAdminClient } from '@/lib/supabase/admin'
import { CampaignsView } from '@/features/marketing/components/CampaignsView'

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  status?: string
  federation?: string
  excluded?: string
  page?: string
}

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || '1'))
  const pageSize = 100
  const offset = (page - 1) * pageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Query de clubes con filtros aplicados
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clubsQuery: any = sb
    .from('marketing_clubs')
    .select('id, name, email, location, federation, status, last_sent_at, reply_at, priority, excluded, notes', { count: 'exact' })

  if (sp.q) clubsQuery = clubsQuery.or(`name.ilike.%${sp.q}%,email.ilike.%${sp.q}%,location.ilike.%${sp.q}%`)
  if (sp.status) clubsQuery = clubsQuery.eq('status', sp.status)
  if (sp.federation) clubsQuery = clubsQuery.eq('federation', sp.federation)
  if (sp.excluded === '1') clubsQuery = clubsQuery.eq('excluded', true)
  if (sp.excluded === '0') clubsQuery = clubsQuery.eq('excluded', false)

  clubsQuery = clubsQuery
    .order('excluded', { ascending: true })
    .order('priority', { ascending: true })
    .order('status', { ascending: true })
    .range(offset, offset + pageSize - 1)

  const [
    { data: settings },
    { data: template },
    statsTotal,
    statsPending,
    statsSent,
    statsReplied,
    statsBounced,
    statsUnsubscribed,
    statsExcluded,
    { data: lastSends },
    { data: clubs, count: filteredCount },
    sentTodayRes,
    { data: federationsRaw },
  ] = await Promise.all([
    sb.from('marketing_settings').select('*').eq('id', 1).single(),
    sb.from('marketing_templates').select('*').eq('key', 'email_1').eq('variant', 'A').maybeSingle(),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('excluded', false),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'sent_1'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'replied'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'bounced'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('excluded', true),
    sb.from('marketing_email_sends')
      .select('id, sent_at, subject, bounced, error, marketing_clubs(name, email, status)')
      .order('sent_at', { ascending: false })
      .limit(20),
    clubsQuery,
    sb.from('marketing_email_sends')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    sb.from('marketing_clubs').select('federation').not('federation', 'is', null),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const federations = Array.from(new Set((federationsRaw ?? []).map((f: any) => f.federation).filter(Boolean))).sort() as string[]

  return (
    <CampaignsView
      settings={settings}
      template={template}
      stats={{
        total: statsTotal.count ?? 0,
        pending: statsPending.count ?? 0,
        sent: statsSent.count ?? 0,
        replied: statsReplied.count ?? 0,
        bounced: statsBounced.count ?? 0,
        unsubscribed: statsUnsubscribed.count ?? 0,
        excluded: statsExcluded.count ?? 0,
        sentToday: sentTodayRes.count ?? 0,
      }}
      lastSends={lastSends ?? []}
      clubs={clubs ?? []}
      filteredCount={filteredCount ?? 0}
      page={page}
      pageSize={pageSize}
      filters={{
        q: sp.q ?? '',
        status: sp.status ?? '',
        federation: sp.federation ?? '',
        excluded: sp.excluded ?? '',
      }}
      federations={federations}
    />
  )
}
