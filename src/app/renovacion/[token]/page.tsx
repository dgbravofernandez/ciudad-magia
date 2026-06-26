import type { Metadata } from 'next'
import { getPlayerRenewalInfo } from '@/features/jugadores/actions/renewal.actions'
import { RenovacionForm } from './RenovacionForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Renovación de plaza',
  robots: { index: false },
}

export default async function RenovacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const info = await getPlayerRenewalInfo(token)
  const brand = info.brand || '#2563eb'

  const wrap = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      // Fondo corporativo del club (mismo patrón que /inscripcion, /subir-documentos).
      background: `linear-gradient(160deg,#ffffff 0%, ${brand}11 100%)`,
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>{children}</div>
    </div>
  )

  if (!info.ok) {
    return wrap(
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '2rem', textAlign: 'center', color: '#475569' }}>
        <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F172A' }}>Enlace no válido</p>
        <p style={{ marginTop: 8 }}>{info.error ?? 'No se pudo abrir este enlace. Pide al club uno nuevo.'}</p>
      </div>
    )
  }

  return wrap(
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {info.clubLogo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={info.clubLogo} alt={info.clubName} style={{ height: 64, margin: '0 auto 0.75rem', objectFit: 'contain' }} />
          : null}
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{info.clubName}</h1>
        <p style={{ color: '#475569', marginTop: 4 }}>Renovación de plaza</p>
      </div>
      <RenovacionForm
        token={token}
        brand={brand}
        clubName={info.clubName ?? 'el club'}
        playerName={info.playerName ?? 'el/la jugador/a'}
        nextSeasonLabel={info.nextSeasonLabel}
        currentChoice={info.currentChoice ?? null}
      />
    </>
  )
}
