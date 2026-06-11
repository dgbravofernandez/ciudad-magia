-- 043_per_club_inscription_sheets.sql
-- Hojas de Google por club para la sincronización de inscripciones y entrenadores.
-- Antes estaban hardcodeadas a Getafe (constants.ts) → cualquier club que pulsara
-- "sincronizar" bajaba los datos de Getafe. Ahora cada club usa LO SUYO; sin fallback.

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS inscriptions_sheet_id  text,
  ADD COLUMN IF NOT EXISTS inscriptions_form_gids text,   -- GIDs de hojas de respuestas, separados por coma
  ADD COLUMN IF NOT EXISTS coaches_sheet_id       text,
  ADD COLUMN IF NOT EXISTS coaches_gid            text;

COMMENT ON COLUMN club_settings.inscriptions_sheet_id  IS 'ID de la hoja principal de inscripciones de jugadores (gid=0)';
COMMENT ON COLUMN club_settings.inscriptions_form_gids IS 'GIDs de las hojas de respuestas de formularios, separados por coma';
COMMENT ON COLUMN club_settings.coaches_sheet_id       IS 'ID de la hoja de entrenadores/staff';
COMMENT ON COLUMN club_settings.coaches_gid            IS 'GID de la pestaña de entrenadores dentro de coaches_sheet_id';

-- Sembrar los valores actuales de Getafe para no romper su flujo.
UPDATE club_settings SET
  inscriptions_sheet_id  = COALESCE(inscriptions_sheet_id,  '1HBXUsNX9asVfkYpnhMDxI39eWsuDDrFcF8g5Ye5Yilc'),
  inscriptions_form_gids = COALESCE(inscriptions_form_gids, '1234867596,1385952206'),
  coaches_sheet_id       = COALESCE(coaches_sheet_id,       '1CvaOcfVt1YTxakn7ImVrmvbJkyP3UaUsqmEgeQ9xk_M'),
  coaches_gid            = COALESCE(coaches_gid,            '2033450781')
WHERE club_id = '72bad0f3-d4f5-44ec-914c-4e08e573f3c7';
