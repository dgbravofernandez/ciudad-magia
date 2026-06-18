import { LoginForm } from '@/features/auth/components/LoginForm'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Iniciar sesión — Cluberly',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>
}) {
  const params = await searchParams

  return (
    <div className="space-y-7">

      {/* Logo + marca */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <div style={{
            position: 'relative',
            width: 80, height: 80,
          }}>
            {/* Glow ring */}
            <div style={{
              position: 'absolute', inset: -4,
              borderRadius: '50%',
              background: 'conic-gradient(from 0deg, #EC4899, #A855F7, #EC4899, #EC4899)',
              filter: 'blur(8px)',
              opacity: 0.5,
            }} />
            {/* Main icon */}
            <div style={{
              position: 'relative', width: 80, height: 80,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 50%, #EC4899 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 16px 48px rgba(99,102,241,0.45), 0 4px 12px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}>
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
                <circle cx="23" cy="23" r="18" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none"/>
                <path d="M23 5 C12.5 5 5 13 5 23 C5 33 12.5 41 23 41" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/>
                <line x1="5" y1="23" x2="41" y2="23" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2"/>
                <circle cx="23" cy="23" r="4" fill="white" opacity="0.9"/>
              </svg>
            </div>
          </div>
        </div>

        <div>
          <h1 style={{
            fontSize: '2rem', fontWeight: 800, color: '#fff',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            background: 'linear-gradient(135deg, #fff 30%, rgba(168,85,247,0.9) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Cluberly
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 tracking-wide">
            Gestión deportiva profesional
          </p>
        </div>
      </div>

      {/* Features strip */}
      <div className="flex items-center justify-center gap-4">
        {['⚽ Fútbol', '🎾 Tenis', '🏀 Basket', '🥋 Artes'].map(f => (
          <span key={f} style={{
            fontSize: '0.7rem', color: 'rgba(148,163,184,0.7)',
            padding: '3px 8px', borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.03)',
          }}>{f}</span>
        ))}
      </div>

      {/* Card */}
      <div className="relative">
        <div className="absolute -top-px left-6 right-6 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), rgba(168,85,247,0.7), transparent)' }}
        />
        <div style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          padding: '2rem',
          boxShadow: '0 32px 80px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)',
        }}>
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">Iniciar sesión</h2>
            <p className="text-sm text-gray-500 mt-0.5">Accede al panel de tu club</p>
          </div>

          {params.error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>
                {params.error === 'unauthorized'
                  ? 'No tienes permisos para acceder.'
                  : 'Ha ocurrido un error. Inténtalo de nuevo.'}
              </span>
            </div>
          )}
          <LoginForm redirectTo={params.redirectTo} />
        </div>
      </div>

      {/* Footer */}
      <div className="text-center space-y-1.5">
        <p className="text-sm text-slate-400">
          ¿Sin cuenta?{' '}
          <Link href="/onboarding" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            Crea tu club gratis →
          </Link>
        </p>
        <p className="text-xs text-slate-600">© {new Date().getFullYear()} Cluberly · Todos los deportes</p>
      </div>
    </div>
  )
}
