-- ============================================================
-- 010 — Session planning extras
-- ============================================================
-- 1) Rename session_exercises.position → slot_order to match the code base.
-- 2) Add microcycle / macrocycle / session_number to sessions for the
--    planning context shown in the exported PDF.

-- ---- 1) session_exercises.position → slot_order ------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_exercises'
      AND column_name = 'position'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_exercises'
      AND column_name = 'slot_order'
  ) THEN
    ALTER TABLE session_exercises RENAME COLUMN position TO slot_order;
  END IF;

  -- If the column never existed, add it (idempotent safety net)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_exercises'
      AND column_name = 'slot_order'
  ) THEN
    ALTER TABLE session_exercises
      ADD COLUMN slot_order INTEGER NOT NULL DEFAULT 1
        CHECK (slot_order BETWEEN 1 AND 4);
  END IF;
END $$;

-- ---- 2) sessions: planning fields --------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS microcycle      TEXT,
  ADD COLUMN IF NOT EXISTS macrocycle      TEXT,
  ADD COLUMN IF NOT EXISTS session_number  INTEGER;
