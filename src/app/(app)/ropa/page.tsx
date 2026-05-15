import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { RopaPage } from '@/features/ropa/components/RopaPage'

export const dynamic = 'force-dynamic'

export default async function Ropa() {
  const { clubId } = await getClubContext()
  const supabase = createAdminClient()

  const [{ data: pedidos }, { data: players }] = await Promise.all([
    supabase
      .from('clothing_orders')
      .select('*, clothing_order_items(count), player:player_id(first_name, last_name)')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false }),
    supabase
      .from('players')
      .select('id, first_name, last_name')
      .eq('club_id', clubId)
      .eq('status', 'active')
      .order('last_name'),
  ])

  return <RopaPage pedidos={pedidos ?? []} players={players ?? []} clubId={clubId} />
}
