import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos y condiciones — Cluberly',
}

const SECTIONS = [
  {
    title: '1. Objeto y aceptación',
    content: 'Los presentes Términos y Condiciones regulan el uso de la plataforma Cluberly (cluberly.club), un servicio SaaS de gestión para clubes deportivos. Al crear una cuenta o utilizar el servicio, aceptas íntegramente estos términos. Si no estás de acuerdo, no utilices el servicio.',
  },
  {
    title: '2. Cuenta de usuario',
    content: 'Para usar Cluberly debes crear una cuenta proporcionando un email válido y datos de tu club. Eres responsable de mantener la confidencialidad de tu contraseña y de todas las actividades realizadas con tu cuenta. Debes notificarnos inmediatamente cualquier uso no autorizado.',
  },
  {
    title: '3. Periodo de prueba',
    content: 'Ofrecemos un periodo de prueba gratuito de 14 días sin necesidad de tarjeta. Al finalizar el periodo, debes elegir un plan de pago para continuar usando el servicio. Si no eliges plan, la cuenta entra en modo limitado pero los datos se conservan 30 días.',
  },
  {
    title: '4. Planes y pagos',
    content: 'Los planes de suscripción son: Básico (39€/mes), Pro (89€/mes) y Club (149€/mes). Los pagos se procesan a través de Stripe (PCI DSS Level 1). Las suscripciones se renuevan automáticamente cada mes. Puedes cancelar en cualquier momento desde el portal del cliente, con efectos al final del periodo facturado.',
  },
  {
    title: '5. Cancelación y reembolsos',
    content: 'Puedes cancelar tu suscripción cuando quieras. No reembolsamos meses parciales salvo en caso de fallo grave imputable a Cluberly. Si cancelas, mantienes acceso hasta el final del periodo ya pagado.',
  },
  {
    title: '6. Cambios de plan',
    content: 'Puedes actualizar o reducir tu plan en cualquier momento. Los cambios al alza son inmediatos con prorrateo. Los cambios a la baja se aplican al siguiente ciclo de facturación.',
  },
  {
    title: '7. Uso aceptable',
    content: 'No puedes: (a) usar Cluberly para fines ilegales, (b) intentar acceder a datos de otros clubes, (c) hacer ingeniería inversa del software, (d) revender el servicio a terceros sin acuerdo explícito, (e) cargar contenido que viole derechos de terceros. El incumplimiento puede resultar en suspensión o cancelación de la cuenta sin reembolso.',
  },
  {
    title: '8. Datos del cliente',
    content: 'Los datos que introduces en Cluberly (jugadores, pagos, comunicaciones) son de tu propiedad. Actuamos como encargado del tratamiento conforme al RGPD. Puedes exportar tus datos en cualquier momento. Si cancelas, los datos se eliminan a los 30 días salvo obligación legal de conservación.',
  },
  {
    title: '9. Disponibilidad del servicio',
    content: 'Nos comprometemos a una disponibilidad razonable del servicio (objetivo: 99.5% mensual), excluyendo ventanas de mantenimiento programado. No garantizamos uptime al 100%. No somos responsables de pérdidas indirectas derivadas de interrupciones del servicio.',
  },
  {
    title: '10. Limitación de responsabilidad',
    content: 'La responsabilidad total de Cluberly frente a ti por cualquier causa relacionada con el servicio se limita al importe efectivamente pagado por ti en los 12 meses anteriores al hecho que da lugar a la reclamación.',
  },
  {
    title: '11. Modificaciones',
    content: 'Podemos modificar estos términos avisando con 30 días de antelación por email. Si no estás de acuerdo con los cambios, puedes cancelar tu suscripción antes de que entren en vigor.',
  },
  {
    title: '12. Ley aplicable y fuero',
    content: 'Estos términos se rigen por la legislación española. Las controversias se someten a los Juzgados y Tribunales del domicilio del consumidor cuando éste sea aplicable, o subsidiariamente a los del domicilio del Prestador.',
  },
]

export default function TermsPage() {
  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,Inter,sans-serif', color: '#0F172A', minHeight: '100vh' }}>
      <nav style={{ borderBottom: '1px solid #E2E8F0', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#EC4899,#BE185D)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.875rem' }}>C</div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', letterSpacing: '-0.02em' }}>cluberly</span>
        </Link>
        <Link href="/login" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#EC4899', textDecoration: 'none' }}>Iniciar sesión</Link>
      </nav>
      <div style={{ maxWidth: 740, margin: '0 auto', padding: 'clamp(2rem,5vw,4rem) 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Términos y condiciones</h1>
        <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '3rem' }}>
          Última actualización: {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: '#1E293B' }}>{sec.title}</h2>
              <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>{sec.content}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '3rem', textAlign: 'center' }}>
          <Link href="/" style={{ color: '#EC4899', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>← Volver a inicio</Link>
        </p>
      </div>
    </div>
  )
}
