'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function saveQuotaSettings(data: {
  clubId: string
  quotaAmounts: Record<string, unknown>
  deadlineDay: number
  siblingDiscountEnabled?: boolean
  siblingDiscountPercent?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const patch: Record<string, unknown> = {
    quota_amounts: data.quotaAmounts,
    quota_deadline_day: data.deadlineDay,
  }
  if (data.siblingDiscountEnabled !== undefined) patch.sibling_discount_enabled = data.siblingDiscountEnabled
  if (data.siblingDiscountPercent !== undefined) patch.sibling_discount_percent = data.siblingDiscountPercent

  const { error } = await sb
    .from('club_settings')
    .update(patch)
    .eq('club_id', data.clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/configuracion/cuotas')
  revalidatePath('/contabilidad/pagos')
  return { success: true }
}
