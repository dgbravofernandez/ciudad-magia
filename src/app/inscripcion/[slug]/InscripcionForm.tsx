'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getInscriptionUploadTicket, submitInscription, type InscriptionInput } from '@/features/jugadores/actions/inscription.actions'

const MAX_BYTES = 8 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

// Documentos del formulario. nie/passport solo si NO es español.
const BASE_DOCS = [
  { key: 'photo',      label: 'Foto del jugador' },
  { key: 'dni_front',  label: 'DNI/NIE (cara 1)' },
  { key: 'dni_back',   label: 'DNI/NIE (cara 2) / Libro de familia' },
  { key: 'birth_cert', label: 'Certificado de nacimiento' },
] as const
const FOREIGN_DOCS = [
  { key: 'nie',       label: 'NIE' },
  { key: 'passport',  label: 'Pasaporte' },
] as const

export function InscripcionForm({ slug, brand }: { slug: string; brand: string }) {
  const supabase = createClient()
  const [spanish, setSpanish] = useState(true)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [consent, setConsent] = useState(false)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const docList = spanish ? BASE_DOCS : [...BASE_DOCS, ...FOREIGN_DOCS]

  function pickFile(key: string, f: File | null) {
    if (f && f.size > MAX_BYTES) { setError(`"${f.name}" supera los 8 MB`); return }
    setError(null)
    setFiles(prev => ({ ...prev, [key]: f }))
  }

  async function uploadDoc(docType: string, file: File): Promise<string | null> {
    const ext = (file.name.split('.').pop() || file.type.split('/')[1] || 'bin').toLowerCase()
    const ticket = await getInscriptionUploadTicket(slug, docType, ext)
    if (!ticket.success || !ticket.path || !ticket.token) { setError(ticket.error ?? 'Error subiendo documento'); return null }
    const { error: upErr } = await supabase.storage.from('player-docs').uploadToSignedUrl(ticket.path, ticket.token, file)
    if (upErr) { setError(`No se pudo subir ${file.name}: ${upErr.message}`); return null }
    return ticket.path
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!consent) { setError('Debes aceptar el tratamiento de datos para continuar.'); return }
    const fd = new FormData(e.currentTarget)
    setPending(true)
    try {
      // 1. Subir documentos seleccionados (directo a Storage)
      const docs: Array<{ docType: string; path: string }> = []
      for (const d of docList) {
        const file = files[d.key]
        if (!file) continue
        const path = await uploadDoc(d.key, file)
        if (!path) { setPending(false); return }   // error ya mostrado
        docs.push({ docType: d.key, path })
      }

      // 2. Registrar la inscripción
      const input: InscriptionInput = {
        first_name: String(fd.get('first_name') || ''),
        last_name: String(fd.get('last_name') || ''),
        birth_date: String(fd.get('birth_date') || '') || null,
        dni: String(fd.get('dni') || '') || null,
        spanish_nationality: spanish,
        tutor_name: String(fd.get('tutor_name') || '') || null,
        tutor_email: String(fd.get('tutor_email') || '') || null,
        tutor_phone: String(fd.get('tutor_phone') || '') || null,
        categoria: String(fd.get('categoria') || '') || null,
        consent,
        website: String(fd.get('website') || ''),   // honeypot
        docs,
      }
      const res = await submitInscription(slug, input)
      if (res.success) setDone(true)
      else setError(res.error ?? 'No se pudo enviar la inscripción')
    } finally {
      setPending(false)
    }
  }

  const card: React.CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
    padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '1rem',
  }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #cbd5e1',
    borderRadius: 8, fontSize: 15, marginBottom: '0.85rem', boxSizing: 'border-box',
  }

  if (done) {
    return (
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>¡Inscripción recibida!</h2>
        <p style={{ color: '#475569' }}>El club revisará los datos y se pondrá en contacto contigo. Gracias.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      {/* Honeypot anti-bot (oculto) */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

      <div style={card}>
        <h3 style={{ fontWeight: 700, color: '#0F172A', marginTop: 0 }}>Datos del jugador</h3>
        <label style={labelStyle}>Nombre *</label>
        <input name="first_name" required style={inputStyle} />
        <label style={labelStyle}>Apellidos *</label>
        <input name="last_name" required style={inputStyle} />
        <label style={labelStyle}>Fecha de nacimiento</label>
        <input name="birth_date" type="date" style={inputStyle} />
        <label style={labelStyle}>DNI / NIE</label>
        <input name="dni" style={inputStyle} />
        <label style={labelStyle}>Categoría o año solicitado</label>
        <input name="categoria" placeholder="Ej: Alevín, Benjamín, 2015…" style={inputStyle} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
          <input type="checkbox" checked={spanish} onChange={e => setSpanish(e.target.checked)} />
          Nacionalidad española
        </label>
      </div>

      <div style={card}>
        <h3 style={{ fontWeight: 700, color: '#0F172A', marginTop: 0 }}>Datos del tutor / responsable</h3>
        <label style={labelStyle}>Nombre del tutor</label>
        <input name="tutor_name" style={inputStyle} />
        <label style={labelStyle}>Email del tutor</label>
        <input name="tutor_email" type="email" style={inputStyle} />
        <label style={labelStyle}>Teléfono del tutor</label>
        <input name="tutor_phone" type="tel" style={inputStyle} />
      </div>

      <div style={card}>
        <h3 style={{ fontWeight: 700, color: '#0F172A', marginTop: 0 }}>Documentación</h3>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 0 }}>Opcional. JPG, PNG o PDF (máx. 8 MB cada uno).</p>
        {docList.map(d => (
          <div key={d.key} style={{ marginBottom: '0.85rem' }}>
            <label style={labelStyle}>{d.label}</label>
            <input type="file" accept={ACCEPT} onChange={e => pickFile(d.key, e.target.files?.[0] ?? null)}
              style={{ fontSize: 14 }} />
            {files[d.key] && <span style={{ fontSize: 12, color: '#16a34a', marginLeft: 8 }}>✓ {files[d.key]!.name}</span>}
          </div>
        ))}
      </div>

      <div style={card}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#334155' }}>
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
          <span>Acepto que el club trate estos datos para gestionar la inscripción, conforme a su{' '}
            <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: brand, fontWeight: 600 }}>política de privacidad</a>.
            Declaro ser el tutor legal o tener su autorización.</span>
        </label>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: '0.75rem' }}>{error}</p>}

      <button type="submit" disabled={pending}
        style={{
          width: '100%', padding: '0.95rem', borderRadius: 12, border: 'none',
          background: brand, color: '#fff', fontWeight: 800, fontSize: '1rem',
          cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1,
        }}>
        {pending ? 'Enviando…' : 'Enviar inscripción'}
      </button>
    </form>
  )
}
