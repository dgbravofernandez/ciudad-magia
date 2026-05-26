-- 038: Mejoras al cierre de caja
--
-- 1. Ampliar el CHECK de cash_movements.source para incluir 'actividad'
--    (era: cuota|ropa|torneo|gasto|otro — faltaba actividad → inserts fallaban silenciosamente)
-- 2. Añadir fondo de caja (cambio) persistente a club_settings
-- 3. Guardar snapshot del fondo en cada cierre

-- ── 1. Arreglar constraint source ──────────────────────────────────────────
ALTER TABLE cash_movements
  DROP CONSTRAINT IF EXISTS cash_movements_source_check;

ALTER TABLE cash_movements
  ADD CONSTRAINT cash_movements_source_check
  CHECK (source IN ('cuota', 'ropa', 'torneo', 'actividad', 'gasto', 'otro'));

-- ── 2. Fondo de caja persistente ───────────────────────────────────────────
ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS cash_register_float DECIMAL(10,2) NOT NULL DEFAULT 0
  CHECK (cash_register_float >= 0);

-- ── 3. Snapshot del fondo en cada cierre ───────────────────────────────────
ALTER TABLE cash_closes
  ADD COLUMN IF NOT EXISTS cash_register_float DECIMAL(10,2) NOT NULL DEFAULT 0;
