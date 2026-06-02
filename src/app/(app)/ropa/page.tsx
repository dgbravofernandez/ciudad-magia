import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { RopaPage } from '@/features/ropa/components/RopaPage'
import type { ClothingCatalogItem } from '@/features/ropa/actions/clothing.actions'

export const dynamic = 'force-dynamic'

export default async function Ropa() {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const [{ data: pedidos }, { data: players }, { data: settings }] = await Promise.all([
    supabase
      .from('clothing_orders')
      .select('*, clothing_order_items(count), player:player_id(first_name, last_name)')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false }),
    supabase
      .from('players')
      .select('id, first_name, last_name, tutor_phone')
      .eq('club_id', clubId)
      .eq('status', 'active')
      .order('last_name'),
    supabase
      .from('club_settings')
      .select('clothing_catalog')
      .eq('club_id', clubId)
      .single(),
  ])

  const catalog = ((settings?.clothing_catalog as ClothingCatalogItem[] | null) ?? [])

  return <RopaPage pedidos={pedidos ?? []} players={players ?? []} clubId={clubId} catalog={catalog} />
}
