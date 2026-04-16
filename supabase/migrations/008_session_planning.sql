-- ============================================================
-- 008 — Session planning, exercise repository extensions
-- ============================================================
-- Extiende exercises con campos del repositorio (subcategoría libre,
-- nº jugadores, material), añade tabla de favoritos por entrenador,
-- amplía sessions con objetivos y tracking de PDF/Drive, y session_attendance
-- con asistencia previa + grupo de peto + flag de portero.
-- También siembra las 5 categorías iniciales para cada club existente.

-- ---- exercises: nuevos campos ------------------------------
ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS subcategory  TEXT,
  ADD COLUMN IF NOT EXISTS players_min  INTEGER,
  ADD COLUMN IF NOT EXISTS players_max  INTEGER,
  ADD COLUMN IF NOT EXISTS material     TEXT;

CREATE INDEX IF NOT EXISTS idx_exercises_subcategory ON exercises(subcategory);

-- ---- exercise_favorites ------------------------------------
CREATE TABLE IF NOT EXISTS exercise_favorites (
  member_id   UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (member_id, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_exercise_favorites_member ON exercise_favorites(member_id);

ALTER TABLE exercise_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_manage_own_favorites" ON exercise_favorites;
CREATE POLICY "members_manage_own_favorites" ON exercise_favorites
  FOR ALL USING (
    member_id IN (
      SELECT id FROM club_members WHERE user_id = auth.uid() AND active = TRUE
    )
  );

-- ---- sessions: objetivos, hora fin, PDF, Drive -------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS objectives    TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS end_time      TIME,
  ADD COLUMN IF NOT EXISTS pdf_url       TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_url     TEXT;

-- ---- session_attendance: planificada, peto, portero --------
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS planned_status TEXT
    CHECK (planned_status IS NULL OR planned_status IN ('yes','no','maybe')),
  ADD COLUMN IF NOT EXISTS group_color    TEXT
    CHECK (group_color IS NULL OR group_color IN ('orange','pink','white')),
  ADD COLUMN IF NOT EXISTS is_goalkeeper  BOOLEAN DEFAULT FALSE;

-- ---- Seed de categorías por defecto para cada club ---------
INSERT INTO exercise_categories (club_id, name, color, sort_order)
SELECT c.id, cat.name, cat.color, cat.sort_order
FROM clubs c
CROSS JOIN (VALUES
  ('Posesiones',      '#3b82f6', 1),
  ('Ruedas de pases', '#8b5cf6', 2),
  ('Circuitos',       '#10b981', 3),
  ('Progresiones',    '#f59e0b', 4),
  ('Partido',         '#ef4444', 5)
) AS cat(name, color, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM exercise_categories ec WHERE ec.club_id = c.id
);
