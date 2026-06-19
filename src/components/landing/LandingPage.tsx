'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Users, Calendar, CreditCard, BarChart3, Bell, MessageSquare,
  Check, ChevronDown, ChevronUp,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Cluberly — El CRM para clubs deportivos',
  description: 'Gestiona socios, cuotas, sesiones y comunicaciones. Multi-deporte. Sin Excel. Sin papeles.',
}

// ─── Data ────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Users,
    title: 'Ficha de jugador completa',
    desc: 'Historial de pagos, lesiones, sanciones y evaluaciones. Todo en un lugar, sin papeles.',
  },
  {
    icon: Calendar,
    title: 'Sesiones y asistencia',
    desc: 'Registra entrenamientos y partidos. Métricas de asistencia y rendimiento por equipo.',
  },
  {
    icon: CreditCard,
    title: 'Cuotas sin WhatsApp',
    desc: 'Recordatorios automáticos de cobro. Vista clara de quién debe qué. Sin perseguir a nadie.',
  },
  {
    icon: MessageSquare,
    title: 'Comunicaciones masivas',
    desc: 'Emails a equipos completos en segundos. Plantillas, tracking de aperturas, historial.',
  },
  {
    icon: BarChart3,
    title: 'Informes reales',
    desc: 'Evolución de pagos, asistencia por temporada, rendimiento por jugador. Datos que se usan.',
  },
  {
    icon: Bell,
    title: 'Inscripciones online',
    desc: 'Link público de inscripción. Las familias rellenan el formulario y los datos entran solos.',
  },
]

const PLANS = [
  {
    id: 'basic',
    name: 'Básico',
    color: '#6B7280',
    monthlyPrice: 39,
    annualPrice: 390,
    annualMonthly: 33,
    limit: 'Hasta 100 jugadores',
    description: 'Para clubs pequeños que quieren dejar atrás Excel.',
    features: ['Gestión de jugadores', 'Cuotas y pagos', 'Comunicaciones email', 'Formulario de inscripción', 'Soporte email'],
    cta: 'Empezar gratis',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    color: '#EC4899',
    monthlyPrice: 89,
    annualPrice: 890,
    annualMonthly: 74,
    limit: 'Hasta 300 jugadores',
    description: 'Sesiones, contabilidad completa, informes y recordatorios automáticos.',
    popular: true,
    features: ['Todo lo de Básico', 'Sesiones y asistencia', 'Contabilidad completa', 'Informes y estadísticas', 'Recordatorios automáticos de cobro', 'Migración gratis desde Excel', 'Soporte WhatsApp'],
    cta: 'Empezar con Pro',
  },
  {
    id: 'club',
    name: 'Club',
    color: '#F59E0B',
    monthlyPrice: 149,
    annualPrice: 1490,
    annualMonthly: 124,
    limit: 'Hasta 600 jugadores',
    description: 'Para clubs grandes con evaluaciones, lesiones y soporte prioritario.',
    features: ['Todo lo de Pro', 'Evaluaciones de jugadores', 'Módulo de lesiones avanzado', 'Exportación completa', 'Google Sheets sync automático', 'Soporte prioritario'],
    cta: 'Empezar con Club',
    popular: false,
  },
  {
    id: 'personalizado',
    name: 'Personalizado',
    color: '#0F172A',
    monthlyPrice: 0,
    annualPrice: 0,
    annualMonthly: 0,
    limit: 'Federaciones y +600',
    description: 'Federaciones, integraciones a medida, onboarding y SLA.',
    features: ['Todo lo de Club', 'Jugadores ilimitados', 'Integraciones a medida', 'Onboarding presencial', 'SLA garantizado'],
    cta: 'Contactar',
    popular: false,
  },
]

const FAQS = [
  { q: '¿Puedo probarlo antes de pagar?', a: 'Sí. Todos los planes incluyen 14 días de prueba gratuita, sin tarjeta de crédito. Creas tu cuenta, importas tus datos y decides.' },
  { q: '¿Es difícil migrar desde Excel?', a: 'Muy sencillo. Puedes importar miembros desde CSV en 3 clics. Si tienes dudas, nuestro equipo te ayuda en la primera semana sin coste.' },
  { q: '¿Funciona para cualquier deporte?', a: 'Sí. Cluberly es multi-deporte: fútbol, tenis, pádel, baloncesto, natación, artes marciales y más. Cada deporte tiene sus propias métricas configurables.' },
  { q: '¿Puedo cambiar de plan más adelante?', a: 'En cualquier momento. Si creces, actualiza en segundos. Si necesitas bajar también puedes al terminar el período.' },
  { q: '¿Los datos son seguros?', a: 'Sí. Todo está almacenado en Supabase (PostgreSQL) con cifrado en tránsito y en reposo. Los datos de tu club son tuyos y siempre exportables.' },
  { q: '¿Hay descuento para federaciones o grupos de clubs?', a: 'Sí. Si gestionas varios clubs o eres una federación, escríbenos a diego@cluberly.club para opciones de precios personalizadas.' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #E8E4DC' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '1.25rem 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: '1rem',
        }}>
        <span style={{ fontWeight: 600, fontSize: '1rem', color: '#141414', fontFamily: sf }}>{q}</span>
        {open ? <ChevronUp size={18} color="#888" /> : <ChevronDown size={18} color="#888" />}
      </button>
      {open && (
        <div style={{ paddingBottom: '1.25rem', color: '#555', fontSize: '0.9375rem', lineHeight: 1.75 }}>{a}</div>
      )}
    </div>
  )
}

