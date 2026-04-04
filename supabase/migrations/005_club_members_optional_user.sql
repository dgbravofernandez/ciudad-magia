-- ============================================================
-- CIUDAD MAGIA CRM — Migración 005
-- Permite crear entrenadores/staff sin cuenta de login (stub)
-- ============================================================

-- Make user_id nullable: coaches imported from sheet don't have auth accounts yet
ALTER TABLE club_members ALTER COLUMN user_id DROP NOT NULL;

-- Add coach-specific fields
ALTER TABLE club_members
  ADD COLUMN IF NOT EXISTS form_link        TEXT,       -- inscription form link sent to them
  ADD COLUMN IF NOT EXISTS form_sent        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS form_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dni              TEXT,
  ADD COLUMN IF NOT EXISTS birth_date       DATE,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  -- Document URLs (from Google Drive or uploaded)
  ADD COLUMN IF NOT EXISTS doc_dni_url               TEXT,
  ADD COLUMN IF NOT EXISTS doc_antecedentes_url      TEXT,
  ADD COLUMN IF NOT EXISTS doc_delitos_sexuales_url  TEXT,
  ADD COLUMN IF NOT EXISTS doc_licencia_url          TEXT,
  ADD COLUMN IF NOT EXISTS doc_titulacion_url        TEXT,
  ADD COLUMN IF NOT EXISTS doc_contrato_url          TEXT;
