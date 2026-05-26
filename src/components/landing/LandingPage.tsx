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
    id: 'starter',
    name: 'Starter',
    icon: '🌱',
    color: '#10B981',
    monthlyPrice: 49,
    annualPrice: 490,
    annualMonthly: 41,
    limit: 'Hasta 75 miembros',
    description: 'Para clubs pequeños que empiezan a digitalizarse.',
    features: [
      'Gestión de miembros y grupos',
      'Sesiones y asistencia',
      'Registro de cuotas manual',
      'Formulario de inscripción',
      'Comunicaciones por email',
      'Soporte por email',
    ],
    cta: 'Empezar con Starter',
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: '⚽',
    color: '#6366F1',
    monthlyPrice: 99,
    annualPrice: 990,
    annualMonthly: 83,
    limit: 'Hasta 200 miembros',
    description: 'El más popular. Para clubs en activo con múltiples grupos.',
    popular: true,
    features: [
      'Todo lo de Starter',
      'Grupos ilimitados',
      'Gastos y balance financiero',
      'Planes de cuota configurables',
      'Recordatorios automáticos',
      'SMTP propio',
      'Métricas por deporte',
      'Soporte prioritario',
    ],
    cta: 'Empezar con Pro',
  },
  {
    id: 'club',
    name: 'Club',
    icon: '🏆',
    color: '#F59E0B',
    monthlyPrice: 179,
    annualPrice: 1790,
    annualMonthly: 149,
    limit: 'Hasta 500 miembros',
    description: 'Para clubs medianos con alta actividad y varios equipos.',
    features: [
      'Todo lo de Pro',
      'Hasta 500 miembros',
      'Evaluaciones y rendimiento',
      'Módulo de lesiones avanzado',
      'Exportación de datos',
      'Onboarding personalizado',
      'Soporte telefónico',
    ],
    cta: 'Empezar con Club',
  },
  {
    id: 'elite',
    name: 'Elite',
    icon: '👑',
    color: '#0F172A',
    monthlyPrice: 279,
    annualPrice: 2790,
    annualMonthly: 233,
    limit: 'Miembros ilimitados',
    description: 'Para academias y clubs con más de 500 miembros.',
    features: [
      'Todo lo de Club',
      'Miembros ilimitados',
      'Multi-deporte ilimitado',
      'API access',
      'SLA garantizado',
      'Account manager dedicado',
    ],
    cta: 'Contactar ventas',
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
    q: '¿Qué es el LTD (acceso de por vida)?',
    a: 'Un pago único de €199 que te da acceso al plan Pro para siempre, sin cuotas mensuales. Son solo 30 plazas y se ofrecen por tiempo limitado para los fundadores.',
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
            const isElite = plan.id === 'elite'
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
                <Link href={isElite ? 'mailto:iakevoapp@gmail.com?subject=Plan%20Elite' : `/onboarding?plan=${plan.id}`} style={{
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

const LTD_TOTAL = 30
const LTD_LEFT = 18

export default function LandingPage() {
  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,Inter,sans-serif', color: '#0F172A', overflowX: 'hidden' }}>

      {/* NAVBAR */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E2E8F0', padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,#6366F1,#EC4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '1rem',
          }}>C</div>
          <span style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>cluberly</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="#precios" style={{ color: '#64748B', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>Precios</a>
          <Link href="/login" style={{ color: '#64748B', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>Iniciar sesión</Link>
          <Link href="/onboarding" style={{
            background: '#6366F1', color: '#fff', padding: '0.4rem 1rem',
            borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, textDecoration: 'none',
          }}>Prueba gratis</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        padding: 'clamp(3rem,8vw,6rem) 1.5rem',
        background: 'linear-gradient(160deg,#EEF2FF 0%,#FDF2F8 55%,#FFF0F6 100%)',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: '#FEF3C7', border: '1px solid #FDE68A',
          borderRadius: 999, padding: '0.35rem 1rem', marginBottom: '2rem',
          fontSize: '0.8125rem', fontWeight: 700, color: '#92400E',
        }}>
          <Sparkles size={13} />
          Oferta fundadores: {LTD_LEFT} plazas LTD restantes · €199 de por vida
          <ArrowRight size={13} />
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 900, letterSpacing: '-0.04em',
          lineHeight: 1.1, marginBottom: '1.25rem', maxWidth: 780, margin: '0 auto 1.25rem',
        }}>
          El club bien llevado —{' '}
          <span style={{
            background: 'linear-gradient(90deg,#6366F1,#EC4899)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>para que te centres<br />en el deporte</span>
        </h1>

        <p style={{ fontSize: 'clamp(1rem,2vw,1.1875rem)', color: '#475569', lineHeight: 1.7, maxWidth: 580, margin: '0 auto 2.5rem' }}>
          Cluberly gestiona socios, cuotas, sesiones, asistencias y comunicaciones.
          Multi-deporte. Sin Excel. Sin papeles. Todo desde tu móvil o escritorio.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/onboarding" style={{
            background: '#6366F1', color: '#fff', padding: '0.875rem 2rem', borderRadius: 12,
            fontSize: '1rem', fontWeight: 800, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            boxShadow: '0 4px 24px #6366F140',
          }}><Zap size={17} /> Prueba gratis 14 días</Link>
          <a href="#precios" style={{
            background: '#fff', color: '#374151', padding: '0.875rem 2rem', borderRadius: 12,
            fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
            border: '1px solid #E2E8F0', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          }}>Ver precios</a>
        </div>
        <p style={{ color: '#94A3B8', fontSize: '0.8rem', marginTop: '1rem' }}>Sin tarjeta de crédito · 14 días gratis · Cancela cuando quieras</p>

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem', marginTop: '3rem' }}>
          {SPORTS.map(sp => (
            <div key={sp.name} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999,
              padding: '0.35rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, color: '#374151',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <span>{sp.icon}</span><span>{sp.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section style={{ padding: '1.5rem', background: '#fff', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>
        <p style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          Clubs deportivos que confían en Cluberly
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '2.5rem' }}>
          {['⚽ E.F. Ciudad de Getafe', '🎾 Club de Tenis Arroyomolinos', '🥋 Akademia Fight', '🏊 Natación Rivas'].map(c => (
            <span key={c} style={{ fontWeight: 700, color: '#64748B', fontSize: '0.875rem' }}>{c}</span>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#fff', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <span style={s.badge}>😩 El problema</span>
          <h2 style={s.h2}>¿Tu club sigue gestionando con Excel y WhatsApp?</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.25rem', marginTop: '2.5rem' }}>
            {[
              { icon: '📋', title: 'Listas interminables', desc: 'Excels que nadie entiende. Versiones desactualizadas. Datos perdidos.' },
              { icon: '💰', title: 'Cobros imposibles', desc: 'Perseguir familias por WhatsApp para cobrar la cuota de octubre.' },
              { icon: '📅', title: 'Asistencia manual', desc: 'Listas en papel, fotos de WhatsApp o simplemente... nada.' },
              { icon: '📧', title: 'Comunicación caótica', desc: 'Grupos de WhatsApp, emails masivos con CCO, respuestas de vuelta.' },
            ].map(p => (
              <div key={p.title} style={{ background: '#FAFAFA', border: '1px solid #E2E8F0', borderRadius: 12, padding: '1.5rem', textAlign: 'left' }}>
                <div style={{ fontSize: 28, marginBottom: '0.5rem' }}>{p.icon}</div>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{p.title}</div>
                <div style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#FAFAFA' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <span style={s.badge}>✨ Solución</span>
          <h2 style={s.h2}>Todo lo que tu club necesita, en una sola app</h2>
          <p style={s.desc}>Diseñado para directivos, coordinadores y entrenadores. No para informáticos.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.25rem', marginTop: '3rem', textAlign: 'left' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                  <f.icon size={22} color={f.color} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>{f.title}</div>
                <div style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>{f.desc}</div>
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
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#fff' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <span style={s.badge}>🚀 Cómo funciona</span>
          <h2 style={s.h2}>En marcha en menos de 30 minutos</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '2rem', marginTop: '3rem' }}>
            {[
              { step: '1', title: 'Crea tu cuenta', desc: 'Regístrate, configura tu club y sube tu logo. Menos de 5 minutos.' },
              { step: '2', title: 'Importa tus socios', desc: 'Desde CSV o añádelos manualmente. Los datos migran en segundos.' },
              { step: '3', title: 'Todo en marcha', desc: 'Sesiones, cuotas, comunicaciones. Tu club digital desde hoy.' },
            ].map(st => (
              <div key={st.step} style={{ textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#EEF2FF', color: '#6366F1', fontSize: '1.25rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>{st.step}</div>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem', fontSize: '1rem' }}>{st.title}</div>
                <div style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.6 }}>{st.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <PricingSection />

      {/* LTD BLOCK */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: 'linear-gradient(135deg,#FEF3C7 0%,#FDE68A30 100%)', borderTop: '1px solid #FDE68A' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚡</div>
          <div style={{ display: 'inline-block', background: '#DC2626', color: '#fff', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.3rem 1rem', borderRadius: 999, marginBottom: '1rem' }}>
            Oferta fundadores — Solo {LTD_LEFT} plazas restantes
          </div>
          <h2 style={{ fontSize: 'clamp(1.5rem,4vw,2.25rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.75rem', color: '#92400E' }}>
            Acceso de por vida al plan Pro<br />por un único pago de <span style={{ color: '#D97706' }}>€199</span>
          </h2>
          <p style={{ color: '#92400E', fontSize: '1rem', lineHeight: 1.7, maxWidth: 540, margin: '0 auto 2rem' }}>
            Sin cuotas mensuales. Sin renovaciones. Pagas una vez y usas Cluberly para siempre, con todas las actualizaciones incluidas. El precio normal es <s>€99/mes</s>.
          </p>
          <div style={{ maxWidth: 400, margin: '0 auto 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#92400E' }}>
              <span>{LTD_TOTAL - LTD_LEFT} de {LTD_TOTAL} plazas ocupadas</span>
              <span>{LTD_LEFT} restantes</span>
            </div>
            <div style={{ height: 10, background: '#FDE68A', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#D97706,#DC2626)', width: `${((LTD_TOTAL - LTD_LEFT) / LTD_TOTAL) * 100}%` }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {['✅ Hasta 200 miembros', '✅ Grupos ilimitados', '✅ Todas las integraciones', '✅ Actualizaciones incluidas', '✅ Sin cuota mensual jamás'].map(b => (
              <span key={b} style={{ fontSize: '0.875rem', fontWeight: 600, color: '#78350F' }}>{b}</span>
            ))}
          </div>
          <Link href="/onboarding?plan=ltd" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: 'linear-gradient(135deg,#D97706,#DC2626)', color: '#fff',
            padding: '1rem 2.5rem', borderRadius: 12, fontSize: '1.0625rem', fontWeight: 800, textDecoration: 'none',
          }}><Zap size={18} /> Conseguir mi plaza LTD — €199</Link>
          <p style={{ color: '#92400E80', fontSize: '0.75rem', marginTop: '0.75rem' }}>Garantía de devolución de 30 días · Pago único sin letra pequeña</p>
        </div>
      </section>

      {/* TRUST */}
      <section style={{ padding: '3rem 1.5rem', background: '#fff', borderTop: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ ...s.h2, fontSize: '1.375rem', marginBottom: '2rem' }}>Por qué los clubs eligen Cluberly</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.5rem' }}>
            {[
              { icon: Shield, color: '#6366F1', title: 'Datos seguros', desc: 'Cifrado end-to-end. Tus datos son tuyos y siempre exportables.' },
              { icon: Clock, color: '#10B981', title: '30 min de setup', desc: 'Empiezas a usar el mismo día. Sin formación, sin IT.' },
              { icon: Star, color: '#F59E0B', title: 'Soporte real', desc: 'Respuesta en menos de 24h. Personas reales, no bots.' },
              { icon: Activity, color: '#EC4899', title: 'Siempre disponible', desc: '99.9% uptime. Tu club no para y Cluberly tampoco.' },
            ].map(t => (
              <div key={t.title} style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${t.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.875rem' }}>
                  <t.icon size={22} color={t.color} />
                </div>
                <div style={{ fontWeight: 700, marginBottom: '0.3rem', fontSize: '0.9375rem' }}>{t.title}</div>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#6366F1,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.875rem' }}>C</div>
          <span style={{ color: '#E2E8F0', fontWeight: 800, fontSize: '1rem' }}>cluberly</span>
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
