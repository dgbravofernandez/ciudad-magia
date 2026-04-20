-- ============================================================
-- 013 — Scouting: add status + player name for tracking
-- ============================================================

ALTER TABLE scouting_reports
  ADD COLUMN IF NOT EXISTS player_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('new', 'watching', 'contacted', 'signed', 'dropped'))
    DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_scouting_status ON scouting_reports(club_id, status);

-- Allow UPDATE / DELETE to director roles
DROP POLICY IF EXISTS "scouting_update" ON scouting_reports;
CREATE POLICY "scouting_update" ON scouting_reports
  FOR UPDATE TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('director_deportivo')
    )
  );

DROP POLICY IF EXISTS "scouting_delete" ON scouting_reports;
CREATE POLICY "scouting_delete" ON scouting_reports
  FOR DELETE TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('director_deportivo')
    )
  );
