'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Users, Calendar, CreditCard, BarChart3, Bell, MessageSquare,
  Check, ChevronDown, ChevronUp, Zap, Star, Shield, Clock,
  Activity, ArrowRight, Sparkles,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Cluberly — El CRM para clubs deportivos',
  description: 'Gestiona socios, cuotas, sesiones y comunicaciones. Multi-deporte. Sin Excel. Sin papeles.',
}

// ─── Data ────────────────────────────────────────────────────────────────────

const SPORTS = [
  { icon: '⚽', name: 'Fútbol' },
  { icon: '🎾', name: 'Tenis' },
  { icon: '🏸', name: 'Pádel' },
  { icon: '🏀', name: 'Baloncesto' },
  { icon: '🏊', name: 'Natación' },
  { icon: '🥋', name: 'Artes marciales' },
  { icon: '🏐', name: 'Voleibol' },
  { icon: '🤸', name: 'Gimnasia' },
]

const FEATURES = [
  {
    icon: Users,
    color: '#6366F1',
    title: 'Gestión de socios',
    desc: 'Ficha completa con historial de pagos, lesiones, sanciones y evaluaciones. Todo en un lugar.',
  },
  {
    icon: Calendar,
    color: '#10B981',
    title: 'Sesiones y asistencias',
    desc: 'Registra entrenamientos y partidos. Asistencia por miembro, métricas por deporte: goles, minutos, puntos.',
  },
  {
    icon: CreditCard,
    color: '#F59E0B',
    title: 'Cuotas y pagos',
    desc: 'Recordatorios automáticos de renovación. Vista clara de deudas. Sin Excel, sin perseguir a nadie.',
  },
  {
    icon: MessageSquare,
    color: '#EC4899',
    title: 'Comunicaciones',
    desc: 'Emails masivos o individuales con plantillas. Tracking de aperturas. Desde la app, en segundos.',
  },
  {
    icon: BarChart3,
    color: '#3B82F6',
    title: 'Informes y estadísticas',
    desc: 'Rendimiento de jugadores, evolución de pagos, asistencia por temporada. Datos que se usan.',
  },
  {
    icon: Bell,
    color: '#8B5CF6',
    title: 'Formularios públicos',
    desc: 'Link de inscripción para nuevos socios. Rellenan online y los datos llegan directos al sistema.',
  },
]

const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    icon: '🌱',
    color: '#6B7280',
    monthlyPrice: 39,
    annualPrice: 390,
    annualMonthly: 33,
    limit: 'Hasta 100 jugadores',
    description: 'Para clubes pequeños: jugadores, cuotas y comunicaciones.',
    features: [
      'Gestión de jugadores',
      'Cuotas y pagos',
      'Comunicaciones email',
      'Formulario de inscripción',
      'Soporte email',
    ],
    cta: 'Empezar gratis',
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: '🏆',
    color: '#6366F1',
    monthlyPrice: 89,
    annualPrice: 890,
    annualMonthly: 74,
    limit: 'Hasta 300 jugadores',
    description: 'Sesiones, contabilidad completa, informes y recordatorios automáticos.',
    popular: true,
    features: [
      'Todo lo de Básico',
      'Sesiones y asistencia',
      'Contabilidad completa',
      'Informes y estadísticas',
      'Recordatorios automáticos de cobro',
      'Migración gratis desde Excel',
      'Soporte WhatsApp',
    ],
    cta: 'Empezar con Pro',
  },
  {
    id: 'club',
    name: 'Club',
    icon: '🎯',
    color: '#F59E0B',
    monthlyPrice: 149,
    annualPrice: 1490,
    annualMonthly: 124,
    limit: 'Hasta 600 jugadores',
    description: 'Para clubes grandes: todo + evaluaciones, lesiones y prioridad.',
    features: [
      'Todo lo de Pro',
      'Evaluaciones de jugadores',
      'Módulo de lesiones avanzado',
      'Exportación completa de datos',
      'Google Sheets sync automático',
      'Soporte prioritario',
    ],
    cta: 'Empezar con Club',
  },
  {
    id: 'personalizado',
    name: 'Personalizado',
    icon: '👑',
    color: '#0F172A',
    monthlyPrice: 0,
    annualPrice: 0,
    annualMonthly: 0,
    limit: 'Federaciones y +600',
    description: 'Federaciones, integraciones a medida, onboarding y SLA.',
    features: [
      'Todo lo de Club',
      'Jugadores ilimitados',
      'Integraciones a medida',
      'Onboarding presencial',
      'SLA garantizado',
    ],
    cta: 'Contactar',
  },
]

