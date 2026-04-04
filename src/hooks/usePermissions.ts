import { useCurrentUser } from '@/context/UserContext'
import type { Permission } from '@/types/roles'
import { hasAnyRole, type Role } from '@/types/roles'

export function usePermissions() {
  const { roles, can } = useCurrentUser()

  return {
    can,
    hasRole: (role: Role) => roles.includes(role),
    hasAnyRole: (required: Role[]) => hasAnyRole(roles, required),
    isAdmin: roles.includes('admin'),
    isDireccion: roles.includes('direccion'),
    isDirectorDeportivo: roles.includes('director_deportivo'),
    isCoordinador: roles.includes('coordinador'),
    isEntrenador: roles.includes('entrenador'),
    isFisio: roles.includes('fisio'),
    isInfancia: roles.includes('infancia'),
    isRedes: roles.includes('redes'),
    isSuperUser: hasAnyRole(roles, ['admin', 'direccion']),
    isSportsStaff: hasAnyRole(roles, ['entrenador', 'coordinador', 'director_deportivo']),
  }
}
