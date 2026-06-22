-- 054: Email automático de seguimiento para leads que clicaron /demo o /reservar
-- pero no completaron la reserva.
-- Añade columna de tracking en marketing_clubs y la plantilla del email.

-- 1. Columna para saber si ya enviamos el followup de clic (idempotencia)
ALTER TABLE marketing_clubs
  ADD COLUMN IF NOT EXISTS followup_click_sent_at TIMESTAMPTZ;

-- 2. Plantilla del email de recuperación de lead
--    Tono: muy corto, muy personal, CTA sin fricción (responde con tu número)
INSERT INTO marketing_templates (key, variant, active, subject, body_html, body_text)
VALUES (
  'email_followup_click',
  'A',
  true,
  '¿Todo bien por ahí, {{club_name}}?',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;max-width:560px">
<p>Hola,</p>
<p>Vi que echastes un ojo a la página de demo de Cluberly pero no llegasteis a reservar.</p>
<p>Sin problema — a veces la hora no viene bien o simplemente hay mucho lío. Si queréis que os lo enseñe, <strong>respondedme con vuestro número y el mejor momento para llamar</strong> y me encargo yo.</p>
<p>Sin formularios, sin esperar. 10-15 minutos por teléfono y veis si os convence.</p>
<p>Un saludo,<br>
Diego Bravo<br>
<span style="font-size:13px;color:#666">665 676 341 · <a href="mailto:diego@cluberly.club" style="color:#888;text-decoration:none">diego@cluberly.club</a></span></p>
<p style="font-size:11px;color:#aaa;margin-top:24px">Recibiste este email porque <strong>{{club_name}}</strong> visitó cluberly.club recientemente. · <a href="{{unsubscribe_url}}" style="color:#aaa">Darse de baja</a></p>
</div>',
  'Hola,

Vi que echastes un ojo a la página de demo de Cluberly pero no llegasteis a reservar.

Sin problema — si queréis que os lo enseñe, respondedme con vuestro número y el mejor momento para llamar y me encargo yo.

Sin formularios, sin esperar. 10-15 minutos por teléfono.

Diego Bravo
665 676 341 · diego@cluberly.club'
)
ON CONFLICT (key, variant) DO UPDATE SET
  subject   = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  active    = true,
  updated_at = now();
