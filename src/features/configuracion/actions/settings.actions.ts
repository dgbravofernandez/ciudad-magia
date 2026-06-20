'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export async function saveQuotaSettings(data: {
  clubId?: string // ignorado: el club se deriva del contexto (multi-tenant)
  quotaAmounts: Record<string, unknown>
  deadlineDay: number
  siblingDiscountEnabled?: boolean
  siblingDiscountPercent?: number
}) {
  try {
    // SEC: el club SIEMPRE del contexto, nunca del input del cliente.
    const { clubId, roles } = await getClubContext()
    if (!clubId) return { success: false, error: 'Sin club' }
    if (!roles.some((r) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

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
      .eq('club_id', clubId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/configuracion/cuotas')
    revalidatePath('/contabilidad/pagos')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
