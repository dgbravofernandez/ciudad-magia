// Inserta las plantillas email_1 para el A/B de FORMATO:
//   A = texto plano (Inbox primario garantizado, sin tracking de aperturas)
//   B = HTML estilo Cluberly (rosa, párrafos cortos, CTAs con flecha, footer legal)
// Mismo contenido en ambas; el gancho por federación entra por {{hook_subject}}/{{hook}}
// (campaign.actions.ts: Madrid→goleadores RFFM, resto→dolor Excel/WhatsApp).
import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://mcjmguvkcseyfhsyvdhd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jam1ndXZrY3NleWZoc3l2ZGhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MjczNCwiZXhwIjoyMDkwNjQ4NzM0fQ.1nBVmV2tQQyOj9EzER1UEXHEv2C-oIND_ItZIrNpcQs',
  { auth: { persistSession: false } }
)

const SUBJECT = '{{club_name}}, una pregunta sobre la gestión del club'

// PLANO (variante A) — CTA suave: "te llamamos cuando os venga bien, sin compromiso"
const BODY_TEXT = `Hola,

Soy Diego, de Cluberly. Os escribo porque {{club_name}} aparece en el directorio de la {{federation}} y creo que podemos ayudaros.

{{hook}}

Si queréis verlo en 60 segundos:
→ {{demo_url}}

Si os encaja, te lo enseño en 10-15 minutos y resolvemos cualquier duda. Sin compromiso ninguno y cuando a vosotros os venga bien — me decís hueco y os llamo:

→ {{reservar_url}}

Un saludo,
Diego Bravo
665 676 341 · diego@cluberly.club

---
Recibiste este email porque {{club_name}} aparece en el directorio público de la {{federation}}. Base legal: interés legítimo (Art. 6.1.f RGPD / LSSI Art. 21.2). Cluberly · diego@cluberly.club · España.
Privacidad: https://cluberly.club/privacy
Darse de baja: {{unsubscribe_url}}`

// HTML (variante B) — estilo Cluberly rosa, párrafos cortos, CTAs con flecha
const PINK = '#EC4899'    // primario Cluberly (rosa de la app)
const PINK_DK = '#BE185D' // hover/secundario
const BODY_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1f2937;max-width:560px">

<p style="margin:0 0 18px"><strong style="font-size:15px">Asunto:</strong> {{club_name}}, una pregunta sobre la gestión del club</p>

<p style="margin:0 0 14px">Hola,</p>

<p style="margin:0 0 14px">Soy Diego, de <a href="https://cluberly.club" style="color:${PINK};text-decoration:underline;font-weight:600">Cluberly</a>. Os escribo porque <strong>{{club_name}}</strong> aparece en el directorio de la <strong>{{federation}}</strong> y creo que podemos ayudaros.</p>

<p style="margin:0 0 14px">{{hook}}</p>

<p style="margin:0 0 6px">Si queréis verlo en 60 segundos:</p>
<p style="margin:0 0 18px">→ <a href="{{demo_url}}" style="color:${PINK};text-decoration:underline">cluberly.club/demo</a></p>

<p style="margin:0 0 6px"><strong>Sin compromiso ninguno.</strong> Decidnos hueco y os llamamos cuando a vosotros os venga bien (también L-V tarde):</p>
<p style="margin:0 0 18px">→ <a href="{{reservar_url}}" style="color:${PINK};text-decoration:underline">cluberly.club/reservar</a></p>

<p style="margin:0 0 4px">Un saludo,</p>
<p style="margin:0 0 4px"><strong>Diego Bravo</strong></p>
<p style="margin:0 0 18px;font-size:13px;color:#6b7280">665 676 341 · diego@cluberly.club</p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 12px">

<p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5">
Recibiste este email porque <strong>{{club_name}}</strong> aparece en el directorio público de la <strong>{{federation}}</strong>. Base legal: interés legítimo (Art. 6.1.f RGPD / LSSI Art. 21.2). Cluberly · diego@cluberly.club · España · <a href="https://cluberly.club/privacy" style="color:#9ca3af;text-decoration:underline">Privacidad</a> · <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline">Darse de baja</a>
</p>

</div>`

const run = async () => {
  // 1. Desactivar todas las email_1 previas
  const { error: e1 } = await sb.from('marketing_templates').update({ active: false }).eq('key', 'email_1')
  if (e1) { console.error('Error desactivando:', e1.message); process.exit(1) }

  // 2. Upsert A (plano) y B (HTML), ambas activas, contenido idéntico salvo formato
  const rows = [
    { key: 'email_1', variant: 'A', active: true, subject: SUBJECT, body_html: BODY_HTML, body_text: BODY_TEXT },
    { key: 'email_1', variant: 'B', active: true, subject: SUBJECT, body_html: BODY_HTML, body_text: BODY_TEXT },
  ]
  const { error: e2 } = await sb.from('marketing_templates').upsert(rows, { onConflict: 'key,variant' })
  if (e2) { console.error('Error upsert:', e2.message); process.exit(1) }

  const { data } = await sb.from('marketing_templates').select('key,variant,active').eq('key', 'email_1').order('variant')
  console.log('Plantillas email_1 ahora:')
  for (const t of (data ?? [])) console.log(`  ${t.variant}  active=${t.active}`)
  console.log('\nA = texto plano · B = HTML rosa Cluberly. Reparto 50/50 por hash de club_id.')
}
run().catch(e => { console.error(e.message); process.exit(1) })
