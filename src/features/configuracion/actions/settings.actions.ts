'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
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
    const { sb, clubId, roles } = await getScopedClient()
    if (!clubId) return { success: false, error: 'Sin club' }
    if (!roles.some((r) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

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
