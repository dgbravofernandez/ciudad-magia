-- 017_match_callups.sql
-- Convocatorias de partido: quién está llamado, quién es titular.
-- El tamaño máximo es configurable por equipo (no todos los clubes/categorías
-- tienen convocatoria de 18).

-- 1. Tamaño máximo por defecto en cada equipo.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS default_callup_size INTEGER DEFAULT 18
    CHECK (default_callup_size BETWEEN 1 AND 30);

-- 2. Tabla de convocatorias: una fila por jugador convocado.
CREATE TABLE IF NOT EXISTS match_callups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  is_starter  BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_callups_session ON match_callups(session_id);
CREATE INDEX IF NOT EXISTS idx_match_callups_player ON match_callups(player_id);

-- 3. RLS
ALTER TABLE match_callups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_callups_select" ON match_callups;
CREATE POLICY "match_callups_select" ON match_callups FOR SELECT
  USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "match_callups_insert" ON match_callups;
CREATE POLICY "match_callups_insert" ON match_callups FOR INSERT
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "match_callups_update" ON match_callups;
CREATE POLICY "match_callups_update" ON match_callups FOR UPDATE
  USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "match_callups_delete" ON match_callups;
CREATE POLICY "match_callups_delete" ON match_callups FOR DELETE
  USING (
    club_id IN (
      SELECT club_id FROM club_members WHERE user_id = auth.uid()
    )
  );
