-- 056: Tres plantillas de recuperación para envío MANUAL desde el panel CRM.
-- El comercial elige cuál según lo caliente que esté el lead:
--   recover_click    → abrió/clicó algo (suave, sin presión)
--   recover_reservar → entró a /reservar o /demo pero no cerró (quitar fricción)
--   recover_hot      → clicó varias cosas / muy interesado (muy personal, "te llamo yo")
-- Variables disponibles: {{club_name}}, {{location}}, {{federation}}, {{unsubscribe_url}}, {{send_id}}

-- ── 1. recover_click ──────────────────────────────────────────────────────────
INSERT INTO marketing_templates (key, variant, active, subject, body_html, body_text)
VALUES (
  'recover_click',
  'A',
  true,
  '¿Te cuadró algo, {{club_name}}?',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;max-width:560px">
<p>Hola,</p>
<p>Vi que le echasteis un ojo a Cluberly hace poco. ¿Os encajó lo que visteis?</p>
<p>Sin prisa ninguna — si en algún momento queréis que os lo enseñe en 10 minutos por teléfono, <strong>respondedme con vuestro número y cuándo os viene bien</strong> y me encargo yo.</p>
<p>Y si no es el momento, sin problema. Aquí sigo.</p>
<p>Un saludo,<br>
Diego Bravo<br>
<span style="font-size:13px;color:#666">665 676 341 · <a href="mailto:diego@cluberly.club" style="color:#888;text-decoration:none">diego@cluberly.club</a></span></p>
<p style="font-size:11px;color:#aaa;margin-top:24px">Recibiste este email porque <strong>{{club_name}}</strong> visitó cluberly.club recientemente. · <a href="{{unsubscribe_url}}" style="color:#aaa">Darse de baja</a></p>
</div>',
  'Hola,

Vi que le echasteis un ojo a Cluberly hace poco. ¿Os encajó lo que visteis?

Sin prisa — si queréis que os lo enseñe en 10 minutos por teléfono, respondedme con vuestro número y cuándo os viene bien.

Y si no es el momento, sin problema. Aquí sigo.

Diego Bravo
665 676 341 · diego@cluberly.club'
)
ON CONFLICT (key, variant) DO UPDATE SET
  subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text,
  active = true, updated_at = now();

-- ── 2. recover_reservar ───────────────────────────────────────────────────────
INSERT INTO marketing_templates (key, variant, active, subject, body_html, body_text)
VALUES (
  'recover_reservar',
  'A',
  true,
  '{{club_name}}, ¿te lío con la demo?',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;max-width:560px">
<p>Hola,</p>
<p>Vi que entrasteis a reservar una demo de Cluberly pero no llegasteis a cerrar el hueco.</p>
<p>Lo más normal — a lo mejor la hora no cuadraba. <strong>Olvidaos del calendario: decidme vosotros cuándo os viene bien y me adapto.</strong> Mañana, tarde, el día que sea. Os llamo yo.</p>
<p>Respondedme con un número y un par de huecos buenos y lo dejamos cuadrado en un minuto.</p>
<p>Un saludo,<br>
Diego Bravo<br>
<span style="font-size:13px;color:#666">665 676 341 · <a href="mailto:diego@cluberly.club" style="color:#888;text-decoration:none">diego@cluberly.club</a></span></p>
<p style="font-size:11px;color:#aaa;margin-top:24px">Recibiste este email porque <strong>{{club_name}}</strong> visitó cluberly.club recientemente. · <a href="{{unsubscribe_url}}" style="color:#aaa">Darse de baja</a></p>
</div>',
  'Hola,

Vi que entrasteis a reservar una demo de Cluberly pero no llegasteis a cerrar el hueco.

Lo más normal — a lo mejor la hora no cuadraba. Olvidaos del calendario: decidme vosotros cuándo os viene bien y me adapto. Os llamo yo.

Respondedme con un número y un par de huecos buenos.

Diego Bravo
665 676 341 · diego@cluberly.club'
)
ON CONFLICT (key, variant) DO UPDATE SET
  subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text,
  active = true, updated_at = now();

-- ── 3. recover_hot ────────────────────────────────────────────────────────────
INSERT INTO marketing_templates (key, variant, active, subject, body_html, body_text)
VALUES (
  'recover_hot',
  'A',
  true,
  '{{club_name}} — te lo enseño en 10 min y salís de dudas',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;max-width:560px">
<p>Hola,</p>
<p>Se nota que le habéis dado más de una vuelta a Cluberly estos días — y me alegra, porque normalmente eso quiere decir que hay algo que os encaja.</p>
<p>En vez de que sigáis leyendo páginas, dejadme que os lo enseñe yo en directo: <strong>10-15 minutos por teléfono o videollamada</strong> y veis exactamente cómo quedaría con vuestros equipos, cuotas y jugadores.</p>
<p>Decidme un número y un par de huecos que os vengan bien <em>(la hora que sea, me adapto)</em> y os llamo yo. Sin compromiso.</p>
<p>Un saludo,<br>
Diego Bravo<br>
<span style="font-size:13px;color:#666">665 676 341 · <a href="mailto:diego@cluberly.club" style="color:#888;text-decoration:none">diego@cluberly.club</a></span></p>
<p style="font-size:11px;color:#aaa;margin-top:24px">Recibiste este email porque <strong>{{club_name}}</strong> visitó cluberly.club recientemente. · <a href="{{unsubscribe_url}}" style="color:#aaa">Darse de baja</a></p>
</div>',
  'Hola,

Se nota que le habéis dado más de una vuelta a Cluberly estos días — normalmente eso quiere decir que hay algo que os encaja.

En vez de seguir leyendo, dejadme que os lo enseñe en directo: 10-15 minutos por teléfono y veis cómo quedaría con vuestros equipos, cuotas y jugadores.

Decidme un número y un par de huecos (la hora que sea, me adapto) y os llamo yo. Sin compromiso.

Diego Bravo
665 676 341 · diego@cluberly.club'
)
ON CONFLICT (key, variant) DO UPDATE SET
  subject = EXCLUDED.subject, body_html = EXCLUDED.body_html, body_text = EXCLUDED.body_text,
  active = true, updated_at = now();
