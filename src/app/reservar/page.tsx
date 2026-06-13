import { createAdminClient } from '@/lib/supabase/admin'
import { BookingView } from './BookingView'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Reserva tu demo de Cluberly',
  description: 'Reserva 15 minutos para que te enseñe Cluberly. Sin compromiso.',
}

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; club?: string }>
}) {
  const sp = await searchParams

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Siguientes 14 días laborables, slots ocupados
  const now = new Date()
  const in14d = new Date(now)
  in14d.setDate(now.getDate() + 14)

  const { data: occupied } = await sb
    .from('marketing_demos')
    .select('scheduled_at')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in14d.toISOString())
    .neq('status', 'canceled')

  // Buscar nombre prerellenable del club
  let clubName: string | null = null
  if (sp.c) {
    const { data: club } = await sb.from('marketing_clubs').select('name').eq('id', sp.c).maybeSingle()
    clubName = club?.name ?? null
  }
  if (!clubName && sp.club) clubName = decodeURIComponent(sp.club).slice(0, 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const occupiedSlots = (occupied ?? []).map((o: any) => o.scheduled_at)

  return (
    <BookingView
      occupiedSlots={occupiedSlots}
      clubName={clubName}
      marketingClubId={sp.c ?? null}
    />
  )
}
