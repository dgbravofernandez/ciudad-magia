-- 045: Tics de comprobación por operación en caja
-- Cada movimiento puede marcarse como "verificado" (cotejado con datáfono/banco).
ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES club_members(id) ON DELETE SET NULL;

COMMENT ON COLUMN cash_movements.verified IS 'Operación cotejada manualmente (TPV/banco) en el arqueo';
