-- 059: Plantillas email_1 — reescritura completa, texto plano, sin marketing language
-- Razón: variantes A/B/C/D previas van a Promociones aunque DKIM esté ok.
-- Causa: HTML + List-Unsubscribe header = clasificador de Promociones.
-- Fix en código: coldOutreach=true → solo body_text, sin List-Unsubscribe header.
-- Fix en plantilla: copy más humano, sin precio, sin "temporada", CTA suave.
--
-- Variables disponibles en body_text:
--   {{club_name}}       nombre del club
--   {{federation}}      federación (ej: RFFM, FFCM, etc.)
--   {{demo_url}}        link al demo (con ?fed=rffm para clubs RFFM, sin param para resto)
--   {{unsubscribe_url}} link de baja
--
-- Aplicar: pega en SQL Editor de Supabase
-- Tras aplicar, no hace falta nada más — variant A queda activa.

-- Desactivar TODAS las variantes previas de email_1
UPDATE marketing_templates SET active = false WHERE key = 'email_1';

-- Nueva variante A — activa inmediatamente
INSERT INTO marketing_templates (key, variant, active, subject, body_html, body_text)
VALUES (
  'email_1',
  'A',
  true,
  'algo rápido sobre {{club_name}}',

  -- body_html: solo se usa si coldOutreach=false (email_2, email_3).
  -- Para email_1 (coldOutreach=true) se ignora — solo va body_text.
  '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#222;max-width:540px">
<p>Hola,</p>
<p>Soy Diego. He construido una herramienta para que los clubes de fútbol base gestionen cuotas, asistencias e inscripciones desde un sitio, sin depender de Excel ni de grupos de WhatsApp.</p>
<p>He grabado un vídeo corto que lo explica mejor que yo:<br>→ <a href="{{demo_url}}" style="color:#222">{{demo_url}}</a></p>
<p>Si os parece interesante, podemos hablar 15 minutos cuando mejor os venga. Sin compromiso.</p>
<p>Diego<br>665 676 341</p>
<p style="font-size:11px;color:#bbb;margin-top:28px;border-top:1px solid #eee;padding-top:10px">
Para no recibir más emails de mi parte: <a href="{{unsubscribe_url}}" style="color:#bbb">darse de baja</a>
</p>
</div>',

  -- body_text: el que SE ENVÍA REALMENTE para email_1 (coldOutreach=true)
  'Hola,

Soy Diego. He construido una herramienta para que los clubes de fútbol base gestionen cuotas, asistencias e inscripciones desde un sitio, sin depender de Excel ni de grupos de WhatsApp.

He grabado un vídeo corto que lo explica mejor que yo:
{{demo_url}}

Si os parece interesante, podemos hablar 15 minutos cuando mejor os venga. Sin compromiso.

Diego
665 676 341

---
Para no recibir más emails de mi parte: {{unsubscribe_url}}'
)
ON CONFLICT (key, variant) DO UPDATE SET
  active     = EXCLUDED.active,
  subject    = EXCLUDED.subject,
  body_html  = EXCLUDED.body_html,
  body_text  = EXCLUDED.body_text,
  updated_at = now();
