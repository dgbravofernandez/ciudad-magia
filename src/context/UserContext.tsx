'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ClubMember } from '@/types/database.types'
import type { Role } from '@/types/roles'
import { hasPermission, type Permission } from '@/types/roles'

export type UserContextValue = {
  member: ClubMember
  roles: Role[]
  can: (permission: Permission) => boolean
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({
  children,
  member,
  roles,
}: {
  children: ReactNode
  member: ClubMember
  roles: Role[]
}) {
  const can = (permission: Permission) => hasPermission(roles, permission)

  return (
    <UserContext.Provider value={{ member, roles, can }}>
      {children}
    </UserContext.Provider>
  )
}

export function useCurrentUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useCurrentUser must be used inside UserProvider')
  return ctx
}
