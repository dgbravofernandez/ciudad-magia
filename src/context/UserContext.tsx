'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ClubMember } from '@/types/database.types'
import type { Role } from '@/types/roles'
import { hasPermission, type Permission } from '@/types/roles'

export type UserContextValue = {
  member: ClubMember
  roles: Role[]
  isSuperAdmin: boolean
  can: (permission: Permission) => boolean
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({
  children,
  member,
  roles,
  isSuperAdmin = false,
}: {
  children: ReactNode
  member: ClubMember
  roles: Role[]
  isSuperAdmin?: boolean
}) {
  const can = (permission: Permission) => hasPermission(roles, permission)

  return (
    <UserContext.Provider value={{ member, roles, isSuperAdmin, can }}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useCurrentUser must be used inside UserProvider')
  return ctx
}
