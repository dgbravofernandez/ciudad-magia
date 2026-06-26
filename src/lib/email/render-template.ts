// Núcleo unificado para renderizar emails a familias/jugadores/clubes.
//
// Diseño:
//   1. renderClubEmail(eventType, clubId, vars) consulta email_templates en BD.
//   2. Si existe + enabled → usa el subject/body de BD, sustituye {{vars}}.
//   3. Si NO existe → cae al fallback en código (red de seguridad, cero regresión).
//   4. Aplica el wrapper visual con logo + color del club + footer estándar.
//   5. Devuelve { subject, html, text, fromName, replyTo } listo para enviar.
//
// Pattern de Mustache mínimo: {{var}} se sustituye literal, escapado HTML.
// Bloques condicionales {{#var}}...{{/var}}: el contenido se incluye solo si
// var es truthy y no vacía. NO soportamos lógica más compleja a propósito —
// el editor del club es texto plano + variables, no un motor de plantillas.

import { createAdminClient } from '@/lib/supabase/admin'
import { wrapEmailHtml, wrapEmailText, type WrapperContext } from '@/lib/email/wrapper'

export type EmailEventType =
  | 'fill_form'
  | 'team_assignment'
  | 'request_docs'
  | 'wants_to_continue_yes'
  | 'wants_to_continue_no'
  | 'dismissed_requirements'
  | 'dismissed_non_payment'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'coach_invitation'

export type EmailVars = Record<string, string | number | null | undefined>

export interface RenderedEmail {
  subject: string
  html: string
  text: string
  fromName: string
  replyTo: string | undefined
}

