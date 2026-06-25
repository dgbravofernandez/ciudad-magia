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

  const wrap = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#ffffff 0%,#EFF6FF 100%)',
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>{children}</div>
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
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{info.clubName}</h1>
        <p style={{ color: '#475569', marginTop: 4 }}>
          Documentación de <strong>{info.name}</strong>
        </p>
      </div>
      <SubirDocsForm
        token={token}
        baseDocs={DOC_CATALOG.base as unknown as { key: string; label: string }[]}
        foreignDocs={DOC_CATALOG.foreign as unknown as { key: string; label: string }[]}
        defaultForeign={info.spanish === false}
        have={info.have ?? {}}
      />
    </>
  )
}
