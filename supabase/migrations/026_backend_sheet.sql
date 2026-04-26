-- ============================================================
-- 026 — Configuración del backend Sheet
-- ID de la hoja de Google Sheets donde se vuelca el snapshot
-- de las tablas importantes del CRM (jugadores, contabilidad…)
-- ============================================================

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS backend_sheet_id        TEXT,
  ADD COLUMN IF NOT EXISTS backend_sheet_last_sync TIMESTAMPTZ;
