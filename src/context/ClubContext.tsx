'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Club, ClubSettings } from '@/types/database.types'

export type ClubContextValue = {
  club: Club
  settings: ClubSettings | null
}

const ClubContext = createContext<ClubContextValue | null>(null)

export function ClubProvider({
  children,
  value,
}: {
  children: ReactNode
  value: ClubContextValue
}) {
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>
}

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext)
  if (!ctx) throw new Error('useClub must be used inside ClubProvider')
  return ctx
}
