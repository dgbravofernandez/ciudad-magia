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

export type ClothingPaymentMethod = 'cash' | 'card' | 'transfer'

export async function markClothingOrderPaid(
  orderId: string,
  paymentMethod: ClothingPaymentMethod
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch order (verify club ownership + get data for cash_movement description)
  const { data: order, error: fetchErr } = await sb
    .from('clothing_orders')
    .select('id, description, total_amount, player_id, notes, payment_status')
    .eq('id', orderId)
    .eq('club_id', clubId)
    .single()

  if (fetchErr || !order) return { success: false, error: fetchErr?.message ?? 'Pedido no encontrado' }
  if (order.payment_status === 'paid') return { success: false, error: 'Este pedido ya está pagado' }

  const paidAt = new Date().toISOString()
  const today = paidAt.slice(0, 10)

  // 1. Mark order as paid
  const { error: updateErr } = await sb
    .from('clothing_orders')
    .update({ payment_status: 'paid', paid_at: paidAt })
    .eq('id', orderId)
    .eq('club_id', clubId)

  if (updateErr) return { success: false, error: updateErr.message }

  // 2. Build description — prefer real player name, fallback to manual name from notes
  let playerLabel = 'Jugador'
  if (order.player_id) {
    const { data: player } = await sb
      .from('players')
      .select('first_name, last_name')
      .eq('id', order.player_id)
      .single()
    if (player) playerLabel = `${player.first_name} ${player.last_name}`.trim()
  } else if (order.notes) {
    const match = (order.notes as string).match(/Jugador \(manual\):\s*([^—]+)/)
    if (match?.[1]) playerLabel = match[1].trim()
  }

  // 3. Create cash_movement row (source='ropa')
  const { error: movementErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'income',
    amount: order.total_amount,
    payment_method: paymentMethod,
    description: `Ropa - ${playerLabel}${order.description ? ` (${order.description})` : ''}`,
    movement_date: today,
    related_clothing_order_id: orderId,
    source: 'ropa',
    registered_by: memberId ?? null,
  })

  if (movementErr) {
    // Roll back the paid status so we don't leave the order marked paid without an income row
    await sb
      .from('clothing_orders')
      .update({ payment_status: 'pending', paid_at: null })
      .eq('id', orderId)
    return { success: false, error: movementErr.message }
  }

  revalidatePath('/ropa')
  revalidatePath('/contabilidad/caja')
  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

/**
 * Anula/devuelve un pedido ya pagado: marca el pedido como 'cancelled' y crea
 * un movimiento de caja negativo (tipo 'expense') ligado al pedido, con source='ropa'.
 */
export async function refundClothingOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: order, error: fetchErr } = await sb
    .from('clothing_orders')
    .select('id, description, total_amount, player_id, notes, payment_status')
    .eq('id', orderId)
    .eq('club_id', clubId)
    .single()

  if (fetchErr || !order) return { success: false, error: fetchErr?.message ?? 'Pedido no encontrado' }
  if (order.payment_status !== 'paid') {
    return { success: false, error: 'Solo se pueden devolver pedidos ya pagados' }
  }

  // Find the original cash_movement to match its payment_method for the refund
  const { data: originalMovement } = await sb
    .from('cash_movements')
    .select('payment_method')
    .eq('related_clothing_order_id', orderId)
    .eq('type', 'income')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const refundMethod = originalMovement?.payment_method ?? 'cash'
  const today = new Date().toISOString().slice(0, 10)

  let playerLabel = 'Jugador'
  if (order.player_id) {
    const { data: player } = await sb
      .from('players')
      .select('first_name, last_name')
      .eq('id', order.player_id)
      .single()
    if (player) playerLabel = `${player.first_name} ${player.last_name}`.trim()
  } else if (order.notes) {
    const match = (order.notes as string).match(/Jugador \(manual\):\s*([^—]+)/)
    if (match?.[1]) playerLabel = match[1].trim()
  }

  // Create the refund movement
  const { error: movementErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'expense',
    amount: order.total_amount,
    payment_method: refundMethod,
    description: `Devolución ropa - ${playerLabel}${order.description ? ` (${order.description})` : ''}`,
    movement_date: today,
    related_clothing_order_id: orderId,
    source: 'ropa',
    registered_by: memberId ?? null,
  })

  if (movementErr) return { success: false, error: movementErr.message }

  // Mark the order cancelled
  const { error: updateErr } = await sb
    .from('clothing_orders')
    .update({ payment_status: 'cancelled' })
    .eq('id', orderId)
    .eq('club_id', clubId)

  if (updateErr) return { success: false, error: updateErr.message }

  revalidatePath('/ropa')
  revalidatePath('/contabilidad/caja')
  revalidatePath('/contabilidad/pagos')
  return { success: true }
}