const FAQS = [
  {
    q: '¿Puedo probarlo antes de pagar?',
    a: 'Sí. Todos los planes incluyen 14 días de prueba gratuita, sin tarjeta de crédito. Creas tu cuenta, importas tus datos y decides.',
  },
  {
    q: '¿Es difícil migrar desde Excel?',
    a: 'Muy sencillo. Puedes importar miembros desde CSV en 3 clics. Si tienes dudas, nuestro equipo te ayuda en la primera semana sin coste.',
  },
  {
    q: '¿Funciona para cualquier deporte?',
    a: 'Sí. Cluberly es multi-deporte por diseño: fútbol, tenis, pádel, baloncesto, natación, artes marciales y más. Cada deporte tiene sus propias métricas configurables.',
  },
  {
    q: '¿Puedo cambiar de plan más adelante?',
    a: 'En cualquier momento. Si creces y necesitas más miembros, actualiza el plan en segundos. Si necesitas bajar, también puedes hacerlo al terminar el período.',
  },
  {
    q: '¿Los datos son seguros?',
    a: 'Sí. Todo está almacenado en Supabase (PostgreSQL) con cifrado en tránsito y en reposo. Los datos de tu club son tuyos y siempre exportables.',
  },
  {
    q: '¿Qué pasa si supero el límite de miembros?',
    a: 'Te avisamos antes. Puedes seguir usando la app y tienes 30 días para actualizar el plan. Nunca bloqueamos el acceso de golpe.',
  },
  {
    q: '¿Hay descuento para federaciones o grupos de clubs?',
    a: 'Sí. Si gestionas varios clubs o eres una federación, escríbenos a iakevoapp@gmail.com para opciones de precios personalizadas.',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '1.1rem 1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '1rem',
        }}>
        <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#0F172A' }}>{q}</span>
        {open ? <ChevronUp size={18} color="#64748B" /> : <ChevronDown size={18} color="#64748B" />}
      </button>
      {open && (
        <div style={{ padding: '0 1.25rem 1.1rem', color: '#475569', fontSize: '0.9rem', lineHeight: 1.7 }}>{a}</div>
      )}
    </div>
  )
}

