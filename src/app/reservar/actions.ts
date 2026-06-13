'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMarketingEmail } from '@/lib/email/marketing-send'

/**
 * Reserva una demo SIN autenticación (público). Llamado desde la página /reservar.
 * Valida horario L-V 14:30-16:30, valida que el slot no esté ocupado, manda
 * confirmación al cliente y notificación al admin.
 */
export async function bookDemoPublic(input: {
  marketingClubId?: string | null
  clubName: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  scheduledAt: string  // ISO
  notes?: string
}) {
  // Validaciones básicas
  if (!input.clubName?.trim() || input.clubName.length < 2) return { success: false, error: 'Falta el nombre del club' }
  if (!input.contactName?.trim() || input.contactName.length < 2) return { success: false, error: 'Falta tu nombre' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) return { success: false, error: 'Email no válido' }

  const when = new Date(input.scheduledAt)
  if (isNaN(when.getTime())) return { success: false, error: 'Fecha no válida' }
  if (when.getTime() < Date.now()) return { success: false, error: 'No se puede reservar en pasado' }

  // L-V 14:30-16:30 hora Madrid
  const dayUTC = when.getUTCDay()
  if (dayUTC === 0 || dayUTC === 6) return { success: false, error: 'Solo de lunes a viernes' }
  const hourMadrid = (when.getUTCHours() + 2) % 24
  const minMadrid = when.getUTCMinutes()
  const totalMin = hourMadrid * 60 + minMadrid
  if (totalMin < 14 * 60 + 30 || totalMin > 16 * 60 + 0) {
    return { success: false, error: 'Solo huecos de 14:30 a 16:00' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Verificar que no hay otra demo en ese slot (anti-double-booking)
  const startSlot = new Date(when.getTime() - 5 * 60_000).toISOString()
  const endSlot = new Date(when.getTime() + 25 * 60_000).toISOString()
  const { data: clash } = await sb.from('marketing_demos')
    .select('id').gte('scheduled_at', startSlot).lt('scheduled_at', endSlot)
    .neq('status', 'canceled').limit(1)
  if (clash && clash.length > 0) return { success: false, error: 'Ese hueco se ha cogido hace nada. Elige otro.' }

  // Insertar reserva
  const { data: demo, error: insErr } = await sb.from('marketing_demos').insert({
    club_id: input.marketingClubId || null,
    contact_name: input.contactName.trim(),
    contact_email: input.contactEmail.trim().toLowerCase(),
    contact_phone: input.contactPhone?.trim() || null,
    scheduled_at: when.toISOString(),
    duration_min: 30,
    channel: 'call',
    notes: input.notes ? `[${input.clubName}] ${input.notes}` : `[${input.clubName}]`,
  }).select('id').single()

  if (insErr || !demo) return { success: false, error: insErr?.message ?? 'Error al reservar' }

  // Marcar club como demo_booked
  if (input.marketingClubId) {
    await sb.from('marketing_clubs').update({ status: 'demo_booked' }).eq('id', input.marketingClubId)
  }

  // Email de confirmación al cliente
  const dateStr = when.toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
  })
  await sendMarketingEmail({
    to: input.contactEmail,
    subject: `Confirmada tu demo de Cluberly el ${when.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' })}`,
    fromName: 'Diego Bravo · Cluberly',
    html: `
<div style="font-family:Georgia,serif;color:#222;line-height:1.55;font-size:15px;max-width:600px">
<p>Hola ${input.contactName.split(' ')[0]},</p>
<p>Tu reserva está confirmada. Te llamo el <strong>${dateStr}</strong> al ${input.contactPhone || 'teléfono que me indiques'}.</p>
<p>Si surge algo y necesitas cambiar el día, responde a este email y lo arreglamos sin problema.</p>
<p>Hasta entonces,<br/>
Diego Bravo<br/>
665 676 341</p>
</div>`,
  })

  // Notificación al admin (a iakevoapp@gmail.com)
  const adminEmail = process.env.MARKETING_GMAIL_USER ?? 'iakevoapp@gmail.com'
  await sendMarketingEmail({
    to: adminEmail,
    subject: `🎯 Nueva demo reservada: ${input.clubName} - ${dateStr}`,
    fromName: 'Cluberly Bot',
    html: `
<div style="font-family:system-ui;line-height:1.5;font-size:14px">
<h2>Nueva reserva de demo</h2>
<table cellpadding="6" style="border-collapse:collapse">
<tr><td><strong>Club:</strong></td><td>${input.clubName}</td></tr>
<tr><td><strong>Contacto:</strong></td><td>${input.contactName}</td></tr>
<tr><td><strong>Email:</strong></td><td><a href="mailto:${input.contactEmail}">${input.contactEmail}</a></td></tr>
<tr><td><strong>Teléfono:</strong></td><td>${input.contactPhone ? `<a href="tel:${input.contactPhone}">${input.contactPhone}</a>` : '—'}</td></tr>
<tr><td><strong>Cuándo:</strong></td><td>${dateStr}</td></tr>
<tr><td><strong>Notas:</strong></td><td>${input.notes || '—'}</td></tr>
</table>
<p><a href="https://cluberly.vercel.app/superadmin/demos">Ver en el panel</a></p>
</div>`,
  })

  return { success: true, demoId: demo.id }
}
