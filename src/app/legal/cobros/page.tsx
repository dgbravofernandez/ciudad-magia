import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Términos del servicio de cobros — Cluberly',
}

const SECTIONS = [
  {
    title: '1. Objeto',
    content:
      'El presente documento regula las condiciones particulares aplicables a la funcionalidad opcional de cobros con tarjeta de Cluberly ("el Servicio de Cobros"). Esta funcionalidad permite a los clubes suscritos cobrar cuotas e inscripciones a través de la plataforma Stripe. Su activación es voluntaria y se realiza por el administrador del club desde la sección Configuración → Cobros.',
  },
  {
    title: '2. Quién procesa los pagos (Stripe)',
    content:
      'Los pagos son procesados por Stripe Payments Europe, Ltd. ("Stripe"), entidad de pago autorizada con sede en Irlanda. Cluberly NO recibe, custodia ni transmite directamente fondos de los pagadores: los fondos van desde el pagador a la cuenta Stripe Connected Account del club. Stripe actúa como entidad de pago a todos los efectos legales. Al activar el Servicio de Cobros, el club acepta también los términos de Stripe Connected Account Agreement (https://stripe.com/connect-account/legal).',
  },
  {
    title: '3. Tasa de procesamiento Cluberly (application fee)',
    content:
      'Cluberly aplica una tasa de procesamiento del 0,50 € fijo + 1 % del importe sobre cada cobro completado a través del Servicio de Cobros. La tasa se descuenta automáticamente por Stripe del importe del cobro antes de transferir el neto a la cuenta del club. La tasa cubre infraestructura de pagos, soporte y desarrollo continuo de la plataforma. Sobre una cuota de 60 €, la tasa Cluberly es de 1,10 €.',
  },
  {
    title: '4. Tarifas de Stripe',
    content:
      'Adicionalmente, Stripe aplica sus propias tarifas estándar por el procesamiento del cobro (consultables en stripe.com/es/pricing). Estas tarifas son cobradas por Stripe directamente al club. Cluberly no participa en su cuantía. Para tarjetas EEE estándar, la tarifa actual de Stripe es 1,5 % + 0,25 € por cobro (sujeta a actualizaciones de Stripe).',
  },
  {
    title: '5. Activación y desactivación opcional',
    content:
      'El Servicio de Cobros es opt-in: requiere activación explícita por el administrador del club, completar el onboarding KYC de Stripe (entidad jurídica, IBAN, representante legal) y activar el toggle correspondiente. El club puede desactivar el servicio en cualquier momento. La desactivación bloquea la emisión de nuevos enlaces de pago; los enlaces ya enviados y no caducados pueden seguir siendo abonados por las familias hasta su caducidad. Tras la desactivación, la cuenta Stripe del club se conserva — si se reactiva, no es necesario rehacer el onboarding.',
  },
  {
    title: '6. Repercusión de las tasas a las familias',
    content:
      'El club decide libremente si repercute o no las tasas (Cluberly + Stripe) a las familias pagadoras. En caso de repercutirlas, el club debe informar previamente a las familias en sus comunicaciones internas. Cluberly no fija precios al consumidor final.',
  },
  {
    title: '7. Devoluciones y disputas',
    content:
      'Las devoluciones (refunds) y disputas (chargebacks) las gestiona el club a través de su panel Stripe. Cuando se produce una devolución total, la tasa Cluberly aplicada se devuelve íntegramente al club. Las disputas y costes asociados (15 € por chargeback en Stripe) son responsabilidad del club como receptor de los fondos.',
  },
  {
    title: '8. Liquidación a la cuenta bancaria del club',
    content:
      'Stripe transfiere el neto cobrado (importe - tarifa Stripe - tasa Cluberly) a la cuenta bancaria IBAN proporcionada por el club durante el onboarding. La frecuencia y plazos los gestiona Stripe (típicamente 2-7 días hábiles desde el cobro). El club puede consultar sus liquidaciones en su panel Stripe Express.',
  },
  {
    title: '9. Facturación',
    content:
      'Cluberly emite mensualmente al club una factura por las tasas de procesamiento cobradas en el periodo, con su correspondiente IVA (21 %). El IVA es a cargo del club. La factura se envía al email administrativo del club y queda disponible en su panel.',
  },
  {
    title: '10. KYC, antiblanqueo y obligaciones del club',
    content:
      'El club es responsable de proporcionar a Stripe información veraz y completa durante el onboarding (CIF, IBAN, DNI representante legal, etc.). El no proporcionar la información requerida puede llevar a Stripe a restringir o rechazar la cuenta. Cluberly no participa en el proceso KYC; este es gestionado exclusivamente por Stripe conforme a la normativa europea de antiblanqueo (AMLD5/AMLD6).',
  },
  {
    title: '11. Datos personales del pagador',
    content:
      'Los datos de tarjeta del pagador no son tratados ni almacenados por Cluberly en ningún momento. Stripe es el responsable del tratamiento de estos datos en su calidad de entidad de pago. Los datos no de pago (email, nombre del pagador, importe, concepto) son tratados por el club como responsable, y por Cluberly como encargado, conforme a la Política de Privacidad de Cluberly.',
  },
  {
    title: '12. Limitación de responsabilidad',
    content:
      'Cluberly no es responsable de: fallos o caídas del servicio de Stripe; retrasos en las liquidaciones causados por Stripe; errores en la información proporcionada por el club durante el onboarding; impagos o disputas entre el club y los pagadores. La responsabilidad máxima de Cluberly en relación con el Servicio de Cobros queda limitada al importe total de tasas Cluberly cobradas al club en los 12 meses anteriores al incidente.',
  },
  {
    title: '13. Modificaciones',
    content:
      'Cluberly podrá modificar estas condiciones notificando con al menos 30 días de antelación a través de email o aviso en la plataforma. Si el club no acepta las modificaciones, puede desactivar el Servicio de Cobros sin penalización.',
  },
  {
    title: '14. Legislación y jurisdicción',
    content:
      'Las presentes condiciones se rigen por la legislación española. Para cualquier controversia se aplica el fuero del consumidor o usuario. La relación entre Cluberly y los pagadores (familias) — si la hubiera — se rige adicionalmente por el RGPD y la LSSI-CE.',
  },
]

export default function CobrosLegalPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ borderBottom: '1px solid #E2E8F0', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, margin: '0 auto' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#EC4899,#BE185D)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.875rem' }}>C</div>
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A', letterSpacing: '-0.02em' }}>cluberly</span>
        </Link>
        <Link href="/login" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#EC4899', textDecoration: 'none' }}>Iniciar sesión</Link>
      </nav>
      <div style={{ maxWidth: 740, margin: '0 auto', padding: 'clamp(2rem,5vw,4rem) 1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem,4vw,2.5rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Términos del servicio de cobros</h1>
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
