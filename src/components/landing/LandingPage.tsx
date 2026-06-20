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
        {/* SVG Illustration: old chaos vs modern order — realistic illustration */}
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
            <linearGradient id="parch" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#A07038"/>
              <stop offset="12%" stopColor="#E8D5A3"/>
              <stop offset="88%" stopColor="#DCC890"/>
              <stop offset="100%" stopColor="#987030"/>
            </linearGradient>
            <filter id="gbl"><feGaussianBlur stdDeviation="4"/></filter>
            <filter id="shd"><feDropShadow dx="2" dy="4" stdDeviation="7" floodColor="#000" floodOpacity="0.28"/></filter>
            <filter id="sshd"><feDropShadow dx="1" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.22"/></filter>
          </defs>
          <style>{`
            @keyframes dp { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
            .dl1 { stroke-dasharray: 722; stroke-dashoffset: 722; animation: dp 2s ease-out 0.8s forwards; }
            .dl2 { stroke-dasharray: 145; stroke-dashoffset: 145; animation: dp 0.7s ease-out 2.9s forwards; }
            .dl3 { stroke-dasharray: 190; stroke-dashoffset: 190; animation: dp 1s ease-out 3.7s forwards; }
            .dl5 { stroke-dasharray: 290; stroke-dashoffset: 290; animation: dp 0.9s ease-out 4.8s forwards; }
            .dl6 { stroke-dasharray: 290; stroke-dashoffset: 290; animation: dp 0.9s ease-out 5.4s forwards; }
            .dl7 { stroke-dasharray: 155; stroke-dashoffset: 155; animation: dp 0.6s ease-out 6.1s forwards; }
            .dl8 { stroke-dasharray: 155; stroke-dashoffset: 155; animation: dp 0.6s ease-out 6.6s forwards; }
          `}</style>

          {/* Ambient */}
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

          {/* ════════════════════════════════════════════════ */}
          {/* LEFT — OLD ADMIN + PARCHMENT SCROLLS           */}
          {/* ════════════════════════════════════════════════ */}

          {/* Wooden desk */}
          <rect x="28" y="488" width="272" height="13" rx="4" fill="#7C4A1E" fillOpacity="0.85"/>
          <rect x="34" y="483" width="262" height="9" rx="2" fill="#A0622A" fillOpacity="0.45"/>
          <rect x="40" y="501" width="9" height="55" rx="3" fill="#6B3D18" fillOpacity="0.7"/>
          <rect x="278" y="501" width="9" height="55" rx="3" fill="#6B3D18" fillOpacity="0.7"/>
          <ellipse cx="157" cy="564" rx="126" ry="10" fill="#000" fillOpacity="0.18" filter="url(#gbl)"/>

          {/* SCROLL 1 — large, on desk */}
          <g transform="rotate(-7, 93, 456)" filter="url(#sshd)">
            <rect x="53" y="384" width="80" height="118" fill="url(#parch)"/>
            <ellipse cx="93" cy="384" rx="40" ry="9" fill="#7B4A1C"/>
            <ellipse cx="93" cy="384" rx="33" ry="6" fill="#B07A42" fillOpacity="0.55"/>
            <ellipse cx="93" cy="502" rx="40" ry="9" fill="#5A3010"/>
            <ellipse cx="93" cy="502" rx="33" ry="6" fill="#B07A42" fillOpacity="0.45"/>
            <line x1="67" y1="408" x2="119" y2="408" stroke="#4A2808" strokeWidth="1.1" strokeOpacity="0.5"/>
            <line x1="67" y1="420" x2="119" y2="420" stroke="#4A2808" strokeWidth="1.1" strokeOpacity="0.5"/>
            <line x1="67" y1="432" x2="107" y2="432" stroke="#4A2808" strokeWidth="1.1" strokeOpacity="0.45"/>
            <line x1="67" y1="444" x2="119" y2="444" stroke="#4A2808" strokeWidth="1.1" strokeOpacity="0.5"/>
            <line x1="67" y1="456" x2="103" y2="456" stroke="#4A2808" strokeWidth="1.1" strokeOpacity="0.4"/>
            <line x1="67" y1="468" x2="119" y2="468" stroke="#4A2808" strokeWidth="1.1" strokeOpacity="0.48"/>
            <line x1="67" y1="480" x2="112" y2="480" stroke="#4A2808" strokeWidth="1.1" strokeOpacity="0.4"/>
            <circle cx="93" cy="444" r="12" fill="#8B1515" fillOpacity="0.52"/>
            <circle cx="93" cy="444" r="8.5" fill="#A52020" fillOpacity="0.42"/>
            <text x="93" y="448" textAnchor="middle" fontSize="9" fill="#FFD700" fillOpacity="0.65" fontFamily="serif">★</text>
          </g>

          {/* SCROLL 2 — flying upper right */}
          <g transform="rotate(31, 234, 256)" filter="url(#sshd)">
            <rect x="196" y="208" width="76" height="96" fill="url(#parch)"/>
            <ellipse cx="234" cy="208" rx="38" ry="8.5" fill="#7B4A1C"/>
            <ellipse cx="234" cy="208" rx="31" ry="5.5" fill="#B07A42" fillOpacity="0.55"/>
            <ellipse cx="234" cy="304" rx="38" ry="8.5" fill="#5A3010"/>
            <ellipse cx="234" cy="304" rx="31" ry="5.5" fill="#B07A42" fillOpacity="0.45"/>
            <line x1="210" y1="228" x2="258" y2="228" stroke="#4A2808" strokeWidth="1" strokeOpacity="0.5"/>
            <line x1="210" y1="240" x2="258" y2="240" stroke="#4A2808" strokeWidth="1" strokeOpacity="0.5"/>
            <line x1="210" y1="252" x2="247" y2="252" stroke="#4A2808" strokeWidth="1" strokeOpacity="0.45"/>
            <line x1="210" y1="264" x2="258" y2="264" stroke="#4A2808" strokeWidth="1" strokeOpacity="0.5"/>
            <line x1="210" y1="276" x2="251" y2="276" stroke="#4A2808" strokeWidth="1" strokeOpacity="0.4"/>
            <line x1="210" y1="288" x2="258" y2="288" stroke="#4A2808" strokeWidth="1" strokeOpacity="0.45"/>
          </g>

          {/* SCROLL 3 — flying upper left, small */}
          <g transform="rotate(-19, 74, 234)" filter="url(#sshd)">
            <rect x="48" y="196" width="52" height="76" fill="url(#parch)"/>
            <ellipse cx="74" cy="196" rx="26" ry="6" fill="#7B4A1C"/>
            <ellipse cx="74" cy="196" rx="21" ry="4" fill="#B07A42" fillOpacity="0.55"/>
            <ellipse cx="74" cy="272" rx="26" ry="6" fill="#5A3010"/>
            <ellipse cx="74" cy="272" rx="21" ry="4" fill="#B07A42" fillOpacity="0.45"/>
            <line x1="58" y1="214" x2="96" y2="214" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.5"/>
            <line x1="58" y1="225" x2="96" y2="225" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.5"/>
            <line x1="58" y1="236" x2="83" y2="236" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.45"/>
            <line x1="58" y1="247" x2="96" y2="247" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.4"/>
            <line x1="58" y1="258" x2="87" y2="258" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.4"/>
          </g>

          {/* SCROLL 4 — small, fallen off desk edge */}
          <g transform="rotate(74, 240, 462)" filter="url(#sshd)">
            <rect x="212" y="430" width="56" height="64" fill="url(#parch)"/>
            <ellipse cx="240" cy="430" rx="28" ry="6" fill="#7B4A1C"/>
            <ellipse cx="240" cy="430" rx="23" ry="4" fill="#B07A42" fillOpacity="0.55"/>
            <ellipse cx="240" cy="494" rx="28" ry="6" fill="#5A3010"/>
            <ellipse cx="240" cy="494" rx="23" ry="4" fill="#B07A42" fillOpacity="0.45"/>
            <line x1="222" y1="448" x2="258" y2="448" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.5"/>
            <line x1="222" y1="459" x2="258" y2="459" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.45"/>
            <line x1="222" y1="470" x2="248" y2="470" stroke="#4A2808" strokeWidth="0.9" strokeOpacity="0.4"/>
          </g>

          {/* ── OLD ADMIN FIGURE (stressed, round glasses, gray hair) ── */}
          <ellipse cx="157" cy="491" rx="42" ry="7" fill="#000" fillOpacity="0.18" filter="url(#gbl)"/>
          {/* Legs */}
          <rect x="138" y="425" width="20" height="63" rx="7" fill="#1a2744" fillOpacity="0.92"/>
          <rect x="162" y="427" width="20" height="61" rx="7" fill="#1a2744" fillOpacity="0.92"/>
          {/* Shoes */}
          <ellipse cx="148" cy="490" rx="16" ry="6.5" fill="#111" fillOpacity="0.88"/>
          <ellipse cx="172" cy="490" rx="16" ry="6.5" fill="#111" fillOpacity="0.88"/>
          {/* Torso — dark navy suit */}
          <path d="M 120 314 Q 114 383 116 430 L 204 430 Q 206 383 200 314 Z" fill="#1e3a5f" fillOpacity="0.9"/>
          {/* Shirt collar */}
          <path d="M 147 314 L 160 336 L 173 314 L 166 310 L 160 324 L 154 310 Z" fill="#F5F5F5" fillOpacity="0.82"/>
          {/* Tie */}
          <path d="M 157 320 L 160 330 L 163 320 L 161 312 L 159 312 Z" fill="#8B1515" fillOpacity="0.88"/>
          <path d="M 157 320 L 153 370 Q 160 379 167 370 L 163 320 Z" fill="#8B1515" fillOpacity="0.88"/>
          {/* Lapels */}
          <path d="M 147 314 L 120 346 L 131 314 Z" fill="#162D4E" fillOpacity="0.88"/>
          <path d="M 173 314 L 200 346 L 189 314 Z" fill="#162D4E" fillOpacity="0.88"/>
          {/* Breast pocket */}
          <rect x="122" y="354" width="21" height="3" rx="1" fill="#F5F5F5" fillOpacity="0.38"/>
          {/* Suit buttons */}
          <circle cx="160" cy="400" r="2.5" fill="#F5F5F5" fillOpacity="0.22"/>
          <circle cx="160" cy="416" r="2.5" fill="#F5F5F5" fillOpacity="0.22"/>
          {/* LEFT ARM — hand on head, stressed */}
          <path d="M 122 338 Q 92 320 70 290" stroke="#1e3a5f" strokeWidth="16" strokeLinecap="round" fill="none"/>
          <path d="M 124 334 Q 94 316 72 288" stroke="#D4956A" strokeWidth="12" strokeLinecap="round" fill="none"/>
          {/* Palm on forehead */}
          <ellipse cx="68" cy="285" rx="14" ry="11" fill="#D4956A" fillOpacity="0.9" transform="rotate(-20,68,285)"/>
          {/* Fingers hint */}
          <path d="M 57 278 Q 54 282 56 287" stroke="#C07850" strokeWidth="5" strokeLinecap="round" fill="none" strokeOpacity="0.7"/>
          <path d="M 63 274 Q 60 278 62 284" stroke="#C07850" strokeWidth="5" strokeLinecap="round" fill="none" strokeOpacity="0.7"/>
          {/* RIGHT ARM — extended, releasing scroll */}
          <path d="M 198 336 Q 226 320 250 340" stroke="#1e3a5f" strokeWidth="16" strokeLinecap="round" fill="none"/>
          <path d="M 198 332 Q 224 316 248 336" stroke="#D4956A" strokeWidth="12" strokeLinecap="round" fill="none"/>
          {/* Right hand */}
          <circle cx="250" cy="340" r="12" fill="#D4956A" fillOpacity="0.9"/>
          {/* Neck */}
          <rect x="150" y="276" width="20" height="24" rx="7" fill="#D4956A" fillOpacity="0.88"/>
          {/* HEAD */}
          <ellipse cx="160" cy="256" rx="32" ry="34" fill="#D4956A" fillOpacity="0.92"/>
          {/* Gray hair */}
          <path d="M 129 250 Q 126 214 140 202 Q 154 192 170 196 Q 182 200 190 214 Q 195 228 193 250 Q 184 222 160 220 Q 136 222 129 250 Z" fill="#A8B0BC" fillOpacity="0.88"/>
          <path d="M 128 250 Q 123 259 125 268 Q 127 254 131 250 Z" fill="#A8B0BC" fillOpacity="0.7"/>
          <path d="M 191 250 Q 196 259 194 268 Q 192 254 188 250 Z" fill="#A8B0BC" fillOpacity="0.7"/>
          {/* Ears */}
          <ellipse cx="128" cy="259" rx="7" ry="11" fill="#C07850" fillOpacity="0.85"/>
          <ellipse cx="192" cy="259" rx="7" ry="11" fill="#C07850" fillOpacity="0.85"/>
          <ellipse cx="128" cy="259" rx="4" ry="7" fill="#D4956A" fillOpacity="0.5"/>
          <ellipse cx="192" cy="259" rx="4" ry="7" fill="#D4956A" fillOpacity="0.5"/>
          {/* ROUND GLASSES */}
          <circle cx="145" cy="256" r="13" fill="none" stroke="#6B4A28" strokeWidth="2.4"/>
          <circle cx="145" cy="256" r="13" fill="#C4E0F0" fillOpacity="0.1"/>
          <circle cx="175" cy="256" r="13" fill="none" stroke="#6B4A28" strokeWidth="2.4"/>
          <circle cx="175" cy="256" r="13" fill="#C4E0F0" fillOpacity="0.1"/>
          <line x1="158" y1="256" x2="162" y2="256" stroke="#6B4A28" strokeWidth="2"/>
          <line x1="132" y1="253" x2="128" y2="250" stroke="#6B4A28" strokeWidth="1.8"/>
          <line x1="188" y1="253" x2="192" y2="250" stroke="#6B4A28" strokeWidth="1.8"/>
          {/* Eyes */}
          <circle cx="145" cy="256" r="5.5" fill="#2A1A0E" fillOpacity="0.85"/>
          <circle cx="175" cy="256" r="5.5" fill="#2A1A0E" fillOpacity="0.85"/>
          <circle cx="146" cy="255" r="1.8" fill="#FFF" fillOpacity="0.45"/>
          <circle cx="176" cy="255" r="1.8" fill="#FFF" fillOpacity="0.45"/>
          {/* Stressed brows — tilted inward */}
          <path d="M 133 242 Q 145 237 157 240" stroke="#6A5040" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M 163 240 Q 175 237 187 242" stroke="#6A5040" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          {/* Nose */}
          <path d="M 160 262 Q 154 272 157 276 Q 160 278 163 276 Q 166 272 160 262 Z" fill="#C07850" fillOpacity="0.5"/>
          {/* Worried mouth */}
          <path d="M 149 284 Q 160 279 171 284" stroke="#9A6040" strokeWidth="2.3" fill="none" strokeLinecap="round"/>
          {/* Wrinkles */}
          <path d="M 131 242 Q 128 250 129 256" stroke="#B07050" strokeWidth="0.9" strokeOpacity="0.38" fill="none"/>
          <path d="M 189 242 Q 192 250 191 256" stroke="#B07050" strokeWidth="0.9" strokeOpacity="0.38" fill="none"/>
          {/* Sweat drops */}
          <ellipse cx="108" cy="236" rx="3.5" ry="5" fill="#60A0D0" fillOpacity="0.35" transform="rotate(-15,108,236)"/>
          <ellipse cx="116" cy="220" rx="2.5" ry="3.5" fill="#60A0D0" fillOpacity="0.28" transform="rotate(-10,116,220)"/>

          <text x="157" y="624" textAnchor="middle" fill="#d97706" fillOpacity="0.45" fontSize="11" fontFamily="Georgia,serif" letterSpacing="4">ANTES</text>

          {/* ════════════════════════════════════════════════ */}
          {/* RIGHT — MODERN PERSON + ANIMATED SHEET         */}
          {/* ════════════════════════════════════════════════ */}

          {/* ANIMATED WHITE SHEET — pitch lines drawn progressively */}
          <g transform="rotate(-3, 1148, 395)" filter="url(#shd)">
            <rect x="1065" y="295" width="200" height="155" rx="4" fill="#FFFFFF" fillOpacity="0.97"/>
            <rect x="1065" y="295" width="5" height="155" fill="#DDE6F0" fillOpacity="0.45"/>
            <rect x="1260" y="295" width="5" height="155" fill="#DDE6F0" fillOpacity="0.45"/>
            <rect x="1065" y="295" width="200" height="5" fill="#D0DAEA" fillOpacity="0.3"/>
            {/* Nested SVG for overflow clipping */}
            <svg x="1065" y="295" width="200" height="155" viewBox="0 0 200 155" overflow="hidden">
              <rect className="dl1" x="12" y="12" width="176" height="131" fill="none" stroke="#EC4899" strokeWidth="1.8"/>
              <line className="dl2" x1="100" y1="12" x2="100" y2="143" stroke="#EC4899" strokeWidth="1.5"/>
              <circle className="dl3" cx="100" cy="78" r="30" fill="none" stroke="#EC4899" strokeWidth="1.5"/>
              <circle cx="100" cy="78" r="3" fill="#EC4899" fillOpacity="0.65"/>
              <rect className="dl5" x="12" y="44" width="46" height="68" fill="none" stroke="#EC4899" strokeWidth="1.3"/>
              <rect className="dl6" x="142" y="44" width="46" height="68" fill="none" stroke="#EC4899" strokeWidth="1.3"/>
              <rect className="dl7" x="12" y="58" width="18" height="40" fill="none" stroke="#EC4899" strokeWidth="1"/>
              <rect className="dl8" x="170" y="58" width="18" height="40" fill="none" stroke="#EC4899" strokeWidth="1"/>
            </svg>
          </g>

          {/* Clean desk */}
          <rect x="1085" y="490" width="295" height="10" rx="3" fill="#e2e8f0" fillOpacity="0.22"/>
          <rect x="1094" y="498" width="8" height="46" rx="3" fill="#cbd5e1" fillOpacity="0.18"/>
          <rect x="1366" y="498" width="8" height="46" rx="3" fill="#cbd5e1" fillOpacity="0.18"/>
          <ellipse cx="1230" cy="502" rx="140" ry="9" fill="#3b82f6" fillOpacity="0.06" filter="url(#gbl)"/>

          {/* ── MODERN PERSON FIGURE (confident, pointing at sheet) ── */}
          <ellipse cx="1316" cy="492" rx="42" ry="7" fill="#000" fillOpacity="0.15" filter="url(#gbl)"/>
          {/* Legs */}
          <rect x="1298" y="418" width="19" height="72" rx="7" fill="#1e293b" fillOpacity="0.85"/>
          <rect x="1322" y="420" width="19" height="70" rx="7" fill="#1e293b" fillOpacity="0.85"/>
          {/* Shoes */}
          <ellipse cx="1307" cy="491" rx="15" ry="6" fill="#111" fillOpacity="0.82"/>
          <ellipse cx="1331" cy="491" rx="15" ry="6" fill="#111" fillOpacity="0.82"/>
          {/* Belt */}
          <rect x="1287" y="408" width="70" height="8" rx="2" fill="#0D1B2A" fillOpacity="0.48"/>
          {/* Torso — casual teal shirt */}
          <path d="M 1289 298 Q 1283 373 1285 422 L 1355 422 Q 1357 373 1351 298 Z" fill="#0369A1" fillOpacity="0.82"/>
          {/* Collar */}
          <path d="M 1315 298 L 1322 315 L 1315 325 L 1308 315 Z" fill="#F5F5F5" fillOpacity="0.55"/>
          {/* Shirt pocket */}
          <rect x="1291" y="336" width="24" height="20" rx="2" fill="#0284C7" fillOpacity="0.5"/>
          {/* LEFT ARM — extended, pointing toward the sheet */}
          <path d="M 1290 316 Q 1252 344 1228 372" stroke="#0369A1" strokeWidth="16" strokeLinecap="round" fill="none"/>
          <path d="M 1292 312 Q 1254 340 1230 368" stroke="#C08060" strokeWidth="12" strokeLinecap="round" fill="none"/>
          {/* Pointing hand */}
          <circle cx="1227" cy="372" r="12" fill="#C08060" fillOpacity="0.9"/>
          <ellipse cx="1214" cy="367" rx="15" ry="7" fill="#C08060" fillOpacity="0.88" transform="rotate(-28,1214,367)"/>
          {/* RIGHT ARM — relaxed, slight bend */}
          <path d="M 1349 310 Q 1372 354 1368 400" stroke="#0369A1" strokeWidth="16" strokeLinecap="round" fill="none"/>
          <path d="M 1347 306 Q 1370 350 1366 396" stroke="#C08060" strokeWidth="12" strokeLinecap="round" fill="none"/>
          <circle cx="1366" cy="400" r="12" fill="#C08060" fillOpacity="0.9"/>
          {/* Neck */}
          <rect x="1307" y="266" width="18" height="20" rx="6" fill="#C08060" fillOpacity="0.88"/>
          {/* HEAD */}
          <ellipse cx="1316" cy="246" rx="29" ry="31" fill="#C08060" fillOpacity="0.92"/>
          {/* Dark hair */}
          <path d="M 1288 238 Q 1286 206 1302 196 Q 1317 188 1332 192 Q 1344 198 1350 212 Q 1354 226 1350 238 Q 1340 214 1316 216 Q 1292 216 1288 238 Z" fill="#2d1b0e" fillOpacity="0.88"/>
          <path d="M 1287 238 Q 1283 247 1284 255 Q 1286 244 1289 238 Z" fill="#2d1b0e" fillOpacity="0.6"/>
          {/* Ears */}
          <ellipse cx="1287" cy="248" rx="6" ry="9" fill="#B07050" fillOpacity="0.85"/>
          <ellipse cx="1345" cy="248" rx="6" ry="9" fill="#B07050" fillOpacity="0.85"/>
          {/* Eye whites */}
          <ellipse cx="1305" cy="245" rx="7" ry="6" fill="#FFFFFF" fillOpacity="0.88"/>
          <ellipse cx="1327" cy="245" rx="7" ry="6" fill="#FFFFFF" fillOpacity="0.88"/>
          {/* Irises */}
          <circle cx="1306" cy="246" r="4" fill="#3B2010" fillOpacity="0.9"/>
          <circle cx="1328" cy="246" r="4" fill="#3B2010" fillOpacity="0.9"/>
          {/* Shine */}
          <circle cx="1307" cy="245" r="1.4" fill="#FFFFFF" fillOpacity="0.75"/>
          <circle cx="1329" cy="245" r="1.4" fill="#FFFFFF" fillOpacity="0.75"/>
          {/* Eyebrows — engaged, slightly raised */}
          <path d="M 1297 234 Q 1306 230 1315 232" stroke="#2d1b0e" strokeWidth="2.3" fill="none" strokeLinecap="round"/>
          <path d="M 1319 232 Q 1328 229 1337 233" stroke="#2d1b0e" strokeWidth="2.3" fill="none" strokeLinecap="round"/>
          {/* Nose */}
          <path d="M 1316 252 Q 1310 261 1312 265 Q 1316 268 1320 265 Q 1322 261 1316 252 Z" fill="#B07050" fillOpacity="0.48"/>
          {/* Confident smile */}
          <path d="M 1306 274 Q 1316 280 1326 274" stroke="#8B5040" strokeWidth="2.3" fill="none" strokeLinecap="round"/>
          <path d="M 1304 271 Q 1303 276 1305 279" stroke="#A06050" strokeWidth="1" fill="none" strokeOpacity="0.5"/>
          <path d="M 1326 271 Q 1327 276 1325 279" stroke="#A06050" strokeWidth="1" fill="none" strokeOpacity="0.5"/>

          <text x="1165" y="624" textAnchor="middle" fill="#3b82f6" fillOpacity="0.45" fontSize="11" fontFamily="Georgia,serif" letterSpacing="4">AHORA</text>

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
