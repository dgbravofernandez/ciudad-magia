-- 044_club_inscription_form_link.sql
-- Enlace del Google Form de documentación por club (antes hardcodeado a Getafe en PlayerForm).

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS inscription_form_link text;

COMMENT ON COLUMN club_settings.inscription_form_link IS 'Google Form de documentación que se preña por defecto al crear un jugador';

-- Sembrar el de Getafe para no perder su flujo
UPDATE club_settings SET
  inscription_form_link = COALESCE(inscription_form_link, 'https://docs.google.com/forms/d/e/1FAIpQLSe6f_oYxywNu4uL160w9m1ufkIJBCJghQc8rTtjxDNhAbjXWA/viewform')
WHERE club_id = '72bad0f3-d4f5-44ec-914c-4e08e573f3c7';
