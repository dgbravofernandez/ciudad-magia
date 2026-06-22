-- 053: Corregir dato incorrecto en email_1 — "900 jugadores" → "280 jugadores"
-- El club piloto (E.F. Ciudad de Getafe) tiene ~280 jugadores, no 900.

UPDATE marketing_templates
SET
  body_html = REPLACE(
    body_html,
    'un club piloto de 900 jugadores',
    'un club piloto de 280 jugadores'
  ),
  updated_at = now()
WHERE key = 'email_1';
