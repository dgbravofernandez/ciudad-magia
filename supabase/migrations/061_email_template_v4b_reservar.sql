-- 061: Actualiza email_1 variante A — añade {{demo_url}} y {{reservar_url}}
-- Cambios vs 059: CTA reservar suave al final ("sin compromiso, cuando quieras")
-- Variables: {{demo_url}} (link al vídeo, fed-aware), {{reservar_url}} (link a /reservar)

UPDATE marketing_templates
SET
  body_html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:540px">
<p>Hola,</p>
<p>Soy Diego. He construido una herramienta para que los clubes de fútbol base gestionen cuotas, asistencias e inscripciones desde un sitio, sin depender de Excel ni de grupos de WhatsApp.</p>
<p>Lo explica mejor un vídeo de 60 segundos:<br>→ <a href="{{demo_url}}" style="color:#222">{{demo_url}}</a></p>
<p>Si os parece útil, puedo enseñároslo en persona. Sin compromiso y a la hora que mejor os venga:<br>→ <a href="{{reservar_url}}" style="color:#222">{{reservar_url}}</a></p>
<p>Diego<br>665 676 341</p>
<p style="font-size:11px;color:#bbb;margin-top:28px;border-top:1px solid #eee;padding-top:10px">
Para no recibir más emails de mi parte: <a href="{{unsubscribe_url}}" style="color:#bbb">darse de baja</a>
</p>
</div>',
  body_text = 'Hola,

Soy Diego. He construido una herramienta para que los clubes de fútbol base gestionen cuotas, asistencias e inscripciones desde un sitio, sin depender de Excel ni de grupos de WhatsApp.

Lo explica mejor un vídeo de 60 segundos:
{{demo_url}}

Si os parece útil, puedo enseñároslo en persona. Sin compromiso y a la hora que mejor os venga:
{{reservar_url}}

Diego
665 676 341

---
Para no recibir más emails de mi parte: {{unsubscribe_url}}',
  updated_at = now()
WHERE key = 'email_1' AND variant = 'A';
