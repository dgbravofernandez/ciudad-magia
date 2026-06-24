'use server'
/* eslint-disable no-restricted-imports -- superadmin marketing platform, no club_id context */

import { createAdminClient } from '@/lib/supabase/admin'
import { RECOVERY_TEMPLATES, type RecoveryTemplateKey } from '../lib/recovery-templates'
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

function wrapLinksForTracking(html: string, sendId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (match, url: string) => {
    if (url.includes('/api/marketing/unsubscribe')) return match
    if (url.includes('/api/marketing/click')) return match
    return `href="${base}/api/marketing/click/${sendId}?u=${encodeURIComponent(url)}"`
  })
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
  // SEC-6: fallo cerrado sin APP_SECRET (debe coincidir con api/marketing/unsubscribe).
  const secret = process.env.APP_SECRET
  if (!secret) throw new Error('APP_SECRET no configurado')
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
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
    const unsub = await unsubscribeUrl(claimed.id, sendRow.id)
    // demo_url: vídeo con datos RFFM solo para clubs de la federación Madrid
    const isRffm = (claimed.federation ?? '').toUpperCase().includes('RFFM')
    const demoUrl = `${base}/demo?s=${sendRow.id}&utm_source=email&utm_campaign=outbound${isRffm ? '&fed=rffm' : ''}`
    const vars = {
      club_name: claimed.name,
      location: claimed.location || 'tu zona',
      federation: claimed.federation || '',
      unsubscribe_url: unsub,
      send_id: sendRow.id,
      club_url: clubNameUrl,
      demo_url: demoUrl,
      reservar_url: `${base}/reservar`,
    }
    const subject = renderTemplate(tpl.subject, vars)
    const html = wrapLinksForTracking(renderTemplate(tpl.body_html, vars), sendRow.id)
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
      // email_1 = primer contacto frío: texto plano solo, sin List-Unsubscribe header.
      // El header List-Unsubscribe clasifica el email en Promociones automáticamente.
      coldOutreach: templateKey === 'email_1',
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
// computeDynamicCap — cap diario seguro basado en madurez del dominio y engagement
// Lógica de warming estándar de deliverability:
//   Fase 1  (0-7d):    40/día — dominio nuevo, poca reputación
//   Fase 2  (8-14d):   70/día — reputación básica
//   Fase 3 (15-28d):  110/día — dominio con historial positivo
//   Fase 4 (29-60d):  150/día — dominio maduro
//   Fase 5  (60d+):   200/día — máximo para dominios sin equipo dedicado
// Ajuste por engagement (últimos 50 enviados):
//   Open rate > 20% → +15% (inbox placement bueno)
//   Open rate < 10% → −25% (algo va mal, reducir)
//   Devuelve siempre [20, 200] para evitar extremos.
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function computeDynamicCap(sb: any): Promise<{ cap: number; phase: number; openRate: number; domainAgeDays: number }> {
  // Edad del dominio de envío = días desde el primer email enviado
  const { data: firstSend } = await sb
    .from('marketing_email_sends')
    .select('sent_at')
    .order('sent_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const domainAgeDays = firstSend
    ? Math.floor((Date.now() - new Date(firstSend.sent_at).getTime()) / 86_400_000)
    : 0

  // Cap base por fase
  let baseCap: number
  let phase: number
  if (domainAgeDays < 7)  { baseCap = 40;  phase = 1 }
  else if (domainAgeDays < 14) { baseCap = 70;  phase = 2 }
  else if (domainAgeDays < 28) { baseCap = 110; phase = 3 }
  else if (domainAgeDays < 60) { baseCap = 150; phase = 4 }
  else                         { baseCap = 200; phase = 5 }

  // Engagement de los últimos 50 enviados
  const { data: recent } = await sb
    .from('marketing_email_sends')
    .select('opened_at')
    .order('sent_at', { ascending: false })
    .limit(50)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openRate = recent && recent.length > 0 ? recent.filter((r: any) => r.opened_at).length / recent.length : 0

  let cap = baseCap
  if (openRate > 0.20) cap = Math.round(cap * 1.15)
  if (openRate < 0.10 && recent && recent.length >= 20) cap = Math.round(cap * 0.75)

  cap = Math.max(20, Math.min(200, cap))
  return { cap, phase, openRate, domainAgeDays }
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

  // Cap dinámico: min entre el cap automático (madurez+engagement) y el manual (override desde UI)
  const dynamic = await computeDynamicCap(sb)
  const manualOverride: number = settings.daily_send_cap ?? 999
  const cap: number = opts?.max ?? Math.min(dynamic.cap, manualOverride)
  console.log(`[campaign] cap dinámico: ${dynamic.cap} (fase ${dynamic.phase}, ${dynamic.domainAgeDays}d, open ${Math.round(dynamic.openRate * 100)}%), override manual: ${manualOverride}, cap efectivo: ${cap}`)
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

// ─────────────────────────────────────────────────────────────────────────────
// Limpiar datos de prueba — borra envíos anteriores a hoy y resetea clubes
// ─────────────────────────────────────────────────────────────────────────────
export async function purgeTestSends(): Promise<{ success: boolean; deleted?: number; resetClubs?: number; error?: string }> {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

  // Qué clubes tenían envíos antes de hoy
  const { data: oldSends } = await sb
    .from('marketing_email_sends')
    .select('club_id')
    .lt('sent_at', todayStart)
  if (!oldSends || oldSends.length === 0) return { success: true, deleted: 0, resetClubs: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldClubIds = [...new Set((oldSends as any[]).map((s) => s.club_id))] as string[]

  // De esos, ¿cuáles tienen también envíos HOY (son reales)?
  const { data: todaySends } = await sb
    .from('marketing_email_sends')
    .select('club_id')
    .gte('sent_at', todayStart)
    .in('club_id', oldClubIds)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realSet = new Set((todaySends ?? []).map((s: any) => s.club_id))

  // Solo resetear los que únicamente tenían pruebas (sin envíos hoy)
  const clubsToReset = oldClubIds.filter((id) => !realSet.has(id))

  // Borrar envíos de prueba
  const { count: deleted } = await sb
    .from('marketing_email_sends')
    .delete({ count: 'exact' })
    .lt('sent_at', todayStart)

  // Resetear clubs de prueba → pending
  if (clubsToReset.length > 0) {
    await sb
      .from('marketing_clubs')
      .update({ status: 'pending', last_sent_at: null })
      .in('id', clubsToReset)
      .in('status', ['sent_1', 'sent_2', 'sent_3'])
  }

  revalidatePath('/superadmin/campanas')
  return { success: true, deleted: deleted ?? 0, resetClubs: clubsToReset.length }
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
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'
  const vars = {
    club_name: clubName,
    club_url: encodeURIComponent(clubName),
    location: 'Madrid',
    federation: 'RFFM',
    send_id: 'test',
    demo_url: `${base}/demo?s=test&utm_source=email&utm_campaign=outbound&fed=rffm`,
    reservar_url: `${base}/reservar`,
    unsubscribe_url: `${base}/api/marketing/unsubscribe?c=test&s=test&t=test`,
  }
  const errors: string[] = []
  for (const tpl of templates) {
    const html = renderTemplate(tpl.body_html, vars)
    const text = tpl.body_text ? renderTemplate(tpl.body_text, vars) : undefined
    const result = await sendMarketingEmail({
      to: targetEmail,
      subject: `[TEST-${tpl.variant}] ${renderTemplate(tpl.subject, vars)}`,
      html,
      text,
      fromName: settings.from_name,
      replyTo: settings.reply_to || settings.from_email,
      coldOutreach: true,  // igual que el envío real: texto plano
    })
    if (!result.sent) errors.push(`Variante ${tpl.variant}: ${result.error}`)
  }
  if (errors.length === templates.length) return { success: false, error: errors.join(' | ') }
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// runClickFollowupBatch — email de recuperación para leads que clicaron
// /demo o /reservar pero no completaron la reserva.
// Se ejecuta diariamente desde el cron. Espera 24h tras el clic.
// ─────────────────────────────────────────────────────────────────────────────
export async function runClickFollowupBatch(opts?: { force?: boolean }): Promise<BatchResult> {
  if (!opts?.force) {
    const auth = await requireSuperadmin()
    if (!auth.ok) return { success: false, error: auth.error }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!settings) return { success: false, error: 'Sin settings' }
  if (settings.is_paused) return { success: false, error: 'Campaña pausada' }

  const { data: tpl } = await sb.from('marketing_templates')
    .select('*').eq('key', 'email_followup_click').eq('active', true).maybeSingle()
  if (!tpl) return { success: true, sent: 0, failed: 0, skipped: 0, message: 'Plantilla email_followup_click no configurada' }

  // 1. Send IDs donde el destino fue /demo o /reservar
  const { data: demoClicks } = await sb.from('marketing_email_clicks')
    .select('send_id')
    .or('destination.ilike.%/demo%,destination.ilike.%/reservar%')
    .limit(500)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendIds: string[] = (demoClicks ?? []).map((c: any) => c.send_id)
  if (sendIds.length === 0) return { success: true, sent: 0, failed: 0, skipped: 0, message: 'Sin clics en /demo o /reservar' }

  // 2. Club IDs de esos sends; solo los que clicaron hace >24h
  const cutoff24h = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { data: clickedSends } = await sb.from('marketing_email_sends')
    .select('club_id, clicked_at')
    .in('id', sendIds)
    .not('clicked_at', 'is', null)
    .lt('clicked_at', cutoff24h)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clickedClubIds: string[] = [...new Set((clickedSends ?? []).map((s: any) => s.club_id))] as string[]
  if (clickedClubIds.length === 0) return { success: true, sent: 0, failed: 0, skipped: 0, message: 'Sin clics de hace >24h' }

  // 3. Clubs sin followup enviado aún, no excluidos, no dados de baja
  const { data: eligibleClubs } = await sb.from('marketing_clubs')
    .select('id, name, email, location, federation')
    .in('id', clickedClubIds)
    .is('followup_click_sent_at', null)
    .eq('excluded', false)
    .not('status', 'in', '("bounced","unsubscribed")')
  if (!eligibleClubs || eligibleClubs.length === 0) {
    return { success: true, sent: 0, failed: 0, skipped: 0, message: 'Todos ya recibieron el followup o están excluidos' }
  }

  // 4. Quitar los que ya tienen una demo (no bounced ni canceled)
  const { data: existingDemos } = await sb.from('marketing_demos')
    .select('club_id')
    .in('club_id', clickedClubIds)
    .not('status', 'in', '("canceled")')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const demoCluIds = new Set((existingDemos ?? []).map((d: any) => d.club_id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toSend = eligibleClubs.filter((c: any) => !demoCluIds.has(c.id))
  if (toSend.length === 0) {
    return { success: true, sent: 0, failed: 0, skipped: 0, message: 'Todos los que clicaron ya tienen demo agendada' }
  }

  let sent = 0, failed = 0, skipped = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const club of toSend as any[]) {
    try {
      const { data: sendRow } = await sb.from('marketing_email_sends')
        .insert({ club_id: club.id, template_key: 'email_followup_click', template_variant: 'A', subject: 'pending', bounced: false })
        .select('id').single()
      if (!sendRow) { skipped++; continue }

      const vars = {
        club_name: club.name,
        club_url: encodeURIComponent(club.name),
        location: club.location || 'tu zona',
        federation: club.federation || '',
        send_id: sendRow.id,
        unsubscribe_url: await unsubscribeUrl(club.id, sendRow.id),
      }
      const subject = renderTemplate(tpl.subject, vars)
      const html = wrapLinksForTracking(renderTemplate(tpl.body_html, vars), sendRow.id)
      const text = tpl.body_text ? renderTemplate(tpl.body_text, vars) : htmlToPlainText(html)

      const result = await sendMarketingEmail({
        to: club.email,
        subject,
        html,
        text,
        fromName: settings.from_name,
        replyTo: settings.reply_to || settings.from_email,
        unsubscribeUrl: vars.unsubscribe_url,
      })

      if (result.sent) {
        await sb.from('marketing_email_sends').update({ subject }).eq('id', sendRow.id)
        await sb.from('marketing_clubs').update({ followup_click_sent_at: new Date().toISOString() }).eq('id', club.id)
        sent++
      } else {
        await sb.from('marketing_email_sends').update({ subject, bounced: true, error: result.error ?? 'unknown' }).eq('id', sendRow.id)
        failed++
      }
    } catch {
      failed++
    }
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
  }

  revalidatePath('/superadmin/campanas')
  return { success: true, sent, failed, skipped, message: `Followup clic: ${sent} enviados, ${failed} fallos` }
}

// ── sendFollowupToClubManual ──────────────────────────────────────────────────
// Envía una plantilla de recuperación a UN club específico, disparado manualmente
// desde el panel CRM con la plantilla que elija el comercial. Sin checks de
// tiempo ni de flag. Marca followup_click_sent_at para que el cron no doble-envíe.
export async function sendFollowupToClubManual(
  clubId: string,
  templateKey: RecoveryTemplateKey = 'recover_click',
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (!RECOVERY_TEMPLATES.includes(templateKey)) {
    return { success: false, error: 'Plantilla no permitida' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!settings) return { success: false, error: 'Sin settings de campaña' }

  const { data: tpl } = await sb.from('marketing_templates')
    .select('*').eq('key', templateKey).eq('active', true).maybeSingle()
  if (!tpl) return { success: false, error: `Plantilla ${templateKey} no activa` }

  const { data: club } = await sb.from('marketing_clubs')
    .select('id, name, email, location, federation, status')
    .eq('id', clubId).single()
  if (!club) return { success: false, error: 'Club no encontrado' }
  if (!club.email) return { success: false, error: 'El club no tiene email' }
  if (['bounced', 'unsubscribed'].includes(club.status)) {
    return { success: false, error: `No se puede enviar: estado ${club.status}` }
  }

  const { data: sendRow } = await sb.from('marketing_email_sends')
    .insert({ club_id: club.id, template_key: templateKey, template_variant: 'A', subject: 'pending', bounced: false })
    .select('id').single()
  if (!sendRow) return { success: false, error: 'Error creando registro de envío' }

  const vars = {
    club_name: club.name,
    club_url: encodeURIComponent(club.name),
    location: club.location || 'tu zona',
    federation: club.federation || '',
    send_id: sendRow.id,
    unsubscribe_url: await unsubscribeUrl(club.id, sendRow.id),
  }

  const subject = renderTemplate(tpl.subject, vars)
  const html = wrapLinksForTracking(renderTemplate(tpl.body_html, vars), sendRow.id)
  const text = tpl.body_text ? renderTemplate(tpl.body_text, vars) : htmlToPlainText(html)

  const result = await sendMarketingEmail({
    to: club.email,
    subject,
    html,
    text,
    fromName: settings.from_name,
    replyTo: settings.reply_to || settings.from_email,
    unsubscribeUrl: vars.unsubscribe_url,
  })

  if (result.sent) {
    await sb.from('marketing_email_sends').update({ subject }).eq('id', sendRow.id)
    await sb.from('marketing_clubs').update({ followup_click_sent_at: new Date().toISOString() }).eq('id', club.id)
    revalidatePath('/superadmin/campanas')
    return { success: true }
  } else {
    await sb.from('marketing_email_sends').update({ subject, bounced: true, error: result.error ?? 'unknown' }).eq('id', sendRow.id)
    return { success: false, error: result.error ?? 'Error de entrega' }
  }
}

// ── reactivateMarketingClub ───────────────────────────────────────────────────
// Reactiva manualmente un club 'unsubscribed' para poder enviarle followup manual.
// Solo superadmin. Cambia status → 'sent_1' (ya recibió email previo).
export async function reactivateMarketingClub(
  clubId: string,
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { error } = await sb
    .from('marketing_clubs')
    .update({ status: 'sent_1', followup_click_sent_at: null })
    .eq('id', clubId)
    .eq('status', 'unsubscribed')

  if (error) return { success: false, error: error.message }
  revalidatePath('/superadmin/campanas')
  return { success: true }
}
