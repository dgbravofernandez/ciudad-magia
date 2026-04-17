-- ============================================================
-- Ropa ↔ Contabilidad: cuando un pedido se paga, se crea un
-- movimiento de caja ligado al pedido y al jugador.
-- También añadimos un campo `source` para distinguir cuota / ropa / torneo / gasto.
-- ============================================================

ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS related_clothing_order_id UUID REFERENCES clothing_orders(id) ON DELETE SET NULL;

ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS source TEXT
  CHECK (source IN ('cuota', 'ropa', 'torneo', 'gasto', 'otro'));

CREATE INDEX IF NOT EXISTS idx_cash_movements_source ON cash_movements(source);
CREATE INDEX IF NOT EXISTS idx_cash_movements_clothing_order ON cash_movements(related_clothing_order_id);

-- Backfill histórico: los movimientos existentes se etiquetan a partir de sus FKs
UPDATE cash_movements SET source = 'cuota' WHERE source IS NULL AND related_payment_id IS NOT NULL;
UPDATE cash_movements SET source = 'gasto' WHERE source IS NULL AND related_expense_id IS NOT NULL;
UPDATE cash_movements SET source = 'otro' WHERE source IS NULL;