function PricingSection() {
  const [annual, setAnnual] = useState(false)
  return (
    <section id="precios" style={{ padding: 'clamp(4rem,7vw,6rem) 1.5rem', background: '#F8F5EF' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ ...h2style, marginBottom: '0.875rem' }}>Sin letra pequeña.</h2>
          <p style={{ color: '#666', fontSize: '1.0625rem', marginBottom: '2rem' }}>Cancela cuando quieras. Sin contratos.</p>
          <div style={{ display: 'inline-flex', background: '#E8E4DC', borderRadius: 999, padding: 3, gap: 2 }}>
            <button onClick={() => setAnnual(false)} style={{
              padding: '0.45rem 1.25rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.875rem', transition: 'all 0.15s',
              background: !annual ? '#141414' : 'transparent',
              color: !annual ? '#fff' : '#555',
            }}>Mensual</button>
            <button onClick={() => setAnnual(true)} style={{
              padding: '0.45rem 1.25rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
              background: annual ? '#141414' : 'transparent',
              color: annual ? '#fff' : '#555',
            }}>
              Anual
              <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999 }}>−17%</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {PLANS.map(plan => {
            const isElite = plan.id === 'personalizado'
            return (
              <div key={plan.id} style={{
                background: plan.popular ? '#141414' : '#FFFFFF',
                borderRadius: 16, padding: '1.75rem',
                position: 'relative', display: 'flex', flexDirection: 'column',
                border: plan.popular ? 'none' : '1px solid #E2DDD6',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: '#EC4899', color: '#fff', fontSize: '0.7rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 14px', borderRadius: 999,
                  }}>Más popular</div>
                )}
                <div style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: 4, color: plan.popular ? '#fff' : '#141414' }}>{plan.name}</div>
                <div style={{ color: plan.popular ? '#aaa' : '#888', fontSize: '0.8125rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>{plan.description}</div>
                <div style={{ marginBottom: '1.25rem' }}>
                  {isElite ? (
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#141414' }}>Personalizado</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: plan.popular ? '#fff' : '#141414', fontFamily: sf }}>€{annual ? plan.annualMonthly : plan.monthlyPrice}</span>
                        <span style={{ color: plan.popular ? '#999' : '#888', fontSize: '0.875rem' }}>/mes</span>
                      </div>
                      {annual && <div style={{ color: plan.popular ? '#aaa' : '#888', fontSize: '0.75rem', marginTop: 2 }}>€{plan.annualPrice}/año · facturado anualmente</div>}
                    </>
                  )}
                  <div style={{ color: plan.popular ? '#bbb' : '#888', fontSize: '0.75rem', marginTop: 4 }}>{plan.limit}</div>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', alignItems: 'flex-start' }}>
                      <Check size={14} style={{ color: plan.popular ? '#EC4899' : '#16a34a', flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: plan.popular ? '#ddd' : '#444' }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href={isElite ? 'mailto:diego@cluberly.club?subject=Plan%20Personalizado' : `/onboarding?plan=${plan.id}`} style={{
                  display: 'block', padding: '0.8rem 1rem', borderRadius: 10, textAlign: 'center',
                  fontWeight: 700, fontSize: '0.9375rem', textDecoration: 'none',
                  background: plan.popular ? '#EC4899' : '#141414',
                  color: '#fff',
                }}>{plan.cta}</Link>
              </div>
            )
          })}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#999', fontSize: '0.8125rem' }}>
          Sin tarjeta de crédito en el periodo de prueba · Cancela cuando quieras · Pago seguro vía Stripe
        </p>
      </div>
    </section>
  )
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const sf = '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif'
const serif = 'Georgia, "Times New Roman", serif'
const bg = '#F8F5EF'  // warm off-white
const dark = '#141414'
const pink = '#EC4899'  // brand pink

