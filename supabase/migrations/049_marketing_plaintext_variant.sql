-- 049: Email texto plano variante C + from_name personal + columna body_text
-- Objetivo: mejorar deliverability (inbox principal vs Promociones) y conversión

-- 1. Columna body_text en marketing_templates (texto plano para email multipart)
ALTER TABLE marketing_templates ADD COLUMN IF NOT EXISTS body_text TEXT;

-- 2. From name más personal → menos reconocible como marketing bulk
UPDATE marketing_settings
SET from_name = 'Diego'
WHERE id = 1;

-- 3. Variante C — email de texto plano personal
--    Sin imágenes, sin botones, sin pixel de tracking visual.
--    El video demo se incluye como link de texto (57s = expectativa baja = más clics).
--    Los links de click-tracking siguen funcionando vía ?s={{send_id}}.
INSERT INTO marketing_templates (key, variant, active, subject, body_html, body_text)
VALUES (
  'email_1',
  'C',
  false,  -- desactivada por defecto; activar manualmente cuando se quiera probar
  '{{club_name}}, una pregunta rápida',

  -- HTML mínimo sin imágenes ni botones — parece email personal de Outlook/Gmail
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;max-width:560px;">
<p>Hola,</p>
<p>Veo que <strong>{{club_name}}</strong> está en {{federation}} — llevo tiempo trabajando con clubs de fútbol y quería preguntarte directamente: ¿cómo lleváis la gestión de socios y cuotas?</p>
<p>La mayoría de clubs con los que hablo siguen con Excel y WhatsApp, y se pierden horas cada mes en cosas que se pueden automatizar.</p>
<p>He montado <a href="https://cluberly.club?utm_source=outreach&utm_medium=email&utm_campaign=plaintext_c&utm_content={{club_url}}" style="color:#EC4899;">Cluberly</a> para eso — si quieres echarle un vistazo, aquí tienes un demo de 57 segundos: <a href="https://cluberly.club/demo?s={{send_id}}&utm_source=outreach&utm_medium=email&utm_campaign=plaintext_c" style="color:#EC4899;">cluberly.club/demo</a></p>
<p>Si no es el momento o no aplica, no pasa nada. Solo dime y no te molesto más.</p>
<p>Diego<br><span style="font-size:13px;color:#666;">Cluberly — gestión de clubs deportivos</span></p>
<p style="font-size:12px;color:#999;margin-top:24px;">¿No quieres recibir más emails? <a href="{{unsubscribe_url}}" style="color:#999;">Darte de baja</a></p>
</div>',

  -- Versión texto plano (multipart/alternative) — la que ve el filtro de spam
  'Hola,

Veo que {{club_name}} está en {{federation}} — llevo tiempo trabajando con clubs de fútbol y quería preguntarte directamente: ¿cómo lleváis la gestión de socios y cuotas?

La mayoría de clubs con los que hablo siguen con Excel y WhatsApp, y se pierden horas cada mes en cosas que se pueden automatizar.

He montado Cluberly para eso — si quieres echarle un vistazo, aquí tienes un demo de 57 segundos:
https://cluberly.club/demo?s={{send_id}}&utm_source=outreach&utm_medium=email&utm_campaign=plaintext_c

Si no es el momento o no aplica, no pasa nada. Solo dime y no te molesto más.

Diego
Cluberly — gestión de clubs deportivos
https://cluberly.club

---
¿No quieres recibir más emails? {{unsubscribe_url}}'
)
ON CONFLICT DO NOTHING;

-- NOTAS DE USO:
-- Para activar la variante C y hacer test A/B con A:
--   UPDATE marketing_templates SET active = true WHERE key = 'email_1' AND variant = 'C';
-- Para usar SOLO C (sin A/B):
--   UPDATE marketing_templates SET active = false WHERE key = 'email_1' AND variant IN ('A','B');
--   UPDATE marketing_templates SET active = true  WHERE key = 'email_1' AND variant = 'C';
