-- ============================================================
-- 024 — RFFM enrich tracking
-- Permite enriquecer perfiles (año nacimiento) en batches por cron
-- sin reventar el límite de 60s de Vercel Hobby
-- ============================================================

ALTER TABLE rffm_scouting_signals
  ADD COLUMN IF NOT EXISTS enriched_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrich_attempts  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrich_error     TEXT;

-- Índice para que el cron de enrich coja siempre los más prioritarios
-- (sin año, menos intentos primero, mejor ratio primero)
CREATE INDEX IF NOT EXISTS idx_signals_enrich_pending
  ON rffm_scouting_signals (club_id, enrich_attempts ASC, goles_por_partido DESC)
  WHERE anio_nacimiento IS NULL AND enrich_attempts < 3;
