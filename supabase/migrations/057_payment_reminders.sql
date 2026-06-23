-- 057: Tabla para trackear avisos de pago por tipo (reserva, 1er plazo, etc.)
-- Permite filtrar quién ha recibido qué aviso y cuándo, sin depender del asunto
-- del email en la tabla communications (que es más frágil).

CREATE TABLE IF NOT EXISTS payment_reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season      TEXT NOT NULL,           -- ej. '2025/26'
  milestone   TEXT NOT NULL,           -- ej. 'Reserva de plaza', '1er plazo'
  amount      NUMERIC(10,2),           -- importe del aviso (puede ser null si no aplica)
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payment_reminders_club_season
  ON payment_reminders(club_id, season);

CREATE INDEX IF NOT EXISTS payment_reminders_player
  ON payment_reminders(player_id);

-- RLS: solo miembros del club pueden ver/insertar sus propios avisos
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_reminders_club_isolation"
  ON payment_reminders
  USING (club_id IN (
    SELECT club_id FROM club_members WHERE user_id = auth.uid()
  ));
