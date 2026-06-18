'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMarketingEmail } from '@/lib/email/marketing-send'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createHmac } from 'crypto'

async function requireSuperadmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = await headers()
  if (h.get('x-platform-role') === 'superadmin') return { ok: true }
  // Fallback BD (consistente con el resto del sistema)
  const { createClient } = await import('@/lib/supabase/server')
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Sin sesión' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? { ok: true } : { ok: false, error: 'Sin permisos' }
}

function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '$2 ( $1 )')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Token de unsubscribe ligado al send.id (nonce real) — no enumerable.
 * Antes era HMAC(clubId), filtrable y reutilizable.
 */
function unsubscribeToken(sendId: string): string {
  const secret = process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'
  return createHmac('sha256', secret).update(sendId).digest('hex').slice(0, 32)
}

export async function unsubscribeUrl(clubId: string, sendId: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
  return `${base}/api/marketing/unsubscribe?c=${clubId}&s=${sendId}&t=${unsubscribeToken(sendId)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado siguiente según plantilla (cadena email_1 -> email_2 -> email_3)
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATE_TO_NEXT_STATUS: Record<string, string> = {
  email_1: 'sent_1',
  email_2: 'sent_2',
  email_3: 'sent_3',
}

const TEMPLATE_REQUIRED_STATUS: Record<string, string> = {
  email_1: 'pending',
  email_2: 'sent_1',
  email_3: 'sent_2',
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: enviar una plantilla a una lista de clubes con claim atómico
// ─────────────────────────────────────────────────────────────────────────────
async function sendBatchInternal(clubIds: string[], templateKey: string = 'email_1') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  // A/B test: traer todas las variantes activas. Se elige una por club_id (hash determinista).
  const { data: tpls } = await sb.from('marketing_templates').select('*').eq('key', templateKey).eq('active', true)
  if (!tpls || tpls.length === 0 || !settings) return { success: false as const, error: `Plantilla ${templateKey} o settings sin configurar` }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variants: any[] = tpls as any[]
  function pickVariant(clubId: string) {
    // Hash determinista del UUID -> índice de variante (50/50 si hay 2)
    let h = 0
    for (let i = 0; i < clubId.length; i++) h = ((h << 5) - h + clubId.charCodeAt(i)) | 0
    return variants[Math.abs(h) % variants.length]
  }

  const requiredStatus = TEMPLATE_REQUIRED_STATUS[templateKey]
  const nextStatus = TEMPLATE_TO_NEXT_STATUS[templateKey]
  if (!requiredStatus || !nextStatus) return { success: false as const, error: `Plantilla ${templateKey} no soportada` }

  let sent = 0, failed = 0, skipped = 0
  const errors: string[] = []

  for (const clubId of clubIds) {
    // CLAIM ATÓMICO: solo procesar si está en el estado esperado para esta plantilla
    const { data: claimed } = await sb
      .from('marketing_clubs')
      .update({ queued_at: new Date().toISOString() })
      .eq('id', clubId)
      .eq('status', requiredStatus)
      .eq('excluded', false)
      .select('id, name, email, location, federation, status')
      .maybeSingle()

    if (!claimed) { skipped++; continue }

    // Selección de variante A/B determinista por club_id
    const tpl = pickVariant(claimed.id)

    const { data: sendRow, error: insErr } = await sb
      .from('marketing_email_sends')
      .insert({
        club_id: claimed.id,
        template_key: templateKey,
        template_variant: tpl.variant,
        subject: 'pending',
        bounced: false,
      })
      .select('id')
      .single()

    if (insErr || !sendRow) {
      await sb.from('marketing_clubs').update({ queued_at: null }).eq('id', claimed.id)
      skipped++
      continue
    }

    // URL-encode club_name para que sea seguro en query strings de links del email
    const clubNameUrl = encodeURIComponent(claimed.name)
    const vars = {
      club_name: claimed.name,
      location: claimed.location || 'tu zona',
      federation: claimed.federation || '',
      unsubscribe_url: await unsubscribeUrl(claimed.id, sendRow.id),
      send_id: sendRow.id,
      club_url: clubNameUrl,
    }
    const subject = renderTemplate(tpl.subject, vars)
    const html = renderTemplate(tpl.body_html, vars)
    // text/plain: usa body_text de la plantilla si existe, si no lo genera del HTML
    const rawText = tpl.body_text ? renderTemplate(tpl.body_text, vars) : htmlToPlainText(html)

    const result = await sendMarketingEmail({
      to: claimed.email,
      subject,
      html,
      text: rawText,
      fromName: settings.from_name,
      replyTo: settings.reply_to || settings.from_email,
      unsubscribeUrl: vars.unsubscribe_url,
    })

    if (result.sent) {
      await sb.from('marketing_email_sends').update({ subject }).eq('id', sendRow.id)
      await sb.from('marketing_clubs')
        .update({ status: nextStatus, last_sent_at: new Date().toISOString(), queued_at: null })
        .eq('id', claimed.id)
      sent++
    } else {
      await sb.from('marketing_email_sends').update({ subject, bounced: true, error: result.error ?? 'unknown' }).eq('id', sendRow.id)
      await sb.from('marketing_clubs')
        .update({ status: 'bounced', notes: `Error en ${templateKey}: ${result.error}`, queued_at: null })
        .eq('id', claimed.id)
      failed++
      errors.push(`${claimed.email}: ${result.error}`)
    }

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
  }

  revalidatePath('/superadmin/campanas')
  return { success: true as const, sent, failed, skipped, message: `${sent} enviados, ${failed} fallos, ${skipped} ya cogidos por otro proceso o duplicados` }
}

// ─────────────────────────────────────────────────────────────────────────────
// runCampaignBatch — usado por cron y por botón "Enviar X ahora por prioridad"
// ─────────────────────────────────────────────────────────────────────────────
export async function runCampaignBatch(opts?: { force?: boolean; max?: number }) {
  if (!opts?.force) {
    const auth = await requireSuperadmin()
    if (!auth.ok) return { success: false, error: auth.error }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!settings) return { success: false, error: 'Sin settings' }
  if (settings.is_paused) return { success: false, error: 'Campaña pausada' }

  const cap: number = Math.min(500, Math.max(1, opts?.max ?? settings.daily_send_cap ?? 50))
  const { count: sentToday } = await sb
    .from('marketing_email_sends')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  const remaining = Math.max(0, cap - (sentToday ?? 0))
  if (remaining === 0) return { success: true, sent: 0, message: `Ya enviados hoy: ${sentToday}/${cap}` }

  // Cogemos IDs ordenados por prioridad — el claim atómico se hace dentro de sendBatchInternal
  const { data: clubs } = await sb
    .from('marketing_clubs')
    .select('id')
    .eq('status', 'pending')
    .eq('excluded', false)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(remaining)

  if (!clubs || clubs.length === 0) return { success: true, sent: 0, message: 'No quedan clubes pendientes' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sendBatchInternal(clubs.map((c: any) => c.id))
}

type BatchResult =
  | { success: true; sent: number; failed: number; skipped: number; message: string }
  | { success: false; error: string }

export async function sendToSelected(clubIds: string[], templateKey: string = 'email_1'): Promise<BatchResult> {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!Array.isArray(clubIds) || clubIds.length === 0) return { success: false, error: 'Sin clubes seleccionados' }
  if (clubIds.length > 100) return { success: false, error: 'Máximo 100 por tanda manual (limite Gmail/runtime)' }
  return sendBatchInternal(clubIds, templateKey)
}

// ─────────────────────────────────────────────────────────────────────────────
// runFollowupBatch — manda email_2 (a sent_1 con >=4d) o email_3 (a sent_2 con >=5d)
// que NO hayan respondido. Cron diario lo invoca.
// ─────────────────────────────────────────────────────────────────────────────
export async function runFollowupBatch(opts?: { force?: boolean }): Promise<BatchResult> {
  if (!opts?.force) {
    const auth = await requireSuperadmin()
    if (!auth.ok) return { success: false, error: auth.error }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!settings) return { success: false, error: 'Sin settings' }
  if (settings.is_paused) return { success: false, error: 'Campaña pausada' }

  // Cap diario total: cuenta TODOS los envíos del día (email_1 + email_2 + email_3)
  const { count: sentToday } = await sb
    .from('marketing_email_sends')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  const cap: number = Math.min(500, Math.max(1, settings.daily_send_cap ?? 50))
  const remaining = Math.max(0, cap - (sentToday ?? 0))
  if (remaining === 0) return { success: true, sent: 0, failed: 0, skipped: 0, message: `Cap alcanzado hoy: ${sentToday}/${cap}` }

  // Reservamos 60% del cap restante para email_2, 40% para email_3 (email_2 es el más rentable)
  const cap2 = Math.ceil(remaining * 0.6)
  const cap3 = remaining - cap2

  const now = new Date()
  const fourDaysAgo = new Date(now.getTime() - 4 * 86400_000).toISOString()
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400_000).toISOString()

  // sent_1 con >=4d sin reply → email_2
  const { data: candidates2 } = await sb
    .from('marketing_clubs')
    .select('id')
    .eq('status', 'sent_1')
    .eq('excluded', false)
    .is('reply_at', null)
    .lte('last_sent_at', fourDaysAgo)
    .order('priority', { ascending: true })
    .order('last_sent_at', { ascending: true })
    .limit(cap2)

  // sent_2 con >=5d sin reply → email_3
  const { data: candidates3 } = await sb
    .from('marketing_clubs')
    .select('id')
    .eq('status', 'sent_2')
    .eq('excluded', false)
    .is('reply_at', null)
    .lte('last_sent_at', fiveDaysAgo)
    .order('priority', { ascending: true })
    .order('last_sent_at', { ascending: true })
    .limit(cap3)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids2: string[] = (candidates2 ?? []).map((c: any) => c.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ids3: string[] = (candidates3 ?? []).map((c: any) => c.id)

  const r2 = ids2.length > 0 ? await sendBatchInternal(ids2, 'email_2') : { success: true as const, sent: 0, failed: 0, skipped: 0, message: '' }
  const r3 = ids3.length > 0 ? await sendBatchInternal(ids3, 'email_3') : { success: true as const, sent: 0, failed: 0, skipped: 0, message: '' }

  const totalSent = (r2.success ? r2.sent : 0) + (r3.success ? r3.sent : 0)
  const totalFailed = (r2.success ? r2.failed : 0) + (r3.success ? r3.failed : 0)
  const totalSkipped = (r2.success ? r2.skipped : 0) + (r3.success ? r3.skipped : 0)
  return {
    success: true,
    sent: totalSent,
    failed: totalFailed,
    skipped: totalSkipped,
    message: `email_2: ${r2.success ? r2.sent : 0}, email_3: ${r3.success ? r3.sent : 0}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings + edición (con validación)
// ─────────────────────────────────────────────────────────────────────────────
export async function pauseCampaign(paused: boolean) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { error } = await sb.from('marketing_settings').update({ is_paused: paused, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return { success: false, error: error.message }
  revalidatePath('/superadmin/campanas')
  return { success: true }
}

export async function updateDailyCap(cap: number) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  const n = Math.floor(Number(cap))
  if (!Number.isFinite(n) || n < 1 || n > 500) {
    return { success: false, error: 'Cap inválido: debe estar entre 1 y 500' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { error } = await sb.from('marketing_settings').update({ daily_send_cap: n, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return { success: false, error: error.message }
  revalidatePath('/superadmin/campanas')
  return { success: true }
}

export async function updateTemplate(key: string, subject: string, body_html: string) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!subject || subject.trim().length < 3) return { success: false, error: 'Asunto demasiado corto' }
  if (subject.length > 200) return { success: false, error: 'Asunto demasiado largo (200 max)' }
  if (!body_html || body_html.trim().length < 50) return { success: false, error: 'Cuerpo demasiado corto' }
  if (body_html.length > 50_000) return { success: false, error: 'Cuerpo demasiado largo (50k max)' }
  if (!/\{\{unsubscribe_url\}\}/.test(body_html)) {
    return { success: false, error: 'El cuerpo debe incluir {{unsubscribe_url}} (obligatorio anti-spam y RGPD)' }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { error } = await sb.from('marketing_templates')
    .upsert({ key, subject, body_html, active: true, updated_at: new Date().toISOString() })
  if (error) return { success: false, error: error.message }
  revalidatePath('/superadmin/campanas')
  return { success: true }
}

export async function markReplied(clubId: string) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('marketing_clubs').update({ status: 'replied', reply_at: new Date().toISOString() }).eq('id', clubId)
  revalidatePath('/superadmin/campanas')
  return { success: true }
}

export async function toggleExcluded(clubId: string, excluded: boolean) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('marketing_clubs').update({ excluded }).eq('id', clubId)
  revalidatePath('/superadmin/campanas')
  return { success: true }
}

export async function bulkToggleExcluded(clubIds: string[], excluded: boolean) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!Array.isArray(clubIds) || clubIds.length === 0) return { success: false, error: 'Sin clubes' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('marketing_clubs').update({ excluded }).in('id', clubIds)
  revalidatePath('/superadmin/campanas')
  return { success: true, count: clubIds.length }
}

export async function setPriority(clubId: string, priority: number) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  const n = Math.floor(Number(priority))
  if (!Number.isFinite(n) || n < 1 || n > 999) return { success: false, error: 'Prioridad 1-999' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('marketing_clubs').update({ priority: n }).eq('id', clubId)
  revalidatePath('/superadmin/campanas')
  return { success: true }
}

export async function bulkSetPriority(clubIds: string[], priority: number) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  const n = Math.floor(Number(priority))
  if (!Number.isFinite(n) || n < 1 || n > 999) return { success: false, error: 'Prioridad 1-999' }
  if (!Array.isArray(clubIds) || clubIds.length === 0) return { success: false, error: 'Sin clubes' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('marketing_clubs').update({ priority: n }).in('id', clubIds)
  revalidatePath('/superadmin/campanas')
  return { success: true, count: clubIds.length }
}

export async function sendTestEmail(targetEmail: string) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) return { success: false, error: 'Email inválido' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: templates } = await sb.from('marketing_templates').select('*').eq('key', 'email_1').eq('active', true).order('variant')
  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!templates?.length) return { success: false, error: 'No hay plantillas email_1 activas en la BD' }
  if (!settings) return { success: false, error: 'No hay marketing_settings (id=1) en la BD' }

  const clubName = 'Club de Prueba'
  const vars = {
    club_name: clubName,
    club_url: encodeURIComponent(clubName),
    location: 'Madrid',
    federation: 'RFFM',
    send_id: 'test',
    unsubscribe_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'}/api/marketing/unsubscribe?c=test&s=test&t=test`,
  }
  const errors: string[] = []
  for (const tpl of templates) {
    const result = await sendMarketingEmail({
      to: targetEmail,
      subject: `[TEST-${tpl.variant}] ${renderTemplate(tpl.subject, vars)}`,
      html: renderTemplate(tpl.body_html, vars),
      fromName: settings.from_name,
      replyTo: settings.reply_to || settings.from_email,
    })
    if (!result.sent) errors.push(`Variante ${tpl.variant}: ${result.error}`)
  }
  if (errors.length === templates.length) return { success: false, error: errors.join(' | ') }
  return { success: true }
}
