'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendHtmlEmail } from '@/lib/email/send'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createHmac, randomBytes } from 'crypto'

async function requireSuperadmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = await headers()
  if (h.get('x-platform-role') !== 'superadmin') {
    return { ok: false, error: 'Sin permisos' }
  }
  return { ok: true }
}

function renderTemplate(html: string, vars: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

function unsubscribeToken(clubId: string): string {
  const secret = process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'
  return createHmac('sha256', secret).update(clubId).digest('hex').slice(0, 32)
}

export async function unsubscribeUrl(clubId: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.vercel.app'
  return `${base}/api/marketing/unsubscribe?c=${clubId}&t=${unsubscribeToken(clubId)}`
}

/**
 * Envía la siguiente tanda según el daily_send_cap.
 * Se ejecuta tanto manualmente desde el panel como desde el cron diario.
 */
export async function runCampaignBatch(opts?: { force?: boolean; max?: number }) {
  const auth = await requireSuperadmin()
  if (!auth.ok && !opts?.force) return { success: false, error: auth.error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!settings) return { success: false, error: 'Sin settings' }
  if (settings.is_paused) return { success: false, error: 'Campaña pausada' }

  // Cuántos enviar hoy
  const cap: number = opts?.max ?? settings.daily_send_cap ?? 50
  const sentTodayRes = await sb
    .from('marketing_email_sends')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  const sentToday: number = sentTodayRes.count ?? 0
  const remaining = Math.max(0, cap - sentToday)
  if (remaining === 0) return { success: true, sent: 0, message: `Ya enviados hoy: ${sentToday}/${cap}` }

  // Coger los siguientes "pending"
  const { data: clubs } = await sb
    .from('marketing_clubs')
    .select('id, name, email, location, federation')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(remaining)

  if (!clubs || clubs.length === 0) {
    return { success: true, sent: 0, message: 'No quedan clubes pendientes' }
  }

  // Plantilla activa
  const { data: tpl } = await sb
    .from('marketing_templates')
    .select('*')
    .eq('key', 'email_1')
    .eq('active', true)
    .single()
  if (!tpl) return { success: false, error: 'Plantilla email_1 no encontrada' }

  let sent = 0
  let failed = 0
  type Club = { id: string; name: string; email: string; location: string | null; federation: string | null }
  for (const club of clubs as Club[]) {
    const vars = {
      club_name: club.name,
      location: club.location || 'tu zona',
      federation: club.federation || '',
      unsubscribe_url: await unsubscribeUrl(club.id),
    }
    const subject = renderTemplate(tpl.subject, vars)
    const html = renderTemplate(tpl.body_html, vars)

    const result = await sendHtmlEmail({
      to: club.email,
      subject,
      html,
      fromName: settings.from_name,
      replyTo: settings.reply_to || settings.from_email,
    })

    await sb.from('marketing_email_sends').insert({
      club_id: club.id,
      template_key: 'email_1',
      subject,
      bounced: !result.sent,
      error: result.error ?? null,
    })

    if (result.sent) {
      await sb.from('marketing_clubs')
        .update({ status: 'sent_1', last_sent_at: new Date().toISOString() })
        .eq('id', club.id)
      sent++
    } else {
      await sb.from('marketing_clubs')
        .update({ status: 'bounced', notes: `Error: ${result.error}` })
        .eq('id', club.id)
      failed++
    }
    // Espaciar 2-4 segundos entre cada uno para no triggerar spam
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000))
  }

  revalidatePath('/superadmin/campanas')
  return { success: true, sent, failed, message: `${sent} enviados, ${failed} fallos` }
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { error } = await sb.from('marketing_settings').update({ daily_send_cap: cap, updated_at: new Date().toISOString() }).eq('id', 1)
  if (error) return { success: false, error: error.message }
  revalidatePath('/superadmin/campanas')
  return { success: true }
}

export async function updateTemplate(key: string, subject: string, body_html: string) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
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

export async function sendTestEmail(targetEmail: string) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: tpl } = await sb.from('marketing_templates').select('*').eq('key', 'email_1').single()
  const { data: settings } = await sb.from('marketing_settings').select('*').eq('id', 1).single()
  if (!tpl || !settings) return { success: false, error: 'Plantilla o settings no configurados' }

  const vars = {
    club_name: 'Club de Prueba',
    location: 'Madrid',
    federation: 'RFFM',
    unsubscribe_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.vercel.app'}/api/marketing/unsubscribe?c=test&t=test`,
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

// Suprimir warning de import no usado
void randomBytes
