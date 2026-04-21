-- =============================================================
-- 019_season_fees.sql
-- Cuotas configurables por temporada + equipo + concepto.
-- Permite convivencia de temporada actual (25/26) y próxima (26/27)
-- con importes distintos por equipo.
-- =============================================================

CREATE TABLE IF NOT EXISTS season_fees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  season      TEXT NOT NULL,                               -- '2025/26'
  team_id     UUID REFERENCES teams(id) ON DELETE CASCADE, -- NULL = cuota por defecto de la temporada
  concept     TEXT NOT NULL,                               -- 'Reserva', 'Cuota mensual', 'Inscripción'
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Un mismo concepto no puede repetirse para el mismo club+temporada+equipo
CREATE UNIQUE INDEX IF NOT EXISTS uq_season_fees_ctse
  ON season_fees(club_id, season, COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid), concept);

CREATE INDEX IF NOT EXISTS idx_season_fees_club_season ON season_fees(club_id, season);
CREATE INDEX IF NOT EXISTS idx_season_fees_team ON season_fees(team_id);

ALTER TABLE season_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sf_select ON season_fees;
CREATE POLICY sf_select ON season_fees FOR SELECT
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS sf_insert ON season_fees;
CREATE POLICY sf_insert ON season_fees FOR INSERT
  WITH CHECK (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS sf_update ON season_fees;
CREATE POLICY sf_update ON season_fees FOR UPDATE
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS sf_delete ON season_fees;
CREATE POLICY sf_delete ON season_fees FOR DELETE
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));
