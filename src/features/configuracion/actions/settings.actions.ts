'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function saveQuotaSettings(data: {
  clubId: string
  quotaAmounts: { default: number; teams: Record<string, number> }
  deadlineDay: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { error } = await sb
    .from('club_settings')
    .update({
      quota_amounts: data.quotaAmounts,
      quota_deadline_day: data.deadlineDay,
    })
    .eq('club_id', data.clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/configuracion/cuotas')
  revalidatePath('/contabilidad/pagos')
  return { success: true }
}
