import Link from 'next/link'
import type { Metadata } from 'next'
import { CluberlyMark } from '@/components/brand/CluberlyMark'

export const metadata: Metadata = {
  title: 'Demo Cluberly — 60 segundos',
  description: 'Mira cómo Cluberly automatiza la gestión de tu club en menos de un minuto.',
  openGraph: {
    title: 'Demo Cluberly — 60 segundos',
    description: 'Mira cómo Cluberly automatiza la gestión de tu club.',
    images: ['/downloads/cluberly-demo-thumbnail.png'],
  },
}

export default function DemoPage() {
  return (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
      fontFamily: 'system-ui',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', marginBottom: '2rem' }}>
          <CluberlyMark size={36} />
          <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0F172A' }}>cluberly</span>
        </Link>

        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          fontWeight: 900,
          color: '#0F172A',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: '0.75rem',
          textAlign: 'center',
        }}>
          Cluberly en <span style={{ background: 'linear-gradient(90deg,#EC4899,#BE185D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>60 segundos</span>
        </h1>
        <p style={{ textAlign: 'center', color: '#475569', fontSize: '1.1rem', marginBottom: '2.5rem', maxWidth: 600, margin: '0 auto 2.5rem' }}>
          Cuotas, asistencia, avisos de deuda y cierre de caja. Todo en un sitio.
        </p>

        <div style={{
          borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(236,72,153,0.2), 0 0 0 1px #FBCFE8',
          background: '#000',
        }}>
          <video
            controls
            autoPlay
            playsInline
            poster="/downloads/cluberly-demo-thumbnail.png"
            style={{ width: '100%', display: 'block' }}
          >
            <source src="/downloads/cluberly-demo.mp4" type="video/mp4" />
            Tu navegador no soporta vídeo HTML5.
          </video>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <p style={{ color: '#475569', fontSize: '1rem', marginBottom: '1.25rem' }}>
            ¿Quieres probarlo con tu club?
          </p>
          <div style={{ display: 'inline-flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/onboarding" style={{
              padding: '0.95rem 2rem', borderRadius: 12,
              background: 'linear-gradient(135deg,#EC4899,#BE185D)', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: '1rem',
            }}>Probar gratis 14 días</Link>
            <Link href="/reservar" style={{
              padding: '0.95rem 2rem', borderRadius: 12,
              background: '#fff', color: '#BE185D', textDecoration: 'none', fontWeight: 700, fontSize: '1rem',
              border: '2px solid #FBCFE8',
            }}>Reservar demo en directo</Link>
          </div>
          <p style={{ marginTop: '1rem', color: '#94A3B8', fontSize: '0.85rem' }}>
            Sin tarjeta · Sin compromiso · Cancela cuando quieras
          </p>
        </div>
      </div>
    </div>
  )
}
