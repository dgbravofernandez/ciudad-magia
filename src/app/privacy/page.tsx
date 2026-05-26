import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de privacidad — Cluberly',
}

const SECTIONS = [
  {
    title: '1. Responsable del tratamiento',
    content: 'Kevo (en adelante, "nosotros" o "Cluberly") es el responsable del tratamiento de los datos personales recogidos a través de la plataforma Cluberly. Puedes contactarnos en iakevoapp@gmail.com para cualquier consulta relacionada con tus datos.',
  },
  {
    title: '2. Datos que recogemos',
    content: 'Recogemos los datos que tú o tu club introducen en la plataforma: nombre, email, teléfono, fecha de nacimiento de los socios, datos de pago (gestionados por Stripe, nunca almacenamos tarjetas), y datos de uso de la aplicación (sesiones, asistencias, comunicaciones).',
  },
  {
    title: '3. Finalidad del tratamiento',
    content: 'Los datos se usan exclusivamente para prestar el servicio contratado: gestionar miembros, cuotas, sesiones y comunicaciones de tu club. No vendemos datos a terceros. No hacemos perfilado para publicidad.',
  },
  {
    title: '4. Base legal',
    content: 'El tratamiento se basa en la ejecución del contrato de servicio aceptado al registrarse (Art. 6.1.b RGPD). Para comunicaciones de marketing, en el consentimiento explícito (Art. 6.1.a RGPD).',
  },
  {
    title: '5. Almacenamiento y seguridad',
    content: 'Los datos se almacenan en servidores de Supabase (PostgreSQL) con cifrado en tránsito (TLS) y en reposo (AES-256). Los backups se realizan diariamente. El acceso está controlado por autenticación y Row Level Security.',
  },
  {
    title: '6. Conservación de datos',
    content: 'Los datos se conservan mientras la cuenta esté activa. Si cancelas tu suscripción, los datos se mantienen 30 días para posible reactivación. Pasado ese plazo, se eliminan automáticamente salvo obligación legal.',
  },
  {
    title: '7. Tus derechos',
    content: 'Tienes derecho a acceder, rectificar, suprimir, limitar el tratamiento, oponerte y a la portabilidad de tus datos (Art. 15-22 RGPD). También tienes derecho a retirar el consentimiento en cualquier momento.',
  },
  {
    title: '8. Subencargados',
    content: 'Utilizamos los siguientes subencargados: Supabase (base de datos, EE.UU., con cláusulas contractuales tipo), Stripe (pagos, EE.UU.), Vercel (hosting, EE.UU.), Google (servicios opcionales de hoja de cálculo, EE.UU.). Todos cumplen con garantías adecuadas según RGPD.',
  },
  {
    title: '9. Cookies',
    content: 'Usamos únicamente cookies técnicas necesarias para el funcionamiento de la plataforma (autenticación de sesión). No usamos cookies de seguimiento ni publicidad.',
  },
  {
    title: '10. Contacto y reclamaciones',
    content: null, // special rendering
  },
]

export default function PrivacyPage() {
  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,Inter,sans-serif', color: '#0F172A', minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #E2E8F0', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#6366F1,#EC4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.875rem' }}>C</div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', letterSpacing: '-0.02em' }}>cluberly</span>
        </Link>
        <Link href="/login" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6366F1', textDecoration: 'none' }}>Iniciar sesión</Link>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: 'clamp(2rem,5vw,4rem) 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Política de privacidad</h1>
        <p style={{ color: '#64748B', fontSize: '0.9rem', marginBottom: '3rem' }}>
          Última actualización: {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: '#1E293B' }}>{sec.title}</h2>
              {sec.content ? (
                <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>{sec.content}</p>
              ) : (
                <p style={{ color: '#475569', fontSize: '0.9375rem', lineHeight: 1.7 }}>
                  Para ejercer estos derechos, escríbenos a{' '}
                  <a href="mailto:iakevoapp@gmail.com" style={{ color: '#6366F1', fontWeight: 600 }}>iakevoapp@gmail.com</a>.
                  También puedes presentar una reclamación ante la{' '}
                  <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" style={{ color: '#6366F1' }}>
                    Agencia Española de Protección de Datos (AEPD)
                  </a>.
                </p>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: '3rem', padding: '1.5rem', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12 }}>
          <p style={{ fontWeight: 700, marginBottom: '0.5rem' }}>¿Tienes alguna duda?</p>
          <p style={{ color: '#64748B', fontSize: '0.9rem' }}>
            Escríbenos a{' '}
            <a href="mailto:iakevoapp@gmail.com" style={{ color: '#6366F1', fontWeight: 600 }}>iakevoapp@gmail.com</a>{' '}
            y te respondemos en menos de 24 horas.
          </p>
        </div>

        <p style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link href="/" style={{ color: '#6366F1', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>← Volver a inicio</Link>
        </p>
      </div>
    </div>
  )
}
