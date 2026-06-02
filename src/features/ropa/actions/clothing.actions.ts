'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { assertNotLocked } from '@/lib/accounting/lock'
import { sendPaymentReceiptEmail } from '@/lib/email/send-receipt'

export interface ClothingCatalogItem { name: string; price: number }

export async function updateClothingCatalog(
  items: ClothingCatalogItem[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error } = await sb
    .from('club_settings')
    .update({ clothing_catalog: items })
    .eq('club_id', clubId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/ropa')
  return { success: true }
}

export interface CreateClothingOrderInput {
  playerName: string          // nombre libre (para externos o cuando no se selecciona del club)
  playerId?: string | null    // si se selecciona del combo, se usa directamente
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Si se pasó un playerId explícito (seleccionado del combo en la UI) → usarlo directamente.
  // Si no, guardar el nombre como texto manual en notes (sin fuzzy-match que da falsos positivos).
  let playerId: string | null = input.playerId ?? null

  // Validar que el playerId pertenece al club (seguridad)
  if (playerId) {
    try {
      const { data: playerCheck } = await sb
        .from('players')
        .select('id')
        .eq('id', playerId)
        .eq('club_id', clubId)
        .single()
      if (!playerCheck) playerId = null
    } catch {
      playerId = null
    }
  }

  // Keep the typed name in notes when no player was linked
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
  paymentMethod: ClothingPaymentMethod,
  partialAmount?: number   // si se omite → paga el total pendiente
): Promise<{ success: boolean; error?: string; emailSent?: boolean; emailError?: string }> {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch order (verify club ownership + get data for cash_movement description)
  const { data: order, error: fetchErr } = await sb
    .from('clothing_orders')
    .select('id, description, total_amount, amount_paid, player_id, notes, payment_status')
    .eq('id', orderId)
    .eq('club_id', clubId)
    .single()

  if (fetchErr || !order) return { success: false, error: fetchErr?.message ?? 'Pedido no encontrado' }
  if (order.payment_status === 'paid') return { success: false, error: 'Este pedido ya está pagado' }

  const alreadyPaid = Number(order.amount_paid ?? 0)
  const remaining   = Number(order.total_amount) - alreadyPaid
  const payNow      = partialAmount !== undefined
    ? Math.min(partialAmount, remaining)
    : remaining

  if (payNow <= 0) return { success: false, error: 'Sin importe pendiente' }

  const newAmountPaid = alreadyPaid + payNow
  const isFullyPaid   = newAmountPaid >= Number(order.total_amount) - 0.001

  const paidAt = new Date().toISOString()
  const today = paidAt.slice(0, 10)

  // 1. Build description — prefer real player name, fallback to manual name from notes
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

  // 2. Mark order as paid/partial
  const { error: updateErr } = await sb
    .from('clothing_orders')
    .update({
      payment_status: isFullyPaid ? 'paid' : 'partial',
      amount_paid: newAmountPaid,
      ...(isFullyPaid ? { paid_at: paidAt } : {}),
    })
    .eq('id', orderId)
    .eq('club_id', clubId)

  if (updateErr) return { success: false, error: updateErr.message }

  // 3. Create cash_movement por el importe de ESTE pago (source='ropa')
  const partialLabel = isFullyPaid ? '' : ' (parcial)'
  const { error: movementErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'income',
    amount: payNow,
    payment_method: paymentMethod,
    description: `Ropa - ${playerLabel}${order.description ? ` (${order.description})` : ''}${partialLabel}`,
    movement_date: today,
    related_clothing_order_id: orderId,
    source: 'ropa',
    registered_by: memberId ?? null,
  })

  if (movementErr) {
    // Roll back
    await sb
      .from('clothing_orders')
      .update({ payment_status: alreadyPaid > 0 ? 'partial' : 'pending', amount_paid: alreadyPaid, paid_at: null })
      .eq('id', orderId)
    return { success: false, error: movementErr.message }
  }

  // Email de confirmación con justificante PDF — DEBE ir antes de revalidatePath
  let emailSent = false
  let emailError: string | undefined

  if (!order.player_id) {
    emailError = 'El pedido no tiene jugador del club asociado (es manual/externo)'
  } else {
    // NO usar join teams(name) — PostgREST falla silenciosamente y devuelve null.
    // Se consulta el equipo por separado.
    const { data: player, error: playerErr } = await sb
      .from('players')
      .select('tutor_email, team_id')
      .eq('id', order.player_id)
      .single()

    const tutorEmail = player?.tutor_email ?? null

    let teamName = 'Ropa'
    if (player?.team_id) {
      const { data: team } = await sb
        .from('teams')
        .select('name')
        .eq('id', player.team_id)
        .single()
      if (team?.name) teamName = team.name
    }

    if (playerErr) {
      emailError = `Error al leer el jugador: ${playerErr.message}`
    } else if (!tutorEmail) {
      emailError = 'El jugador no tiene email de tutor configurado'
    } else {
      try {
        const res = await Promise.race([
          sendPaymentReceiptEmail({
            tutorEmail,
            playerName: playerLabel,
            teamName,
            amount: payNow,
            method: paymentMethod,
            date: today,
            concept: isFullyPaid
              ? `Ropa${order.description ? ` — ${order.description}` : ''}`
              : `Ropa (pago parcial)${order.description ? ` — ${order.description}` : ''}`,
            clubId,
          }),
          new Promise<{ sent: boolean; error?: string }>((_, rej) =>
            setTimeout(() => rej(new Error('timeout tras 20s')), 20000)),
        ])
        emailSent = res.sent
        if (!res.sent) emailError = res.error ?? 'Error desconocido al enviar'
        console.log(`[ropa] email → sent=${res.sent}${res.error ? ` error=${res.error}` : ''}`)
      } catch (err) {
        emailError = (err as Error).message
        console.error('[ropa] email error (pago ya registrado):', err)
      }
    }
  }

  revalidatePath('/ropa')
  revalidatePath('/contabilidad/caja')
  revalidatePath('/contabilidad/pagos')

  return { success: true, emailSent, emailError }
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
    .select('id, description, total_amount, player_id, notes, payment_status, paid_at')
    .eq('id', orderId)
    .eq('club_id', clubId)
    .single()

  if (fetchErr || !order) return { success: false, error: fetchErr?.message ?? 'Pedido no encontrado' }
  if (order.payment_status !== 'paid') {
    return { success: false, error: 'Solo se pueden devolver pedidos ya pagados' }
  }

  // Lock check: no se puede devolver si la caja de ese día ya está cerrada
  const lockCheck = await assertNotLocked(order.paid_at ?? new Date().toISOString(), clubId)
  if (!lockCheck.ok) return { success: false, error: lockCheck.error }

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

/**
 * Borra un pedido por completo. Si estaba pagado, también borra el movimiento
 * de caja asociado (si la caja de ese día está cerrada → no se puede).
 */
export async function deleteClothingOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: order, error: fetchErr } = await sb
    .from('clothing_orders')
    .select('id, payment_status, paid_at')
    .eq('id', orderId)
    .eq('club_id', clubId)
    .single()

  if (fetchErr || !order) return { success: false, error: fetchErr?.message ?? 'Pedido no encontrado' }

  // Si ya está pagado, la eliminación afecta a caja → aplicar lock check
  if (order.payment_status === 'paid' && order.paid_at) {
    const lockCheck = await assertNotLocked(order.paid_at, clubId)
    if (!lockCheck.ok) return { success: false, error: lockCheck.error }
  }

  // Borrar movimiento(s) de caja asociados
  await sb.from('cash_movements').delete().eq('related_clothing_order_id', orderId)

  // Borrar items (CASCADE debería hacerlo, pero por si acaso)
  await sb.from('clothing_order_items').delete().eq('order_id', orderId)

  const { error } = await sb.from('clothing_orders').delete().eq('id', orderId).eq('club_id', clubId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/ropa')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

/**
 * Edita un pedido (descripción, precio, cantidad, talla, notas).
 * Si está pagado y la caja del día del pago ya se cerró → bloqueado.
 * Si está pagado y el importe cambia → actualiza el cash_movement a la par.
 */
export async function updateClothingOrder(input: {
  orderId: string
  description: string
  size: string
  quantity: number
  price: number
  notes?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: order, error: fetchErr } = await sb
    .from('clothing_orders')
    .select('id, payment_status, paid_at, notes')
    .eq('id', input.orderId)
    .eq('club_id', clubId)
    .single()

  if (fetchErr || !order) return { success: false, error: fetchErr?.message ?? 'Pedido no encontrado' }

  if (order.payment_status === 'paid' && order.paid_at) {
    const lockCheck = await assertNotLocked(order.paid_at, clubId)
    if (!lockCheck.ok) return { success: false, error: lockCheck.error }
  }

  const quantity = Math.max(1, Math.floor(input.quantity || 1))
  const unitPrice = Number.isFinite(input.price) ? Math.max(0, input.price) : 0
  const totalAmount = +(unitPrice * quantity).toFixed(2)

  // Preserve the "Jugador (manual):" prefix if it existed, append user notes
  let mergedNotes: string | null = null
  const manualMatch = (order.notes as string | null)?.match(/^Jugador \(manual\):\s*([^—]+)/)
  const manualPart = manualMatch ? `Jugador (manual): ${manualMatch[1].trim()}` : null
  const parts = [manualPart, input.notes?.trim() || null].filter(Boolean)
  mergedNotes = parts.length > 0 ? parts.join(' — ') : null

  const { error: orderErr } = await sb
    .from('clothing_orders')
    .update({
      description: input.description.trim(),
      total_amount: totalAmount,
      notes: mergedNotes,
    })
    .eq('id', input.orderId)
    .eq('club_id', clubId)

  if (orderErr) return { success: false, error: orderErr.message }

  // Reemplazar items (simpler than trying to diff)
  await sb.from('clothing_order_items').delete().eq('order_id', input.orderId)
  const { error: itemErr } = await sb.from('clothing_order_items').insert({
    order_id: input.orderId,
    item_name: input.description.trim(),
    size: input.size || null,
    quantity,
    unit_price: unitPrice,
  })
  if (itemErr) return { success: false, error: itemErr.message }

  // Si está pagado, sincronizar el cash_movement
  if (order.payment_status === 'paid') {
    await sb
      .from('cash_movements')
      .update({ amount: totalAmount, description: `Ropa - ${input.description.trim()}` })
      .eq('related_clothing_order_id', input.orderId)
      .eq('type', 'income')
  }

  revalidatePath('/ropa')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}
