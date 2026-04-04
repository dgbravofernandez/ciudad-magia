'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export async function sendBulkEmail(data: {
  templateId: string | null
  subject: string
  bodyHtml: string
  recipientType: string
  recipientIds: string[]
  filter: Record<string, string> | null
  clubId: string
}) {
  const supabase = await createClient()
  const headersList = await headers()
  const memberId = headersList.get('x-member-id')!

  const { data: communication, error } = await supabase
    .from('communications')
    .insert({
      club_id: data.clubId,
      sent_by: memberId,
      template_id: data.templateId,
      subject: data.subject,
      body_html: data.bodyHtml,
      recipient_type: data.recipientType,
      recipient_ids: data.recipientIds.length > 0 ? data.recipientIds : null,
      recipient_filter: data.filter,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/comunicaciones/historial')
  return { success: true, communicationId: communication.id, count: data.recipientIds.length }
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
