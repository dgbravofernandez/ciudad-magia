-- Recurring training schedules per team.
-- Each row = one weekly training slot. A team can have several (e.g. Mon + Wed).
-- A cron auto-generates `sessions` for the next week every Sunday.

CREATE TABLE IF NOT EXISTS team_schedule (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  weekday       INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time    TIME NOT NULL,
  end_time      TIME,
  location      TEXT,
  session_type  TEXT NOT NULL DEFAULT 'training' CHECK (session_type IN ('training', 'match')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_schedule_team ON team_schedule(team_id);
CREATE INDEX IF NOT EXISTS idx_team_schedule_club_active ON team_schedule(club_id, active);

-- Traceability: when a session is auto-generated from a schedule, link back.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES team_schedule(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS end_time   TIME,
  ADD COLUMN IF NOT EXISTS location   TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_schedule ON sessions(schedule_id);

-- Prevent duplicate auto-generation of the same (team, date, start_time) combo
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_team_date_start
  ON sessions(team_id, session_date, start_time)
  WHERE schedule_id IS NOT NULL;

-- Bonus: minutes played per player per match
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS minutes_played INTEGER;

-- RLS
ALTER TABLE team_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_schedule_select ON team_schedule;
CREATE POLICY team_schedule_select ON team_schedule FOR SELECT
  USING (club_id IN (SELECT cm.club_id FROM club_members cm WHERE cm.user_id = auth.uid()));

DROP POLICY IF EXISTS team_schedule_insert ON team_schedule;
CREATE POLICY team_schedule_insert ON team_schedule FOR INSERT
  WITH CHECK (club_id IN (
    SELECT cm.club_id FROM club_members cm
    JOIN club_member_roles cmr ON cmr.member_id = cm.id
    WHERE cm.user_id = auth.uid()
      AND cmr.role IN ('admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador')
  ));

DROP POLICY IF EXISTS team_schedule_update ON team_schedule;
CREATE POLICY team_schedule_update ON team_schedule FOR UPDATE
  USING (club_id IN (
    SELECT cm.club_id FROM club_members cm
    JOIN club_member_roles cmr ON cmr.member_id = cm.id
    WHERE cm.user_id = auth.uid()
      AND cmr.role IN ('admin', 'direccion', 'director_deportivo', 'coordinador', 'entrenador')
  ));

DROP POLICY IF EXISTS team_schedule_delete ON team_schedule;
CREATE POLICY team_schedule_delete ON team_schedule FOR DELETE
  USING (club_id IN (
    SELECT cm.club_id FROM club_members cm
    JOIN club_member_roles cmr ON cmr.member_id = cm.id
    WHERE cm.user_id = auth.uid()
      AND cmr.role IN ('admin', 'direccion', 'director_deportivo', 'coordinador')
  ));
