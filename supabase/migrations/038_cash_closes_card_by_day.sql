-- Guardar verificación de tarjeta día a día en el cierre de caja
-- Cada elemento: { date: string, system: number, real: number }
ALTER TABLE cash_closes
  ADD COLUMN IF NOT EXISTS card_by_day JSONB DEFAULT '[]'::jsonb;