const h2style: React.CSSProperties = {
  fontFamily: serif,
  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
  fontWeight: 700,
  color: dark,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ fontFamily: sf, color: dark, overflowX: 'hidden' }}>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .nav-link:hover { color: #141414 !important; }
        .hero-cta:hover { background: #fff !important; color: #141414 !important; }
        .feature-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.08) !important; transform: translateY(-2px); }
        .feature-card { transition: transform 0.2s, box-shadow 0.2s; }

        /* Grain texture for hero */
        .grain::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.08'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 200px;
          pointer-events: none;
          z-index: 1;
        }
        @media (max-width: 640px) {
          .hero-h1 { font-size: 2.5rem !important; }
          .screens-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .sticky-mob { display: flex !important; }
        }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(248,245,239,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8E4DC',
        padding: '0 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: pink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 46 46" fill="none"><circle cx="23" cy="23" r="17" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none"/><path d="M23 6 C12.5 6 6 14 6 23 C6 32 12.5 40 23 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/><circle cx="23" cy="23" r="4" fill="white" opacity="0.9"/></svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.0625rem', letterSpacing: '-0.03em', color: dark }}>cluberly</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="#precios" className="nav-link" style={{ color: '#666', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}>Precios</a>
          <Link href="/login" className="nav-link" style={{ color: '#666', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none', transition: 'color 0.15s' }}>Iniciar sesión</Link>
          <Link href="/onboarding" style={{
            background: dark, color: '#fff', padding: '0.45rem 1.125rem',
            borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
          }}>Prueba gratis</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      {/* AI IMAGE: Replace the SVG below with a generated image. Midjourney prompt:
          "Middle-aged football club administrator in a suit, floating above a pink grass
          football pitch, an endless Excel spreadsheet falling off his wooden floating desk
          with papers drawing the field lines below, contrasted with a young modern person
          at a clean desk holding a glowing tablet and phone. Surrealist editorial, aerial
          view, dramatic lighting, dark rose sky. --ar 16:9 --style raw --v 6" */}
      <section className="grain" style={{
        minHeight: '100vh',
        background: 'linear-gradient(175deg, #0d0009 0%, #1a0014 40%, #2d0020 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 1.5rem 8vh',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* SVG Illustration: old chaos vs modern order */}
        <svg viewBox="0 0 1400 700" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.82 }}>
          <defs>
            <radialGradient id="glow-c" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EC4899" stopOpacity="0.22"/>
              <stop offset="100%" stopColor="#EC4899" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="glow-l" cx="20%" cy="60%" r="40%">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.14"/>
              <stop offset="100%" stopColor="#d97706" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="glow-r" cx="80%" cy="50%" r="40%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="fade-b" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a0014" stopOpacity="0"/>
              <stop offset="100%" stopColor="#1a0014" stopOpacity="0.92"/>
            </linearGradient>
            <filter id="gbl"><feGaussianBlur stdDeviation="4"/></filter>
          </defs>
          {/* Ambient light */}
          <rect width="1400" height="700" fill="url(#glow-c)"/>
          <rect width="1400" height="700" fill="url(#glow-l)"/>
          <rect width="1400" height="700" fill="url(#glow-r)"/>

          {/* ── FOOTBALL PITCH ── */}
          <rect x="280" y="140" width="840" height="420" rx="4" fill="#EC4899" fillOpacity="0.035" stroke="#EC4899" strokeWidth="1.5" strokeOpacity="0.45"/>
          <line x1="700" y1="140" x2="700" y2="560" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.4"/>
          <circle cx="700" cy="350" r="65" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.4"/>
          <circle cx="700" cy="350" r="4" fill="#EC4899" fillOpacity="0.55"/>
          <rect x="280" y="245" width="130" height="210" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.35"/>
          <rect x="280" y="295" width="55" height="110" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.25"/>
          <circle cx="368" cy="350" r="3" fill="#EC4899" fillOpacity="0.45"/>
          <path d="M 410 308 A 52 52 0 0 1 410 392" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.3"/>
          <rect x="990" y="245" width="130" height="210" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.35"/>
          <rect x="1065" y="295" width="55" height="110" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.25"/>
          <circle cx="1032" cy="350" r="3" fill="#EC4899" fillOpacity="0.45"/>
          <path d="M 990 308 A 52 52 0 0 0 990 392" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.3"/>
          <path d="M 280 158 A 18 18 0 0 1 298 140" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.28"/>
          <path d="M 1102 140 A 18 18 0 0 1 1120 158" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.28"/>
          <path d="M 1120 542 A 18 18 0 0 1 1102 560" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.28"/>
          <path d="M 298 560 A 18 18 0 0 1 280 542" fill="none" stroke="#EC4899" strokeWidth="1" strokeOpacity="0.28"/>

          {/* ── LEFT: OLD ADMIN ── */}
          {/* Floating wooden desk */}
          <rect x="38" y="312" width="200" height="11" rx="3" fill="#8B5E3C" fillOpacity="0.75"/>
          <rect x="50" y="323" width="7" height="48" rx="2" fill="#6B4226" fillOpacity="0.55"/>
          <rect x="230" y="323" width="7" height="48" rx="2" fill="#6B4226" fillOpacity="0.55"/>
          <ellipse cx="138" cy="382" rx="108" ry="9" fill="#000" fillOpacity="0.18" filter="url(#gbl)"/>
          {/* Paper stack on desk */}
          <rect x="55" y="287" width="84" height="26" rx="1" fill="#fff" fillOpacity="0.82" transform="rotate(-5,97,300)"/>
          <line x1="60" y1="293" x2="131" y2="291" stroke="#10b981" strokeWidth="0.8" strokeOpacity="0.55" transform="rotate(-5,97,300)"/>
          <line x1="60" y1="300" x2="131" y2="298" stroke="#10b981" strokeWidth="0.8" strokeOpacity="0.55" transform="rotate(-5,97,300)"/>
          <line x1="60" y1="307" x2="131" y2="305" stroke="#10b981" strokeWidth="0.8" strokeOpacity="0.55" transform="rotate(-5,97,300)"/>
          <line x1="85" y1="286" x2="83" y2="313" stroke="#10b981" strokeWidth="0.8" strokeOpacity="0.45" transform="rotate(-5,97,300)"/>
          <line x1="106" y1="285" x2="104" y2="312" stroke="#10b981" strokeWidth="0.8" strokeOpacity="0.45" transform="rotate(-5,97,300)"/>
          {/* Flying paper 1 */}
          <rect x="168" y="202" width="70" height="50" rx="1" fill="#fff" fillOpacity="0.77" transform="rotate(24,203,227)"/>
          <line x1="173" y1="211" x2="232" y2="209" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.5" transform="rotate(24,203,227)"/>
          <line x1="173" y1="220" x2="232" y2="218" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.5" transform="rotate(24,203,227)"/>
          <line x1="173" y1="229" x2="232" y2="227" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.5" transform="rotate(24,203,227)"/>
          <line x1="198" y1="204" x2="196" y2="250" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.4" transform="rotate(24,203,227)"/>
          <line x1="214" y1="203" x2="212" y2="249" stroke="#10b981" strokeWidth="0.75" strokeOpacity="0.4" transform="rotate(24,203,227)"/>
          {/* Flying paper 2 */}
          <rect x="99" y="162" width="58" height="44" rx="1" fill="#fff" fillOpacity="0.72" transform="rotate(-16,128,184)"/>
          <line x1="104" y1="172" x2="151" y2="170" stroke="#10b981" strokeWidth="0.7" strokeOpacity="0.48" transform="rotate(-16,128,184)"/>
          <line x1="104" y1="180" x2="151" y2="178" stroke="#10b981" strokeWidth="0.7" strokeOpacity="0.48" transform="rotate(-16,128,184)"/>
          <line x1="104" y1="188" x2="151" y2="186" stroke="#10b981" strokeWidth="0.7" strokeOpacity="0.48" transform="rotate(-16,128,184)"/>
          {/* Flying paper 3 — lines turning pink as it flies toward pitch */}
          <rect x="218" y="282" width="74" height="54" rx="1" fill="#fff" fillOpacity="0.68" transform="rotate(10,255,309)"/>
          <line x1="223" y1="292" x2="286" y2="290" stroke="#EC4899" strokeWidth="0.85" strokeOpacity="0.6" transform="rotate(10,255,309)"/>
          <line x1="223" y1="302" x2="286" y2="300" stroke="#EC4899" strokeWidth="0.85" strokeOpacity="0.6" transform="rotate(10,255,309)"/>
          <line x1="223" y1="312" x2="286" y2="310" stroke="#EC4899" strokeWidth="0.85" strokeOpacity="0.6" transform="rotate(10,255,309)"/>
          <line x1="248" y1="284" x2="246" y2="334" stroke="#EC4899" strokeWidth="0.85" strokeOpacity="0.5" transform="rotate(10,255,309)"/>
          <line x1="267" y1="283" x2="265" y2="333" stroke="#EC4899" strokeWidth="0.85" strokeOpacity="0.5" transform="rotate(10,255,309)"/>
          {/* Small paper */}
          <rect x="53" y="232" width="44" height="34" rx="1" fill="#fff" fillOpacity="0.62" transform="rotate(-28,75,249)"/>
          <line x1="58" y1="240" x2="93" y2="238" stroke="#10b981" strokeWidth="0.7" strokeOpacity="0.48" transform="rotate(-28,75,249)"/>
          <line x1="58" y1="248" x2="93" y2="246" stroke="#10b981" strokeWidth="0.7" strokeOpacity="0.48" transform="rotate(-28,75,249)"/>
          {/* Old admin figure */}
          <circle cx="138" cy="242" r="22" fill="#C8956C" fillOpacity="0.88"/>
          <rect x="128" y="239" width="10" height="7" rx="3" fill="none" stroke="#333" strokeWidth="1.4" strokeOpacity="0.65"/>
          <rect x="141" y="239" width="10" height="7" rx="3" fill="none" stroke="#333" strokeWidth="1.4" strokeOpacity="0.65"/>
          <line x1="138" y1="242" x2="141" y2="242" stroke="#333" strokeWidth="1.4" strokeOpacity="0.65"/>
          <path d="M 116 264 Q 103 297 106 322 L 170 322 Q 173 297 160 264 Z" fill="#2d3748" fillOpacity="0.82"/>
          <polygon points="138,270 134,312 138,320 142,312" fill="#DC2626" fillOpacity="0.65"/>
          <path d="M 116 282 Q 88 287 68 307" stroke="#C8956C" strokeWidth="10" strokeLinecap="round" fill="none" strokeOpacity="0.88"/>
          <path d="M 160 280 Q 184 284 204 297" stroke="#C8956C" strokeWidth="10" strokeLinecap="round" fill="none" strokeOpacity="0.88"/>
          <line x1="116" y1="224" x2="108" y2="212" stroke="#d97706" strokeWidth="1.5" strokeOpacity="0.45"/>
          <line x1="160" y1="220" x2="170" y2="208" stroke="#d97706" strokeWidth="1.5" strokeOpacity="0.45"/>
          <line x1="138" y1="220" x2="138" y2="208" stroke="#d97706" strokeWidth="1.5" strokeOpacity="0.45"/>

          {/* ── RIGHT: MODERN PERSON ── */}
          {/* Clean desk */}
          <rect x="1148" y="312" width="208" height="9" rx="3" fill="#e2e8f0" fillOpacity="0.28"/>
          <rect x="1162" y="321" width="6" height="44" rx="2" fill="#cbd5e1" fillOpacity="0.18"/>
          <rect x="1344" y="321" width="6" height="44" rx="2" fill="#cbd5e1" fillOpacity="0.18"/>
          <ellipse cx="1252" cy="328" rx="104" ry="10" fill="#3b82f6" fillOpacity="0.06" filter="url(#gbl)"/>
          {/* Tablet */}
          <rect x="1202" y="222" width="94" height="84" rx="6" fill="#0f172a" fillOpacity="0.88"/>
          <rect x="1206" y="226" width="86" height="76" rx="4" fill="#1e293b" fillOpacity="0.92"/>
          <rect x="1206" y="226" width="86" height="13" rx="2" fill="#EC4899" fillOpacity="0.65"/>
          <rect x="1210" y="244" width="37" height="7" rx="1" fill="#e2e8f0" fillOpacity="0.2"/>
          <rect x="1210" y="255" width="37" height="7" rx="1" fill="#e2e8f0" fillOpacity="0.15"/>
          <rect x="1210" y="264" width="37" height="7" rx="1" fill="#e2e8f0" fillOpacity="0.15"/>
          <rect x="1252" y="244" width="35" height="54" rx="2" fill="#EC4899" fillOpacity="0.1"/>
          <rect x="1255" y="248" width="27" height="4" rx="1" fill="#EC4899" fillOpacity="0.38"/>
          <rect x="1255" y="256" width="20" height="3" rx="1" fill="#e2e8f0" fillOpacity="0.18"/>
          <rect x="1255" y="263" width="23" height="3" rx="1" fill="#e2e8f0" fillOpacity="0.18"/>
          <circle cx="1249" cy="297" r="4" fill="#334155" fillOpacity="0.75"/>
          <ellipse cx="1249" cy="262" rx="43" ry="38" fill="#3b82f6" fillOpacity="0.07" filter="url(#gbl)"/>
          {/* Phone */}
          <rect x="1312" y="254" width="41" height="66" rx="5" fill="#0f172a" fillOpacity="0.83"/>
          <rect x="1315" y="258" width="35" height="58" rx="3" fill="#1e293b" fillOpacity="0.92"/>
          <rect x="1315" y="258" width="35" height="13" rx="2" fill="#EC4899" fillOpacity="0.52"/>
          <rect x="1318" y="276" x2="1345" y2="276" stroke="none"/>
          <rect x="1318" y="276" width="28" height="4" rx="1" fill="#e2e8f0" fillOpacity="0.18"/>
          <rect x="1318" y="284" width="22" height="3" rx="1" fill="#e2e8f0" fillOpacity="0.14"/>
          <circle cx="1332" cy="314" r="3" fill="#334155" fillOpacity="0.75"/>
          <ellipse cx="1332" cy="287" rx="23" ry="32" fill="#3b82f6" fillOpacity="0.07" filter="url(#gbl)"/>
          {/* Modern figure */}
          <circle cx="1252" cy="178" r="20" fill="#8B6A5C" fillOpacity="0.88"/>
          <path d="M 1232 170 Q 1237 158 1252 158 Q 1267 158 1272 170 Q 1267 162 1252 162 Q 1237 162 1232 170 Z" fill="#2d1b0e" fillOpacity="0.78"/>
          <path d="M 1234 198 Q 1220 232 1224 272 L 1280 272 Q 1284 232 1270 198 Z" fill="#334155" fillOpacity="0.78"/>
          <path d="M 1234 216 Q 1212 227 1200 254" stroke="#8B6A5C" strokeWidth="9" strokeLinecap="round" fill="none" strokeOpacity="0.88"/>
          <circle cx="1199" cy="256" r="6" fill="#8B6A5C" fillOpacity="0.82"/>
          <path d="M 1270 222 Q 1297 232 1314 257" stroke="#8B6A5C" strokeWidth="9" strokeLinecap="round" fill="none" strokeOpacity="0.88"/>

          {/* Labels */}
          <text x="138" y="590" textAnchor="middle" fill="#d97706" fillOpacity="0.35" fontSize="10" fontFamily="Georgia,serif" letterSpacing="4">ANTES</text>
          <text x="1252" y="590" textAnchor="middle" fill="#3b82f6" fillOpacity="0.35" fontSize="10" fontFamily="Georgia,serif" letterSpacing="4">AHORA</text>

          {/* Bottom fade */}
          <rect x="0" y="420" width="1400" height="280" fill="url(#fade-b)"/>
        </svg>

        {/* Radial pink glow from center */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '80vw', height: '60vh', background: 'radial-gradient(ellipse, rgba(236,72,153,0.18) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 860 }}>
          <div style={{ display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '0.35rem 1rem', marginBottom: '2rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            14 días gratis · Sin tarjeta de crédito
          </div>
          <h1 className="hero-h1" style={{
            fontFamily: serif,
            fontSize: 'clamp(3rem, 6vw, 5rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            marginBottom: '1.5rem',
          }}>
            Tu club deportivo,<br />gestionado con calma.
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: 'clamp(1rem, 2vw, 1.1875rem)',
            lineHeight: 1.7,
            maxWidth: 520,
            margin: '0 auto 2.5rem',
          }}>
            Cuotas, asistencia, comunicaciones y documentos. Todo en un sitio.
            Ya activo con 1.022 jugadores en Madrid.
          </p>
          <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/onboarding" className="hero-cta" style={{
              background: '#fff', color: dark,
              padding: '0.9rem 2.25rem', borderRadius: 10,
              fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
              transition: 'all 0.15s',
            }}>Prueba gratis 14 días</Link>
            <a href="#app" style={{
              background: 'transparent', color: 'rgba(255,255,255,0.8)',
              padding: '0.9rem 2.25rem', borderRadius: 10,
              fontSize: '1rem', fontWeight: 600, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>Ver la app</a>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
            Activo en E.F. Ciudad de Getafe · 1.022 jugadores · 12 meses
          </p>
        </div>

        {/* Arrow down */}
        <div style={{ position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', zIndex: 2 }}>
          ↓
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: bg, padding: '3.5rem 1.5rem', borderBottom: `1px solid #E8E4DC` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', textAlign: 'center' }}>
          {[
            { value: '1.022', label: 'Jugadores activos en piloto' },
            { value: '12', label: 'Meses en producción real' },
            { value: '80%', label: 'Menos tiempo admin' },
            { value: '30 min', label: 'Setup desde cero' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: serif, fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 700, color: dark, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: '#888', fontSize: '0.875rem', marginTop: '0.5rem', lineHeight: 1.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MANIFEST (dark) ── */}
      <section style={{ background: dark, padding: 'clamp(4rem,8vw,7rem) 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2rem' }}>El problema</p>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(1.75rem, 4vw, 3.25rem)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25, letterSpacing: '-0.02em', marginBottom: '1.75rem' }}>
            Gestionas 500 jugadores con<br />un Excel y grupos de WhatsApp.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.0625rem', lineHeight: 1.75, maxWidth: 560, margin: '0 auto 3rem' }}>
            Cuotas sin cobrar. Emails sin abrir. Hojas de cálculo que nadie entiende.
            Lo de siempre. Hay algo mejor.
          </p>
          <Link href="/onboarding" style={{
            display: 'inline-block',
            background: '#fff', color: dark,
            padding: '0.875rem 2.25rem', borderRadius: 10,
            fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
          }}>Conocer Cluberly</Link>
        </div>
      </section>

      {/* ── APP SCREENSHOTS ── */}
      <section id="app" style={{ background: bg, padding: 'clamp(4rem,8vw,7rem) 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ color: '#888', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem' }}>La app</p>
            <h2 style={h2style}>Datos reales. Decisiones rápidas.</h2>
          </div>

          {/* Screenshots floating on pink bg */}
          <div style={{ background: `${pink}`, borderRadius: 24, padding: 'clamp(1.5rem,4vw,3rem)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="screens-grid">

            {/* Card 1: Jugadores */}
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={14} color={pink} />
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: dark }}>Jugadores · Benjamín A</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#888', background: '#F0EDE8', padding: '2px 8px', borderRadius: 999 }}>22 jugadores</span>
              </div>
              <div style={{ padding: '0.875rem 1.125rem' }}>
                {[
                  { name: 'Carlos Martínez', status: 'Al día', statusColor: '#16a34a', bg: '#f0fdf4', team: 'Benjamín A' },
                  { name: 'Ana García López', status: 'Pendiente', statusColor: '#d97706', bg: '#fffbeb', team: 'Benjamín A' },
                  { name: 'Luis Rodríguez', status: 'Al día', statusColor: '#16a34a', bg: '#f0fdf4', team: 'Benjamín A' },
                  { name: 'Sofía Pérez Vega', status: 'Sin cuota', statusColor: '#6b7280', bg: '#f9fafb', team: 'Benjamín A' },
                  { name: 'Marcos Torres', status: 'Con deuda', statusColor: '#dc2626', bg: '#fef2f2', team: 'Benjamín A' },
                ].map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: i < 4 ? '1px solid #F5F3EF' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: pink + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: pink, flexShrink: 0 }}>
                        {p.name.charAt(0)}{p.name.split(' ')[1]?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: dark }}>{p.name}</div>
                        <div style={{ fontSize: '0.65rem', color: '#aaa' }}>{p.team}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: p.statusColor, background: p.bg, padding: '2px 8px', borderRadius: 999 }}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Cuotas */}
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid #F0EDE8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={14} color='#EC4899' />
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: dark }}>Cuotas · Temporada 26/27</span>
              </div>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, borderBottom: '1px solid #F0EDE8' }}>
                {[
                  { label: 'Recaudado', value: '€42.780', color: '#16a34a' },
                  { label: 'Pendiente', value: '€8.430', color: '#d97706' },
                  { label: 'Deudores', value: '47', color: '#dc2626' },
                ].map((k, i) => (
                  <div key={i} style={{ padding: '0.875rem', textAlign: 'center', borderRight: i < 2 ? '1px solid #F0EDE8' : 'none' }}>
                    <div style={{ fontSize: '1.0625rem', fontWeight: 800, color: k.color, letterSpacing: '-0.03em' }}>{k.value}</div>
                    <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {/* Recent payments */}
              <div style={{ padding: '0.875rem 1.125rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Últimos pagos</div>
                {[
                  { name: 'María López', amount: '€60', date: '19 jun', status: 'Cobrado', statusColor: '#16a34a' },
                  { name: 'Pedro Sanz', amount: '€120', date: '18 jun', status: 'Cobrado', statusColor: '#16a34a' },
                  { name: 'Rosa Iglesias', amount: '€60', date: '17 jun', status: '1er plazo', statusColor: '#2563eb' },
                  { name: 'Felipe Mora', amount: '€60', date: '16 jun', status: 'Cobrado', statusColor: '#16a34a' },
                ].map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0', borderBottom: i < 3 ? '1px solid #F5F3EF' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: dark }}>{p.name}</div>
                      <div style={{ fontSize: '0.65rem', color: '#aaa' }}>{p.date}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: dark }}>{p.amount}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: p.statusColor, background: p.statusColor + '15', padding: '2px 8px', borderRadius: 999 }}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ background: '#FFFFFF', padding: 'clamp(4rem,8vw,7rem) 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ maxWidth: 560, marginBottom: '3.5rem' }}>
            <p style={{ color: '#888', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem' }}>Qué incluye</p>
            <h2 style={h2style}>Todo lo que necesita un club real.</h2>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0' }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature-card" style={{
                padding: '2rem',
                borderTop: '1px solid #EDE8E0',
                borderLeft: (i % 3 === 0) ? 'none' : '1px solid #EDE8E0',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: pink + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                  <f.icon size={20} color={pink} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: dark }}>{f.title}</div>
                <div style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL / CASE STUDY ── */}
      <section style={{ background: bg, padding: 'clamp(4rem,8vw,7rem) 1.5rem' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 'clamp(2rem,5vw,3.5rem)', border: '1px solid #E8E4DC' }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontFamily: serif, fontSize: '3rem', color: '#E8E4DC', lineHeight: 0.8, marginBottom: '1.25rem' }}>"</div>
                <p style={{ fontFamily: serif, fontSize: 'clamp(1.0625rem, 2vw, 1.25rem)', lineHeight: 1.75, color: '#1a1a1a', fontWeight: 400, fontStyle: 'italic', marginBottom: '1.75rem' }}>
                  Llevaba años con 900 jugadores en Excel, papel y grupos de WhatsApp. Desde Cluberly,
                  el tiempo de administración bajó a la mitad y los impagos prácticamente desaparecieron.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: pink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>D</span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: dark, fontSize: '0.9375rem' }}>Diego Bravo</div>
                    <div style={{ color: '#888', fontSize: '0.8125rem' }}>E.F. Ciudad de Getafe · Fútbol base</div>
                  </div>
                </div>
              </div>
              {/* Stats column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 160 }}>
                {[
                  { value: '1.022', label: 'Jugadores activos' },
                  { value: '12', label: 'Meses en producción' },
                  { value: '45', label: 'Entrenadores' },
                ].map(s => (
                  <div key={s.label} style={{ background: bg, borderRadius: 12, padding: '1rem 1.25rem', textAlign: 'center' }}>
                    <div style={{ fontFamily: serif, fontSize: '1.75rem', fontWeight: 700, color: dark, letterSpacing: '-0.03em' }}>{s.value}</div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: '#FFFFFF', padding: 'clamp(4rem,8vw,7rem) 1.5rem', borderTop: '1px solid #E8E4DC' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: '#888', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem' }}>Cómo funciona</p>
          <h2 style={{ ...h2style, marginBottom: '3rem' }}>En marcha en menos de 30 minutos.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', textAlign: 'left' }}>
            {[
              { step: '01', title: 'Crea tu cuenta', desc: 'Regístrate, ponle nombre a tu club y sube tu logo. Menos de 5 minutos sin tarjeta.' },
              { step: '02', title: 'Importa tus datos', desc: 'Sube tu Excel o añade jugadores manualmente. Los datos entran en segundos.' },
              { step: '03', title: 'Todo en marcha', desc: 'Sesiones, cuotas, comunicaciones. Tu club digital desde hoy.' },
            ].map(st => (
              <div key={st.step}>
                <div style={{ fontFamily: serif, fontSize: '3rem', fontWeight: 700, color: '#E8E4DC', lineHeight: 1, marginBottom: '1rem' }}>{st.step}</div>
                <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: '0.5rem', color: dark }}>{st.title}</div>
                <div style={{ color: '#666', fontSize: '0.9rem', lineHeight: 1.7 }}>{st.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <PricingSection />

      {/* ── FAQ ── */}
      <section style={{ background: '#FFFFFF', padding: 'clamp(4rem,7vw,6rem) 1.5rem', borderTop: '1px solid #E8E4DC' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <p style={{ color: '#888', fontSize: '0.8125rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem' }}>Preguntas frecuentes</p>
            <h2 style={h2style}>Todo lo que necesitas saber.</h2>
          </div>
          <div>
            {FAQS.map(faq => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ background: dark, padding: 'clamp(5rem,10vw,8rem) 1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(2rem,4vw,3.25rem)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
            Tu club merece<br />una gestión profesional.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.0625rem', lineHeight: 1.75, marginBottom: '2.5rem' }}>
            14 días gratis. Sin tarjeta de crédito. Cancela cuando quieras.
          </p>
          <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/onboarding" style={{
              background: '#fff', color: dark,
              padding: '0.9rem 2.25rem', borderRadius: 10,
              fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
            }}>Prueba gratis ahora</Link>
            <a href="mailto:diego@cluberly.club" style={{
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              padding: '0.9rem 2.25rem', borderRadius: 10,
              fontSize: '1rem', fontWeight: 600, textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>Hablar con el equipo</a>
          </div>
        </div>
      </section>

      {/* ── STICKY MOBILE CTA ── */}
      <div className="sticky-mob" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
        padding: '0.75rem 1rem', background: 'rgba(20,20,20,0.98)',
        backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.1)',
        gap: '0.625rem', alignItems: 'center',
      }}>
        <Link href="/onboarding" style={{
          flex: 1, textAlign: 'center',
          background: '#fff', color: dark,
          padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.9375rem', fontWeight: 700,
          textDecoration: 'none',
        }}>Prueba gratis 14 días →</Link>
        <a href="tel:+34665676341" style={{
          flexShrink: 0, background: 'rgba(255,255,255,0.08)', color: '#ccc',
          padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.8125rem', fontWeight: 700,
          textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
        }}>📞</a>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '2.5rem 1.5rem', background: dark, borderTop: '1px solid rgba(255,255,255,0.06)', color: '#555', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', marginBottom: '1.5rem' }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: pink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 46 46" fill="none"><circle cx="23" cy="23" r="17" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none"/><path d="M23 6 C12.5 6 6 14 6 23 C6 32 12.5 40 23 40" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/><circle cx="23" cy="23" r="4" fill="white" opacity="0.9"/></svg>
          </div>
          <span style={{ color: '#888', fontWeight: 800, fontSize: '0.9375rem', letterSpacing: '-0.02em' }}>cluberly</span>
        </div>
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <a href="#precios" style={{ color: '#555', textDecoration: 'none' }}>Precios</a>
          <Link href="/login" style={{ color: '#555', textDecoration: 'none' }}>Iniciar sesión</Link>
          <Link href="/onboarding" style={{ color: '#555', textDecoration: 'none' }}>Registro</Link>
          <a href="mailto:diego@cluberly.club" style={{ color: '#555', textDecoration: 'none' }}>Contacto</a>
          <Link href="/privacy" style={{ color: '#555', textDecoration: 'none' }}>Privacidad</Link>
          <Link href="/terms" style={{ color: '#555', textDecoration: 'none' }}>Términos</Link>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#444' }}>
          © {new Date().getFullYear()} Cluberly · Hecho en España ·{' '}
          <a href="mailto:diego@cluberly.club" style={{ color: '#666', textDecoration: 'none' }}>diego@cluberly.club</a>
        </p>
      </footer>
    </div>
  )
}
