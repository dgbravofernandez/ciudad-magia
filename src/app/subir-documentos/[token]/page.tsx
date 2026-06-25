import type { Metadata } from 'next'
import { getPlayerDocInfo } from '@/features/jugadores/actions/player-docs.actions'
import { DOC_CATALOG } from '@/features/jugadores/doc-catalog'
import { SubirDocsForm } from './SubirDocsForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Subir documentación',
  robots: { index: false },
}

export default async function SubirDocumentosPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const info = await getPlayerDocInfo(token)
  const brand = info.brand || '#2563eb'

  const wrap = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      // Fondo corporativo del club (mismo patrón que /inscripcion)
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
        <p style={{ color: '#475569', marginTop: 4 }}>
          Documentación de <strong>{info.name}</strong>
        </p>
      </div>
      <SubirDocsForm
        token={token}
        brand={brand}
        clubName={info.clubName ?? 'el club'}
        baseDocs={DOC_CATALOG.base as unknown as { key: string; label: string }[]}
        foreignDocs={DOC_CATALOG.foreign as unknown as { key: string; label: string }[]}
        foreignNotice={DOC_CATALOG.foreignNotice}
        defaultForeign={info.spanish === false}
        have={info.have ?? {}}
        requested={info.requested}
      />
    </>
  )
}
