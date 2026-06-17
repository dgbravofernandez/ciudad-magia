'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'cluberly-cookie-consent'

type Consent = 'accepted' | 'rejected' | null

function readConsent(): Consent {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'accepted' || v === 'rejected' ? v : null
  } catch {
    return null
  }
}

function writeConsent(value: 'accepted' | 'rejected') {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
    window.dispatchEvent(new CustomEvent('cluberly-consent-change', { detail: value }))
  } catch {
    /* noop */
  }
}

/**
 * Banner RGPD obligatorio para sitios con cookies de tracking (Meta Pixel,
 * Google Analytics, etc.). Pixel solo se carga si consent === 'accepted'.
 */
export function CookieBanner() {
  const [consent, setConsent] = useState<Consent>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setConsent(readConsent())
  }, [])

  if (!mounted || consent !== null) return null

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 720,
        margin: '0 auto',
        background: '#0F172A',
        color: '#F8FAFC',
        padding: '16px 20px',
        borderRadius: 12,
        boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
        zIndex: 9999,
        fontSize: 14,
        lineHeight: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: '-apple-system,BlinkMacSystemFont,Inter,sans-serif',
      }}
    >
      <p style={{ margin: 0 }}>
        Usamos cookies necesarias para que Cluberly funcione, y cookies de análisis para entender
        cómo se usa nuestra web. Las de análisis se cargan solo si las aceptas. Puedes leer más
        en nuestra{' '}
        <Link href="/privacy" style={{ color: '#F9A8D4', textDecoration: 'underline' }}>
          Política de privacidad
        </Link>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => {
            writeConsent('accepted')
            setConsent('accepted')
          }}
          style={{
            background: '#EC4899',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            flex: '1 1 auto',
          }}
        >
          Aceptar
        </button>
        <button
          onClick={() => {
            writeConsent('rejected')
            setConsent('rejected')
          }}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: '#F8FAFC',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            flex: '1 1 auto',
          }}
        >
          Rechazar
        </button>
      </div>
    </div>
  )
}

/** Hook para componentes que necesitan saber si hay consent. */
export function useCookieConsent(): Consent {
  const [consent, setConsent] = useState<Consent>(null)
  useEffect(() => {
    setConsent(readConsent())
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setConsent(detail === 'accepted' || detail === 'rejected' ? detail : null)
    }
    window.addEventListener('cluberly-consent-change', handler)
    return () => window.removeEventListener('cluberly-consent-change', handler)
  }, [])
  return consent
}
