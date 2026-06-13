import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Cluberly — Software de gestión para clubes deportivos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
          color: 'white',
          fontFamily: 'system-ui',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#BE185D',
              fontSize: 60,
              fontWeight: 900,
            }}
          >
            C
          </div>
          <div style={{ fontSize: 80, fontWeight: 800, letterSpacing: -3 }}>cluberly</div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.2,
            marginBottom: 24,
          }}
        >
          El software para tu club de fútbol base
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 400,
            opacity: 0.9,
            textAlign: 'center',
            maxWidth: 800,
          }}
        >
          Cuotas, inscripciones, asistencia y comunicaciones en un sitio
        </div>

        {/* Bottom badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            padding: '12px 28px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 999,
            fontSize: 22,
            fontWeight: 600,
            display: 'flex',
          }}
        >
          14 días gratis · Sin tarjeta de crédito
        </div>
      </div>
    ),
    { ...size }
  )
}
