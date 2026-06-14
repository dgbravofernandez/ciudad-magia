'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMarketingEmail } from '@/lib/email/marketing-send'
import { headers } from 'next/headers'

interface CaptureInput {
  email: string
  clubName?: string
  utmSource?: string | null
  utmCampaign?: string | null
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cluberly.club'

export async function captureLeadMagnet(input: CaptureInput) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return { success: false, error: 'Email no válido' }

  const email = input.email.trim().toLowerCase().slice(0, 200)
  const clubName = input.clubName?.trim().slice(0, 200) || null

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = h.get('user-agent')?.slice(0, 300) || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Guardar lead
  await sb.from('lead_magnet_downloads').insert({
    email,
    club_name: clubName,
    source: 'plantilla-inscripciones-26-27',
    utm_source: input.utmSource || null,
    utm_campaign: input.utmCampaign || null,
    ip,
    user_agent: ua,
  })

  // Mandar email con el link de descarga (estilo personal, no marketing chillón)
  await sendMarketingEmail({
    to: email,
    subject: 'Tu plantilla de inscripciones 26/27',
    fromName: 'Diego Bravo · Cluberly',
    html: `
<div style="font-family:Georgia,serif;color:#222;line-height:1.55;font-size:15px;max-width:600px">
<p>Hola${clubName ? ` ${clubName}` : ''},</p>
<p>Aquí tienes la plantilla. Está pensada para que la copies y la adaptes a tu club:</p>
<p style="margin:18px 0">
  <a href="${APP_URL}/downloads/plantilla-inscripciones-2026-2027.xlsx" style="color:#BE185D;font-weight:bold;font-size:16px">▼ Descargar la plantilla Excel</a>
</p>
<p>Tres pestañas: <strong>Inscripciones</strong>, <strong>Categorías y cuotas</strong>, <strong>Plan de cobros mensual</strong>.</p>
<p>Si en algún momento te das cuenta de que el Excel se queda corto (familias que pagan tarde, recordatorios automáticos, conciliación bancaria...), prueba Cluberly 14 días sin tarjeta: <a href="${APP_URL}">cluberly.club</a></p>
<p>Un saludo,<br/>
Diego Bravo<br/>
665 676 341</p>
</div>`,
  })

  return { success: true }
}
