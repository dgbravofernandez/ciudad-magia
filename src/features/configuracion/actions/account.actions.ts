'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Cambia la contraseña del PROPIO usuario logueado.
 * Verifica la contraseña actual reautenticando, luego la actualiza.
 * Limpia el flag must_change_password del club_member asociado.
 */
export async function changeOwnPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) return { success: false, error: 'No autenticado' }

    if (input.newPassword.length < 8) {
      return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' }
    }
    if (input.currentPassword === input.newPassword) {
      return { success: false, error: 'La nueva contraseña debe ser distinta de la actual' }
    }

    // 1. Verificar contraseña actual reautenticando (sin afectar la sesión activa
    //    porque usamos un cliente admin con signInWithPassword separado)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminAuth = createAdminClient() as any
    const { error: signInErr } = await adminAuth.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
    })
    if (signInErr) {
      return { success: false, error: 'La contraseña actual no es correcta' }
    }

    // 2. Actualizar la contraseña del usuario (vía admin para no depender de la sesión)
    const { error: updErr } = await adminAuth.auth.admin.updateUserById(user.id, {
      password: input.newPassword,
    })
    if (updErr) return { success: false, error: updErr.message }

    // 3. Limpiar flag must_change_password en club_members
    await adminAuth
      .from('club_members')
      .update({ must_change_password: false })
      .eq('user_id', user.id)

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** ¿El usuario actual tiene que cambiar la contraseña? (para guards) */
export async function getMustChangePassword(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data } = await sb
      .from('club_members')
      .select('must_change_password')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .single()
    return !!data?.must_change_password
  } catch {
    return false
  }
}
