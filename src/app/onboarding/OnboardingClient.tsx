'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createClub } from './actions'
import { Zap, Check } from 'lucide-react'

const SPORTS = [
  '⚽ Fútbol', '🎾 Tenis', '🏸 Pádel', '🏀 Baloncesto',
  '🏊 Natación', '🥋 Artes marciales', '🏐 Voleibol', '🤸 Gimnasia', '🏃 Atletismo', '🏋️ Fitness', '⛳ Golf', '🎱 Otro',
]

const PLAN_LABELS: Record<string, string> = {
  basic: 'Básico — €39/mes',
  pro:   'Pro — €89/mes',
  club:  'Club — €149/mes',
}

type Step = 'account' | 'club' | 'done'

/** Lee la atribución UTM: query params primero, cookie de la landing como fallback. */
function readAttribution(params: URLSearchParams) {
  const fromQuery = {
    source: params.get('utm_source'),
    campaign: params.get('utm_campaign'),
    content: params.get('utm_content'),
  }
  if (fromQuery.source || fromQuery.campaign || fromQuery.content) return fromQuery
  try {
    const match = document.cookie.match(/(?:^|;\s*)cluberly_utm=([^;]+)/)
    if (match) return JSON.parse(decodeURIComponent(match[1]))
  } catch { /* tracking nunca rompe el registro */ }
  return { source: null, campaign: null, content: null }
}

