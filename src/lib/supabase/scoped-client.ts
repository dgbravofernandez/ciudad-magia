/**
 * getScopedClient — helper para server actions multi-tenant
 *
 * Centraliza el patrón:
 *   const sb = createAdminClient() as any
 *   const { clubId, memberId, roles } = await getClubContext()
 *
 * En un único import, reduciendo el riesgo de olvidar filtrar por club_id.
 *
 * Uso:
 *   const { sb, clubId, memberId, roles } = await getScopedClient()
 *   const { data } = await sb.from('players').select('*').eq('club_id', clubId)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'

export async function getScopedClient() {
  const [context] = await Promise.all([getClubContext()])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  return {
    sb,
    clubId: context.clubId,
    memberId: context.memberId,
    roles: context.roles,
  }
}

/**
 * assertRole — lanza si el usuario no tiene ninguno de los roles indicados.
 * Para usar justo después de getScopedClient().
 *
 * Uso:
 *   const { sb, clubId, roles } = await getScopedClient()
 *   assertRole(roles, ['admin', 'direccion'])
 */
export function assertRole(
  roles: string[],
  required: string[],
  message = 'Sin permisos'
): void | never {
  if (!roles.some(r => required.includes(r))) {
    throw new Error(message)
  }
}
