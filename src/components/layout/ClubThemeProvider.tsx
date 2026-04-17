'use client'

import { useEffect } from 'react'
import type { Club } from '@/types/database.types'

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function ClubThemeProvider({ club }: { club: Club }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--color-primary', club.primary_color)
    root.style.setProperty('--color-secondary', club.secondary_color)

    const rgb = hexToRgb(club.primary_color)
    if (rgb) {
      // Foreground on top of the primary color
      const L = luminance(rgb)
      const primaryFg = L > 0.6 ? '#0f172a' : '#ffffff'
      root.style.setProperty('--color-primary-foreground', primaryFg)

      // Sidebar accent = club primary color so active/hover items match the brand
      root.style.setProperty('--color-sidebar-active', club.primary_color)

      // Use a dark sidebar background when the primary is bright (so text stays
      // legible), and a slightly primary-tinted dark otherwise. Keep it
      // conservative — never go fully light, or the white sidebar text breaks.
      root.style.setProperty('--color-sidebar', '#111111')
      root.style.setProperty('--color-sidebar-foreground', '#d1d5db')
    }
  }, [club.primary_color, club.secondary_color])

  return null
}
