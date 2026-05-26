-- Enlace directo entre un movimiento de caja y el cobro de actividad que lo originó.
-- Permite mostrar el nombre del jugador y de la actividad en el cierre de caja
-- sin depender del campo "description" libre.

ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS related_activity_charge_id UUID
    REFERENCES activity_charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_activity_charge
  ON cash_movements(related_activity_charge_id)
  WHERE related_activity_charge_id IS NOT NULL;
