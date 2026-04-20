-- ============================================================
-- 014 — Session director comments
-- Free-form comments from dirección / director deportivo on a
-- specific training / match, separate from coordinator_observations.
-- ============================================================

CREATE TABLE IF NOT EXISTS session_director_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES club_members(id),
  comment     TEXT NOT NULL,
  visible_to_coach BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sdc_session ON session_director_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_sdc_club    ON session_director_comments(club_id);

ALTER TABLE session_director_comments ENABLE ROW LEVEL SECURITY;

-- Read: any member of the same club (visible_to_coach gate enforced in app layer)
CREATE POLICY "sdc_read" ON session_director_comments
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

-- Write: only admin / direccion / director_deportivo
CREATE POLICY "sdc_insert" ON session_director_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo'))
  );

CREATE POLICY "sdc_update" ON session_director_comments
  FOR UPDATE TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo'))
  );

CREATE POLICY "sdc_delete" ON session_director_comments
  FOR DELETE TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo'))
  );
