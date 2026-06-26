'use server'

import { getScopedClient } from '@/lib/supabase/scoped-client'
import { renderClubEmail, CATALOGO_VARIABLES, type EmailEventType } from '@/lib/email/render-template'
import { sendHtmlEmail } from '@/lib/email/send'
import { revalidatePath } from 'next/cache'

// ── Tipos de email gestionables desde la UI ─────────────────────────────────
// Orden de presentación en la barra lateral del editor. Lo que NO está en esta
// lista no se muestra (por ejemplo el legacy de marketing vive en otra UI).
export const EVENT_TYPES: { key: EmailEventType; label: string; description: string }[] = [
  { key: 'fill_form',              label: 'Confirmación de inscripción',  description: 'Se envía al tutor para que confirme si el jugador continúa la próxima temporada.' },
  { key: 'wants_to_continue_yes',  label: 'Renovación: SÍ continúa',      description: 'Acuse de recibo cuando la familia confirma que el jugador continúa.' },
  { key: 'wants_to_continue_no',   label: 'Renovación: NO continúa',      description: 'Acuse de recibo cuando la familia confirma que el jugador no continúa.' },
  { key: 'team_assignment',        label: 'Asignación de equipo',         description: 'Comunica el equipo asignado para la próxima temporada y la reserva de plaza.' },
  { key: 'request_docs',           label: 'Solicitud de documentación',   description: 'Envía un enlace seguro para que la familia suba la documentación del jugador.' },
  { key: 'dismissed_requirements', label: 'Plaza denegada (requisitos)',  description: 'Notifica que no se confirma la continuidad por requisitos de inscripción.' },
  { key: 'dismissed_non_payment',  label: 'Plaza liberada (impago)',      description: 'Notifica que la plaza queda liberada por no haberse abonado la reserva.' },
  { key: 'payment_receipt',        label: 'Recibo de pago',               description: 'Confirmación de pago con justificante PDF adjunto.' },
  { key: 'payment_reminder',       label: 'Recordatorio de cuota',        description: 'Aviso de cuota pendiente con datos bancarios y/o link de pago.' },
  { key: 'coach_invitation',       label: 'Invitación a entrenador',      description: 'Email al entrenador para que rellene su formulario de inscripción.' },
]

export interface EmailTemplateRow {
  id: string | null              // null = el club aún no tiene fila propia (usa default)
  event_type: EmailEventType
  name: string
  subject: string
  body_html: string
  body_text: string | null
  from_name: string | null
  active: boolean
  enabled: boolean
  is_default: boolean
  updated_at: string | null
}

/**
 * Lista todas las plantillas del club. Para los event_type sin fila propia,
 * devuelve un placeholder con id=null y los valores DEFAULT del código para que
 * la UI pueda mostrar y permitir editar/personalizar desde cero.
 */
export async function listEmailTemplates(): Promise<{
  success: boolean; error?: string; templates?: EmailTemplateRow[]
}> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    const { data: rows, error } = await sb
      .from('email_templates')
      .select('id, event_type, name, subject, body_html, body_text, from_name, active, enabled, is_default, updated_at')
      .eq('club_id', clubId)
      .eq('active', true)
    if (error) return { success: false, error: error.message }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byEvent = new Map<string, any>()
    for (const r of (rows ?? [])) byEvent.set(r.event_type, r)

    const templates: EmailTemplateRow[] = EVENT_TYPES.map((et) => {
      const r = byEvent.get(et.key)
      if (r) return r as EmailTemplateRow
      // No hay fila → placeholder con default. UI permite "Crear plantilla".
      return {
        id: null,
        event_type: et.key,
        name: et.label,
        subject: '',         // vacío → UI muestra "(Por defecto)"
        body_html: '',       // vacío → UI muestra el body por defecto (CSS gris)
        body_text: null,
        from_name: null,
        active: true,
        enabled: true,
        is_default: true,
        updated_at: null,
      }
    })
    return { success: true, templates }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Guarda (insert o update) una plantilla. Si NO existe fila propia para ese
 * event_type, la crea. Si existe, actualiza subject + body_html + enabled.
 * Garantiza UNIQUE (club_id, event_type) gracias al índice parcial de la mig. 067.
 */
