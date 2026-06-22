import { createAdminClient } from '@/lib/supabase/admin'
import { CampaignsView } from '@/features/marketing/components/CampaignsView'
import type { EngagementLead, ClickDetail, ClickDest, SubjectStat } from '@/features/marketing/components/EngagementPanel'

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  status?: string
  federation?: string
  excluded?: string
  noEmail?: string
  page?: string
  window?: string
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

  // Ventana temporal para el panel de engagement
  const activeWindow = sp.window ?? '7d'
  const windowDays = activeWindow === '30d' ? 30 : activeWindow === 'all' ? 3650 : 7
  const windowStart = new Date(Date.now() - windowDays * 86400_000).toISOString()

  // Query de clubes con filtros aplicados
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clubsQuery: any = sb
    .from('marketing_clubs')
    .select('id, name, email, phone, location, federation, status, last_sent_at, reply_at, priority, excluded, notes', { count: 'exact' })

  if (sp.q) clubsQuery = clubsQuery.or(`name.ilike.%${sp.q}%,email.ilike.%${sp.q}%,location.ilike.%${sp.q}%`)
  if (sp.noEmail === '1') {
    clubsQuery = clubsQuery.eq('status', 'no_email')
  } else if (sp.status) {
    clubsQuery = clubsQuery.eq('status', sp.status)
  } else {
    clubsQuery = clubsQuery.neq('status', 'no_email')
  }
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
    statsNoEmail,
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
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'no_email'),
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

  // Métricas de engagement (aperturas, clics, demos)
  const [
    sendsTotal, opensTotal, clicksTotal, demosTotal, customersTotal,
  ] = await Promise.all([
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).eq('bounced', false),
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).not('opened_at', 'is', null),
    sb.from('marketing_email_sends').select('id', { count: 'exact', head: true }).not('clicked_at', 'is', null),
    sb.from('marketing_demos').select('id', { count: 'exact', head: true }).neq('status', 'canceled'),
    sb.from('clubs').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active').eq('active', true),
  ])

  // ── Datos para panel de engagement ──────────────────────────────────────────
  const [
    { data: engagedSendsRaw },
    { data: clickDetailsRaw },
    { data: windowSendsRaw },
  ] = await Promise.all([
    // Sends con apertura en la ventana temporal, con info del club
    sb.from('marketing_email_sends')
      .select('id, sent_at, opened_at, clicked_at, subject, club_id, marketing_clubs(id, name, email, phone, federation, location, status)')
      .not('opened_at', 'is', null)
      .gte('sent_at', windowStart)
      .order('clicked_at', { ascending: false, nullsFirst: false })
      .order('opened_at', { ascending: false })
      .limit(50),
    // Todos los clics registrados (destino + send_id para cruzar con leads)
    sb.from('marketing_email_clicks')
      .select('send_id, destination')
      .limit(500),
    // Todos los sends de la ventana para calcular performance por asunto
    sb.from('marketing_email_sends')
      .select('subject, opened_at, clicked_at, bounced')
      .gte('sent_at', windowStart)
      .limit(2000),
  ])

  // Leads calientes — enriquecer con info de club
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engagedLeads: EngagementLead[] = (engagedSendsRaw ?? []).map((s: any) => ({
    sendId: s.id,
    clubId: s.club_id,
    clubName: s.marketing_clubs?.name ?? '?',
    email: s.marketing_clubs?.email ?? '',
    phone: s.marketing_clubs?.phone ?? null,
    federation: s.marketing_clubs?.federation ?? null,
    location: s.marketing_clubs?.location ?? null,
    sentAt: s.sent_at,
    openedAt: s.opened_at,
    clickedAt: s.clicked_at,
    subject: s.subject,
    status: s.marketing_clubs?.status ?? '',
  }))

  // Detalle de clics por send (para cruzar con leads)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clickDetails: ClickDetail[] = (clickDetailsRaw ?? []).map((c: any) => ({
    sendId: c.send_id,
    destination: c.destination ?? '',
  }))

  // Agregado de destinos de clic (sin params de URL)
  const destCounts: Record<string, number> = {}
  for (const c of clickDetails) {
    const dest = c.destination.split('?')[0] || '/'
    destCounts[dest] = (destCounts[dest] ?? 0) + 1
  }
  const clickDests: ClickDest[] = Object.entries(destCounts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  // Performance por asunto
  const subjectMap: Record<string, { sent: number; opens: number; clicks: number }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (windowSendsRaw ?? []) as any[]) {
    if (!s.subject) continue
    if (!subjectMap[s.subject]) subjectMap[s.subject] = { sent: 0, opens: 0, clicks: 0 }
    if (!s.bounced) subjectMap[s.subject].sent++
    if (s.opened_at) subjectMap[s.subject].opens++
    if (s.clicked_at) subjectMap[s.subject].clicks++
  }
  const subjectPerf: SubjectStat[] = Object.entries(subjectMap)
    .map(([subject, v]) => ({ subject, ...v }))
    .sort((a, b) => b.opens - a.opens)

  // ─────────────────────────────────────────────────────────────────────────────

  const engagement = {
    emailsSent: sendsTotal.count ?? 0,
    opens: opensTotal.count ?? 0,
    clicks: clicksTotal.count ?? 0,
    demos: demosTotal.count ?? 0,
    customers: customersTotal.count ?? 0,
  }

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
        noEmail: statsNoEmail.count ?? 0,
        sentToday: sentTodayRes.count ?? 0,
      }}
      engagement={engagement}
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
        noEmail: sp.noEmail ?? '',
      }}
      federations={federations}
      engagementData={{
        leads: engagedLeads,
        clickDetails,
        clickDests,
        subjectPerf,
        window: activeWindow,
      }}
    />
  )
}
