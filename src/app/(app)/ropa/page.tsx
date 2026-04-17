import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { RopaPage } from '@/features/ropa/components/RopaPage'

export default async function Ropa() {
  const hdrs = await headers()
  const clubId = hdrs.get('x-club-id')!
  const supabase = await createClient()

  const { data: pedidos } = await supabase
    .from('clothing_orders')
    .select('*, clothing_order_items(count), player:player_id(first_name, last_name)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })

  return <RopaPage pedidos={pedidos ?? []} clubId={clubId} />
}
