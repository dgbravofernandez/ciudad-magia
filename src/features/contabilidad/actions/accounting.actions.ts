'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClubId } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { sendPaymentReceiptEmail as sendReceiptEmail } from '@/lib/email/send-receipt'
import { sendHtmlEmail } from '@/lib/email/send'
import { assertNotLocked } from '@/lib/accounting/lock'
import { logger } from '@/lib/logger'
import { formatCurrency } from '@/lib/utils/currency'
import { applyPaymentToRecords } from '@/lib/contabilidad/apply-payment'


async function resolveClubAndMember() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const headersList = await headers()
  let clubId = headersList.get('x-club-id') ?? ''
  const memberId = headersList.get('x-member-id') ?? ''
  let roles: string[] = []
  try {
    roles = JSON.parse(headersList.get('x-user-roles') ?? '[]') as string[]
  } catch {
    roles = []
  }

  if (!clubId) {
    clubId = (await getClubId()) ?? ''
  }

  // Fallback: si los headers no traen roles (ej. server action directo sin middleware completo),
  // consultamos club_member_roles y el campo legacy club_members.role
  if (roles.length === 0 && memberId) {
    const { data: roleRows } = await sb
      .from('club_member_roles').select('role').eq('member_id', memberId)
    roles = (roleRows ?? []).map((r: { role: string }) => r.role)

    if (roles.length === 0) {
      const { data: memberRow } = await sb
        .from('club_members').select('role').eq('id', memberId).single()
      if (memberRow?.role) roles = [memberRow.role]
    }
  }

  if (!clubId) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await sb
        .from('club_members').select('club_id, role').eq('user_id', user.id).eq('active', true).limit(1).single()
      clubId = member?.club_id ?? ''
      if (roles.length === 0 && member?.role) roles = [member.role]
    }
  }

  // SEC invariante (defensa en profundidad): el memberId debe pertenecer al clubId.
  // Los headers los setea el middleware de forma consistente, pero si un bug futuro
  // los descuadrara, esto evita operar con un member de OTRO club.
  // Excepción: superadmin impersonando usa el marcador sintético sin fila en club_members.
  if (clubId && memberId && memberId !== 'superadmin-impersonating') {
    const { data: belongs } = await sb
      .from('club_members')
      .select('id')
      .eq('id', memberId)
      .eq('club_id', clubId)
      .eq('active', true)
      .maybeSingle()
    if (!belongs) {
      logger.error({ action: 'resolveClubAndMember', clubId, memberId, error: 'member/club mismatch' })
      throw new Error('No autorizado: contexto de club inconsistente')
    }
  }

  return { sb, clubId, memberId, roles }
}

