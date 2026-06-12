import { createAdminClient } from '@/lib/supabase/admin'
import { CampaignsView } from '@/features/marketing/components/CampaignsView'

export const dynamic = 'force-dynamic'

export default async function CampanasPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const [
    { data: settings },
    { data: template },
    { count: total },
    { count: pending },
    { count: sent1 },
    { count: replied },
    { count: bounced },
    { count: unsubscribed },
    { data: lastSends },
    { data: clubsPreview },
    { count: sentToday },
  ] = await Promise.all([
    sb.from('marketing_settings').select('*').eq('id', 1).single(),
    sb.from('marketing_templates').select('*').eq('key', 'email_1').single(),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'sent_1'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'replied'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'bounced'),
    sb.from('marketing_clubs').select('id', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
    sb.from('marketing_email_sends')
      .select('id, sent_at, subject, bounced, error, marketing_clubs(name, email, status)')
      .order('sent_at', { ascending: false })
      .limit(20),
    sb.from('marketing_clubs')
      .select('id, name, email, location, federation, status, last_sent_at, reply_at')
      .order('status', { ascending: true })
      .order('last_sent_at', { ascending: false, nullsFirst: false })
      .limit(50),
    sb.from('marketing_email_sends')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ])

  return (
    <CampaignsView
      settings={settings}
      template={template}
      stats={{
        total: total ?? 0,
        pending: pending ?? 0,
        sent: sent1 ?? 0,
        replied: replied ?? 0,
        bounced: bounced ?? 0,
        unsubscribed: unsubscribed ?? 0,
        sentToday: sentToday ?? 0,
      }}
      lastSends={lastSends ?? []}
      clubsPreview={clubsPreview ?? []}
    />
  )
}
