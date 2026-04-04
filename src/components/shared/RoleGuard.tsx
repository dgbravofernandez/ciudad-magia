'use client'

import type { ReactNode } from 'react'
import type { Role } from '@/types/roles'
import { useCurrentUser } from '@/context/UserContext'
import { hasAnyRole } from '@/types/roles'
import type { Permission } from '@/types/roles'

interface RoleGuardProps {
  children: ReactNode
  roles?: Role[]
  permission?: Permission
  fallback?: ReactNode
}

export function RoleGuard({ children, roles, permission, fallback = null }: RoleGuardProps) {
  const { roles: userRoles, can } = useCurrentUser()

  const allowed =
    (roles ? hasAnyRole(userRoles, roles) : true) &&
    (permission ? can(permission) : true)

  return allowed ? <>{children}</> : <>{fallback}</>
}
