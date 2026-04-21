'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { sendHtmlEmail } from '@/lib/email/send'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

const CLUB_NAME = 'Escuela de Fútbol Ciudad de Getafe'

interface RecipientRow {
  id: string
  first_name: string
  last_name: string
  tutor_name: string | null
  tutor_email: string | null
}

function applyTokens(text: string, row: RecipientRow, extras: Record<string, string> = {}): string {
  const playerName = `${row.first_name} ${row.last_name}`.trim()
  const tutorName = row.tutor_name || playerName
  const tokens: Record<string, string> = {
    '{jugador_nombre}': playerName,
    '{tutor_nombre}': tutorName,
    '{club_nombre}': CLUB_NAME,
    ...extras,
  }
  let out = text
  for (const [k, v] of Object.entries(tokens)) out = out.replaceAll(k, v)
  return out
}

export async function sendBulkEmail(input: {
  templateId: string | null
  subject: string
  bodyHtml: string
  recipientType: 'all' | 'pending' | 'team' | 'category' | 'player'
  teamId?: string | null
  categoryId?: string | null
  playerId?: string | null
}): Promise<{ success: boolean; error?: string; sent: number; failed: number; noEmail: number }> {
  const supabase = createAdminClient()
  const { clubId, memberId } = await getClubContext()

  if (!input.subject.trim() || !input.bodyHtml.trim()) {
    return { success: false, error: 'Asunto y cuerpo son obligatorios', sent: 0, failed: 0, noEmail: 0 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Resolve recipients
  let recipients: RecipientRow[] = []

  if (input.recipientType === 'player' && input.playerId) {
    const { data: players } = await sb
      .from('players')
      .select('id, first_name, last_name, tutor_name, tutor_email')
      .eq('club_id', clubId)
      .eq('id', input.playerId)
    recipients = (players ?? []) as RecipientRow[]
  } else if (input.recipientType === 'pending') {
    // Players with at least one pending quota payment
    const { data: pendingRows } = await sb
      .from('quota_payments')
      .select('player_id')
      .eq('club_id', clubId)
      .eq('status', 'pending')
    const ids = Array.from(new Set(((pendingRows ?? []) as { player_id: string }[]).map(r => r.player_id)))
    if (ids.length === 0) return { success: true, sent: 0, failed: 0, noEmail: 0 }
    const { data: players } = await sb
      .from('players')
      .select('id, first_name, last_name, tutor_name, tutor_email')
      .in('id', ids)
      .eq('club_id', clubId)
    recipients = (players ?? []) as RecipientRow[]
  } else if (input.recipientType === 'team' && input.teamId) {
    const { data: players } = await sb
      .from('players')
      .select('id, first_name, last_name, tutor_name, tutor_email')
      .eq('club_id', clubId)
      .eq('team_id', input.teamId)
      .neq('status', 'low')
    recipients = (players ?? []) as RecipientRow[]
  } else if (input.recipientType === 'category' && input.categoryId) {
    const { data: teamRows } = await sb
      .from('teams')
      .select('id')
      .eq('club_id', clubId)
      .eq('category_id', input.categoryId)
    const teamIds = ((teamRows ?? []) as { id: string }[]).map(t => t.id)
    if (teamIds.length === 0) return { success: true, sent: 0, failed: 0, noEmail: 0 }
    const { data: players } = await sb
      .from('players')
      .select('id, first_name, last_name, tutor_name, tutor_email')
      .eq('club_id', clubId)
      .in('team_id', teamIds)
      .neq('status', 'low')
    recipients = (players ?? []) as RecipientRow[]
  } else {
    // all active players
    const { data: players } = await sb
      .from('players')
      .select('id, first_name, last_name, tutor_name, tutor_email')
      .eq('club_id', clubId)
      .eq('status', 'active')
    recipients = (players ?? []) as RecipientRow[]
  }

  // Send one by one (Gmail SMTP — keep it simple; add delay if needed later)
  let sent = 0
  let failed = 0
  let noEmail = 0
  const sentIds: string[] = []

  for (const r of recipients) {
    if (!r.tutor_email) {
      noEmail++
      continue
    }
    const subject = applyTokens(input.subject, r)
    const html = applyTokens(input.bodyHtml, r)
    const result = await sendHtmlEmail({ to: r.tutor_email, subject, html })
    if (result.sent) {
      sent++
      sentIds.push(r.id)
    } else {
      failed++
    }
  }

  // Log the communication (one row summarising the whole batch)
  await sb.from('communications').insert({
    club_id: clubId,
    sent_by: memberId ?? null,
    template_id: input.templateId,
    subject: input.subject,
    body_html: input.bodyHtml,
    recipient_type: input.recipientType,
    recipient_ids: sentIds.length > 0 ? sentIds : null,
    recipient_filter: {
      teamId: input.teamId ?? null,
      categoryId: input.categoryId ?? null,
    },
    status: sent > 0 ? 'sent' : failed > 0 ? 'error' : 'no_recipients',
    sent_at: new Date().toISOString(),
  })

  revalidatePath('/comunicaciones/historial')
  return { success: true, sent, failed, noEmail }
}

export async function saveTemplate(formData: FormData) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const id = (formData.get('id') as string) || null
  const name = formData.get('name') as string
  const eventType = formData.get('event_type') as string
  const subject = formData.get('subject') as string
  const bodyHtml = formData.get('body_html') as string

  if (id) {
    const { error } = await supabase
      .from('email_templates')
      .update({ name, event_type: eventType, subject, body_html: bodyHtml })
      .eq('id', id)
      .eq('club_id', clubId)

    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase.from('email_templates').insert({
      club_id: clubId,
      name,
      event_type: eventType,
      subject,
      body_html: bodyHtml,
    })

    if (error) return { success: false, error: error.message }
  }

  revalidatePath('/comunicaciones/plantillas')
  return { success: true }
}

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient()
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')!

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', templateId)
    .eq('club_id', clubId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/comunicaciones/plantillas')
  return { success: true }
}
