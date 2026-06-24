import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { InscripcionForm } from './InscripcionForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: club } = await sb.from('clubs').select('name').eq('slug', slug).maybeSingle()
  return {
    title: club ? `Inscripción — ${club.name}` : 'Inscripción',
    description: 'Formulario de inscripción del club. Rellena los datos del jugador y su tutor.',
    robots: { index: false },   // formularios privados de cada club no se indexan
  }
}

export default async function InscripcionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: club } = await sb
    .from('clubs').select('id, name, logo_url, primary_color').eq('slug', slug).maybeSingle()
  if (!club) notFound()

  const { data: settings } = await sb
    .from('club_settings').select('inscription_open').eq('club_id', club.id).maybeSingle()
  const open = !!settings?.inscription_open
  const brand: string = club.primary_color || '#2563eb'

  return (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      background: `linear-gradient(160deg,#ffffff 0%, ${brand}11 100%)`,
      fontFamily: 'system-ui,-apple-system,sans-serif',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {club.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={club.logo_url} alt={club.name} style={{ height: 64, margin: '0 auto 0.75rem', objectFit: 'contain' }} />
            : null}
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{club.name}</h1>
          <p style={{ color: '#475569', marginTop: 4 }}>Formulario de inscripción</p>
        </div>

        {open ? (
          <InscripcionForm slug={slug} brand={brand} />
        ) : (
          <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
            padding: '2rem', textAlign: 'center', color: '#475569',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
          }}>
            <p style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0F172A' }}>Las inscripciones están cerradas</p>
            <p style={{ marginTop: 8 }}>En este momento el club no admite nuevas inscripciones. Contacta con la secretaría para más información.</p>
          </div>
        )}
      </div>
    </div>
  )
}
