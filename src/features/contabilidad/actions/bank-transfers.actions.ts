'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'
import { parseBankPdf, matchConceptToPlayer, type PlayerCandidate } from '@/lib/accounting/parse-bank-pdf'

const AUTO_MATCH_THRESHOLD = 0.7

// ── Upload + parse ────────────────────────────────────────────

export async function uploadBankTransfersPdf(formData: FormData): Promise<{
  success: boolean
  error?: string
  uploadId?: string
  parsed?: number
  autoMatched?: number
}> {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'Falta el archivo PDF' }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'El archivo debe ser PDF' }
    }
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'PDF demasiado grande (>10 MB)' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const transfers = await parseBankPdf(buffer)
    if (transfers.length === 0) {
      return { success: false, error: 'No se detectaron transferencias en el PDF' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Carga jugadores activos del club para hacer fuzzy match
    const { data: players } = await sb
      .from('players')
      .select('id, first_name, last_name, tutor_name')
      .eq('club_id', clubId)
      .neq('status', 'low')
    const candidates = (players ?? []) as PlayerCandidate[]

    // Crea el upload header
    const totalAmount = transfers.reduce((sum, t) => sum + t.amount, 0)
    const { data: upload, error: upErr } = await sb
      .from('bank_transfer_uploads')
      .insert({
        club_id: clubId,
        uploaded_by: memberId ?? null,
        filename: file.name,
        total_rows: transfers.length,
        total_amount: totalAmount,
      })
      .select('id')
      .single()
    if (upErr) return { success: false, error: upErr.message }
    const uploadId = (upload as { id: string }).id

    // Inserta filas con auto-match
    const rows = transfers.map(t => {
      const m = matchConceptToPlayer(t.concept, t.payer, candidates)
      return {
        club_id: clubId,
        upload_id: uploadId,
        transfer_date: t.date,
        amount: t.amount,
        concept: t.concept,
        payer: t.payer ?? null,
        matched_player_id: m.confidence >= AUTO_MATCH_THRESHOLD ? m.playerId : null,
        match_confidence: m.confidence,
        status: 'pending',
      }
    })

    const { error: insErr } = await sb.from('bank_transfers').insert(rows)
    if (insErr) return { success: false, error: insErr.message }

    const autoMatched = rows.filter(r => r.matched_player_id).length

    revalidatePath('/contabilidad/transferencias')
    return { success: true, uploadId, parsed: transfers.length, autoMatched }
  } catch (e) {
    console.error('uploadBankTransfersPdf', e)
    return { success: false, error: (e as Error).message }
  }
}

// ── Asignar a jugador (y opcionalmente crear quota_payment) ───

export async function assignBankTransfer(input: {
  transferId: string
  playerId: string
  createPayment?: boolean
  paymentMonth?: string   // 'YYYY-MM' opcional
  paymentNotes?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    const { data: transfer, error: tErr } = await sb
      .from('bank_transfers')
      .select('*')
      .eq('id', input.transferId)
      .eq('club_id', clubId)
      .single()
    if (tErr || !transfer) return { success: false, error: tErr?.message ?? 'No encontrado' }

    let paymentId: string | null = null
    if (input.createPayment) {
      // Derive season + month integer from optional 'YYYY-MM'
      const [yearStr, monthStr] = (input.paymentMonth ?? transfer.transfer_date.slice(0, 7)).split('-')
      const year = parseInt(yearStr, 10)
      const monthInt = parseInt(monthStr, 10)
      // Season heuristic: months 7-12 -> YYYY/YYYY+1, months 1-6 -> YYYY-1/YYYY
      const season = monthInt >= 7
        ? `${year}/${(year + 1).toString().slice(-2)}`
        : `${year - 1}/${year.toString().slice(-2)}`

      const { data: pay, error: pErr } = await sb
        .from('quota_payments')
        .insert({
          club_id: clubId,
          player_id: input.playerId,
          season,
          month: Number.isFinite(monthInt) && monthInt >= 1 && monthInt <= 12 ? monthInt : null,
          concept: `Transferencia bancaria ${transfer.transfer_date}`,
          amount_due: transfer.amount,
          amount_paid: transfer.amount,
          payment_method: 'transfer',
          payment_date: transfer.transfer_date,
          status: 'paid',
          notes: (input.paymentNotes ?? `Transferencia: ${transfer.concept}`).slice(0, 500),
        })
        .select('id')
        .single()
      if (pErr) return { success: false, error: pErr.message }
      paymentId = (pay as { id: string }).id
    }

    const { error: uErr } = await sb
      .from('bank_transfers')
      .update({
        matched_player_id: input.playerId,
        matched_payment_id: paymentId,
        status: 'assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.transferId)
      .eq('club_id', clubId)
    if (uErr) return { success: false, error: uErr.message }

    revalidatePath('/contabilidad/transferencias')
    revalidatePath('/contabilidad/pagos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Ignorar transferencia ──────────────────────────────────────

export async function ignoreBankTransfer(transferId: string, notes?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('bank_transfers')
      .update({ status: 'ignored', notes: notes ?? null, updated_at: new Date().toISOString() })
      .eq('id', transferId)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/transferencias')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Reset (volver a pending) ──────────────────────────────────

export async function resetBankTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('bank_transfers')
      .update({
        status: 'pending',
        matched_payment_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/transferencias')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ── Borrar todo un upload ─────────────────────────────────────

export async function deleteBankTransferUpload(uploadId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb
      .from('bank_transfer_uploads')
      .delete()
      .eq('id', uploadId)
      .eq('club_id', clubId)
    if (error) return { success: false, error: error.message }
    revalidatePath('/contabilidad/transferencias')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
