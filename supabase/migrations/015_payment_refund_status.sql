-- ============================================================
-- 015 — Añadir estado 'refunded' a quota_payments
-- ============================================================

-- quota_payments.status es TEXT con CHECK. Actualizamos el constraint.
ALTER TABLE quota_payments DROP CONSTRAINT IF EXISTS quota_payments_status_check;
ALTER TABLE quota_payments
  ADD CONSTRAINT quota_payments_status_check
  CHECK (status IN ('paid', 'pending', 'partial', 'exempt', 'refunded'));
