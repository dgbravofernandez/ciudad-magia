-- 034: Añadir cod_tipojuego a rffm_scouting_signals
-- Necesario para que el filtro F7/F11 del dashboard sea fiable (sin heurística por nombre).

ALTER TABLE rffm_scouting_signals
  ADD COLUMN IF NOT EXISTS cod_tipojuego TEXT;

CREATE INDEX IF NOT EXISTS idx_rffm_scouting_signals_tipojuego
  ON rffm_scouting_signals (club_id, cod_tipojuego);

-- Backfill por nombre de competición (heurística — se reemplazará por
-- el valor exacto en el próximo sync de syncAllScorers).
UPDATE rffm_scouting_signals
SET cod_tipojuego = CASE
  WHEN nombre_competicion ILIKE '%F-7%' OR nombre_competicion ILIKE '%F 7%'
    OR nombre_competicion ILIKE '%FUTBOL 7%' OR nombre_competicion ILIKE '%FÚTBOL 7%' THEN '2'
  WHEN nombre_competicion ILIKE '%F-5%' OR nombre_competicion ILIKE '%SALA%' THEN '4'
  ELSE '1'   -- por defecto F-11
END
WHERE cod_tipojuego IS NULL;
