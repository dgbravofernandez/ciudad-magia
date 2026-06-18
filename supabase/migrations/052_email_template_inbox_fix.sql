-- 052: Reescribir template email_1 variante A para aterrizar en bandeja Principal
-- Cambios: eliminar pixel de tracking (1x1), eliminar imágenes (logo + thumbnail demo),
-- sustituir thumbnail por link de texto, footer legal minimalista en una línea.
-- Razón: Gmail clasifica como Promociones por pixel + imágenes + newsletter layout.

UPDATE marketing_templates
SET
  body_html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#1a1a1a;max-width:560px">
<p>Hola,</p>
<p>Soy Diego, de <a href="https://cluberly.club?utm_source=email&amp;utm_campaign=outbound_v2&amp;utm_content={{club_url}}" style="color:#BE185D">Cluberly</a>. Os escribo porque <strong>{{club_name}}</strong> aparece en el directorio de la <strong>{{federation}}</strong> y creo que podemos ayudaros.</p>
<p>Llevo 12 meses construyendo un software para clubes de fútbol base con un club piloto de 900 jugadores: cuotas, inscripciones, asistencia y avisos de deuda en un sitio. Ahorra 4-6 horas semanales a la dirección.</p>
<p>Si queréis verlo en 60 segundos:<br>
→ <a href="https://cluberly.club/demo?s={{send_id}}&amp;utm_source=email&amp;utm_campaign=outbound_v2&amp;utm_content={{club_url}}" style="color:#BE185D">cluberly.club/demo</a></p>
<p>Temporada 26/27 abierta. Desde 39€/mes, prueba de 14 días sin tarjeta. Si os interesa que os lo enseñe en 15 minutos:<br>
→ <a href="https://cluberly.club/reservar?club={{club_url}}&amp;utm_source=email&amp;utm_campaign=outbound_v2" style="color:#BE185D">cluberly.club/reservar</a> (L-V 14:30–16:30)</p>
<p>Un saludo,<br>
Diego Bravo<br>
<span style="font-size:13px;color:#666">665 676 341 · <a href="mailto:diego@cluberly.club" style="color:#888;text-decoration:none">diego@cluberly.club</a></span></p>
<p style="font-size:11px;color:#aaa;margin-top:24px">Recibiste este email porque <strong>{{club_name}}</strong> aparece en el directorio público de la {{federation}}. Base legal: interés legítimo (Art. 6.1.f RGPD / LSSI Art. 21.2). Cluberly · diego@cluberly.club · España · <a href="https://cluberly.club/privacy" style="color:#aaa">Privacidad</a> · <a href="{{unsubscribe_url}}" style="color:#aaa">Darse de baja</a></p>
</div>',
  updated_at = now()
WHERE key = 'email_1' AND variant = 'A';
