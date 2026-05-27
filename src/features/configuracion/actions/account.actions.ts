'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/**
 * Cambia la contraseña del PROPIO usuario logueado.
 * Verifica la contraseña actual reautenticando, luego la actualiza.
 * Limpia el flag must_change_password del club_member asociado.
 *
 * IMPORTANTE — por qué no usamos adminAuth.auth.admin.updateUserById:
 *   1. Ese método invalida la sesión activa → el usuario queda deslogueado.
 *   2. Llamar signInWithPassword en un cliente corrompe su estado interno:
 *      tras el signIn, el cliente usa el JWT del usuario en lugar del service
 *      role key → el update a club_members puede fallar silenciosamente por RLS
 *      → el flag never clears → loop infinito.
 *
 * Solución:
 *   - Verificar pwd actual con cliente temporal (solo para autenticar, descartar).
 *   - Actualizar pwd con supabase.auth.updateUser() usando la sesión del usuario
 *     → mantiene la sesión activa y escribe las cookies actualizadas.
 *   - Limpiar flag con un adminClient FRESCO (sin signInWithPassword previo).
 */
export async function changeOwnPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Cliente del usuario actual (sesión via cookies)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) return { success: false, error: 'No autenticado' }

    if (input.newPassword.length < 8) {
      return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' }
    }
    if (input.currentPassword === input.newPassword) {
      return { success: false, error: 'La nueva contraseña debe ser distinta de la actual' }
    }

    // 1. Verificar contraseña actual — cliente temporal, se descarta inmediatamente
    //    No reutilizamos este cliente para nada más (evita corrupción de estado)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifyClient = createAdminClient() as any
    const { error: signInErr } = await verifyClient.auth.signInWithPassword({
      email: user.email,
      password: input.currentPassword,
    })
    if (signInErr) {
      return { success: false, error: 'La contraseña actual no es correcta' }
    }
    // verifyClient se descarta aquí — no lo usamos para nada más

    // 2. Actualizar contraseña usando la sesión del propio usuario.
    //    updateUser() NO invalida la sesión activa (a diferencia de admin.updateUserById).
    //    Escribe el nuevo access_token en las cookies via el setAll handler.
    const { error: updErr } = await supabase.auth.updateUser({ password: input.newPassword })
    if (updErr) return { success: false, error: updErr.message }

    // 3. Limpiar flag con un adminClient FRESCO (service-role key sin signIn previo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminDb = createAdminClient() as any
    const { error: clearErr } = await adminDb
      .from('club_members')
      .update({ must_change_password: false })
      .eq('user_id', user.id)
    if (clearErr) {
      console.error('[changeOwnPassword] error clearing must_change_password:', clearErr.message)
      // No devolvemos error — la pwd ya está cambiada. El admin puede limpiar manualmente.
    }

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
