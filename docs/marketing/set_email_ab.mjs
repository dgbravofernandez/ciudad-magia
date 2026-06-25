// Inserta las plantillas email_1 para el A/B de FORMATO:
//   A = texto plano   ·   B = HTML mínimo (tipo-texto, con pixel de apertura)
// Contenido idéntico; el gancho por federación entra por {{hook_subject}} y {{hook}}
// (los rellena campaign.actions.ts: Madrid→goleadores RFFM, resto→dolor Excel/WhatsApp).
import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://mcjmguvkcseyfhsyvdhd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jam1ndXZrY3NleWZoc3l2ZGhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA3MjczNCwiZXhwIjoyMDkwNjQ4NzM0fQ.1nBVmV2tQQyOj9EzER1UEXHEv2C-oIND_ItZIrNpcQs',
  { auth: { persistSession: false } }
)

const SUBJECT = '{{hook_subject}}'

const BODY_TEXT = `Hola,

{{hook}}

Si quieres verlo en 60 segundos:
{{demo_url}}

Y si te encaja, te lo enseño en 10 minutos cuando mejor te venga, sin compromiso:
{{reservar_url}}

Un saludo,
Diego
665 676 341

---
Para no recibir más correos míos: {{unsubscribe_url}}`

const BODY_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#222;max-width:540px">
<p>Hola,</p>
<p>{{hook}}</p>
<p>Si quieres verlo en 60 segundos:<br><a href="{{demo_url}}" style="color:#1a56db">{{demo_url}}</a></p>
<p>Y si te encaja, te lo enseño en 10 minutos cuando mejor te venga, sin compromiso:<br><a href="{{reservar_url}}" style="color:#1a56db">{{reservar_url}}</a></p>
<p>Un saludo,<br>Diego<br>665 676 341</p>
<p style="font-size:12px;color:#999;margin-top:24px">Para no recibir más correos míos: <a href="{{unsubscribe_url}}" style="color:#999">darse de baja</a></p>
</div>`

const run = async () => {
  // 1. Desactivar todas las email_1 previas
  const { error: e1 } = await sb.from('marketing_templates').update({ active: false }).eq('key', 'email_1')
  if (e1) { console.error('Error desactivando:', e1.message); process.exit(1) }

  // 2. Upsert A (plano) y B (HTML), ambas activas, contenido idéntico
  const rows = [
    { key: 'email_1', variant: 'A', active: true, subject: SUBJECT, body_html: BODY_HTML, body_text: BODY_TEXT },
    { key: 'email_1', variant: 'B', active: true, subject: SUBJECT, body_html: BODY_HTML, body_text: BODY_TEXT },
  ]
  const { error: e2 } = await sb.from('marketing_templates').upsert(rows, { onConflict: 'key,variant' })
  if (e2) { console.error('Error upsert:', e2.message); process.exit(1) }

  const { data } = await sb.from('marketing_templates').select('key,variant,active').eq('key', 'email_1').order('variant')
  console.log('Plantillas email_1 ahora:')
  for (const t of (data ?? [])) console.log(`  ${t.variant}  active=${t.active}`)
  console.log('\nA = texto plano · B = HTML mínimo. Reparto 50/50 por hash de club_id.')
}
run().catch(e => { console.error(e.message); process.exit(1) })
