'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendHtmlEmail } from '@/lib/email/send'
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

/**
 * Token de unsubscribe ligado al send.id (nonce real) — no enumerable.
 * Antes era HMAC(clubId), filtrable y reutilizable.
 */
function unsubscribeToken(sendId: string): string {
  const secret = process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'
  return createHmac('sha256', secret).update(sendId).digest('hex').slice(0, 32)
}

export async function unsubscribeUrl(clubId: string, sendId: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.vercel.app'
  return `${base}/api/marketing/unsubscribe?c=${clubId}&s=${sendId}&t=${unsubscribeToken(sendId)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: enviar a una lista de clubes con claim atómico anti-doble-envío
// ─────────────────────────────────────────────────────────────────────────────
async function sendBatchInternal(clubIds: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  const { data: tpl } = await sb.from('marketing_templates').select('*').eq('key', 'email_1').eq('active', true).single()
  if (!tpl || !settings) return { success: false as const, error: 'Plantilla o settings sin configurar' }

  let sent = 0, failed = 0, skipped = 0
  const errors: string[] = []

  for (const clubId of clubIds) {
    // CLAIM ATÓMICO: solo procesar si seguía 'pending' y no excluido. update().select() devuelve 0 filas si otro proceso lo cogió.
    const { data: claimed } = await sb
      .from('marketing_clubs')
      .update({ status: 'queued', queued_at: new Date().toISOString() })
      .eq('id', clubId)
      .eq('status', 'pending')
      .eq('excluded', false)
      .select('id, name, email, location, federation')
      .maybeSingle()

    if (!claimed) { skipped++; continue }

    // Pre-crear el send.id para usarlo en el unsubscribe token
    const { data: sendRow, error: insErr } = await sb
      .from('marketing_email_sends')
      .insert({
        club_id: claimed.id,
        template_key: 'email_1',
        subject: 'pending',
        bounced: false,
      })
      .select('id')
      .single()

    if (insErr || !sendRow) {
      // unique violation = ya hay un envío previo no-bounced → claim revertido
      await sb.from('marketing_clubs').update({ status: 'pending', queued_at: null }).eq('id', claimed.id)
      skipped++
      continue
    }

    const vars = {
      club_name: claimed.name,
      location: claimed.location || 'tu zona',
      federation: claimed.federation || '',
      unsubscribe_url: await unsubscribeUrl(claimed.id, sendRow.id),
    }
    const subject = renderTemplate(tpl.subject, vars)
    const html = renderTemplate(tpl.body_html, vars)

    const result = await sendHtmlEmail({
      to: claimed.email,
      subject,
      html,
      fromName: settings.from_name,
      replyTo: settings.reply_to || settings.from_email,
    })

    if (result.sent) {
      await sb.from('marketing_email_sends').update({ subject }).eq('id', sendRow.id)
      await sb.from('marketing_clubs')
        .update({ status: 'sent_1', last_sent_at: new Date().toISOString(), queued_at: null })
        .eq('id', claimed.id)
      sent++
    } else {
      await sb.from('marketing_email_sends').update({ subject, bounced: true, error: result.error ?? 'unknown' }).eq('id', sendRow.id)
      await sb.from('marketing_clubs')
        .update({ status: 'bounced', notes: `Error: ${result.error}`, queued_at: null })
        .eq('id', claimed.id)
      failed++
      errors.push(`${claimed.email}: ${result.error}`)
    }

    // 2-4s espaciado para no triggerar Gmail spam-trap
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

export async function sendToSelected(clubIds: string[]): Promise<BatchResult> {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!Array.isArray(clubIds) || clubIds.length === 0) return { success: false, error: 'Sin clubes seleccionados' }
  if (clubIds.length > 100) return { success: false, error: 'Máximo 100 por tanda manual (limite Gmail/runtime)' }
  return sendBatchInternal(clubIds)
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
  const { data: tpl } = await sb.from('marketing_templates').select('*').eq('key', 'email_1').single()
  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!tpl || !settings) return { success: false, error: 'Plantilla o settings sin configurar' }

  const vars = {
    club_name: 'Club de Prueba',
    location: 'Madrid',
    federation: 'RFFM',
    unsubscribe_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.vercel.app'}/api/marketing/unsubscribe?c=test&s=test&t=test`,
  }
  const result = await sendHtmlEmail({
    to: targetEmail,
    subject: '[TEST] ' + renderTemplate(tpl.subject, vars),
    html: renderTemplate(tpl.body_html, vars),
    fromName: settings.from_name,
    replyTo: settings.reply_to || settings.from_email,
  })
  return result.sent ? { success: true } : { success: false, error: result.error }
}
