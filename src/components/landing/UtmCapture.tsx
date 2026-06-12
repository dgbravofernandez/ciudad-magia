'use client'

import { useEffect } from 'react'

/**
 * Captura los parámetros UTM de la URL y los guarda en una cookie (30 días)
 * para que el onboarding pueda atribuir el registro a la campaña aunque el
 * usuario navegue por la landing antes de registrarse.
 * Last-touch: una visita con UTM nuevos sobreescribe los anteriores.
 */
export function UtmCapture() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const source = params.get('utm_source')
      const campaign = params.get('utm_campaign')
      const content = params.get('utm_content')
      if (!source && !campaign && !content) return

      const value = encodeURIComponent(JSON.stringify({
        source: source?.slice(0, 100) ?? null,
        campaign: campaign?.slice(0, 100) ?? null,
        content: content?.slice(0, 100) ?? null,
      }))
      document.cookie = `cluberly_utm=${value}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    } catch {
      // nunca romper la landing por el tracking
    }
  }, [])

  return null
}