export default function OnboardingClient() {
  const router = useRouter()
  const params = useSearchParams()
  const plan = params.get('plan') ?? 'pro'

  const [step, setStep] = useState<Step>('account')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Step 1: account
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Step 2: club — pre-rellenar desde ?clubName= y ?city= (viene de email outbound)
  const [clubName, setClubName] = useState(() => {
    const fromQuery = params.get('clubName') ?? params.get('club')
    return fromQuery ? decodeURIComponent(fromQuery).slice(0, 100) : ''
  })
  const [sport, setSport] = useState('⚽ Fútbol')
  const [city, setCity] = useState(() => params.get('city') ?? '')
  const [phone, setPhone] = useState('')

  // Keep userId after step 1
  const [userId, setUserId] = useState('')

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const supabase = createClient()

      // 1. Intentar login primero — evita el "usuario fantasma" de Supabase
      //    (cuando email ya existe, signUp devuelve un ID falso que viola FK en club_members)
      const { data: loginData } = await supabase.auth.signInWithPassword({ email, password })
      if (loginData.user) {
        setUserId(loginData.user.id)
        setStep('club')
        return
      }

      // 2. Nuevo usuario — registrar
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (authError) {
        setError(authError.message)
        return
      }
      if (!data.user) {
        // Supabase devuelve user=null cuando el email ya existe (protección anti-enumeración)
        setError('Este email ya está en uso. Si ya tienes cuenta, inicia sesión primero.')
        return
      }
      setUserId(data.user.id)
      setStep('club')
    })
  }

  async function handleClub(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const supabase = createClient()

      const result = await createClub({
        userId, fullName, clubName, sport, city, plan,
        contactPhone: phone,
        acquisition: readAttribution(params),
      })
      if (!result.success) { setError(result.error ?? 'Error'); return }

      // Guardar el club recién creado como preferido para que el middleware lo use
      if (result.clubId) {
        document.cookie = `preferred_club_id=${result.clubId}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure`
      }

      // Iniciar sesión ahora que el email está auto-confirmado
      // (supabase.auth.signUp no crea sesión cuando email confirmation está habilitado)
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        // Si el login falla, continuar de todas formas — el usuario tendrá que
        // hacer login manualmente, pero el club ya está creado
        console.warn('[onboarding] auto-login failed:', signInError.message)
      }

      setStep('done')
      setTimeout(() => { window.location.href = '/dashboard' }, 1800)
    })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', textDecoration: 'none' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#EC4899,#BE185D)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.125rem' }}>C</div>
        <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#0F172A' }}>cluberly</span>
      </Link>

      {/* Card */}
      <div style={{ background: '#fff', borderRadius: 20, padding: 'clamp(1.5rem,4vw,2.5rem)', width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(99,102,241,0.12)', border: '1px solid #E2E8F0' }}>

        {/* Progress steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          {(['account', 'club', 'done'] as Step[]).map((s, i) => {
            const active = step === s
            const completed = (step === 'club' && i === 0) || (step === 'done' && i < 2)
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : undefined }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700,
                  background: completed ? '#10B981' : active ? '#EC4899' : '#E2E8F0',
                  color: completed || active ? '#fff' : '#94A3B8',
                  flexShrink: 0,
                }}>
                  {completed ? <Check size={13} /> : i + 1}
                </div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: completed ? '#10B981' : '#E2E8F0', margin: '0 0.25rem' }} />}
              </div>
            )
          })}
        </div>

        {/* Selected plan badge */}
        {PLAN_LABELS[plan] && (
          <div style={{ background: '#FDF2F8', borderRadius: 8, padding: '0.5rem 0.875rem', marginBottom: '1.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#EC4899', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={13} /> Plan seleccionado: {PLAN_LABELS[plan]}
          </div>
        )}

        {/* Step 1: Account */}
        {step === 'account' && (
          <form onSubmit={handleAccount}>
            <h1 style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>Crea tu cuenta</h1>
            <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>14 días gratis · Sin tarjeta de crédito</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Tu nombre completo</span>
                <input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Ana García"
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Email</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ana@miclub.com"
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Contraseña</span>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres"
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>
            </div>

            {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginTop: '0.75rem' }}>{error}</p>}

            <button type="submit" disabled={isPending} style={{
              width: '100%', marginTop: '1.5rem', padding: '0.875rem', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#EC4899,#BE185D)', color: '#fff', fontWeight: 800, fontSize: '1rem',
              cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
            }}>
              {isPending ? 'Creando cuenta…' : 'Continuar →'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8125rem', color: '#64748B' }}>
              ¿Ya tienes cuenta? <Link href="/login" style={{ color: '#EC4899', fontWeight: 600 }}>Inicia sesión</Link>
            </p>
          </form>
        )}

        {/* Step 2: Club info */}
        {step === 'club' && (
          <form onSubmit={handleClub}>
            <h1 style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>Configura tu club</h1>
            <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Podrás cambiar todo esto después desde Configuración</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Nombre del club</span>
                <input value={clubName} onChange={e => setClubName(e.target.value)} required placeholder="Club Deportivo Ejemplo"
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Deporte principal</span>
                <select value={sport} onChange={e => setSport(e.target.value)}
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none', background: '#fff' }}>
                  {SPORTS.map(sp => <option key={sp} value={sp}>{sp}</option>)}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Ciudad <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span></span>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Madrid"
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Teléfono de contacto <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional — para ayudarte con la puesta en marcha)</span></span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="600 123 456" maxLength={30}
                  style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
              </label>
            </div>

            {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginTop: '0.75rem' }}>{error}</p>}

            <button type="submit" disabled={isPending} style={{
              width: '100%', marginTop: '1.5rem', padding: '0.875rem', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#EC4899,#BE185D)', color: '#fff', fontWeight: 800, fontSize: '1rem',
              cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
            }}>
              {isPending ? 'Creando club…' : '¡Crear mi club!'}
            </button>
          </form>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🎉</div>
            <h1 style={{ fontWeight: 800, fontSize: '1.375rem', marginBottom: '0.5rem' }}>¡Club creado!</h1>
            <p style={{ color: '#64748B', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              Entrando al dashboard…
            </p>
            <div style={{ marginTop: '1.5rem', height: 4, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#EC4899,#EC4899)', borderRadius: 999, animation: 'progress 1.8s linear forwards' }} />
            </div>
            <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
          </div>
        )}
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
        Al registrarte aceptas nuestros <Link href="/privacy" style={{ color: '#EC4899' }}>Términos y Privacidad</Link>
      </p>
    </div>
  )
}
