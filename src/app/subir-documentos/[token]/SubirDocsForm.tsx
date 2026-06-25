'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPlayerDocUploadTicket, submitPlayerDocs } from '@/features/jugadores/actions/player-docs.actions'

const MAX_BYTES = 8 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

type Doc = { key: string; label: string }

export function SubirDocsForm({ token, baseDocs, foreignDocs, defaultForeign, have }: {
  token: string
  baseDocs: Doc[]
  foreignDocs: Doc[]
  defaultForeign: boolean
  have: Record<string, boolean>
}) {
  const supabase = createClient()
  const [foreign, setForeign] = useState(defaultForeign)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const docs = foreign ? [...baseDocs, ...foreignDocs] : baseDocs

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
      const res = await submitPlayerDocs(token, uploaded)
      if (res.success) setDone(true)
      else setError(res.error ?? 'No se pudieron guardar los documentos')
    } finally {
      setPending(false)
    }
  }

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '1rem' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }

  if (done) {
    return (
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px' }}>¡Documentos recibidos!</h2>
        <p style={{ color: '#475569' }}>El club ya los tiene. Gracias.</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <div style={card}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155', marginBottom: '1rem' }}>
          <input type="checkbox" checked={foreign} onChange={e => setForeign(e.target.checked)} />
          El jugador es extranjero (no español) — pide documentación adicional
        </label>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 0 }}>JPG, PNG o PDF (máx. 8 MB cada uno). Solo sube los que tengas a mano.</p>
        {docs.map(d => (
          <div key={d.key} style={{ marginBottom: '0.85rem' }}>
            <label style={labelStyle}>
              {d.label} {have[d.key] && <span style={{ color: '#16a34a', fontWeight: 400 }}>· ya recibido (puedes reemplazar)</span>}
            </label>
            <input type="file" accept={ACCEPT} onChange={e => pick(d.key, e.target.files?.[0] ?? null)} style={{ fontSize: 14 }} />
            {files[d.key] && <span style={{ fontSize: 12, color: '#16a34a', marginLeft: 8 }}>✓ {files[d.key]!.name}</span>}
          </div>
        ))}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 14, marginBottom: '0.75rem' }}>{error}</p>}

      <button type="submit" disabled={pending} style={{
        width: '100%', padding: '0.95rem', borderRadius: 12, border: 'none',
        background: '#2563eb', color: '#fff', fontWeight: 800, fontSize: '1rem',
        cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.6 : 1,
      }}>
        {pending ? 'Subiendo…' : 'Enviar documentación'}
      </button>
    </form>
  )
}
