-- 042_player_special_case.sql
-- Marca de "jugador especial" a nivel de ficha + motivo.
-- Dispara alertas al hacer acciones negativas (eliminar, baja, avisos de deuda).
-- Distinto del quota_payments.is_special_case (que excluye del envío bulk de avisos).

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_special_case boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_case_reason text;

COMMENT ON COLUMN players.is_special_case IS 'Jugador marcado como caso especial desde su ficha — dispara alertas en acciones negativas';
COMMENT ON COLUMN players.special_case_reason IS 'Motivo por el que el jugador es un caso especial';
