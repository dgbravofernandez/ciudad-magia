'use client'

import { useState } from 'react'
import { submitRenewal } from '@/features/jugadores/actions/renewal.actions'

export function RenovacionForm({
  token, brand, clubName, playerName, nextSeasonLabel, currentChoice,
}: {
  token: string
  brand: string
  clubName: string
  playerName: string
  nextSeasonLabel?: string
  // Estado actual en BD. null = aún no contestaron. true/false = ya contestaron y
  // pueden cambiar la respuesta — no es "denegado".
  currentChoice: boolean | null
}) {
  const [choice, setChoice] = useState<boolean | null>(currentChoice)
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<null | boolean>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(value: boolean) {
    setError(null)
    if (!consent) { setError('Debes aceptar el tratamiento de datos para continuar.'); return }
    setPending(true)
    const r = await submitRenewal(token, value, consent)
    setPending(false)
    if (r.success) { setDone(value); setChoice(value) }
    else setError(r.error ?? 'No se pudo registrar la respuesta')
  }

  const seasonTxt = nextSeasonLabel ? `temporada ${nextSeasonLabel}` : 'la próxima temporada'

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
    padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '1rem',
  }

  if (done !== null) {
    return (
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{done ? '✅' : '👋'}</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>
          {done ? '¡Respuesta registrada — sigues con nosotros!' : 'Respuesta registrada'}
        </h2>
        <p style={{ color: '#475569' }}>
          {done
            ? `Hemos guardado que ${playerName} continúa la ${seasonTxt}. El club te avisará con los siguientes pasos.`
            : `Lamentamos que ${playerName} no continúe la ${seasonTxt}. Gracias por habernos avisado a tiempo.`}
        </p>
        <button
          type="button"
          onClick={() => setDone(null)}
          style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: brand, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
          ¿Te has equivocado? Cambia la respuesta
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={card}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0F172A', margin: '0 0 0.5rem' }}>
          ¿{playerName} continúa con {clubName} la {seasonTxt}?
        </h2>
        <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
          Marca tu respuesta. Si cambias de opinión, puedes volver a entrar con el mismo enlace
          y modificarla.
        </p>

        {choice !== null && (
          <div style={{
            marginTop: '0.85rem', padding: '0.55rem 0.85rem', borderRadius: 8,
            background: '#F1F5F9', fontSize: 13, color: '#334155',
          }}>
            Respuesta actual: <strong>{choice ? 'Sí, continúa' : 'No continúa'}</strong>
          </div>
        )}
      </div>

      {/* Bloque RGPD obligatorio antes de poder enviar (Art. 6.1.a y Art. 9 RGPD —
          renovación = decisión sobre datos del menor) */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
        padding: '1.25rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '1rem',
        fontSize: 13, color: '#475569', lineHeight: 1.55,
      }}>
        <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#0F172A' }}>
          Protección de datos
        </p>
        <p style={{ margin: '0 0 0.5rem' }}>
          Tu respuesta se registrará en los sistemas de <strong>{clubName}</strong>, responsable
          del tratamiento, para gestionar la renovación de la plaza del jugador. Base legal: tu
          consentimiento (Art. 6.1.a RGPD) y, cuando aplique, la ejecución de la relación con el
          club (Art. 6.1.b).
        </p>
        <p style={{ margin: '0 0 0.5rem' }}>
          Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación
          y portabilidad escribiendo al club. Más información en nuestra{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: brand, fontWeight: 600 }}>
            política de privacidad
          </a>.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: '0.75rem', fontSize: 13, color: '#0F172A', cursor: 'pointer' }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            Acepto que <strong>{clubName}</strong> trate estos datos conforme a la información
            anterior. Declaro ser el tutor legal del jugador o disponer de su autorización.
          </span>
        </label>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: '0.75rem' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <button
          type="button"
          disabled={pending || !consent}
          onClick={() => send(true)}
          style={{
            padding: '1rem', borderRadius: 12, border: 'none',
            background: brand, color: '#fff', fontWeight: 800, fontSize: '1rem',
            cursor: pending || !consent ? 'default' : 'pointer',
            opacity: pending || !consent ? 0.5 : 1,
            boxShadow: `0 10px 24px ${brand}44`,
          }}
        >
          ✅ Sí, continúa
        </button>
        <button
          type="button"
          disabled={pending || !consent}
          onClick={() => send(false)}
          style={{
            padding: '1rem', borderRadius: 12, border: '2px solid #e2e8f0',
            background: '#fff', color: '#334155', fontWeight: 700, fontSize: '1rem',
            cursor: pending || !consent ? 'default' : 'pointer',
            opacity: pending || !consent ? 0.5 : 1,
          }}
        >
          No continuará
        </button>
      </div>

      {!consent && (
        <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: '0.75rem' }}>
          Acepta primero el tratamiento de datos para poder responder.
        </p>
      )}
    </div>
  )
}