export async function registerPayment(data: {
  playerId: string
  playerName: string
  teamName: string
  tutorEmail: string | null
  amount: number
  method: string
  date: string
  notes: string
  clubId: string
  concept?: string
  month?: number
  season?: string
}) {
  // SEC: usar siempre clubId del contexto de servidor — nunca confiar en data.clubId del cliente
  const { sb, clubId, memberId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  // Buscar TODOS los registros con deuda real del jugador para esta temporada (orden cronológico).
  // Por diferencia (amount_due - amount_paid), NO por status — igual que la UI de pendientes.
  // Detecta registros desalineados (ej. status='paid' con pago incompleto) que antes se saltaban.
  const season = data.season ?? getCurrentSeason()
  const { data: seasonRecs } = await sb
    .from('quota_payments')
    .select('id, amount_due, amount_paid, concept')
    .eq('club_id', clubId)
    .eq('player_id', data.playerId)
    .eq('season', season)
    .neq('status', 'refunded')
    .order('created_at', { ascending: true })

  const pendingRecs = ((seasonRecs ?? []) as { id: string; amount_due: number; amount_paid: number; concept: string }[])
    .filter(r => Number(r.amount_due) - Number(r.amount_paid) > 0)

  // ── Descuento pronto pago ───────────────────────────────────────────────────
  // Si el importe pagado coincide con el total descontado (tolerancia ±1€),
  // reducir amount_due proporcionalmente en los registros pendientes y
  // marcar todo como pagado. Misma lógica que el descuento de hermanos:
  // se descuenta del importe esperado, no se ignora la diferencia.
  // Funciona combinado con descuento hermanos (que ya está en amount_due).
  let effectivePendingRecs = pendingRecs
  let earlyDiscountNote: string | null = null

  try {
    const totalRemaining = pendingRecs.reduce(
      (s, r) => s + Number(r.amount_due) - Number(r.amount_paid), 0,
    )
    if (pendingRecs.length > 0 && totalRemaining > 0) {
      const { data: clubSettings } = await sb
        .from('club_settings').select('quota_amounts').eq('club_id', clubId).single()
      const earlyPct: number = Number(clubSettings?.quota_amounts?.earlyPayDiscount ?? 0)

      if (earlyPct > 0) {
        // Excluir Reserva del descuento — igual que el descuento de hermanos.
        // discountedTotal = Reserva íntegra + cuotas con descuento
        const reservaRemaining = pendingRecs
          .filter(r => /reserva/i.test(r.concept ?? ''))
          .reduce((s, r) => s + Number(r.amount_due) - Number(r.amount_paid), 0)
        const discountableRemaining = totalRemaining - reservaRemaining
        const discountedTotal = Math.round(
          (reservaRemaining + discountableRemaining * (1 - earlyPct / 100)) * 100,
        ) / 100

        if (Math.abs(data.amount - discountedTotal) <= 1.01) {
          // Distribuir el descuento proporcionalmente entre los registros NO-Reserva,
          // preservando el orden original de los registros para applyPaymentToRecords.
          const discountEur = Math.round(discountableRemaining * (earlyPct / 100) * 100) / 100
          earlyDiscountNote = `Descuento pronto pago ${earlyPct}%`
          let applied = 0
          let discountableIdx = 0
          const discountableCount = pendingRecs.filter(r => !/reserva/i.test(r.concept ?? '')).length
          const adjusted: typeof pendingRecs = []

          for (const rec of pendingRecs) {
            if (/reserva/i.test(rec.concept ?? '')) {
              adjusted.push(rec)  // Reserva: sin descuento, sin UPDATE en BD
            } else {
              const remaining = Number(rec.amount_due) - Number(rec.amount_paid)
              const isLast = discountableIdx === discountableCount - 1
              const share = discountableRemaining > 0 ? remaining / discountableRemaining : 0
              const d = isLast
                ? Math.round((discountEur - applied) * 100) / 100
                : Math.round(discountEur * share * 100) / 100
              applied += d
              discountableIdx++
              const newDue = Math.round((Number(rec.amount_due) - d) * 100) / 100
              const { error: adjustErr } = await sb
                .from('quota_payments').update({ amount_due: newDue }).eq('id', rec.id)
              if (adjustErr) throw new Error(adjustErr.message)
              adjusted.push({ ...rec, amount_due: newDue })
            }
          }
          effectivePendingRecs = adjusted
        }
      }
    }
  } catch (e) {
    console.warn('[earlyDiscount] no aplicado:', (e as Error).message)
    effectivePendingRecs = pendingRecs  // revert to original on error
  }

  let paymentId: string | null = null

  if (effectivePendingRecs && effectivePendingRecs.length > 0) {
    // Calcular distribución con lógica pura (testeable) y luego ejecutar en BD
    const applications = applyPaymentToRecords(effectivePendingRecs, data.amount)
    const notesCombined = [earlyDiscountNote, data.notes || null].filter(Boolean).join('. ') || null

    for (const app of applications) {
      const updateData = app.newStatus === 'paid'
        ? {
            amount_paid: app.newAmountPaid,
            payment_date: data.date,
            payment_method: dbMethod,
            status: 'paid' as const,
            notes: notesCombined,
            email_sent: false,
            registered_by: memberId || null,
          }
        : {
            amount_paid: app.newAmountPaid,
            payment_date: data.date,
            payment_method: dbMethod,
            notes: notesCombined,
            registered_by: memberId || null,
          }

      const { error: updateErr } = await sb.from('quota_payments').update(updateData).eq('id', app.id)
      if (updateErr) return { success: false, error: updateErr.message }

      // El primer registro actualizado es el "principal" para el movimiento de caja
      if (!paymentId) paymentId = app.id
    }

    // Si el pago excede la deuda pendiente, registrar el sobrante como pago nuevo.
    // Antes el exceso se perdía: la caja registraba el importe completo pero
    // quota_payments solo lo aplicado → descuadre entre caja y cuotas.
    const totalDue = pendingRecs.reduce(
      (sum, r) => sum + Number(r.amount_due) - Number(r.amount_paid), 0,
    )
    const remainder = parseFloat((data.amount - totalDue).toFixed(2))
    if (remainder > 0) {
      const { error: remainderErr } = await sb.from('quota_payments').insert({
        club_id: clubId,
        player_id: data.playerId,
        season,
        month: data.month ?? new Date(data.date).getMonth() + 1,
        concept: data.concept ?? 'Cuota mensual',
        amount_due: remainder,
        amount_paid: remainder,
        payment_date: data.date,
        payment_method: dbMethod,
        status: 'paid',
        notes: data.notes || null,
        email_sent: false,
        registered_by: memberId || null,
      })
      if (remainderErr) return { success: false, error: remainderErr.message }
    }
  } else {
    // Anti-duplicado: comprobar si ya existe un pago idéntico (mismo jugador + temporada + concepto + importe + fecha)
    // Evita doble registro por doble clic o doble envío del formulario
    const concept = data.concept ?? 'Cuota mensual'
    const { data: existingPaid } = await sb
      .from('quota_payments')
      .select('id')
      .eq('club_id', clubId)
      .eq('player_id', data.playerId)
      .eq('season', season)
      .eq('concept', concept)
      .eq('amount_paid', data.amount)
      .eq('payment_date', data.date)
      .eq('status', 'paid')
      .limit(1)
      .maybeSingle()

    if (existingPaid) {
      return {
        success: false,
        error: `Ya existe un pago de "${concept}" por ${data.amount}€ registrado para ${data.playerName} en esta fecha. Recarga la página para verificar.`,
      }
    }

    // Sin pendiente previo — crear registro nuevo pagado
    const { data: payment, error: paymentError } = await sb.from('quota_payments').insert({
      club_id: clubId,
      player_id: data.playerId,
      season,
      month: data.month ?? new Date(data.date).getMonth() + 1,
      concept,
      amount_due: data.amount,
      amount_paid: data.amount,
      payment_date: data.date,
      payment_method: dbMethod,
      status: 'paid',
      notes: data.notes || null,
      email_sent: false,
      registered_by: memberId || null,
    }).select('id').single()
    if (paymentError) return { success: false, error: paymentError.message }
    paymentId = payment?.id ?? null
  }

  // Create cash_movement record
  const { error: movementError } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'income',
    amount: data.amount,
    payment_method: dbMethod,
    description: `Pago cuota - ${data.playerName}`,
    movement_date: data.date,
    related_payment_id: paymentId,
    source: 'cuota',
    registered_by: memberId || null,
  })

  if (movementError) return { success: false, error: movementError.message }

  // Send PDF receipt email — must await (Vercel kills serverless after response)
  // Use a timeout so the UI doesn't hang forever if email is slow
  let emailSent = false
  if (data.tutorEmail && paymentId) {
    try {
      const emailPromise = sendReceiptEmail({
        paymentId: paymentId!,
        paymentTable: 'quota_payments',
        tutorEmail: data.tutorEmail,
        playerName: data.playerName,
        teamName: data.teamName,
        amount: data.amount,
        method: dbMethod,
        date: data.date,
        concept: data.concept ?? 'Cuota mensual',
        clubId: clubId,
      })
      // 15s timeout — enough for PDF + email, won't hang forever
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 15000)
      )
      await Promise.race([emailPromise, timeout])
      emailSent = true
    } catch (err) {
      console.error('[accounting] PDF/email error:', err)
      logger.error({ action: 'registerPayment', clubId, memberId, error: (err as Error).message, phase: 'email' })
      // Payment already registered — email failure is not fatal
    }
  }

  logger.info({ action: 'registerPayment', clubId, memberId, amount: data.amount, emailSent })
  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true, paymentId: paymentId ?? undefined, emailSent }
}

