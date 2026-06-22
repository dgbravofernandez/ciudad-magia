import { createAdminClient } from '@/lib/supabase/admin'
import { DemosView } from '@/features/marketing/components/DemosView'

export const dynamic = 'force-dynamic'

export default async function DemosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay() + 1)  // lunes
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  const [
    { data: requests },
    { data: upcoming },
    { data: past },
    { data: weekDemos },
  ] = await Promise.all([
    // Solicitudes de llamada sin hora fija ("dime cuándo y me adapto")
    sb.from('marketing_demos')
      .select('*, marketing_clubs(name, email, location, federation)')
      .eq('status', 'requested')
      .order('created_at', { ascending: false })
      .limit(50),
    sb.from('marketing_demos')
      .select('*, marketing_clubs(name, email, location, federation)')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50),
    sb.from('marketing_demos')
      .select('*, marketing_clubs(name, email, location)')
      .not('scheduled_at', 'is', null)
      .lt('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: false })
      .limit(30),
    sb.from('marketing_demos')
      .select('id, scheduled_at, contact_name, duration_min, status, marketing_clubs(name)')
      .gte('scheduled_at', startOfWeek.toISOString())
      .lt('scheduled_at', endOfWeek.toISOString())
      .neq('status', 'canceled'),
  ])

  return (
    <DemosView
      requests={requests ?? []}
      upcoming={upcoming ?? []}
      past={past ?? []}
      weekDemos={weekDemos ?? []}
      weekStart={startOfWeek.toISOString()}
    />
  )
}
