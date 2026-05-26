'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createClub, getClubMemberEmail } from './actions'
import { Zap, Check } from 'lucide-react'

const SPORTS = [
  '⚽ Fútbol', '🎾 Tenis', '🏸 Pádel', '🏀 Baloncesto',
  '🏊 Natación', '🥋 Artes marciales', '🏐 Voleibol', '🤸 Gimnasia', '🏃 Atletismo', '🏋️ Fitness', '⛳ Golf', '🎱 Otro',
]

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter — €49/mes',
  pro: 'Pro — €99/mes',
  club: 'Club — €179/mes',
  elite: 'Elite — €279/mes',
  ltd: '⚡ LTD — €199 de por vida',
}

type Step = 'account' | 'club' | 'done'

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

  // Step 2: club
  const [clubName, setClubName] = useState('')
  const [sport, setSport] = useState('⚽ Fútbol')
  const [city, setCity] = useState('')

  // Keep userId after step 1
  const [userId, setUserId] = useState('')

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (authError) {
        // Maybe user already exists — try sign in
        if (authError.message.includes('already') || authError.message.includes('existe')) {
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
          if (loginError) { setError(loginError.message); return }
          setUserId(loginData.user!.id)
        } else {
          setError(authError.message)
          return
        }
      } else {
        setUserId(data.user!.id)
      }
      setStep('club')
    })
  }

  async function handleClub(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createClub({ userId, fullName, clubName, sport, city, plan })
      if (!result.success) { setError(result.error ?? 'Error'); return }
      await getClubMemberEmail(userId, result.clubId!)
      setStep('done')
      setTimeout(() => router.push('/dashboard'), 1800)
    })
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#EEF2FF 0%,#FDF2F8 55%,#FFF0F6 100%)',
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', textDecoration: 'none' }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.125rem' }}>C</div>
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
                  background: completed ? '#10B981' : active ? '#6366F1' : '#E2E8F0',
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
          <div style={{ background: '#EEF2FF', borderRadius: 8, padding: '0.5rem 0.875rem', marginBottom: '1.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#6366F1', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
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
              background: 'linear-gradient(135deg,#6366F1,#EC4899)', color: '#fff', fontWeight: 800, fontSize: '1rem',
              cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1,
            }}>
              {isPending ? 'Creando cuenta…' : 'Continuar →'}
            </button>

            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8125rem', color: '#64748B' }}>
              ¿Ya tienes cuenta? <Link href="/login" style={{ color: '#6366F1', fontWeight: 600 }}>Inicia sesión</Link>
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
            </div>

            {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginTop: '0.75rem' }}>{error}</p>}

            <button type="submit" disabled={isPending} style={{
              width: '100%', marginTop: '1.5rem', padding: '0.875rem', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#6366F1,#EC4899)', color: '#fff', fontWeight: 800, fontSize: '1rem',
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
              <div style={{ height: '100%', background: 'linear-gradient(90deg,#6366F1,#EC4899)', borderRadius: 999, animation: 'progress 1.8s linear forwards' }} />
            </div>
            <style>{`@keyframes progress { from { width: 0% } to { width: 100% } }`}</style>
          </div>
        )}
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center' }}>
        Al registrarte aceptas nuestros <Link href="/privacy" style={{ color: '#6366F1' }}>Términos y Privacidad</Link>
      </p>
    </div>
  )
}
