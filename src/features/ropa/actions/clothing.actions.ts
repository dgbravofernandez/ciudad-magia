'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export interface CreateClothingOrderInput {
  playerName: string
  description: string
  size: string
  quantity: number
  price: number
  notes?: string | null
}

export async function createClothingOrder(input: CreateClothingOrderInput): Promise<{
  success: boolean
  error?: string
  orderId?: string
}> {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

  const name = input.playerName.trim()
  const description = input.description.trim()
  if (!name || !description) {
    return { success: false, error: 'Nombre de jugador y descripción son obligatorios' }
  }

  const quantity = Math.max(1, Math.floor(input.quantity || 1))
  const unitPrice = Number.isFinite(input.price) ? Math.max(0, input.price) : 0
  const totalAmount = +(unitPrice * quantity).toFixed(2)

  // Best-effort: try to match the typed name to a real player in the club
  let playerId: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  try {
    const { data: matches } = await sb
      .from('players')
      .select('id, first_name, last_name')
      .eq('club_id', clubId)
      .ilike('last_name', `%${name.split(' ').slice(-1)[0]}%`)
      .limit(5)
    if (matches && matches.length > 0) {
      const lower = name.toLowerCase()
      const exact = matches.find((p: { first_name: string; last_name: string }) =>
        `${p.first_name} ${p.last_name}`.toLowerCase() === lower
      )
      playerId = exact?.id ?? matches[0].id
    }
  } catch {
    // non-fatal: proceed without player_id
  }

  // Keep the typed name in notes so it doesn't get lost even if no match was found
  const mergedNotes = [
    playerId ? null : `Jugador (manual): ${name}`,
    input.notes?.trim() ? input.notes.trim() : null,
  ]
    .filter(Boolean)
    .join(' — ') || null

  const { data: order, error: orderErr } = await sb
    .from('clothing_orders')
    .insert({
      club_id: clubId,
      player_id: playerId,
      description,
      total_amount: totalAmount,
      payment_status: 'pending',
      notes: mergedNotes,
      created_by: memberId ?? null,
    })
    .select('id')
    .single()

  if (orderErr) return { success: false, error: orderErr.message }

  const { error: itemErr } = await sb.from('clothing_order_items').insert({
    order_id: order.id,
    item_name: description,
    size: input.size || null,
    quantity,
    unit_price: unitPrice,
  })

  if (itemErr) {
    // Roll back the parent row so we don't leave an order with no items
    await sb.from('clothing_orders').delete().eq('id', order.id)
    return { success: false, error: itemErr.message }
  }

  revalidatePath('/ropa')
  return { success: true, orderId: order.id }
}

export async function markClothingOrderPaid(orderId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { error } = await sb
    .from('clothing_orders')
    .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/ropa')
  return { success: true }
}