export async function saveEmailTemplate(input: {
  eventType: EmailEventType
  subject: string
  body_html: string
  enabled?: boolean
  from_name?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    if (!input.subject.trim()) return { success: false, error: 'El asunto no puede estar vacío.' }
    if (!input.body_html.trim()) return { success: false, error: 'El cuerpo no puede estar vacío.' }

    const eventInfo = EVENT_TYPES.find(e => e.key === input.eventType)
    if (!eventInfo) return { success: false, error: 'Tipo de email desconocido' }

    const { data: existing } = await sb.from('email_templates')
      .select('id').eq('club_id', clubId).eq('event_type', input.eventType)
      .eq('active', true).maybeSingle()

    if (existing?.id) {
      const { error } = await sb.from('email_templates').update({
        subject: input.subject,
        body_html: input.body_html,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.from_name !== undefined ? { from_name: input.from_name } : {}),
        is_default: false,    // ya no es default — el club lo personalizó
      }).eq('id', existing.id)
      if (error) return { success: false, error: error.message }
    } else {
      const { error } = await sb.from('email_templates').insert({
        club_id: clubId,
        event_type: input.eventType,
        name: eventInfo.label,
        subject: input.subject,
        body_html: input.body_html,
        enabled: input.enabled ?? true,
        from_name: input.from_name ?? null,
        active: true,
        is_default: false,
      })
      if (error) return { success: false, error: error.message }
    }
    revalidatePath('/configuracion/plantillas-email')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Resetear una plantilla a su default (borra la fila → en próxima lectura sale
 * el contenido del código). Es la forma limpia: no clonamos el default en BD,
 * el render-template ya cae al default si no hay fila enabled.
 */
export async function resetEmailTemplate(eventType: EmailEventType): Promise<{ success: boolean; error?: string }> {
  try {
    const { sb, clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    const { error } = await sb.from('email_templates').delete()
      .eq('club_id', clubId).eq('event_type', eventType)
    if (error) return { success: false, error: error.message }
    revalidatePath('/configuracion/plantillas-email')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Render de PREVIEW: usa los valores de ejemplo del CATALOGO_VARIABLES para
 * mostrar al usuario cómo se verá el email final. No persiste nada.
 * Si subject/body se pasan como overrides (editor en vivo), los usa en vez de
 * la fila de BD — así el editor refresca el preview sin tener que guardar.
 */
export async function previewEmailTemplate(input: {
  eventType: EmailEventType
  subjectOverride?: string
  bodyOverride?: string
}): Promise<{ success: boolean; error?: string; html?: string; subject?: string; text?: string }> {
  try {
    const { clubId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }

    // Vars de ejemplo desde el catálogo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sampleVars: Record<string, any> = {}
    for (const v of CATALOGO_VARIABLES) sampleVars[v.key] = v.ejemplo

    // Si vienen overrides (texto del editor en vivo) → upsert temporal en
    // memoria: el render lee de BD, así que insertamos lógica de "antes de
    // renderizar, parchea". Para simplificar, hacemos el render normal y luego
    // un segundo render con overrides reemplazando la plantilla del editor.
    if (input.subjectOverride !== undefined || input.bodyOverride !== undefined) {
      // Render desde cero con overrides usando un helper interno
      const { renderClubEmailWithOverride } = await import('@/lib/email/render-template')
      const result = await renderClubEmailWithOverride(
        input.eventType,
        clubId,
        sampleVars,
        { subject: input.subjectOverride, bodyHtml: input.bodyOverride },
      )
      return { success: true, html: result.html, subject: result.subject, text: result.text }
    }

    const result = await renderClubEmail(input.eventType, clubId, sampleVars)
    return { success: true, html: result.html, subject: result.subject, text: result.text }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Envía un email de PRUEBA al email del usuario logueado para validar el render
 * end-to-end (incluyendo transporte SMTP/Gmail). Usa valores de ejemplo.
 */
export async function sendTestEmail(input: {
  eventType: EmailEventType
  subjectOverride?: string
  bodyOverride?: string
}): Promise<{ success: boolean; error?: string; sentTo?: string }> {
  try {
    const { sb, clubId, memberId, roles } = await getScopedClient()
    if (!roles.some((r: string) => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Solo admin / dirección' }
    }
    if (!memberId) return { success: false, error: 'No autenticado' }
    const { data: me } = await sb.from('club_members')
      .select('email').eq('id', memberId).maybeSingle()
    const myEmail = (me?.email as string) || ''
    if (!myEmail) return { success: false, error: 'Tu cuenta no tiene email configurado' }

    const preview = await previewEmailTemplate(input)
    if (!preview.success || !preview.html) return { success: false, error: preview.error ?? 'No se pudo renderizar' }

    // Resolver fromName + replyTo igual que el render real
    const { data: club } = await sb.from('clubs').select('name').eq('id', clubId).single()
    const { data: settings } = await sb.from('club_settings')
      .select('contact_email, email_from_label').eq('club_id', clubId).maybeSingle()
    const clubName = (club?.name as string) || 'el club'
    const fromName = settings?.email_from_label || `Cluberly · ${clubName}`
    const replyTo = settings?.contact_email || undefined

    const { sent, error } = await sendHtmlEmail({
      to: myEmail,
      subject: `[PRUEBA] ${preview.subject}`,
      html: preview.html,
      text: preview.text,
      fromName,
      replyTo,
    })
    if (!sent) return { success: false, error: error ?? 'Error enviando' }
    return { success: true, sentTo: myEmail }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Re-exporta CATALOGO_VARIABLES para que el componente cliente pueda
 *  alimentar el dropdown de insertar variable. */
export async function getVariablesCatalog(): Promise<{
  success: boolean; variables?: typeof CATALOGO_VARIABLES
}> {
  return { success: true, variables: CATALOGO_VARIABLES }
}
