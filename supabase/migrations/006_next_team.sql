-- Add next_team_id to players for next-season assignment (26/27)
-- team_id = current season (25/26, read-only in inscriptions)
-- next_team_id = next season assignment (26/27, editable in inscriptions)
ALTER TABLE players ADD COLUMN IF NOT EXISTS next_team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
