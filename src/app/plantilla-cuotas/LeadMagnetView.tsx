'use client'

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Check, FileSpreadsheet, Download } from 'lucide-react'
import { captureLeadMagnet } from './actions'
import { CluberlyMark } from '@/components/brand/CluberlyMark'

export function LeadMagnetView() {
  const params = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [clubName, setClubName] = useState('')
  const [done, setDone] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return toast.error('Pon tu email')
    startTransition(async () => {
      const res = await captureLeadMagnet({
        email,
        clubName,
        utmSource: params.get('utm_source'),
        utmCampaign: params.get('utm_campaign'),
      })
      if (res.success) setDone(true)
      else toast.error(res.error ?? 'Error')
    })
  }

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
        background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
      }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '2.5rem', maxWidth: 500, textAlign: 'center', boxShadow: '0 10px 40px rgba(236,72,153,0.15)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#EC4899,#BE185D)', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={32} color="#fff" />
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.75rem', color: '#0F172A' }}>¡Listo!</h1>
          <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.6 }}>
            Te he enviado el link de descarga a <strong style={{ color: '#0F172A' }}>{email}</strong>.
          </p>
          <a href="/downloads/plantilla-inscripciones-2026-2027.xlsx"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: '1.5rem', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg,#EC4899,#BE185D)', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none' }}>
            <Download size={16} /> Descargar ahora
          </a>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginTop: '2rem' }}>
            Si Excel se te queda corto, prueba <Link href="/" style={{ color: '#BE185D' }}>Cluberly</Link> 14 días sin tarjeta.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', marginBottom: '2rem' }}>
          <CluberlyMark size={36} />
          <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0F172A' }}>cluberly</span>
        </Link>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
          {/* Left: pitch */}
          <div>
            <div style={{ display: 'inline-block', padding: '0.35rem 0.875rem', background: '#FDF2F8', color: '#BE185D', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>
              GRATIS · Sin compromiso
            </div>
            <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: '1rem' }}>
              Plantilla Excel <span style={{ background: 'linear-gradient(90deg,#EC4899,#BE185D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>inscripciones 26/27</span>
            </h1>
            <p style={{ color: '#475569', fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Hoja preparada con categorías, cuotas y plan de cobros mensual.
              Para que arranques la temporada sin perder tiempo.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.95rem', color: '#1F2937' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Check size={16} color="#EC4899" /> 3 pestañas: inscripciones, cuotas, plan de cobros
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Check size={16} color="#EC4899" /> Descuento hermanos preconfigurado
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Check size={16} color="#EC4899" /> Plan mensual con previsión de caja
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Check size={16} color="#EC4899" /> Lista para personalizar a tu club
              </li>
            </ul>
          </div>

          {/* Right: form */}
          <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', boxShadow: '0 8px 40px rgba(236,72,153,0.12)', border: '1px solid #FBCFE8' }}>
            <FileSpreadsheet size={40} color="#EC4899" style={{ marginBottom: '0.75rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>Descarga la plantilla</h2>
            <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Te la enviamos por email. Sin spam.
            </p>
            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Email *</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>
              <label style={{ display: 'block', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Nombre del club <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span></span>
                <input type="text" value={clubName} onChange={(e) => setClubName(e.target.value)}
                  placeholder="C.D. Ejemplo"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>
              <button type="submit" disabled={isPending} style={{
                width: '100%', padding: '0.95rem', borderRadius: 10, border: 'none',
                background: isPending ? '#CBD5E1' : 'linear-gradient(135deg,#EC4899,#BE185D)',
                color: '#fff', fontWeight: 800, fontSize: '1rem',
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}>
                {isPending ? 'Enviando…' : 'Descargar plantilla →'}
              </button>
            </form>
            <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '1rem', textAlign: 'center' }}>
              Al descargar aceptas recibir 1-2 emails sobre Cluberly. Te das de baja con un clic.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
