'use server'

/**
 * Server action segura para fijar el club preferido del usuario.
 *
 * SEC: NEW-1 — antes la cookie `preferred_club_id` se seteaba desde el cliente
 * con document.cookie sin firma. Esto permitía a un atacante con XSS sobreescribir
 * la cookie con un club_id de otra víctima → la app cargaba sus datos hasta que
 * el usuario notara el cambio.
 *
 * Ahora:
 *  - La cookie se firma con HMAC del par "clubId:userId" usando APP_SECRET
 *  - Se setea httpOnly desde servidor (no accesible vía JS, no manipulable por XSS)
 *  - El middleware verifica firma + userId antes de confiar en el clubId
 *  - Si la firma no valida o userId no coincide, se ignora la cookie y se redirige al selector
 *
 * Patrón replicado de `superadmin_impersonate` (middleware.ts:116-132).
 */

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signValue } from '@/lib/utils/hmac'

export async function setPreferredClub(clubId: string): Promise<{ success: boolean; error?: string }> {
  // Validación básica
  if (!clubId || typeof clubId !== 'string' || clubId.length < 8) {
    return { success: false, error: 'clubId inválido' }
  }

  // Sesión verificada (network call a Supabase)
  const sb = await createClient()
  const { data: { user }, error: authErr } = await sb.auth.getUser()
  if (authErr || !user) {
    return { success: false, error: 'Sin sesión' }
  }

  // Verificar que el usuario pertenece al club como member activo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data: member } = await adm
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .eq('active', true)
    .maybeSingle()

  if (!member) {
    return { success: false, error: 'No perteneces a ese club' }
  }

  // Firmar payload "clubId:userId" → previene reutilización entre usuarios
  const secret = process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'
  const signed = await signValue(`${clubId}:${user.id}`, secret)

  // Cookie httpOnly desde servidor — no manipulable por JS del cliente
  const cookieStore = await cookies()
  cookieStore.set('preferred_club_id', signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })

  return { success: true }
}