// ── Plantillas FALLBACK por defecto (red de seguridad si no hay fila en BD) ──
// Estas son las plantillas LIMPIAS (sin estilo Getafe) que se usan cuando un
// club aún no ha editado/creado su plantilla. La UI de plantillas-email crea
// la primera fila tomando este contenido como base.
//
// Variables disponibles: ver CATALOGO_VARIABLES abajo.
const DEFAULT_TEMPLATES: Record<EmailEventType, { subject: string; body: string }> = {
  fill_form: {
    subject: 'Confirmación de inscripción {{temporada}} - {{club_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Nos ponemos en contacto para saber si <strong>{{jugador_nombre}}</strong> continuará con nosotros la temporada <strong>{{temporada}}</strong>.</p>
<p>Por favor, confirma tu respuesta en el siguiente enlace{{#fecha_limite}} antes del <strong>{{fecha_limite}}</strong>{{/fecha_limite}}:</p>
<p style="text-align:center;margin:24px 0">
  <a href="{{link_renovacion}}" style="background:{{color_marca}};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Confirmar inscripción</a>
</p>
<p style="font-size:13px;color:#64748b">Esta respuesta nos ayuda a planificar las plazas disponibles para la próxima temporada.</p>`,
  },

  team_assignment: {
    subject: 'Asignación de equipo {{temporada}} - {{club_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Te confirmamos la asignación de <strong>{{jugador_nombre}}</strong> para la temporada <strong>{{temporada}}</strong>:</p>
<div style="background:#f8fafc;border-left:3px solid {{color_marca}};padding:14px 18px;border-radius:8px;margin:18px 0">
  <p style="margin:0 0 6px"><strong>Equipo:</strong> {{equipo}}</p>
  <p style="margin:0"><strong>Cuerpo técnico:</strong> {{entrenador_nombre}}</p>
</div>
{{#fecha_limite}}<p>Para confirmar la plaza, te pedimos completar el pago de la reserva antes del <strong>{{fecha_limite}}</strong>.</p>{{/fecha_limite}}
{{#link_pago}}<p style="text-align:center;margin:24px 0">
  <a href="{{link_pago}}" style="background:{{color_marca}};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Pagar reserva</a>
</p>{{/link_pago}}
{{#docs_solicitados}}<p>También necesitamos la siguiente documentación:</p>
<div style="margin:12px 0">{{docs_solicitados}}</div>
<p style="text-align:center;margin:20px 0">
  <a href="{{link_subir_docs}}" style="color:{{color_marca}};font-weight:600">Subir documentos →</a>
</p>{{/docs_solicitados}}`,
  },

  request_docs: {
    subject: 'Documentación pendiente - {{jugador_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Para tramitar la ficha federativa de <strong>{{jugador_nombre}}</strong> necesitamos la siguiente documentación:</p>
<div style="margin:14px 0">{{docs_solicitados}}</div>
<p>Puedes subirlos de forma segura en el siguiente enlace (solo válido para este jugador):</p>
<p style="text-align:center;margin:24px 0">
  <a href="{{link_subir_docs}}" style="background:{{color_marca}};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Subir documentación →</a>
</p>
<p style="font-size:13px;color:#64748b">Si tienes dudas, responde a este correo.</p>`,
  },

  wants_to_continue_yes: {
    subject: '¡Confirmación recibida! - {{club_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Hemos recibido vuestra respuesta y nos alegra confirmar que contamos con <strong>{{jugador_nombre}}</strong> para la próxima temporada.</p>
<p>En las próximas semanas recibiréis la información sobre la asignación de equipo y la reserva de plaza.</p>`,
  },

  wants_to_continue_no: {
    subject: 'Respuesta registrada - {{club_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Hemos registrado vuestra respuesta y confirmamos que <strong>{{jugador_nombre}}</strong> no continuará en el club la próxima temporada.</p>
<p>Os agradecemos el tiempo compartido y os deseamos lo mejor en esta nueva etapa.</p>`,
  },

  dismissed_requirements: {
    subject: 'Información sobre la inscripción {{temporada}} - {{club_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Gracias por la confianza depositada en <strong>{{club_nombre}}</strong> y el tiempo que <strong>{{jugador_nombre}}</strong> ha compartido con nosotros.</p>
<p>Lamentamos comunicarte que, tras revisar los requisitos de inscripción para la temporada <strong>{{temporada}}</strong>, en esta ocasión no podemos confirmar la continuidad de su plaza.</p>
<p>Si tienes alguna pregunta sobre esta decisión, no dudes en contactar con la secretaría del club.</p>
<p>Le deseamos lo mejor a <strong>{{jugador_nombre}}</strong> en su trayectoria.</p>`,
  },

  dismissed_non_payment: {
    subject: 'Plaza liberada - {{club_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>No hemos recibido el pago de la reserva de plaza de <strong>{{jugador_nombre}}</strong> en el plazo correspondiente.</p>
<p>Por este motivo, la plaza queda liberada y no podremos contar con el/la jugador/a para la próxima temporada.</p>
<p>Si crees que se trata de un error, contacta con la secretaría del club lo antes posible.</p>`,
  },

  payment_receipt: {
    subject: 'Recibo de pago - {{jugador_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Confirmamos la recepción del pago de <strong>{{importe_pagado}}</strong> correspondiente a <strong>{{concepto}}</strong> de <strong>{{jugador_nombre}}</strong>.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px 18px;border-radius:8px;margin:18px 0">
  <p style="margin:0 0 6px"><strong>Concepto:</strong> {{concepto}}</p>
  <p style="margin:0 0 6px"><strong>Importe:</strong> {{importe_pagado}}</p>
  <p style="margin:0"><strong>Fecha:</strong> {{fecha_pago}}</p>
</div>
<p style="font-size:13px;color:#64748b">Conserva este correo como justificante. Si necesitas factura, responde a este mensaje.</p>`,
  },

  payment_reminder: {
    subject: 'Cuota pendiente - {{jugador_nombre}}',
    body: `<p>Hola <strong>{{tutor_nombre}}</strong>,</p>
<p>Te escribimos para recordarte que hay una cuota pendiente de pago de <strong>{{jugador_nombre}}</strong>:</p>
<div style="background:#fef3c7;border-left:3px solid #f59e0b;padding:14px 18px;border-radius:8px;margin:18px 0">
  <p style="margin:0 0 6px"><strong>Concepto:</strong> {{concepto}}</p>
  <p style="margin:0"><strong>Importe pendiente:</strong> {{importe_deuda}}</p>
</div>
{{#link_pago}}<p style="text-align:center;margin:24px 0">
  <a href="{{link_pago}}" style="background:{{color_marca}};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Pagar ahora</a>
</p>{{/link_pago}}
{{#club_iban}}<p style="font-size:13px;color:#64748b">También puedes hacer transferencia a:<br>
<strong>IBAN:</strong> {{club_iban}}<br>
<strong>Titular:</strong> {{club_titular}}<br>
<strong>Concepto:</strong> {{jugador_nombre}} - {{concepto}}</p>{{/club_iban}}
<p style="font-size:13px;color:#64748b">Si ya has hecho el pago, ignora este mensaje.</p>`,
  },

  coach_invitation: {
    subject: 'Invitación al cuerpo técnico - {{club_nombre}}',
    body: `<p>Hola{{#jugador_nombre}} <strong>{{jugador_nombre}}</strong>{{/jugador_nombre}},</p>
<p>Te damos la bienvenida al cuerpo técnico de <strong>{{club_nombre}}</strong> para la temporada <strong>{{temporada}}</strong>.</p>
<p>Para completar tu alta como entrenador, por favor rellena el siguiente formulario con tus datos:</p>
<p style="text-align:center;margin:24px 0">
  <a href="{{link_inscripcion}}" style="background:{{color_marca}};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Rellenar formulario</a>
</p>
<p style="font-size:13px;color:#64748b">Si tienes cualquier duda, no dudes en contactar con la coordinación del club.</p>`,
  },
}

/**
 * Catálogo de variables que el editor del club puede insertar. Se exporta para
 * que la UI muestre el dropdown de "insertar variable" con descripción + ejemplo.
 *
 * Cualquier variable que el editor escriba con {{xxx}} y NO esté en esta lista
 * se sustituye por cadena vacía (no por el literal {{xxx}} — eso queda feo).
 */
export const CATALOGO_VARIABLES = [
  // Jugador
  { key: 'jugador_nombre',     desc: 'Nombre completo del jugador', ejemplo: 'Lucas García López' },
  { key: 'jugador_fecha_nac',  desc: 'Fecha de nacimiento',         ejemplo: '15/03/2014' },
  { key: 'jugador_dni',        desc: 'DNI/NIE del jugador',         ejemplo: '12345678A' },
  { key: 'categoria',          desc: 'Categoría del jugador',       ejemplo: 'Alevín' },
  // Tutor
  { key: 'tutor_nombre',       desc: 'Nombre del tutor',            ejemplo: 'María López' },
  { key: 'tutor_email',        desc: 'Email del tutor',             ejemplo: 'maria@ejemplo.com' },
  // Club
  { key: 'club_nombre',        desc: 'Nombre del club',             ejemplo: 'E.F. Ciudad de Getafe' },
  { key: 'club_email_contacto',desc: 'Email de contacto del club',  ejemplo: 'secretaria@club.com' },
  { key: 'club_iban',          desc: 'IBAN del club',               ejemplo: 'ES12 3456 7890 1234 5678 9012' },
  { key: 'club_titular',       desc: 'Titular de la cuenta',        ejemplo: 'E.F. Ciudad de Getafe' },
  { key: 'club_banco',         desc: 'Banco del club',              ejemplo: 'CaixaBank' },
  { key: 'color_marca',        desc: 'Color principal del club (botones)', ejemplo: '#EC4899' },
  // Temporada
  { key: 'temporada',          desc: 'Temporada destino',           ejemplo: '2026/27' },
  { key: 'temporada_actual',   desc: 'Temporada actual',            ejemplo: '2025/26' },
  // Equipo/Entrenador
  { key: 'equipo',             desc: 'Equipo asignado',             ejemplo: 'Alevín B' },
  { key: 'entrenador_nombre',  desc: 'Nombre del entrenador',       ejemplo: 'Alvaro Fernández' },
  // Pagos
  { key: 'importe_reserva',    desc: 'Importe de la reserva',       ejemplo: '60,00 €' },
  { key: 'importe_deuda',      desc: 'Importe pendiente',           ejemplo: '120,00 €' },
  { key: 'importe_pagado',     desc: 'Importe pagado',              ejemplo: '60,00 €' },
  { key: 'concepto',           desc: 'Concepto del pago',           ejemplo: 'Reserva de plaza' },
  { key: 'fecha_pago',         desc: 'Fecha del pago',              ejemplo: '15 de junio de 2026' },
  { key: 'fecha_limite',       desc: 'Fecha límite (reserva, respuesta...)', ejemplo: '8 de mayo de 2026' },
  // Links
  { key: 'link_pago',          desc: 'Link de pago Stripe (si está configurado)', ejemplo: 'https://...' },
  { key: 'link_renovacion',    desc: 'Link al formulario de renovación', ejemplo: 'https://cluberly.club/renovacion/...' },
  { key: 'link_inscripcion',   desc: 'Link al formulario de inscripción', ejemplo: 'https://cluberly.club/inscripcion/...' },
  { key: 'link_subir_docs',    desc: 'Link para subir documentos del jugador', ejemplo: 'https://cluberly.club/subir-documentos/...' },
  { key: 'link_recibo',        desc: 'Link al recibo del pago (PDF)',ejemplo: 'https://...' },
  // Sanciones (epic 3)
  { key: 'sancion_motivo',     desc: 'Motivo de la sanción',        ejemplo: 'Acumulación de tarjetas' },
  { key: 'sancion_partidos',   desc: 'Partidos de sanción',         ejemplo: '2' },
  { key: 'sancion_importe',    desc: 'Importe de la sanción',       ejemplo: '15,00 €' },
  // Docs solicitados (HTML lista)
  { key: 'docs_solicitados',   desc: 'Lista de documentos solicitados', ejemplo: '<ul><li>DNI</li><li>Foto</li></ul>' },
] as const

export type VariableKey = (typeof CATALOGO_VARIABLES)[number]['key']

// ─── Render principal ────────────────────────────────────────────────────────

/**
 * Renderiza un email completo (subject + html + text) listo para enviar.
 * - Lee plantilla de email_templates por (club_id, event_type) si existe enabled.
 * - Si no, usa DEFAULT_TEMPLATES (red de seguridad).
 * - Sustituye variables {{xxx}} con escape HTML.
 * - Soporta bloques condicionales {{#var}}...{{/var}}.
 * - Aplica wrapper visual con branding del club.
 */
export async function renderClubEmail(
  eventType: EmailEventType,
  clubId: string,
  vars: EmailVars,
): Promise<RenderedEmail> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // 1. Cargar club + settings (para wrapper y reply-to)
  const [{ data: club }, { data: settings }] = await Promise.all([
    sb.from('clubs').select('name, logo_url, primary_color').eq('id', clubId).maybeSingle(),
    sb.from('club_settings').select('contact_email, email_from_label').eq('club_id', clubId).maybeSingle(),
  ])
  const clubName = (club?.name as string) || 'el club'
  const wrapperCtx: WrapperContext = {
    clubName,
    clubLogo: club?.logo_url ?? null,
    primaryColor: club?.primary_color ?? null,
    contactEmail: settings?.contact_email ?? null,
  }

  // 2. Inyectar variables automáticas que SIEMPRE están disponibles
  const allVars: EmailVars = {
    club_nombre: clubName,
    club_email_contacto: settings?.contact_email ?? '',
    color_marca: club?.primary_color ?? '#2563eb',
    ...vars,
  }

  // 3. Resolver plantilla: BD primero, fallback código
  const { data: tpl } = await sb
    .from('email_templates')
    .select('subject, body_html, body_text, from_name, enabled')
    .eq('club_id', clubId)
    .eq('event_type', eventType)
    .eq('active', true)
    .eq('enabled', true)
    .maybeSingle()

  const defTpl = DEFAULT_TEMPLATES[eventType] ?? {
    subject: 'Notificación de {{club_nombre}}',
    body: '<p>Hola {{tutor_nombre}}.</p>',
  }
  const rawSubject = (tpl?.subject as string) || defTpl.subject
  const rawBodyHtml = (tpl?.body_html as string) || defTpl.body
  const rawBodyText = (tpl?.body_text as string) || htmlToText(rawBodyHtml)

  // 4. Sustituir variables
  const subject  = substitute(rawSubject, allVars, /* escape */ false)
  const bodyHtml = substitute(rawBodyHtml, allVars, /* escape */ true)
  const bodyText = substitute(rawBodyText, allVars, /* escape */ false)

  // 5. Aplicar wrapper
  const html = wrapEmailHtml(bodyHtml, wrapperCtx)
  const text = wrapEmailText(bodyText, wrapperCtx)

  // 6. fromName / replyTo (consumidos por send.ts)
  const fromName = (tpl?.from_name as string)
    || settings?.email_from_label
    || `Cluberly · ${clubName}`
  const replyTo = settings?.contact_email || undefined

  return { subject, html, text, fromName, replyTo }
}

// ─── Sustitución de variables ────────────────────────────────────────────────

/**
 * Sustituye {{vars}} y resuelve bloques {{#var}}...{{/var}}.
 * - Bloque condicional: incluye el contenido SOLO si vars[key] es truthy y no
 *   cadena vacía. Útil para "si hay deadline → mostrar la frase con deadline".
 * - Variable simple: escapa HTML si `escape=true` (cuerpo HTML), no escapa
 *   si `escape=false` (subject, texto plano).
 * - Variable desconocida → cadena vacía (no deja {{xxx}} literal).
 */
function substitute(tpl: string, vars: EmailVars, escape: boolean): string {
  // 1. Resolver bloques condicionales (NO anidados: limitación voluntaria).
  // Patrón: {{#var}}contenido{{/var}}  →  contenido si var truthy, "" si falsy.
  let out = tpl.replace(
    /\{\{#([a-z_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_match, key, content) => {
      const v = vars[key]
      const truthy = v !== undefined && v !== null && String(v).length > 0
      return truthy ? content : ''
    },
  )

  // 2. Resolver variables simples {{var}}.
  out = out.replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => {
    const v = vars[key]
    if (v === undefined || v === null) return ''
    const s = String(v)
    return escape ? escHtml(s) : s
  })

  return out
}

/**
 * Conversión muy básica de HTML a texto plano para multipart text/plain.
 * No es perfecto, pero suficiente para correos transaccionales cortos.
 * (Tags conocidos: <br>, <p>, <strong>, <em>, <a href>, listas.)
 */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
