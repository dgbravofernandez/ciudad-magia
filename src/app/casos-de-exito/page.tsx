import Link from 'next/link'
import { Check, TrendingDown, Clock, Mail } from 'lucide-react'

export const metadata = {
  title: 'Casos de éxito — Cluberly',
  description: 'Cómo clubes amateur reales han ahorrado tiempo con Cluberly.',
}

export default function CasosExitoPage() {
  return (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
      fontFamily: 'system-ui',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', marginBottom: '2rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#EC4899,#BE185D)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>C</div>
          <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0F172A' }}>cluberly</span>
        </Link>

        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '1rem' }}>
          Cómo cambia el día a día con <span style={{ background: 'linear-gradient(90deg,#EC4899,#BE185D)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Cluberly</span>
        </h1>
        <p style={{ color: '#475569', fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '3rem' }}>
          Datos reales de un club piloto madrileño durante 12 meses de uso.
        </p>

        {/* KPIs antes/después */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          <Kpi icon={Clock} label="Horas/semana ahorradas" before="6h" after="0h" color="#EC4899" />
          <Kpi icon={TrendingDown} label="Familias con deuda &gt;30 días" before="42" after="7" color="#10B981" />
          <Kpi icon={Mail} label="Avisos de deuda manuales" before="30 / mes" after="0" color="#3B82F6" />
          <Kpi icon={Check} label="Cierre de caja mensual" before="1 día" after="5 min" color="#F59E0B" />
        </div>

        {/* Caso anónimo 1 */}
        <Card title="Club piloto · 900 jugadores · Liga regional" subtitle="3 categorías, 35 equipos, tesorería compartida">
          <SectionLabel>Problema antes de Cluberly</SectionLabel>
          <ul style={{ color: '#374151', lineHeight: 1.7, fontSize: '0.95rem', paddingLeft: 18 }}>
            <li>Excel compartido entre coordinación y tesorería con conflictos cada semana.</li>
            <li>Avisos de deuda redactados a mano uno por uno por WhatsApp.</li>
            <li>El cierre de caja a fin de mes ocupaba todo un día.</li>
            <li>Imposible saber al instante quién pagó y quién no.</li>
          </ul>

          <SectionLabel>Resultado después de 12 meses</SectionLabel>
          <ul style={{ color: '#374151', lineHeight: 1.7, fontSize: '0.95rem', paddingLeft: 18 }}>
            <li><strong>4-6 horas/semana ahorradas</strong> en gestión administrativa.</li>
            <li><strong>30 avisos de deuda con un clic</strong>, en menos de 10 segundos.</li>
            <li><strong>Cierre de caja en 5 minutos</strong> al final de cada mes.</li>
            <li>Coordinación y tesorería ven los mismos datos en tiempo real.</li>
            <li>Familias morosas reducidas de 42 a 7 en una temporada.</li>
          </ul>

          <Quote text="Pasé de dedicar 8 horas a las cuotas cada semana, a no acordarme de ellas." author="Tesorería del club" />
        </Card>

        {/* Caso anónimo 2 */}
        <Card title="Escuela de fútbol base · 280 jugadores · Liga provincial" subtitle="Padres voluntarios, sin gestor administrativo">
          <SectionLabel>Problema</SectionLabel>
          <ul style={{ color: '#374151', lineHeight: 1.7, fontSize: '0.95rem', paddingLeft: 18 }}>
            <li>Cuotas cobradas a mano por el presidente del club.</li>
            <li>Sin trazabilidad de quién había pagado y quién no.</li>
            <li>Inscripciones nuevas se gestionaban por email y se perdían.</li>
          </ul>

          <SectionLabel>Resultado</SectionLabel>
          <ul style={{ color: '#374151', lineHeight: 1.7, fontSize: '0.95rem', paddingLeft: 18 }}>
            <li>Formulario público de inscripción que llega directo al sistema.</li>
            <li>Pagos con tarjeta o transferencia automáticamente conciliados.</li>
            <li>El presidente recupera 3 horas a la semana.</li>
          </ul>
        </Card>

        {/* CTA */}
        <div style={{ marginTop: '3rem', background: '#fff', borderRadius: 20, padding: '2rem', textAlign: 'center', border: '1px solid #FBCFE8', boxShadow: '0 4px 24px rgba(236,72,153,0.08)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.75rem' }}>
            ¿Tu club encaja con esto?
          </h2>
          <p style={{ color: '#64748B', fontSize: '1rem', marginBottom: '1.5rem' }}>
            14 días de prueba gratis. Sin tarjeta. Sin compromiso.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/onboarding" style={{
              display: 'inline-block', padding: '0.875rem 2rem', borderRadius: 10,
              background: 'linear-gradient(135deg,#EC4899,#BE185D)', color: '#fff', textDecoration: 'none', fontWeight: 800,
            }}>Probar gratis</Link>
            <Link href="/reservar" style={{
              display: 'inline-block', padding: '0.875rem 2rem', borderRadius: 10,
              background: '#fff', color: '#BE185D', textDecoration: 'none', fontWeight: 700, border: '2px solid #FBCFE8',
            }}>Reservar demo</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, before, after, color }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; before: string; after: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '1.25rem', border: '1px solid #F1F5F9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <Icon size={20} color={color} />
      <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.5rem', fontWeight: 600 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: '0.5rem' }}>
        <span style={{ color: '#94A3B8', fontSize: '0.9rem', textDecoration: 'line-through' }}>{before}</span>
        <span style={{ color: color, fontSize: '1.5rem', fontWeight: 900 }}>→ {after}</span>
      </div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', marginBottom: '1.5rem', border: '1px solid #F1F5F9', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>{title}</h3>
      <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{subtitle}</p>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#BE185D', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '1.25rem', marginBottom: '0.5rem' }}>{children}</h4>
}

function Quote({ text, author }: { text: string; author: string }) {
  return (
    <div style={{ borderLeft: '4px solid #EC4899', padding: '0.75rem 1rem', marginTop: '1.25rem', background: '#FDF2F8', borderRadius: '0 8px 8px 0' }}>
      <p style={{ fontSize: '0.95rem', fontStyle: 'italic', color: '#1F2937', margin: 0 }}>&ldquo;{text}&rdquo;</p>
      <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>— {author}</p>
    </div>
  )
}
