import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Devuelve `true` si la fecha dada cae dentro de un cierre de caja ya realizado.
 * Una vez la caja se cierra, los movimientos de ese periodo quedan inmutables.
 */
export async function isPeriodLocked(dateIso: string, clubId: string): Promise<boolean> {
  if (!dateIso || !clubId) return false
  // Extract YYYY-MM-DD to match DATE columns
  const d = dateIso.slice(0, 10)
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data } = await sb
    .from('cash_closes')
    .select('id')
    .eq('club_id', clubId)
    .lte('period_start', d)
    .gte('period_end', d)
    .limit(1)
    .maybeSingle()

  return !!data
}

/**
 * Lanza un error amistoso si el periodo está bloqueado.
 * Las actions lo capturan y devuelven `{ success: false, error }`.
 */
export async function assertNotLocked(dateIso: string, clubId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const locked = await isPeriodLocked(dateIso, clubId)
  if (locked) {
    return {
      ok: false,
      error: 'La caja de ese periodo ya está cerrada. No se puede modificar.',
    }
  }
  return { ok: true }
}
