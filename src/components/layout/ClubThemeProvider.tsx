'use client'

import { useEffect } from 'react'
import type { Club } from '@/types/database.types'

export function ClubThemeProvider({ club }: { club: Club }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-primary', club.primary_color)
    root.style.setProperty('--color-secondary', club.secondary_color)

    // Determine foreground based on primary color brightness
    const hex = club.primary_color.replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    root.style.setProperty(
      '--color-primary-foreground',
      luminance > 0.5 ? '#0f172a' : '#ffffff'
    )
  }, [club.primary_color, club.secondary_color])

  return null
}
