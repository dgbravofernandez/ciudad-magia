-- ──────────────────────────────────────────────────────────────────
-- Migración 031: Columnas que faltan en sessions para el módulo Informes
--
-- 1. sessions.season  — temporada (ej. '2025/26'). Backfill desde teams.season.
-- 2. sessions.title   — título opcional del partido/entrenamiento.
-- 3. sessions.result  — resultado en texto legible (ej. '2-1 vs Fuenlabrada').
--    Se puede rellenar manualmente o calcular desde score_home/score_away.
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS title  TEXT,
  ADD COLUMN IF NOT EXISTS result TEXT;

-- Backfill season desde el equipo (teams.season es la temporada del equipo
-- cuando se creó la sesión — es la mejor aproximación disponible).
UPDATE sessions s
SET    season = t.season
FROM   teams t
WHERE  s.team_id = t.id
  AND  s.season  IS NULL;

-- Backfill result en texto para sesiones ya completadas con marcador.
-- Formato: 'score_home - score_away' (null si alguno es null).
UPDATE sessions
SET    result = score_home::TEXT || ' - ' || score_away::TEXT
WHERE  score_home IS NOT NULL
  AND  score_away IS NOT NULL
  AND  result IS NULL;

-- Índice para filtrar por club + season (queries más comunes de Informes)
CREATE INDEX IF NOT EXISTS idx_sessions_club_season ON sessions(club_id, season);
