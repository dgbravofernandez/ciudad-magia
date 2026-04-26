-- ============================================================
-- 025 — RFFM standings (clasificaciones por competición/grupo)
-- Scrapeadas de https://www.rffm.es/competicion/clasificaciones
-- ============================================================

CREATE TABLE IF NOT EXISTS rffm_standings (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                  uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  tracked_competition_id   uuid NOT NULL REFERENCES rffm_tracked_competitions(id) ON DELETE CASCADE,
  jornada                  int,
  posicion                 int NOT NULL,
  codigo_equipo            text NOT NULL,
  nombre_equipo            text NOT NULL,
  pj                       int DEFAULT 0,
  pg                       int DEFAULT 0,
  pe                       int DEFAULT 0,
  pp                       int DEFAULT 0,
  gf                       int DEFAULT 0,
  gc                       int DEFAULT 0,
  pts                      int DEFAULT 0,
  fetched_at               timestamptz DEFAULT NOW(),
  UNIQUE (tracked_competition_id, codigo_equipo)
);

CREATE INDEX IF NOT EXISTS idx_rffm_standings_comp
  ON rffm_standings (tracked_competition_id, posicion);
CREATE INDEX IF NOT EXISTS idx_rffm_standings_club
  ON rffm_standings (club_id);

-- last_standings_sync en tracked_competitions
ALTER TABLE rffm_tracked_competitions
  ADD COLUMN IF NOT EXISTS last_standings_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS standings_error     TEXT;

-- RLS — standings públicas dentro del club
ALTER TABLE rffm_standings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rffm_standings_select ON rffm_standings;
CREATE POLICY rffm_standings_select ON rffm_standings
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

DROP POLICY IF EXISTS rffm_standings_all ON rffm_standings;
CREATE POLICY rffm_standings_all ON rffm_standings
  FOR ALL TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo'))
  )
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo'))
  );
