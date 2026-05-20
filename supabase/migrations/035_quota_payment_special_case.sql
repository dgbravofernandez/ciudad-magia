-- 035: Marcar pagos pendientes como "caso especial" para excluirlos
-- del envío bulk de recordatorios.
--
-- Casos típicos: familias con quien ya hablamos, deuda condonada parcialmente,
-- problemas económicos conocidos, etc.

ALTER TABLE quota_payments
  ADD COLUMN IF NOT EXISTS is_special_case BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quota_payments_special_case_pending
  ON quota_payments (club_id, is_special_case)
  WHERE status = 'pending';
