-- Player observations tab: coaches/coordinators can log technical, tactical, physical notes
CREATE TABLE IF NOT EXISTS player_observations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES club_members(id) ON DELETE SET NULL,
  author_name TEXT,
  category    TEXT NOT NULL DEFAULT 'General',
  comment     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_obs_player ON player_observations(player_id);
CREATE INDEX IF NOT EXISTS idx_player_obs_club ON player_observations(club_id);

ALTER TABLE player_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "player_obs_read" ON player_observations
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "player_obs_write" ON player_observations
  FOR INSERT TO authenticated
  WITH CHECK (club_id = get_my_club_id());
