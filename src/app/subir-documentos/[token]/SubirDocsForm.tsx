'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPlayerDocUploadTicket, submitPlayerDocs } from '@/features/jugadores/actions/player-docs.actions'

const MAX_BYTES = 8 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

type Doc = { key: string; label: string }

// Tipos de doc con columna en BD (subibles vía storage). Si la lista CUSTOM
// trae claves desconocidas (custom_*, texto libre), se muestran como aviso
// informativo y se piden de otra manera (entrega presencial / email al club).
const UPLOADABLE_KEYS = new Set(['photo','dni_front','dni_back','birth_cert','nie','passport','residency_cert'])

export function SubirDocsForm({ token, brand, clubName, baseDocs, foreignDocs, foreignNotice, defaultForeign, have, requested }: {
  token: string
  brand: string
  clubName: string
  baseDocs: Doc[]
  foreignDocs: Doc[]
  foreignNotice: string
  defaultForeign: boolean
  have: Record<string, boolean>
  // Lista CUSTOM solicitada por el club desde la ficha. Si llega, sustituye
  // al catálogo base/foreign. Items con key fuera de UPLOADABLE_KEYS van como aviso.
  requested?: Array<{ key: string; label: string }>
}) {
  const supabase = createClient()
  const [foreign, setForeign] = useState(defaultForeign)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prioridad: si el club configuró requested CUSTOM en la ficha, ESA es la
  // lista (filtrada a los uploadables). Si no, fallback al catálogo predefinido.
  // Los items custom (texto libre) se muestran como aviso, no como upload.
  const requestedUploadable = (requested ?? []).filter(r => UPLOADABLE_KEYS.has(r.key))
  const requestedInformative = (requested ?? []).filter(r => !UPLOADABLE_KEYS.has(r.key))
  const usingCustom = (requested?.length ?? 0) > 0
  const docs = usingCustom ? requestedUploadable : (foreign ? foreignDocs : baseDocs)

  function pick(key: string, f: File | null) {
    if (f && f.size > MAX_BYTES) { setError(`"${f.name}" supera los 8 MB`); return }
    setError(null)
    setFiles(prev => ({ ...prev, [key]: f }))
  }

  async function upload(docType: string, file: File): Promise<string | null> {
    const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'bin').toLowerCase()
    const t = await getPlayerDocUploadTicket(token, docType, ext)
    if (!t.success || !t.path || !t.uploadToken) { setError(t.error ?? 'Error preparando la subida'); return null }
    const { error: upErr } = await supabase.storage.from('player-docs').uploadToSignedUrl(t.path, t.uploadToken, file)
    if (upErr) { setError(`No se pudo subir ${file.name}: ${upErr.message}`); return null }
    return t.path
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!consent) { setError('Debes aceptar el tratamiento de datos para continuar.'); return }
    const chosen = docs.filter(d => files[d.key])
    if (chosen.length === 0) { setError('Selecciona al menos un documento.'); return }
    setPending(true)
    try {
      const uploaded: Array<{ docType: string; path: string }> = []
      for (const d of chosen) {
        const path = await upload(d.key, files[d.key]!)
        if (!path) { setPending(false); return }
        uploaded.push({ docType: d.key, path })
      }
      const res = await submitPlayerDocs(token, uploaded, consent)
      if (res.success) setDone(true)
      else setError(res.error ?? 'No se pudieron guardar los documentos')
    } finally {
      setPending(false)
    }
  }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
    padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '1rem',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }

  if (done) {
    return (
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>¡Documentos recibidos!</h2>
        <p style={{ color: '#475569' }}>El club ya los tiene. Gracias.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={card}>
        {/* Toggle "es extranjero": SOLO si el club no ha personalizado la lista */}
        {!usingCustom && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155', marginBottom: '1rem' }}>
              <input type="checkbox" checked={foreign} onChange={e => setForeign(e.target.checked)} />
              El jugador es extranjero (no español)
            </label>

            {foreign && (
              <div style={{
                background: `${brand}11`, border: `1px solid ${brand}33`,
                borderRadius: 10, padding: '0.75rem 0.9rem', fontSize: 13,
                color: '#334155', marginBottom: '1rem', lineHeight: 1.5,
              }}>
                ℹ️ {foreignNotice}
              </div>
            )}
          </>
        )}

        {/* Si hay items custom (texto libre), avisar de que tambien se piden */}
        {usingCustom && requestedInformative.length > 0 && (
          <div style={{
            background: `${brand}11`, border: `1px solid ${brand}33`,
            borderRadius: 10, padding: '0.75rem 0.9rem', fontSize: 13,
            color: '#334155', marginBottom: '1rem', lineHeight: 1.5,
          }}>
            ℹ️ El club también te pide:
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.25rem' }}>
              {requestedInformative.map(r => <li key={r.key}><strong>{r.label}</strong></li>)}
            </ul>
            <p style={{ margin: '0.5rem 0 0', color: '#64748B' }}>
              Estos los entregas en mano o por correo al club. Aquí abajo solo subes los archivos digitales.
            </p>
          </div>
        )}

        <p style={{ fontSize: 13, color: '#64748B', marginTop: 0, marginBottom: '0.75rem' }}>
          JPG, PNG o PDF (máx. 8 MB cada uno). Solo sube los que tengas a mano.
        </p>

        {docs.map(d => (
          <div key={d.key} style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>
              {d.label}
              {have[d.key] && <span style={{ color: '#16a34a', fontWeight: 400, marginLeft: 6 }}>· ya recibido (puedes reemplazar)</span>}
            </label>
            <input type="file" accept={ACCEPT} onChange={e => pick(d.key, e.target.files?.[0] ?? null)} style={{ fontSize: 14 }} />
            {files[d.key] && <span style={{ fontSize: 12, color: '#16a34a', marginLeft: 8 }}>✓ {files[d.key]!.name}</span>}
          </div>
        ))}
      </div>

      {/* RGPD — obligatorio antes de enviar (Art. 6.1.a + Art. 9 RGPD) */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
        padding: '1.25rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '1rem',
        fontSize: 13, color: '#475569', lineHeight: 1.55,
      }}>
        <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#0F172A' }}>
          Protección de datos
        </p>
        <p style={{ margin: '0 0 0.5rem' }}>
          Los documentos que subas se enviarán a <strong>{clubName}</strong>, responsable del
          tratamiento, con la finalidad exclusiva de tramitar la inscripción y la ficha
          federativa del jugador. Base legal: tu consentimiento (Art. 6.1.a RGPD) y, cuando
          aplique, la ejecución de la relación de inscripción (Art. 6.1.b).
        </p>
        <p style={{ margin: '0 0 0.5rem' }}>
          Los datos se conservan mientras dure la relación con el club y los plazos legales
          aplicables. Puedes ejercer tus derechos de acceso, rectificación, supresión,
          oposición, limitación y portabilidad escribiendo al club. Más información en
          nuestra{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: brand, fontWeight: 600 }}>
            política de privacidad
          </a>.
        </p>
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          marginTop: '0.75rem', fontSize: 13, color: '#0F172A', cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            Acepto que <strong>{clubName}</strong> trate estos datos conforme a la información
            anterior. Declaro ser el tutor legal del jugador o disponer de su autorización.
          </span>
        </label>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: '0.75rem' }}>{error}</p>}

      <button type="submit" disabled={pending} style={{
        width: '100%', padding: '0.95rem', borderRadius: 12, border: 'none',
        background: brand, color: '#fff', fontWeight: 800, fontSize: '1rem',
        cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1,
        boxShadow: `0 10px 24px ${brand}44`,
      }}>
        {pending ? 'Subiendo…' : 'Enviar documentación'}
      </button>
    </form>
  )
}
