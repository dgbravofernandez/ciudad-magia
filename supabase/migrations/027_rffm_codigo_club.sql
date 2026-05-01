-- ============================================================
-- 027 — Persistir el código del club RFFM
-- Permite no repetirlo en el bulk-import del PDF y autocompletar
-- el codigo_equipo_nuestro al añadir competiciones.
-- ============================================================

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS rffm_codigo_club TEXT;
