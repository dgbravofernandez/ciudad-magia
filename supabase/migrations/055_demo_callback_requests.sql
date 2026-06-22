-- 055: Solicitudes de demo flexibles — "dime cuándo te viene y me adapto"
-- En vez de forzar al lead a elegir un hueco fijo (L-V 14:30-16:00), puede
-- dejar su disponibilidad en texto libre y Diego le llama cuando le encaje.
-- Esto reduce el abandono en /reservar (los huecos de tarde no encajan a todos).

-- 1. scheduled_at pasa a nullable: una solicitud de llamada no tiene hora fija aún
ALTER TABLE marketing_demos
  ALTER COLUMN scheduled_at DROP NOT NULL;

-- 2. Columna para la disponibilidad en texto libre ("mañanas", "después de las 18h"...)
ALTER TABLE marketing_demos
  ADD COLUMN IF NOT EXISTS preferred_time TEXT;

-- 3. Nuevo estado 'requested' para solicitudes sin hora fija (callback pendiente)
ALTER TABLE marketing_demos
  DROP CONSTRAINT IF EXISTS marketing_demos_status_check;
ALTER TABLE marketing_demos
  ADD CONSTRAINT marketing_demos_status_check
  CHECK (status = ANY (ARRAY['requested','scheduled','done','no_show','canceled','converted']));