function PricingSection() {
  const [annual, setAnnual] = useState(true)
  return (
    <section id="precios" style={{ padding: 'clamp(3rem, 6vw, 5rem) 1rem', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={s.badge}>💰 Precios</span>
          <h2 style={s.h2}>Sin sorpresas. Sin letra pequeña.</h2>
          <p style={s.desc}>Cancela cuando quieras. Cambia de plan en cualquier momento.</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', gap: '0.75rem', alignItems: 'center' }}>
            <button onClick={() => setAnnual(false)} style={{
              padding: '0.45rem 1.25rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.875rem',
              background: !annual ? 'linear-gradient(90deg,#6366F1,#EC4899)' : '#E2E8F0',
              color: !annual ? '#fff' : '#64748B',
            }}>Mensual</button>
            <button onClick={() => setAnnual(true)} style={{
              padding: '0.45rem 1.25rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6,
              background: annual ? 'linear-gradient(90deg,#6366F1,#EC4899)' : '#E2E8F0',
              color: annual ? '#fff' : '#64748B',
            }}>
              Anual
              <span style={{ background: '#10B981', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999 }}>−17%</span>
            </button>
          </div>
          {annual && <p style={{ color: '#64748B', fontSize: '0.8125rem', marginTop: '0.5rem' }}>Con el plan anual pagas <strong style={{ color: '#10B981' }}>2 meses gratis</strong> ✨</p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {PLANS.map(plan => {
            const isElite = plan.id === 'personalizado'
            return (
              <div key={plan.id} style={{
                background: '#fff', borderRadius: 16, padding: '1.75rem', position: 'relative',
                display: 'flex', flexDirection: 'column',
                border: plan.popular ? `2px solid ${plan.color}` : '1px solid #E2E8F0',
                boxShadow: plan.popular ? `0 8px 32px ${plan.color}22` : '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: plan.color, color: '#fff', fontSize: '0.7rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 14px', borderRadius: 999,
                  }}>⭐ Más popular</div>
                )}
                <div style={{ fontSize: 28, marginBottom: 8 }}>{plan.icon}</div>
                <div style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: 4 }}>{plan.name}</div>
                <div style={{ color: '#64748B', fontSize: '0.8125rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>{plan.description}</div>
                <div style={{ marginBottom: '0.5rem' }}>
                  {isElite ? (
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>Personalizado</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.04em' }}>€{annual ? plan.annualMonthly : plan.monthlyPrice}</span>
                        <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>/mes</span>
                      </div>
                      {annual && <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginTop: 2 }}>€{plan.annualPrice}/año · facturado anualmente</div>}
                    </>
                  )}
                  <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: 4, fontWeight: 600 }}>{plan.limit}</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8375rem', alignItems: 'flex-start' }}>
                      <Check size={14} style={{ color: plan.color, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: '#374151' }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={isElite ? 'mailto:iakevoapp@gmail.com?subject=Plan%20Personalizado' : `/onboarding?plan=${plan.id}`} style={{
                  display: 'block', padding: '0.8rem 1rem', borderRadius: 10, textAlign: 'center',
                  fontWeight: 700, fontSize: '0.9375rem', textDecoration: 'none',
                  background: plan.popular ? plan.color : 'transparent',
                  color: plan.popular ? '#fff' : plan.color,
                  border: plan.popular ? 'none' : `2px solid ${plan.color}`,
                }}>{plan.cta}</Link>
              </div>
            )
          })}
        </div>
        <p style={{ textAlign: 'center', marginTop: '2rem', color: '#94A3B8', fontSize: '0.8125rem' }}>
          🔒 Pago seguro vía Stripe · Sin contratos · Cancela cuando quieras
        </p>
      </div>
    </section>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  badge: {
    display: 'inline-block', background: 'linear-gradient(90deg,#EEF2FF,#FDF2F8)',
    color: '#6366F1', fontSize: '0.8rem', fontWeight: 700,
    padding: '0.3rem 0.875rem', borderRadius: 999, marginBottom: '1rem', letterSpacing: '0.02em',
  } as React.CSSProperties,
  h2: {
    fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, color: '#0F172A',
    marginBottom: '0.75rem', lineHeight: 1.25, letterSpacing: '-0.02em',
  } as React.CSSProperties,
  desc: {
    color: '#64748B', fontSize: '1rem', lineHeight: 1.6, maxWidth: 520, margin: '0 auto',
  } as React.CSSProperties,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,Inter,sans-serif', color: '#0F172A', overflowX: 'hidden' }}>

      {/* ── Global animation keyframes ── */}
      <style>{`
        @keyframes blob1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(40px,-30px) scale(1.1); }
          66%      { transform: translate(-20px,20px) scale(0.95); }
        }
        @keyframes blob2 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(-35px,25px) scale(1.05); }
          66%      { transform: translate(25px,-15px) scale(1.12); }
        }
        @keyframes blob3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(20px,30px) scale(0.9); }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .sport-pill:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99,102,241,0.15) !important; }
        .sport-pill { transition: transform 0.2s, box-shadow 0.2s; }
        .feature-card:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,0.1) !important; }
        .feature-card { transition: transform 0.2s, box-shadow 0.2s; }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E2E8F0', padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ position: 'relative', width: 34, height: 34 }}>
            <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: 'conic-gradient(from 0deg,#6366F1,#A855F7,#EC4899,#6366F1)', filter: 'blur(4px)', opacity: 0.5 }} />
            <div style={{ position: 'relative', width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366F1,#8B5CF6,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(99,102,241,0.4)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <svg width="20" height="20" viewBox="0 0 46 46" fill="none"><circle cx="23" cy="23" r="18" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none"/><path d="M23 5 C12.5 5 5 13 5 23 C5 33 12.5 41 23 41" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/><line x1="5" y1="23" x2="41" y2="23" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2"/><circle cx="23" cy="23" r="4" fill="white" opacity="0.9"/></svg>
            </div>
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.03em', color: '#0F172A' }}>cluberly</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="#precios" style={{ color: '#64748B', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>Precios</a>
          <Link href="/login" style={{ color: '#64748B', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>Iniciar sesión</Link>
          <Link href="/onboarding" style={{
            background: 'linear-gradient(135deg,#6366F1,#9333EA)', color: '#fff', padding: '0.4rem 1rem',
            borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 2px 8px #6366F130',
          }}>Prueba gratis</Link>
        </div>
      </nav>

      {/* HERO — animated blobs */}
      <section style={{
        padding: 'clamp(4rem,9vw,7rem) 1.5rem',
        background: '#0B0F1A',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Blobs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '5%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle,#6366F150 0%,transparent 70%)', animation: 'blob1 12s ease-in-out infinite', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', top: '10%', right: '5%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle,#EC489950 0%,transparent 70%)', animation: 'blob2 15s ease-in-out infinite', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', bottom: '-5%', left: '35%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle,#9333EA45 0%,transparent 70%)', animation: 'blob3 10s ease-in-out infinite', filter: 'blur(40px)' }} />
          {/* Mesh grid overlay */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        {/* Badge */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'linear-gradient(90deg,#6366F120,#EC489920)',
            border: '1px solid #6366F140',
            borderRadius: 999, padding: '0.4rem 1.1rem', marginBottom: '2rem',
            fontSize: '0.8125rem', fontWeight: 700, color: '#A5B4FC',
          }}>
            <Sparkles size={13} />
            14 días gratis · Sin tarjeta de crédito
            <ArrowRight size={13} />
          </div>

          <h1 style={{
            fontSize: 'clamp(2.25rem,5.5vw,4rem)', fontWeight: 900, letterSpacing: '-0.04em',
            lineHeight: 1.1, marginBottom: '1.5rem', maxWidth: 820, margin: '0 auto 1.5rem',
            color: '#F8FAFC',
          }}>
            El club bien llevado —{' '}
            <span style={{
              background: 'linear-gradient(90deg,#818CF8,#F472B6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundSize: '200% auto',
              animation: 'shimmer 4s linear infinite',
            }}>para que te centres<br />en el deporte</span>
          </h1>

          <p style={{ fontSize: 'clamp(1rem,2vw,1.2rem)', color: '#94A3B8', lineHeight: 1.75, maxWidth: 560, margin: '0 auto 2.75rem' }}>
            Cluberly gestiona socios, cuotas, sesiones, asistencias y comunicaciones.
            Multi-deporte. Sin Excel. Sin papeles. Todo desde tu móvil o escritorio.
          </p>

          <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/onboarding" style={{
              background: 'linear-gradient(135deg,#6366F1,#9333EA)', color: '#fff', padding: '0.9rem 2.25rem', borderRadius: 12,
              fontSize: '1rem', fontWeight: 800, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              boxShadow: '0 4px 24px #6366F155',
              animation: 'float 3s ease-in-out infinite',
            }}><Zap size={17} /> Prueba gratis 14 días</Link>
            <a href="#precios" style={{
              background: 'rgba(255,255,255,0.07)', color: '#E2E8F0', padding: '0.9rem 2.25rem', borderRadius: 12,
              fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.12)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            }}>Ver precios</a>
          </div>
          <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '1rem' }}>Sin tarjeta de crédito · 14 días gratis · Cancela cuando quieras</p>

          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '3.5rem' }}>
            {SPORTS.map(sp => (
              <div key={sp.name} className="sport-pill" style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
                padding: '0.35rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, color: '#CBD5E1',
              }}>
                <span>{sp.icon}</span><span>{sp.name}</span>
              </div>
            ))}
          </div>

          {/* PRODUCT MOCKUP */}
          <div style={{ marginTop: '4rem', position: 'relative' }}>
            {/* Glow under the card */}
            <div style={{ position: 'absolute', inset: '10% 5%', background: 'radial-gradient(ellipse,rgba(99,102,241,0.35) 0%,transparent 70%)', filter: 'blur(30px)', zIndex: 0 }} />
            <div style={{
              position: 'relative', zIndex: 1,
              maxWidth: 820, margin: '0 auto',
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.2)',
              backdropFilter: 'blur(12px)',
            }}>
              {/* Top bar */}
              <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(15,23,42,0.8)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
                <div style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'rgba(148,163,184,0.5)', fontFamily: 'monospace' }}>cluberly.vercel.app/dashboard</div>
              </div>
              {/* Dashboard content */}
              <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.875rem' }}>
                {[
                  { label: 'Socios activos', value: '147', color: '#6366F1', trend: '+12' },
                  { label: 'Cuotas cobradas', value: '€4.320', color: '#10B981', trend: '+8%' },
                  { label: 'Sesiones mes', value: '38', color: '#F59E0B', trend: '+5' },
                  { label: 'Asistencia media', value: '87%', color: '#EC4899', trend: '+3%' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.color}30`, borderRadius: 12, padding: '1rem' }}>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(148,163,184,0.7)', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    <div style={{ fontSize: '1.375rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.03em' }}>{s.value}</div>
                    <div style={{ fontSize: '0.7rem', color: s.color, fontWeight: 700, marginTop: '0.25rem' }}>{s.trend} este mes</div>
                  </div>
                ))}
              </div>
              {/* Mini table */}
              <div style={{ margin: '0 1.5rem 1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ padding: '0.625rem 1rem', background: 'rgba(255,255,255,0.04)', fontSize: '0.7rem', color: 'rgba(148,163,184,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  Últimos pagos
                </div>
                {[
                  { name: 'Carlos M.', team: 'Benjamín A', amount: '€60', status: 'Cobrado', color: '#10B981' },
                  { name: 'Ana G.', team: 'Alevín B', amount: '€60', status: 'Pendiente', color: '#F59E0B' },
                  { name: 'Luis R.', team: 'Infantil A', amount: '€75', status: 'Cobrado', color: '#10B981' },
                ].map((row, i) => (
                  <div key={i} style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#A5B4FC' }}>{row.name.charAt(0)}{row.name.split(' ')[1]?.charAt(0)}</div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#E2E8F0' }}>{row.name}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(148,163,184,0.6)' }}>{row.team}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F1F5F9' }}>{row.amount}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: row.color, background: `${row.color}15`, padding: '2px 8px', borderRadius: 999, border: `1px solid ${row.color}30` }}>{row.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: '1.75rem', background: '#0F1629', borderBottom: '1px solid #1E293B', textAlign: 'center' }}>
        <p style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
          Clubs deportivos que confían en Cluberly
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '2.5rem' }}>
          {['⚽ E.F. Ciudad de Getafe', '🎾 Club de Tenis Arroyomolinos', '🥋 Akademia Fight', '🏊 Natación Rivas'].map(c => (
            <span key={c} style={{ fontWeight: 700, color: '#64748B', fontSize: '0.875rem' }}>{c}</span>
          ))}
        </div>
      </section>

      {/* PROBLEM — dark card style */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#080C18', textAlign: 'center' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <span style={{ ...s.badge, background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>😩 El problema</span>
          <h2 style={{ ...s.h2, color: '#F1F5F9' }}>¿Tu club sigue gestionando con Excel y WhatsApp?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.25rem', marginTop: '2.5rem' }}>
            {[
              { icon: '📋', title: 'Listas interminables', desc: 'Excels que nadie entiende. Versiones desactualizadas. Datos perdidos.' },
              { icon: '💰', title: 'Cobros imposibles', desc: 'Perseguir familias por WhatsApp para cobrar la cuota de octubre.' },
              { icon: '📅', title: 'Asistencia manual', desc: 'Listas en papel, fotos de WhatsApp o simplemente... nada.' },
              { icon: '📧', title: 'Comunicación caótica', desc: 'Grupos de WhatsApp, emails masivos con CCO, respuestas de vuelta.' },
            ].map(p => (
              <div key={p.title} style={{ background: '#0F1629', border: '1px solid #1E2D4A', borderRadius: 14, padding: '1.5rem', textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: '0.75rem' }}>{p.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#E2E8F0' }}>{p.title}</div>
                <div style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — glass cards on gradient */}
      <section style={{
        padding: 'clamp(3rem,6vw,5rem) 1.5rem',
        background: 'linear-gradient(160deg,#0F172A 0%,#1E1B4B 50%,#0F172A 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* subtle radial glow */}
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 400, background: 'radial-gradient(ellipse,#6366F120 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <span style={{ ...s.badge, background: 'rgba(99,102,241,0.15)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)' }}>✨ Solución</span>
          <h2 style={{ ...s.h2, color: '#F1F5F9' }}>Todo lo que tu club necesita, en una sola app</h2>
          <p style={{ ...s.desc, color: '#94A3B8' }}>Diseñado para directivos, coordinadores y entrenadores. No para informáticos.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.25rem', marginTop: '3rem', textAlign: 'left' }}>
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card" style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '1.75rem',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${f.color}25`, border: `1px solid ${f.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.1rem' }}>
                  <f.icon size={22} color={f.color} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: '#F1F5F9' }}>{f.title}</div>
                <div style={{ color: '#94A3B8', fontSize: '0.875rem', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* METRICS */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: 'linear-gradient(135deg,#1E1B4B 0%,#4A1035 100%)', color: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Datos reales de clubs que usan Cluberly</h2>
          <p style={{ color: '#A5B4FC', marginBottom: '3rem', fontSize: '1rem' }}>Resultados medios en los primeros 3 meses de uso</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '2rem' }}>
            {[
              { value: '80%', label: 'Menos tiempo en tareas administrativas' },
              { value: '95%', label: 'Reducción de impagos por recordatorios automáticos' },
              { value: '3 horas', label: 'Ahorradas por semana por club' },
              { value: '100%', label: 'Satisfacción garantizada o te devolvemos el dinero' },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#F9A8D4', letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>{m.value}</div>
                <div style={{ color: '#FBCFE8', fontSize: '0.875rem', lineHeight: 1.5 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <span style={s.badge}>🚀 Cómo funciona</span>
          <h2 style={s.h2}>En marcha en menos de 30 minutos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '2rem', marginTop: '3rem' }}>
            {[
              { step: '1', title: 'Crea tu cuenta', desc: 'Regístrate, configura tu club y sube tu logo. Menos de 5 minutos.', color: '#6366F1' },
              { step: '2', title: 'Importa tus socios', desc: 'Desde CSV o añádelos manualmente. Los datos migran en segundos.', color: '#9333EA' },
              { step: '3', title: 'Todo en marcha', desc: 'Sesiones, cuotas, comunicaciones. Tu club digital desde hoy.', color: '#EC4899' },
            ].map((st, i) => (
              <div key={st.step} style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.25rem' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg,${st.color}20,${st.color}40)`, border: `2px solid ${st.color}`, color: st.color, fontSize: '1.375rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{st.step}</div>
                  {i < 2 && <div style={{ position: 'absolute', top: '50%', left: '100%', width: 'clamp(20px,8vw,60px)', height: 2, background: `linear-gradient(90deg,${st.color}60,transparent)`, marginTop: -1, display: 'none' }} />}
                </div>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.0625rem', color: '#0F172A' }}>{st.title}</div>
                <div style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.65 }}>{st.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '3rem' }}>
            <Link href="/onboarding" style={{ background: 'linear-gradient(135deg,#6366F1,#EC4899)', color: '#fff', padding: '0.875rem 2rem', borderRadius: 12, fontSize: '1rem', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 24px #6366F130' }}>
              <Zap size={16} /> Empezar ahora gratis
            </Link>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <PricingSection />

      {/* URGENCY BLOCK */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-30%', right: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,#6366F130,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '-5%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,#EC489925,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</div>
          <div style={{ display: 'inline-block', background: 'linear-gradient(90deg,#6366F1,#EC4899)', color: '#fff', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.35rem 1.25rem', borderRadius: 999, marginBottom: '1.25rem' }}>
            Plan Pro — El más elegido por clubs
          </div>
          <h2 style={{ fontSize: 'clamp(1.5rem,4vw,2.25rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.75rem', color: '#F1F5F9' }}>
            Gestión completa por <span style={{ background: 'linear-gradient(90deg,#818CF8,#F472B6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>€89/mes</span>
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '1rem', lineHeight: 1.7, maxWidth: 540, margin: '0 auto 2rem' }}>
            Con el plan anual pagas <strong style={{ color: '#A5B4FC' }}>€890/año</strong> — ahorras 2 meses. Acceso a todas las funciones Pro para hasta 300 jugadores, sesiones ilimitadas y recordatorios automáticos.
          </p>
          <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {['✅ Hasta 300 jugadores', '✅ Contabilidad completa', '✅ Recordatorios automáticos', '✅ Migración gratis'].map(b => (
              <span key={b} style={{ fontSize: '0.875rem', fontWeight: 600, color: '#A5B4FC' }}>{b}</span>
            ))}
          </div>
          <Link href="/onboarding?plan=pro" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'linear-gradient(135deg,#6366F1,#9333EA)', color: '#fff',
            padding: '1rem 2.5rem', borderRadius: 12, fontSize: '1.0625rem', fontWeight: 800, textDecoration: 'none',
            boxShadow: '0 4px 24px #6366F150',
          }}><Zap size={18} /> Empezar con Pro — 14 días gratis</Link>
          <p style={{ color: '#4B5563', fontSize: '0.75rem', marginTop: '0.875rem' }}>Sin tarjeta de crédito en el periodo de prueba · Cancela cuando quieras</p>
        </div>
      </section>

      {/* TRUST */}
      <section style={{ padding: '3.5rem 1.5rem', background: 'linear-gradient(180deg,#F8FAFC 0%,#EEF2FF 100%)', borderTop: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ ...s.h2, fontSize: '1.5rem', marginBottom: '2.5rem' }}>Por qué los clubs eligen Cluberly</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '1.5rem' }}>
            {[
              { icon: Shield, color: '#6366F1', title: 'Datos seguros', desc: 'Cifrado end-to-end. Tus datos son tuyos y siempre exportables.' },
              { icon: Clock, color: '#10B981', title: '30 min de setup', desc: 'Empiezas a usar el mismo día. Sin formación, sin IT.' },
              { icon: Star, color: '#F59E0B', title: 'Soporte real', desc: 'Respuesta en menos de 24h. Personas reales, no bots.' },
              { icon: Activity, color: '#EC4899', title: 'Siempre disponible', desc: '99.9% uptime. Tu club no para y Cluberly tampoco.' },
            ].map(t => (
              <div key={t.title} style={{ textAlign: 'center', padding: '1.25rem', background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${t.color}15,${t.color}30)`, border: `1px solid ${t.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <t.icon size={22} color={t.color} />
                </div>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem', fontSize: '0.9375rem', color: '#0F172A' }}>{t.title}</div>
                <div style={{ color: '#64748B', fontSize: '0.8125rem', lineHeight: 1.6 }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#FAFAFA' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span style={s.badge}>❓ Preguntas frecuentes</span>
            <h2 style={s.h2}>Todo lo que necesitas saber</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: 'clamp(4rem,8vw,6rem) 1.5rem', background: 'linear-gradient(135deg,#6366F1 0%,#9333EA 45%,#EC4899 100%)', color: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
          <h2 style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '1rem' }}>Tu club merece una gestión profesional</h2>
          <p style={{ color: '#FBCFE8', fontSize: '1.0625rem', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            Únete a los clubs que ya ahorran horas cada semana. Prueba gratis durante 14 días, sin compromisos.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/onboarding" style={{ background: '#fff', color: '#9333EA', padding: '0.9rem 2rem', borderRadius: 12, fontSize: '1rem', fontWeight: 800, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
              <Zap size={17} /> Empezar gratis ahora
            </Link>
            <a href="mailto:iakevoapp@gmail.com" style={{ background: 'transparent', color: '#fff', padding: '0.9rem 2rem', borderRadius: 12, fontSize: '1rem', fontWeight: 700, textDecoration: 'none', border: '2px solid rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              Hablar con el equipo
            </a>
          </div>
          <p style={{ color: '#FBCFE8', fontSize: '0.8rem', marginTop: '1rem' }}>¿Tienes más de 5 clubs o eres una federación? Escríbenos para precios especiales.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '2.5rem 1.5rem', background: '#0F172A', color: '#94A3B8', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', width: 28, height: 28 }}>
            <div style={{ position: 'relative', width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#6366F1,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 46 46" fill="none"><circle cx="23" cy="23" r="18" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none"/><path d="M23 5 C12.5 5 5 13 5 23 C5 33 12.5 41 23 41" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none"/><circle cx="23" cy="23" r="4" fill="white" opacity="0.9"/></svg>
            </div>
          </div>
          <span style={{ color: '#E2E8F0', fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>cluberly</span>
        </div>
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <a href="#precios" style={{ color: '#94A3B8', textDecoration: 'none' }}>Precios</a>
          <Link href="/login" style={{ color: '#94A3B8', textDecoration: 'none' }}>Iniciar sesión</Link>
          <Link href="/onboarding" style={{ color: '#94A3B8', textDecoration: 'none' }}>Registro</Link>
          <a href="mailto:iakevoapp@gmail.com" style={{ color: '#94A3B8', textDecoration: 'none' }}>Contacto</a>
          <Link href="/privacy" style={{ color: '#94A3B8', textDecoration: 'none' }}>Privacidad</Link>
        </div>
        <p style={{ fontSize: '0.8rem' }}>
          © {new Date().getFullYear()} Cluberly · Hecho con ❤️ en España ·{' '}
          <a href="mailto:iakevoapp@gmail.com" style={{ color: '#EC4899', textDecoration: 'none' }}>iakevoapp@gmail.com</a>
        </p>
      </footer>
    </div>
  )
}
