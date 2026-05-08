-- ──────────────────────────────────────────────────────────────────
-- Migración 032: Configuración del email de asignación de equipo
--
-- Añade a club_settings las columnas necesarias para:
--   1. fees_image_url           — URL pública de Supabase Storage con la imagen de cuotas
--   2. assignment_email_subject — Asunto del email de asignación
--   3. assignment_email_body    — Cuerpo HTML del email (con placeholders {var})
--   4. reservation_deadline     — Fecha límite de reserva de plaza (DATE)
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS fees_image_url           TEXT,
  ADD COLUMN IF NOT EXISTS assignment_email_subject TEXT,
  ADD COLUMN IF NOT EXISTS assignment_email_body    TEXT,
  ADD COLUMN IF NOT EXISTS reservation_deadline     DATE;
