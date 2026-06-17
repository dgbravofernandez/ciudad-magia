import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso legal — Cluberly',
}

const SECTIONS = [
  {
    title: '1. Datos del titular',
    content: 'En cumplimiento del Art. 10 de la Ley 34/2002 (LSSI-CE), se informa de los datos del titular del sitio web cluberly.club y de la plataforma Cluberly: Diego Bravo Fernández (en adelante, "el Prestador"), con domicilio en España y email de contacto diego@cluberly.club. Toda la actividad comercial se desarrolla bajo la marca Cluberly.',
  },
  {
    title: '2. Objeto del sitio',
    content: 'Cluberly es una plataforma SaaS (Software as a Service) dirigida a clubes de fútbol base para la gestión de jugadores, inscripciones, cuotas, comunicaciones, sesiones y demás operativa diaria del club. El acceso al servicio requiere registro y aceptación de los Términos y Condiciones.',
  },
  {
    title: '3. Condiciones de uso',
    content: 'El uso de Cluberly se rige por los Términos y Condiciones disponibles en cluberly.club/terms y por la Política de Privacidad en cluberly.club/privacy. La utilización del sitio web implica la aceptación expresa de ambos documentos.',
  },
  {
    title: '4. Propiedad intelectual',
    content: 'Todos los contenidos del sitio web — incluyendo textos, gráficos, logotipos, iconos, imágenes, archivos de software y demás material — son propiedad del Prestador o de terceros que han autorizado su uso. Queda prohibida su reproducción, distribución, comunicación pública o transformación sin autorización expresa por escrito.',
  },
  {
    title: '5. Responsabilidad',
    content: 'El Prestador no se hace responsable de los daños y perjuicios que pudieran derivarse de interferencias, omisiones, interrupciones, virus informáticos o desconexiones en el funcionamiento operativo del sistema. Tampoco responde de los daños causados por el uso indebido del servicio por parte de terceros o usuarios.',
  },
  {
    title: '6. Enlaces a terceros',
    content: 'El sitio puede contener enlaces a sitios web de terceros (Stripe para pagos, Google para servicios opcionales, etc.). El Prestador no se hace responsable del contenido ni de las políticas de privacidad de dichos sitios.',
  },
  {
    title: '7. Legislación y jurisdicción',
    content: 'El presente aviso legal se rige por la legislación española. Para la resolución de cualquier controversia que pudiera surgir, las partes se someten a la jurisdicción de los Juzgados y Tribunales del lugar de domicilio del consumidor, conforme a la legislación aplicable.',
  },
  {
    title: '8. Comunicaciones comerciales',
    content: 'En cumplimiento del Art. 21 LSSI, no se enviarán comunicaciones comerciales por correo electrónico que no hayan sido previamente solicitadas o expresamente autorizadas, excepto cuando exista una relación contractual previa o cuando los datos del destinatario se hayan obtenido de fuentes accesibles al público y la comunicación sea relevante para la actividad profesional del destinatario (caso típico de los clubes federados). En todos los casos, cada comunicación incluye una opción simple y gratuita para oponerse al tratamiento.',
  },
]

export default function LegalPage() {
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
        <h1 style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Aviso legal</h1>
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
