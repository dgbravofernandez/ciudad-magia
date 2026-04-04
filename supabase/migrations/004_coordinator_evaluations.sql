-- ============================================================
-- CIUDAD MAGIA CRM — Migración 004: Coordinadores y evaluaciones
-- Añade período a observaciones, coordinación de equipos
-- ============================================================

-- Add period field to coordinator_observations
-- Periods: 'P1' (Sep-Dec), 'P2' (Jan-Mar), 'P3' (Apr-Jun)
ALTER TABLE coordinator_observations
  ADD COLUMN IF NOT EXISTS period TEXT CHECK (period IN ('P1', 'P2', 'P3')),
  ADD COLUMN IF NOT EXISTS season TEXT;

-- coordinator_team_assignments: explicit coordinator ↔ team assignments
-- (separate from team_coaches which is for coaching/training access)
CREATE TABLE IF NOT EXISTS coordinator_team_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, team_id)
);

ALTER TABLE coordinator_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordinator_team_assignments_club_read" ON coordinator_team_assignments
  FOR SELECT USING (
    club_id = (SELECT cm.club_id FROM club_members cm
               JOIN auth.users u ON u.id = cm.user_id
               WHERE u.id = auth.uid() LIMIT 1)
  );

CREATE POLICY "coordinator_team_assignments_admin_write" ON coordinator_team_assignments
  FOR ALL USING (
    club_id = (SELECT cm.club_id FROM club_members cm
               JOIN auth.users u ON u.id = cm.user_id
               WHERE u.id = auth.uid() LIMIT 1)
  );
