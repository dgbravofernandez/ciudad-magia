-- 058: Plantilla email_1 variante B — pregunta personal, un solo CTA, texto plano real
-- Asunto: "pregunta rápida sobre {{club_name}}" — conversacional, no marketing
-- Cuerpo: 3 párrafos, sin precio, sin "temporada abierta", una sola CTA (vídeo demo)
-- Activar con: UPDATE marketing_templates SET active=true WHERE key='email_1' AND variant='B';
-- (y desactivar las demás variantes activas)

INSERT INTO marketing_templates (key, variant, active, subject, body_html, body_text)
VALUES (
  'email_1',
  'B',
  false,
  'pregunta rápida sobre {{club_name}}',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;max-width:560px">
<p>Hola,</p>
<p>Me llamo Diego. Llevo año y medio trabajando con un club de fútbol base de 900 jugadores y construyendo la herramienta que me pedían: cuotas, asistencias, inscripciones y comunicaciones a las familias, todo en un sitio.</p>
<p>Vi que {{club_name}} está en la {{federation}} y quería preguntaros directamente: ¿cómo gestionáis ahora los pagos y las comunicaciones con los padres? Hay algo en el vídeo que quizás os resulte familiar:<br>
→ <a href="https://cluberly.club/demo?s={{send_id}}&utm_source=email&utm_campaign=outbound_v3&utm_content={{club_url}}" style="color:#1a1a1a">cluberly.club/demo</a> (60 segundos)</p>
<p>Si os parece útil, puedo enseñároslo en 15 minutos cuando mejor os venga.</p>
<p>Un saludo,<br>
Diego<br>
<span style="color:#666;font-size:13px">665 676 341</span></p>
<p style="font-size:11px;color:#bbb;margin-top:32px;border-top:1px solid #eee;padding-top:12px">Email enviado a {{club_name}} porque aparece en el directorio público de la {{federation}} · <a href="{{unsubscribe_url}}" style="color:#bbb">Darse de baja</a></p>
</div>',
  'Hola,

Me llamo Diego. Llevo año y medio trabajando con un club de fútbol base de 900 jugadores y construyendo la herramienta que me pedían: cuotas, asistencias, inscripciones y comunicaciones a las familias, todo en un sitio.

Vi que {{club_name}} está en la {{federation}} y quería preguntaros directamente: ¿cómo gestionáis ahora los pagos y las comunicaciones con los padres? Hay algo en el vídeo que quizás os resulte familiar:
→ cluberly.club/demo (60 segundos)

Si os parece útil, puedo enseñároslo en 15 minutos cuando mejor os venga.

Un saludo,
Diego
665 676 341

---
Email enviado a {{club_name}} porque aparece en el directorio público de la {{federation}}.
Para darse de baja: {{unsubscribe_url}}'
)
ON CONFLICT (key, variant) DO UPDATE SET
  subject = EXCLUDED.subject,
  body_html = EXCLUDED.body_html,
  body_text = EXCLUDED.body_text,
  updated_at = now();
