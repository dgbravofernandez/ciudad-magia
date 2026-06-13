'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sendMarketingEmail } from '@/lib/email/marketing-send'

async function requireSuperadmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = await headers()
  if (h.get('x-platform-role') === 'superadmin') return { ok: true }
  const { createClient } = await import('@/lib/supabase/server')
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Sin sesión' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? { ok: true } : { ok: false, error: 'Sin permisos' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Agendar demo manualmente desde el panel
// ─────────────────────────────────────────────────────────────────────────────
export async function scheduleDemo(input: {
  clubId?: string
  contactName: string
  contactEmail?: string
  contactPhone?: string
  scheduledAt: string  // ISO
  durationMin?: number
  channel?: 'call' | 'video' | 'presencial'
  notes?: string
}) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }

  if (!input.contactName?.trim()) return { success: false, error: 'Nombre del contacto obligatorio' }
  if (!input.scheduledAt) return { success: false, error: 'Fecha obligatoria' }

  const when = new Date(input.scheduledAt)
  if (isNaN(when.getTime())) return { success: false, error: 'Fecha inválida' }
  if (when.getTime() < Date.now()) return { success: false, error: 'No se puede agendar en pasado' }

  // Validar ventana del usuario: L-V 14:30-16:30 (Madrid)
  const dayUTC = when.getUTCDay()  // 0=dom..6=sab
  if (dayUTC === 0 || dayUTC === 6) return { success: false, error: 'Fines de semana cerrado (L-V solo)' }
  const hourMadrid = (when.getUTCHours() + 2) % 24  // CEST = UTC+2
  const minMadrid = when.getUTCMinutes()
  const totalMin = hourMadrid * 60 + minMadrid
  if (totalMin < 14 * 60 + 30 || totalMin > 16 * 60 + 30) {
    return { success: false, error: 'Fuera de horario (L-V 14:30-16:30 Madrid)' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Si vienen del club, autorellenar nombre/email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let club: any = null
  if (input.clubId) {
    const { data } = await sb.from('marketing_clubs').select('*').eq('id', input.clubId).maybeSingle()
    club = data
  }

  const { data: demo, error } = await sb.from('marketing_demos').insert({
    club_id: input.clubId ?? null,
    contact_name: input.contactName.trim(),
    contact_email: input.contactEmail || club?.email || null,
    contact_phone: input.contactPhone || null,
    scheduled_at: when.toISOString(),
    duration_min: input.durationMin ?? 30,
    channel: input.channel ?? 'call',
    notes: input.notes || null,
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  // Marcar club como demo_booked
  if (input.clubId) {
    await sb.from('marketing_clubs').update({ status: 'demo_booked' }).eq('id', input.clubId)
  }

  // Crear evento Google Calendar si hay integración conectada
  try {
    const { createCalendarEvent } = await import('@/lib/google/calendar')
    const contactEmail = input.contactEmail || club?.email || null
    const gcal = await createCalendarEvent({
      summary: `Demo Cluberly: ${club?.name ?? input.contactName}`,
      description: [
        `Cliente: ${input.contactName}`,
        contactEmail ? `Email: ${contactEmail}` : null,
        input.contactPhone ? `Teléfono: ${input.contactPhone}` : null,
        `Canal: ${input.channel ?? 'call'}`,
        '',
        input.notes ? `Notas:\n${input.notes}` : null,
        '',
        `Panel: https://cluberly.club/superadmin/demos`,
      ].filter(Boolean).join('\n'),
      startISO: when.toISOString(),
      durationMin: input.durationMin ?? 30,
      attendeeEmail: contactEmail ?? undefined,
      attendeeName: input.contactName,
      withMeet: input.channel === 'video',
    })
    if (gcal) {
      await sb.from('marketing_demos').update({
        gcal_event_id: gcal.eventId,
        gcal_meet_link: gcal.meetLink ?? null,
      }).eq('id', demo.id)
    }
  } catch (err) {
    console.warn('[scheduleDemo] gcal failed:', (err as Error).message)
  }

  revalidatePath('/superadmin/campanas')
  revalidatePath('/superadmin/demos')
  return { success: true, demoId: demo.id }
}

export async function updateDemoStatus(demoId: string, status: 'scheduled' | 'done' | 'no_show' | 'canceled' | 'converted', notes?: string) {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (notes !== undefined) updates.notes = notes
  await sb.from('marketing_demos').update(updates).eq('id', demoId)

  // Si se cancela, borrar el evento del Google Calendar
  if (status === 'canceled') {
    try {
      const { data: demo } = await sb.from('marketing_demos').select('gcal_event_id').eq('id', demoId).maybeSingle()
      if (demo?.gcal_event_id) {
        const { deleteCalendarEvent } = await import('@/lib/google/calendar')
        await deleteCalendarEvent(demo.gcal_event_id)
      }
    } catch (err) {
      console.warn('[cancelDemo] gcal cleanup failed:', (err as Error).message)
    }
  }

  if (status === 'converted') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: demo } = await sb.from('marketing_demos').select('club_id').eq('id', demoId).single()
    if (demo?.club_id) {
      await sb.from('marketing_clubs').update({ status: 'customer' }).eq('id', demo.club_id)
    }
  }

  revalidatePath('/superadmin/campanas')
  revalidatePath('/superadmin/demos')
  return { success: true }
}

export async function cancelDemo(demoId: string) {
  return updateDemoStatus(demoId, 'canceled')
}

// ─────────────────────────────────────────────────────────────────────────────
// Envío automático de recordatorio 24h antes (cron)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendDemoReminders(opts?: { force?: boolean }) {
  if (!opts?.force) {
    const auth = await requireSuperadmin()
    if (!auth.ok) return { success: false, error: auth.error }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Demos en las próximas 12-36 horas que no tienen reminder enviado
  const min = new Date(Date.now() + 12 * 3600_000).toISOString()
  const max = new Date(Date.now() + 36 * 3600_000).toISOString()

  const { data: demos } = await sb
    .from('marketing_demos')
    .select('id, contact_name, contact_email, scheduled_at, channel, duration_min')
    .eq('status', 'scheduled')
    .eq('reminder_sent', false)
    .gte('scheduled_at', min)
    .lte('scheduled_at', max)

  if (!demos || demos.length === 0) return { success: true, sent: 0 }

  let sent = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of demos as any[]) {
    if (!d.contact_email) continue
    const when = new Date(d.scheduled_at)
    const dateStr = when.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })

    const html = `
      <p>Hola ${d.contact_name},</p>
      <p>Te recuerdo nuestra llamada de mañana <strong>${dateStr}</strong> sobre Cluberly.</p>
      <p>Duración prevista: ${d.duration_min} minutos. Canal: ${d.channel === 'call' ? 'te llamo al teléfono que me pasaste' : d.channel === 'video' ? 'videollamada (te paso link al empezar)' : 'presencial'}.</p>
      <p>Si necesitas reagendar o cancelar, responde a este email y lo arreglamos.</p>
      <p>Hasta mañana,<br/>Diego Bravo<br/>665 676 341</p>
    `
    const result = await sendMarketingEmail({
      to: d.contact_email,
      subject: `Recordatorio: nuestra llamada mañana sobre Cluberly`,
      html,
      fromName: 'Diego Bravo · Cluberly',
    })
    if (result.sent) {
      await sb.from('marketing_demos').update({ reminder_sent: true }).eq('id', d.id)
      sent++
    }
  }

  return { success: true, sent }
}
