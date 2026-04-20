-- 018_club_branding.sql
-- Gestión de patrocinadores por club (editable desde /configuracion/club).

CREATE TABLE IF NOT EXISTS club_sponsors (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  logo_url   TEXT,
  website    TEXT,
  sort_order INTEGER DEFAULT 0,
  active     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_sponsors_club ON club_sponsors(club_id);

-- 3. RLS
ALTER TABLE club_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_sponsors_select" ON club_sponsors;
CREATE POLICY "club_sponsors_select" ON club_sponsors FOR SELECT
  USING (
    club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "club_sponsors_all" ON club_sponsors;
CREATE POLICY "club_sponsors_all" ON club_sponsors FOR ALL
  USING (
    club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())
  );