export async function deletePayment(paymentId: string) {
  const { sb, clubId } = await resolveClubAndMember()

  // Lock check against the payment's date + tenant ownership check
  const { data: existing } = await sb
    .from('quota_payments').select('payment_date, club_id').eq('id', paymentId).single()
  if (!existing) return { success: false, error: 'Pago no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }
  if (existing?.payment_date) {
    const check = await assertNotLocked(existing.payment_date, clubId)
    if (!check.ok) return { success: false, error: check.error }
  }

  // Delete related cash_movement first (FK) — scoped to club as defense-in-depth
  const { error: movementError } = await sb
    .from('cash_movements')
    .delete()
    .eq('related_payment_id', paymentId)
    .eq('club_id', clubId)

  if (movementError) return { success: false, error: movementError.message }

  const { error } = await sb.from('quota_payments').delete().eq('id', paymentId).eq('club_id', clubId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updatePayment(data: {
  paymentId: string
  amount: number
  method: string
  date: string
  notes: string
  season?: string
  concept?: string
  sourceType?: 'cuota' | 'torneo' | 'actividad' | 'otro'
  linkedName?: string  // nombre del torneo/actividad para la descripción
}) {
  const { sb, clubId, roles } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)
  const isAdmin = roles.some(r => ['admin', 'direccion'].includes(r))

  // Tenant ownership + lock check
  const { data: existing } = await sb
    .from('quota_payments')
    .select('payment_date, amount_paid, club_id')
    .eq('id', data.paymentId)
    .single()

  if (!existing) return { success: false, error: 'Pago no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  const isAmountChange = existing && parseFloat(String(existing.amount_paid)) !== data.amount
  const isDateChange   = existing && existing.payment_date?.slice(0, 10) !== data.date?.slice(0, 10)

  // Admin bypass: si no cambia importe ni fecha → skip lock (reclasificación)
  const skipLock = isAdmin && !isAmountChange && !isDateChange

  if (!skipLock) {
    if (existing?.payment_date) {
      const oldCheck = await assertNotLocked(existing.payment_date, clubId)
      if (!oldCheck.ok) return { success: false, error: oldCheck.error }
    }
    if (data.date) {
      const newCheck = await assertNotLocked(data.date, clubId)
      if (!newCheck.ok) return { success: false, error: newCheck.error }
    }
  }

  // Leer el registro actual para preservar amount_due (deuda real del concepto).
  // Editar un pago = corregir lo pagado, NO redefinir lo que se debe.
  const { data: current } = await sb
    .from('quota_payments')
    .select('amount_due, status')
    .eq('id', data.paymentId)
    .single()

  const dueAmount = current ? Number(current.amount_due) : data.amount
  // Si quien edita pone un importe MAYOR que la deuda actual (caso de cambio de
  // concepto o reclasificación de fila), permitir subir el due al nuevo importe;
  // si pone igual o menor, conservar el due original (no destruir deuda restante).
  const newDue = data.amount > dueAmount ? data.amount : dueAmount
  const newStatus = data.amount >= newDue ? 'paid' : 'pending'

  const paymentUpdate: Record<string, unknown> = {
    amount_due: newDue,
    amount_paid: data.amount,
    payment_date: data.date,
    payment_method: dbMethod,
    notes: data.notes || null,
    status: newStatus,
  }
  if (data.season) paymentUpdate.season = data.season
  if (data.concept !== undefined) paymentUpdate.concept = data.concept || null

  const { error: paymentError } = await sb
    .from('quota_payments')
    .update(paymentUpdate)
    .eq('id', data.paymentId)
    .eq('club_id', clubId)

  if (paymentError) return { success: false, error: paymentError.message }

  // Update related cash_movement too
  const movementUpdate: Record<string, unknown> = {
    amount: data.amount,
    payment_method: dbMethod,
    movement_date: data.date,
  }
  if (data.sourceType) {
    movementUpdate.source = data.sourceType
    if (data.linkedName) {
      const { data: paymentRow } = await sb
        .from('quota_payments')
        .select('player_id')
        .eq('id', data.paymentId)
        .single()
      // Fetch player name for description
      const { data: player } = paymentRow?.player_id
        ? await sb.from('players').select('first_name, last_name').eq('id', paymentRow.player_id).single()
        : { data: null }
      const pName = player ? `${player.first_name} ${player.last_name}` : ''
      const sourceLabel = data.sourceType === 'torneo' ? 'Torneo' : data.sourceType === 'actividad' ? 'Actividad' : 'Pago cuota'
      movementUpdate.description = `${sourceLabel} - ${data.linkedName}${pName ? ` - ${pName}` : ''}`
    }
  }

  const { error: movementError } = await sb
    .from('cash_movements')
    .update(movementUpdate)
    .eq('related_payment_id', data.paymentId)

  if (movementError) return { success: false, error: movementError.message }

  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

// ── Gestión de períodos cerrados (solo superadmin) ───────────────────────────

// Falla cerrado si la var no está configurada (nunca otorgar acceso implícito)
function getSuperAdminEmail(): string | null {
  return process.env.SUPER_ADMIN_EMAIL ?? null
}

/**
 * Obtiene el email del usuario autenticado a partir del memberId,
 * usando el admin client (funciona correctamente en Server Actions).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMemberEmail(sb: any, memberId: string): Promise<string | null> {
  if (!memberId) return null
  const { data: member } = await sb
    .from('club_members')
    .select('user_id')
    .eq('id', memberId)
    .single()
  if (!member?.user_id) return null
  const { data: authData } = await sb.auth.admin.getUserById(member.user_id)
  return authData?.user?.email ?? null
}

/**
 * Carga todos los movimientos de un período cerrado para revisión/edición.
 * Restringido al superusuario.
 */
export async function getClosedPeriodMovements(periodStart: string, periodEnd: string) {
  try {
    const { sb, clubId, memberId } = await resolveClubAndMember()
    // Restricción: solo el superusuario
    const memberEmail = await getMemberEmail(sb, memberId)
    const superEmail = getSuperAdminEmail()
    if (!superEmail || memberEmail !== superEmail) return { success: false, error: 'Sin acceso' }

    const { data: movements, error } = await sb
      .from('cash_movements')
      .select('id, type, description, amount, payment_method, movement_date, source, related_payment_id, related_expense_id, related_activity_charge_id')
      .eq('club_id', clubId)
      .gte('movement_date', periodStart)
      .lte('movement_date', periodEnd)
      .order('movement_date', { ascending: false })

    if (error) return { success: false, error: error.message }

    // Enrich with player names and payment concepts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const movs = (movements ?? []) as any[]
    const paymentIds = movs.filter(m => m.related_payment_id).map(m => m.related_payment_id as string)

    const paymentMap: Record<string, { player_name: string; season: string; concept: string }> = {}
    if (paymentIds.length > 0) {
      const { data: qps } = await sb
        .from('quota_payments')
        .select('id, player_id, season, concept')
        .in('id', paymentIds)
      const playerIds = [...new Set((qps ?? []).map((q: { player_id: string }) => q.player_id).filter(Boolean))]
      const { data: players } = playerIds.length > 0
        ? await sb.from('players').select('id, first_name, last_name').in('id', playerIds)
        : { data: [] }
      const pMap: Record<string, string> = {}
      for (const p of (players ?? [])) pMap[p.id] = `${p.first_name} ${p.last_name}`.trim()
      for (const q of (qps ?? [])) {
        paymentMap[q.id] = {
          player_name: pMap[q.player_id] ?? '',
          season: q.season ?? '',
          concept: q.concept ?? '',
        }
      }
    }

    const enriched = movs.map(m => ({
      ...m,
      player_name: m.related_payment_id ? (paymentMap[m.related_payment_id]?.player_name ?? '') : '',
      payment_season: m.related_payment_id ? (paymentMap[m.related_payment_id]?.season ?? '') : '',
      payment_concept: m.related_payment_id ? (paymentMap[m.related_payment_id]?.concept ?? '') : '',
    }))

    return { success: true, movements: enriched }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Reclasifica la fuente/concepto de un movimiento de caja y su quota_payment.
 * Permite cambiar cuota → torneo/actividad en períodos ya cerrados.
 * Solo superusuario.
 */
export async function reclassifyMovement(data: {
  movementId: string
  paymentId?: string | null
  newSource: 'cuota' | 'torneo' | 'actividad' | 'otro'
  newDescription: string
  newConcept?: string
}) {
  try {
    const { sb, memberId } = await resolveClubAndMember()
    // Restricción: solo el superusuario
    const memberEmail = await getMemberEmail(sb, memberId)
    const superEmail = getSuperAdminEmail()
    if (!superEmail || memberEmail !== superEmail) return { success: false, error: 'Sin acceso' }

    // Actualizar cash_movement
    const { error: movErr } = await sb
      .from('cash_movements')
      .update({ source: data.newSource, description: data.newDescription })
      .eq('id', data.movementId)
    if (movErr) return { success: false, error: movErr.message }

    // Si hay quota_payment asociado, actualizar también su concept
    if (data.paymentId && data.newConcept !== undefined) {
      await sb
        .from('quota_payments')
        .update({ concept: data.newConcept })
        .eq('id', data.paymentId)
    }

    revalidatePath('/contabilidad/caja')
    revalidatePath('/contabilidad/pagos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Registra un ingreso externo libre en caja (sin vincular a jugador/cuota/actividad).
 * Útil para: donativos, patrocinios, alquiler de instalaciones, etc.
 */
export async function registerExternalIncome(data: {
  concept: string
  amount: number
  method: 'cash' | 'card' | 'transfer'
  date: string
  notes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, memberId, roles } = await resolveClubAndMember()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    if (!data.concept.trim()) return { success: false, error: 'El concepto es obligatorio' }
    if (!data.amount || data.amount <= 0) return { success: false, error: 'El importe debe ser mayor que 0' }

    const lockCheck = await assertNotLocked(data.date, clubId)
    if (!lockCheck.ok) return { success: false, error: lockCheck.error }

    const dbMethod = toDbMethod(data.method)
    const { error } = await sb.from('cash_movements').insert({
      club_id: clubId,
      type: 'income',
      amount: data.amount,
      payment_method: dbMethod,
      description: data.concept.trim(),
      movement_date: data.date,
      source: 'otro',
      registered_by: memberId ?? null,
    })
    if (error) return { success: false, error: error.message }

    revalidatePath('/contabilidad/caja')
    revalidatePath('/contabilidad/pagos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Registra un gasto externo libre en caja (sin vincular a proveedor ni presupuesto).
 * Útil para: material, arbitrajes, desplazamientos, suministros, etc.
 */
export async function registerQuickExpense(data: {
  concept: string
  amount: number
  method: 'cash' | 'card' | 'transfer'
  date: string
  notes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, memberId, roles } = await resolveClubAndMember()
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    if (!data.concept.trim()) return { success: false, error: 'El concepto es obligatorio' }
    if (!data.amount || data.amount <= 0) return { success: false, error: 'El importe debe ser mayor que 0' }

    const lockCheck = await assertNotLocked(data.date, clubId)
    if (!lockCheck.ok) return { success: false, error: lockCheck.error }

    const dbMethod = toDbMethod(data.method)
    const { error } = await sb.from('cash_movements').insert({
      club_id: clubId,
      type: 'expense',
      amount: data.amount,
      payment_method: dbMethod,
      description: data.concept.trim(),
      movement_date: data.date,
      source: 'gasto',
      registered_by: memberId ?? null,
    })
    if (error) return { success: false, error: error.message }

    revalidatePath('/contabilidad/caja')
    revalidatePath('/contabilidad/gastos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getLinkedItems() {
  const { sb, clubId } = await resolveClubAndMember()

  const [{ data: torneos }, { data: actividades }] = await Promise.all([
    sb
      .from('tournaments')
      .select('id, name')
      .eq('club_id', clubId)
      .in('status', ['upcoming', 'in_progress'])
      .order('name', { ascending: true }),
    sb
      .from('activities')
      .select('id, name')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('name', { ascending: true }),
  ])

  return {
    torneos: (torneos ?? []) as { id: string; name: string }[],
    actividades: (actividades ?? []) as { id: string; name: string }[],
  }
}

/**
 * Reembolso parcial o total de un pago.
 * - amount: importe a devolver (positivo). Si no se pasa, devuelve todo el amount_paid.
 * - method: efectivo / tarjeta / transferencia con el que se devuelve el dinero
 * - reason: motivo del reembolso (queda en notes del pago y descripción del movimiento)
 *
 * Efectos:
 * 1. Crea movimiento negativo de caja con el método elegido
 * 2. Decrementa amount_paid del pago
 * 3. Si amount_paid queda en 0 → status='refunded'; si queda parcial → 'pending'
 */
export async function refundPayment(
  paymentId: string,
  refundMethod: string = 'transfer',
  amount?: number,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  const { sb, clubId, memberId } = await resolveClubAndMember()

  const { data: payment } = await sb
    .from('quota_payments')
    .select('id, amount_paid, amount_due, status, notes')
    .eq('id', paymentId)
    .eq('club_id', clubId)
    .single()

  if (!payment) return { success: false, error: 'Pago no encontrado' }
  if ((payment as { status?: string }).status === 'refunded') {
    return { success: false, error: 'Este pago ya fue reembolsado por completo' }
  }

  const today = new Date().toISOString().slice(0, 10)
  const lockCheck = await assertNotLocked(today, clubId)
  if (!lockCheck.ok) return { success: false, error: lockCheck.error }

  const dbMethod = toDbMethod(refundMethod)
  const currentPaid = Number((payment as { amount_paid: number }).amount_paid)
  const refundAmount = amount && amount > 0 ? Math.min(Number(amount), currentPaid) : currentPaid
  if (refundAmount <= 0) return { success: false, error: 'Importe a reembolsar inválido' }

  const newPaid = parseFloat((currentPaid - refundAmount).toFixed(2))
  const dueAmount = Number((payment as { amount_due: number }).amount_due)
  const newStatus = newPaid <= 0.001
    ? 'refunded'
    : (newPaid >= dueAmount - 0.001 ? 'paid' : 'pending')

  const reasonClean = (reason ?? '').trim()
  const description = reasonClean
    ? `Devolucion: ${reasonClean}`
    : `Reembolso cuota (pago ${paymentId.slice(0, 8)})`

  // 1. Movimiento negativo de caja con el método elegido
  const { error: movErr } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'expense',
    amount: refundAmount,
    payment_method: dbMethod,
    source: 'cuota',
    description,
    movement_date: today,
    related_payment_id: paymentId,
    registered_by: memberId || null,
  })
  if (movErr) return { success: false, error: movErr.message }

  // 2. Actualizar pago
  const label = newStatus === 'refunded'
    ? `REEMBOLSADO el ${today}${reasonClean ? ` (${reasonClean})` : ''}`
    : `Reembolso parcial ${refundAmount.toFixed(2)}€ el ${today}${reasonClean ? ` (${reasonClean})` : ''}`
  const notes = [(payment as { notes?: string }).notes, label].filter(Boolean).join(' · ')
  const { error: updErr } = await sb
    .from('quota_payments')
    .update({ amount_paid: newPaid, status: newStatus, notes })
    .eq('id', paymentId)
  if (updErr) return { success: false, error: updErr.message }

  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updateQuotaPaymentComment(paymentId: string, comment: string) {
  // Anotaciones son de solo información — cualquier miembro del club puede añadirlas
  const { sb, clubId } = await resolveClubAndMember()

  if (!clubId) return { success: false, error: 'Club no identificado' }

  const { error } = await sb
    .from('quota_payments')
    .update({ admin_comment: comment.trim() || null })
    .eq('id', paymentId)
    .eq('club_id', clubId)

  if (error) {
    logger.error({ action: 'updateQuotaPaymentComment', clubId, paymentId, error: error.message })
    return { success: false, error: error.message }
  }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

/**
 * Recordatorio bulk de pagos pendientes — envía email a cada tutor con la
 * deuda total + métodos de pago + aviso de plaza próxima temporada.
 *
 * Excluye automáticamente los jugadores cuyo pago pendiente está marcado
 * como is_special_case=true (familias ya contactadas, casos especiales…).
 *
 * Devuelve detalle granular: sent, skipped, failed.
 */
import { EMAIL_BATCH_CAP, toDbMethod } from '@/lib/contabilidad/constants'
const EMAIL_DELAY_MS = 2000   // 2s entre emails — evita detección de spam por Gmail

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export async function sendPendingReminders(playerIds: string[]) {
 try {
  const { sb, clubId, memberId } = await resolveClubAndMember()

  if (playerIds.length === 0) {
    return { success: false, error: 'No hay jugadores seleccionados' }
  }

  if (playerIds.length > EMAIL_BATCH_CAP) {
    return {
      success: false,
      error: `Máximo ${EMAIL_BATCH_CAP} jugadores por lote (límite de tiempo del servidor). Usa el envío por lotes desde la UI.`,
    }
  }

  // 1. Cargar jugadores + total pendiente + flag caso especial
  // is_special_case está en players (migration 042) — el flag por cuota es legado.
  const { data: players } = await sb
    .from('players')
    .select('id, first_name, last_name, tutor_name, tutor_email, is_special_case')
    .eq('club_id', clubId)
    .in('id', playerIds)

  const specialByPlayer: Record<string, boolean> = {}
  for (const p of (players ?? [])) {
    if (p.is_special_case) specialByPlayer[p.id] = true
  }

  // Pendiente real por diferencia (no por status='pending', alineado con la UI)
  const { data: pendings } = await sb
    .from('quota_payments')
    .select('player_id, amount_due, amount_paid, is_special_case')
    .eq('club_id', clubId)
    .neq('status', 'refunded')
    .in('player_id', playerIds)

  const byPlayer: Record<string, { total: number; specialCase: boolean }> = {}
  for (const p of (pendings ?? [])) {
    const remaining = Number(p.amount_due) - Number(p.amount_paid)
    if (remaining <= 0) continue
    if (!byPlayer[p.player_id]) {
      byPlayer[p.player_id] = { total: 0, specialCase: specialByPlayer[p.player_id] ?? false }
    }
    byPlayer[p.player_id].total += remaining
    // Compatibilidad: si una cuota concreta esta marcada como especial, tambien protege
    if (p.is_special_case) byPlayer[p.player_id].specialCase = true
  }

  // Importe ya pagado por jugador (incluye pagos parciales — sumar amount_paid de TODO)
  // No filtrar por status='paid' o se ignoran los pagos parciales.
  const paidByPlayer: Record<string, number> = {}
  for (const p of (pendings ?? [])) {
    paidByPlayer[p.player_id] = (paidByPlayer[p.player_id] ?? 0) + Number(p.amount_paid)
  }

  // 2. Obtener nombre del club + datos de contacto/banco + plazos de pago
  const { data: clubData } = await sb
    .from('clubs').select('name').eq('id', clubId).single()
  const clubName = clubData?.name ?? 'El Club'

  const { data: settingsData } = await sb
    .from('club_settings')
    .select('contact_email, bank_iban, bank_titular, bank_name, quota_amounts, current_season')
    .eq('club_id', clubId)
    .single()
  const contactEmail = settingsData?.contact_email ?? ''
  // SIN fallback a Getafe: si el club no configura su IBAN, no se muestra (evita cobrar a cuenta ajena)
  const bankIban     = settingsData?.bank_iban     ?? ''
  const bankTitular  = settingsData?.bank_titular  ?? clubName
  const bankName     = settingsData?.bank_name     ?? ''

  // Calcular importe "al día" según plazos vencidos
  const installments: Array<{ amount: number; deadline: string; label: string }> =
    settingsData?.quota_amounts?.installments ?? []
  const currentSeason: string = settingsData?.current_season ?? ''
  // Año de inicio de temporada: "2025/26" o "2025-26" → 2025
  const seasonStartYear = (() => {
    const m = currentSeason.match(/^(\d{4})/)
    return m ? parseInt(m[1]) : new Date().getFullYear()
  })()

  function computeAmountDueNow(totalPending: number, alreadyPaid: number): number {
    if (!installments.length) return totalPending
    const today = new Date()
    let dueByNow = 0
    for (const inst of installments) {
      const [mm, dd] = (inst.deadline ?? '').split('-').map(Number)
      if (!mm || !dd) continue
      const deadlineDate = new Date(seasonStartYear, mm - 1, dd)
      if (deadlineDate <= today) dueByNow += Number(inst.amount)
    }
    // Lo que el jugador debería haber pagado ya, descontando lo que pagó
    const shouldPayNow = Math.max(0, dueByNow - alreadyPaid)
    // No superar el total pendiente real
    return Math.min(totalPending, shouldPayNow > 0 ? shouldPayNow : totalPending)
  }

  let sent = 0
  let skippedSpecial = 0
  let skippedNoEmail = 0
  let skippedNoDebt = 0
  let failed = 0
  const errorList: string[] = []

  // 3. Para cada jugador → enviar email
  const playersList = players ?? []
  for (let i = 0; i < playersList.length; i++) {
    const player = playersList[i]
    const info = byPlayer[player.id]

    if (info?.specialCase) { skippedSpecial++; continue }
    if (!info || info.total <= 0) { skippedNoDebt++; continue }
    if (!player.tutor_email) { skippedNoEmail++; continue }

    const tutorName = (player.tutor_name ?? '').trim() || 'familia'
    const playerName = `${player.first_name} ${player.last_name}`.trim()
    const alreadyPaid = paidByPlayer[player.id] ?? 0
    const amountDueNow = computeAmountDueNow(info.total, alreadyPaid)
    const debtStr = formatCurrency(amountDueNow)

    const html = buildReminderHtml({
      tutorName, playerName, debtStr, clubName,
      contactEmail, bankIban, bankTitular, bankName,
    })

    // Versión plain text para reducir spam score (Gmail penaliza emails solo-HTML)
    const text = [
      `Estimada ${tutorName},`,
      '',
      `Le informamos que ${playerName} tiene cuotas pendientes con ${clubName}.`,
      `Para estar al corriente de pago, el importe a abonar es: ${debtStr}.`,
      '',
      'MÉTODOS DE PAGO:',
      ...(bankIban ? [`  · Transferencia bancaria: ${bankIban} (${bankTitular || clubName})`] : []),
      '  · En las oficinas del club',
      '',
      'Por favor, realice el pago a la mayor brevedad posible.',
      '',
      `Un saludo,`,
      clubName,
    ].join('\n')

    try {
      const sendPromise = sendHtmlEmail({
        to: player.tutor_email,
        subject: `Cuota pendiente — ${playerName}`,
        html,
        text,
        fromName: clubName,
      })
      const timeout = new Promise<void>((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), 20000)
      )
      await Promise.race([sendPromise, timeout])
      sent++

      // Registrar el envío en communications
      await sb.from('communications').insert({
        club_id: clubId,
        sent_by: memberId || null,
        subject: `Cuota pendiente — ${playerName}`,
        body_html: html,
        recipient_type: 'individual',
        recipient_ids: [player.id],
        template_id: null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    } catch (e) {
      failed++
      errorList.push(`${playerName}: ${(e as Error).message}`)
    } finally {
      // Throttle entre TODOS los intentos (éxito o fallo) — evita detección de spam
      // No dormimos tras el último jugador del lote
      if (i < playersList.length - 1) {
        await sleep(EMAIL_DELAY_MS)
      }
    }
  }

  revalidatePath('/contabilidad/pagos')
  return {
    success: failed === 0,
    sent,
    skippedSpecial,
    skippedNoEmail,
    skippedNoDebt,
    failed,
    errors: errorList.slice(0, 5),  // limit
  }
 } catch (e) {
   // Nunca lanzar al cliente: si algo falla tras enviar, devolver error estructurado
   return { success: false, error: (e as Error).message }
 }
}

function buildReminderHtml(opts: {
  tutorName: string; playerName: string; debtStr: string; clubName: string
  contactEmail: string; bankIban: string; bankTitular: string; bankName: string
}) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">

  <!-- Cabecera -->
  <div style="background:#1a1a1a;padding:24px 32px;text-align:center;">
    <p style="color:#ffcc00;font-size:20px;font-weight:bold;margin:0;letter-spacing:1px;">${opts.clubName.toUpperCase()}</p>
    <p style="color:#ffffff;font-size:12px;margin:4px 0 0;letter-spacing:2px;text-transform:uppercase;">Recordatorio de pago de cuotas</p>
  </div>

  <!-- Franja amarilla -->
  <div style="background:#ffcc00;height:4px;"></div>

  <!-- Cuerpo -->
  <div style="padding:32px;">

    <p style="font-size:15px;color:#333;margin:0 0 16px;">Estimado/a <strong>${opts.tutorName}</strong>,</p>

    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 16px;">
      Le escribimos para recordarle que <strong>${opts.playerName}</strong> tiene <strong>cuotas pendientes</strong> de pago correspondientes a la temporada actual.
    </p>

    <!-- Importe para estar al corriente -->
    <div style="background:#fffbe6;border-left:4px solid #ffcc00;border-radius:6px;padding:18px 20px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Importe para estar al corriente</p>
      <p style="margin:0;font-size:26px;font-weight:bold;color:#b76e00;">${opts.debtStr}</p>
      <p style="margin:6px 0 0;font-size:12px;color:#888;">Calculado según los plazos de pago de la temporada vigente.</p>
    </div>

    <!-- Aviso plaza próxima temporada -->
    <div style="background:#fff3e0;border-left:4px solid #e05c00;border-radius:6px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#7a3a00;line-height:1.5;">
        ⚠️ <strong>Importante:</strong> para tener derecho a plaza la próxima temporada es necesario haber abonado todas las cuotas pendientes de la temporada actual.
      </p>
    </div>

    <!-- Formas de pago -->
    <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 14px;font-size:13px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:1px;">Formas de pago</p>

      ${opts.bankIban ? `
      <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#1a1a1a;">🏦 Transferencia bancaria</p>
      <table style="width:100%;font-size:14px;color:#333;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:3px 0;color:#888;width:130px;">Titular</td><td><strong>${opts.bankTitular}</strong></td></tr>
        ${opts.bankName ? `<tr><td style="padding:3px 0;color:#888;">Banco</td><td>${opts.bankName}</td></tr>` : ''}
        <tr><td style="padding:3px 0;color:#888;">IBAN</td><td><strong>${opts.bankIban}</strong></td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:13px;color:#e05c00;background:#fff3e0;padding:8px 12px;border-radius:4px;">
        ⚠️ <strong>Importante:</strong> Indique en el concepto el nombre completo del jugador/a para identificar correctamente el pago.
      </p>` : ''}

      <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#1a1a1a;">🏢 En la oficina del club</p>
      <p style="margin:0;font-size:14px;color:#333;">También puede abonar la deuda en efectivo o con tarjeta directamente en nuestras instalaciones.</p>
    </div>

    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 8px;">
      Si ya ha efectuado el pago o existe alguna circunstancia que debamos conocer, le rogamos que conteste a este correo para revisar el caso.
    </p>
    <p style="margin:0 0 24px;">
      ${opts.contactEmail ? `<a href="mailto:${opts.contactEmail}" style="color:#ffcc00;font-weight:bold;text-decoration:none;font-size:15px;">📧 ${opts.contactEmail}</a>` : ''}
    </p>

    <p style="font-size:15px;color:#333;line-height:1.7;margin:0;">
      Gracias por su atención.
    </p>

  </div>

  <!-- Pie -->
  <div style="background:#1a1a1a;padding:18px 32px;text-align:center;">
    <p style="color:#ffcc00;font-size:13px;font-weight:bold;margin:0 0 4px;">${opts.clubName}</p>
    ${opts.contactEmail ? `<p style="color:#888;font-size:12px;margin:0;">${opts.contactEmail}</p>` : ''}
  </div>

</div>`
}

/**
 * Marcar / desmarcar un pago pendiente como "caso especial" → excluido del
 * recordatorio bulk. Aplica a TODOS los pagos pendientes del jugador
 * (no solo al firstPendingPaymentId), para que el flag funcione aunque
 * la deuda esté repartida en varios meses.
 */
export async function toggleQuotaSpecialCase(playerId: string, value: boolean) {
  try {
    const { sb, clubId } = await resolveClubAndMember()
    const { error } = await sb
      .from('quota_payments')
      .update({ is_special_case: value })
      .eq('club_id', clubId)
      .eq('player_id', playerId)
      .eq('status', 'pending')
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/pagos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addExpense(formData: FormData) {
  const { sb, clubId, memberId } = await resolveClubAndMember()

  const amount = parseFloat(formData.get('amount') as string)
  const date = formData.get('date') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const method = toDbMethod((formData.get('method') as string) ?? 'cash')
  const receiptUrl = (formData.get('receipt_url') as string | null)?.trim() || null

  const { data: expense, error: expenseError } = await sb.from('expenses').insert({
    club_id: clubId,
    category,
    description,
    amount,
    expense_date: date,
    paid_by: memberId || null,
    receipt_url: receiptUrl,
  }).select('id').single()

  if (expenseError) return { success: false, error: expenseError.message }

  const { error: movementError } = await sb.from('cash_movements').insert({
    club_id: clubId,
    type: 'expense',
    amount,
    payment_method: method,
    description,
    movement_date: date,
    related_expense_id: expense?.id ?? null,
    registered_by: memberId || null,
  })

  if (movementError) return { success: false, error: movementError.message }

  revalidatePath('/contabilidad/gastos')
  return { success: true }
}

export async function deleteExpense(expenseId: string) {
  const { sb, clubId } = await resolveClubAndMember()

  const { data: existing } = await sb
    .from('expenses').select('expense_date, club_id').eq('id', expenseId).single()
  if (!existing) return { success: false, error: 'Gasto no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  const check = await assertNotLocked(existing.expense_date, clubId)
  if (!check.ok) return { success: false, error: check.error }

  // Delete linked cash_movement(s)
  const { error: movementErr } = await sb
    .from('cash_movements').delete().eq('related_expense_id', expenseId)
  if (movementErr) return { success: false, error: movementErr.message }

  // If the expense was linked to a tournament_budget_item, un-link it + mark unpaid
  await sb
    .from('tournament_budget_items')
    .update({ is_paid: false, payment_method: null, paid_at: null, related_expense_id: null })
    .eq('related_expense_id', expenseId)

  const { error } = await sb.from('expenses').delete().eq('id', expenseId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/gastos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updateExpense(data: {
  expenseId: string
  amount: number
  date: string
  category: string
  description: string
  method: string
  receipt_url?: string | null
}) {
  const { sb, clubId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  const { data: existing } = await sb
    .from('expenses').select('expense_date, club_id').eq('id', data.expenseId).single()
  if (!existing) return { success: false, error: 'Gasto no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  // Lock check against BOTH old and new date
  const oldCheck = await assertNotLocked(existing.expense_date, clubId)
  if (!oldCheck.ok) return { success: false, error: oldCheck.error }
  if (data.date) {
    const newCheck = await assertNotLocked(data.date, clubId)
    if (!newCheck.ok) return { success: false, error: newCheck.error }
  }

  const expensePatch: Record<string, unknown> = {
    amount: data.amount,
    expense_date: data.date,
    category: data.category,
    description: data.description,
  }
  if (data.receipt_url !== undefined) {
    expensePatch.receipt_url = data.receipt_url?.trim() || null
  }
  const { error: expenseErr } = await sb
    .from('expenses')
    .update(expensePatch)
    .eq('id', data.expenseId)

  if (expenseErr) return { success: false, error: expenseErr.message }

  const { error: movementErr } = await sb
    .from('cash_movements')
    .update({
      amount: data.amount,
      payment_method: dbMethod,
      movement_date: data.date,
      description: data.description,
    })
    .eq('related_expense_id', data.expenseId)

  if (movementErr) return { success: false, error: movementErr.message }

  revalidatePath('/contabilidad/gastos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function closeCash(data: {
  clubId: string
  periodStart: string
  periodEnd: string
  systemCash: number
  realCash: number
  systemCard: number
  realCard: number
  notes: string
  closedBy: string
  cashRegisterFloat: number
  cardByDay?: Array<{ date: string; system: number; real: number }>
}) {
  const { sb } = await resolveClubAndMember()

  // cash_difference and card_difference are GENERATED columns — do NOT insert them
  const { error } = await sb.from('cash_closes').insert({
    club_id: data.clubId,
    period_start: data.periodStart,
    period_end: data.periodEnd,
    system_cash: data.systemCash,
    real_cash: data.realCash,
    system_card: data.systemCard,
    real_card: data.realCard,
    notes: data.notes || null,
    closed_by: data.closedBy || null,
    cash_register_float: data.cashRegisterFloat,
    card_by_day: data.cardByDay ?? [],
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function updateCashRegisterFloat(
  amount: number,
): Promise<{ success: boolean; error?: string }> {
  const { sb, clubId } = await resolveClubAndMember()
  if (amount < 0) return { success: false, error: 'El fondo no puede ser negativo' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from('club_settings')
    .update({ cash_register_float: amount })
    .eq('club_id', clubId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

export async function reopenCashClose(
  closeId: string
): Promise<{ success: boolean; error?: string }> {
  const { sb, clubId, roles } = await resolveClubAndMember()

  // Only admin/direccion can reopen
  if (!roles.some((r) => ['admin', 'direccion'].includes(r))) {
    return { success: false, error: 'Solo admin o dirección pueden reabrir un cierre' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: close } = await (sb as any)
    .from('cash_closes')
    .select('club_id')
    .eq('id', closeId)
    .single()
  if (!close || close.club_id !== clubId) return { success: false, error: 'Cierre no encontrado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from('cash_closes').delete().eq('id', closeId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/caja')
  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/gastos')
  return { success: true }
}

// ── updatePlayerTeam ─────────────────────────────────────────────────────────
// Cambia el equipo de un jugador desde la vista de pendientes.
// isNextSeason=true → actualiza next_team_id; false → team_id.
export async function updatePlayerTeam(
  playerId: string,
  teamId: string | null,
  isNextSeason = false,
) {
  const { sb, clubId } = await resolveClubAndMember()

  const field = isNextSeason ? 'next_team_id' : 'team_id'
  const { error } = await sb
    .from('players')
    .update({ [field]: teamId })
    .eq('id', playerId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

// ── updatePendingPaymentAmount ─────────────────────────────────────────────────
// Corrige el importe pendiente de un quota_payment con status='pending'.
export async function updatePendingPaymentAmount(paymentId: string, amountDue: number) {
  const { sb, clubId } = await resolveClubAndMember()

  const { data: existing } = await sb
    .from('quota_payments')
    .select('status, club_id, amount_paid')
    .eq('id', paymentId)
    .single()

  if (!existing) return { success: false, error: 'Pago no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  // amountDue es el importe PENDIENTE que quiere el usuario → amount_due = ya_pagado + pendiente
  const newAmountDue = (Number(existing.amount_paid) || 0) + amountDue

  const { error } = await sb
    .from('quota_payments')
    .update({ amount_due: newAmountDue })
    .eq('id', paymentId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/contabilidad/pagos')
  return { success: true }
}

// ── updateCashMovement ───────────────────────────────────────────────────────
// Edita un movimiento de caja directamente (no cuota). Actualiza también el
// registro enlazado si existe (quota_payment o expense).
export async function updateCashMovement(data: {
  movementId: string
  amount: number
  method: string
  date: string
  description?: string
}) {
  const { sb, clubId } = await resolveClubAndMember()
  const dbMethod = toDbMethod(data.method)

  const { data: existing } = await sb
    .from('cash_movements')
    .select('movement_date, related_payment_id, related_expense_id, club_id')
    .eq('id', data.movementId)
    .single()

  if (!existing) return { success: false, error: 'Movimiento no encontrado' }
  if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

  const oldCheck = await assertNotLocked(existing.movement_date, clubId)
  if (!oldCheck.ok) return { success: false, error: oldCheck.error }
  if (data.date) {
    const newCheck = await assertNotLocked(data.date, clubId)
    if (!newCheck.ok) return { success: false, error: newCheck.error }
  }

  // Actualizar cash_movement
  const patch: Record<string, unknown> = {
    amount: data.amount,
    payment_method: dbMethod,
    movement_date: data.date,
  }
  if (data.description) patch.description = data.description

  const { error: movErr } = await sb.from('cash_movements').update(patch).eq('id', data.movementId)
  if (movErr) return { success: false, error: movErr.message }

  // Actualizar registro enlazado si existe
  if (existing.related_payment_id) {
    await sb.from('quota_payments').update({
      amount_paid: data.amount,
      amount_due: data.amount,
      payment_date: data.date,
      payment_method: dbMethod,
    }).eq('id', existing.related_payment_id)
  }
  if (existing.related_expense_id) {
    await sb.from('expenses').update({
      amount: data.amount,
      expense_date: data.date,
    }).eq('id', existing.related_expense_id)
  }

  revalidatePath('/contabilidad/pagos')
  revalidatePath('/contabilidad/caja')
  return { success: true }
}

// ── toggleMovementVerified ───────────────────────────────────────────────────
// Marca/desmarca una operación de caja como verificada (cotejada con TPV/banco).
export async function toggleMovementVerified(movementId: string, verified: boolean) {
  try {
    const { sb, clubId, memberId, roles } = await resolveClubAndMember()

    // Solo roles con acceso a contabilidad pueden tocar la conciliación TPV
    if (!roles.some(r => ['admin', 'direccion', 'director_deportivo'].includes(r))) {
      return { success: false, error: 'Sin permisos para verificar operaciones' }
    }

    const { data: existing } = await sb
      .from('cash_movements')
      .select('club_id')
      .eq('id', movementId)
      .single()

    if (!existing) return { success: false, error: 'Movimiento no encontrado' }
    if (existing.club_id !== clubId) return { success: false, error: 'No autorizado' }

    const { error } = await sb
      .from('cash_movements')
      .update({
        verified,
        verified_at: verified ? new Date().toISOString() : null,
        verified_by: verified ? (memberId || null) : null,
      })
      .eq('id', movementId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/contabilidad/caja')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function getCurrentSeason(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month >= 9) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}

// ── getReminderHistory ───────────────────────────────────────────────────────
// Devuelve el historial de avisos de cuota enviados a cada jugador.
// Consulta la tabla communications buscando subject que empiece con "Cuota pendiente".
export async function getReminderHistory(): Promise<
  Record<string, { lastSent: string; count: number; history: string[] }>
> {
  const { sb, clubId } = await resolveClubAndMember()

  const { data } = await sb
    .from('communications')
    .select('recipient_ids, sent_at')
    .eq('club_id', clubId)
    .like('subject', 'Cuota pendiente%')
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(500)

  const result: Record<string, { lastSent: string; count: number; history: string[] }> = {}

  for (const row of (data ?? [])) {
    const ids: string[] = row.recipient_ids ?? []
    for (const playerId of ids) {
      if (!result[playerId]) {
        result[playerId] = { lastSent: row.sent_at, count: 0, history: [] }
      }
      result[playerId].count++
      result[playerId].history.push(row.sent_at)
      if (row.sent_at > result[playerId].lastSent) {
        result[playerId].lastSent = row.sent_at
      }
    }
  }

  return result
}
