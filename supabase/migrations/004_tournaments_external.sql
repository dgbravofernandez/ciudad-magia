-- ============================================================
-- Torneos: separar "local" (organizamos nosotros) de "external" (vamos a uno)
-- + presupuesto + asistentes + integración con contabilidad.
-- ============================================================

-- 1. Distinguir tipo de torneo
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'local'
  CHECK (kind IN ('local', 'external'));

-- Existing rows stay as 'local' by default (ya tienen DEFAULT).

-- 2. Marcar el equipo propio cuando Ciudad de Getafe participa en torneo local
ALTER TABLE tournament_teams
  ADD COLUMN IF NOT EXISTS is_own_club BOOLEAN DEFAULT FALSE;

-- 3. Reglas de puntuación del torneo local (se usarán en fase 2c)
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS allow_draws BOOLEAN DEFAULT TRUE;

-- 4. Grupos: fase y ronda (para la 2ª fase "1º vs 1º, 2º vs 2º...")
ALTER TABLE tournament_groups
  ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'groups'
  CHECK (phase IN ('groups', 'placements', 'knockout'));

ALTER TABLE tournament_groups
  ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;

-- 5. Partidos: soporte para penaltis cuando allow_draws=false
ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS went_to_penalties BOOLEAN DEFAULT FALSE;

ALTER TABLE tournament_matches
  ADD COLUMN IF NOT EXISTS penalty_winner_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL;

-- ============================================================
-- PRESUPUESTO DEL TORNEO EXTERNO
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_budget (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL UNIQUE REFERENCES tournaments(id) ON DELETE CASCADE,
  organizer_cost      NUMERIC(10,2) DEFAULT 0,      -- coste total al organizador
  margin_pct          NUMERIC(5,2) DEFAULT 0,       -- % de margen del club (ej. 10.00)
  estimated_players   INTEGER DEFAULT 0,            -- nº estimado de jugadores para el cálculo
  price_mode          TEXT DEFAULT 'auto' CHECK (price_mode IN ('auto', 'manual')),
  price_manual        NUMERIC(10,2),                -- precio fijado a mano (si mode='manual')
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_budget_tournament ON tournament_budget(tournament_id);

-- Gastos adicionales del torneo (bus, hotel, comidas, árbitros...)
CREATE TABLE IF NOT EXISTS tournament_budget_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,                -- "Autobús ida/vuelta"
  amount              NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_paid             BOOLEAN DEFAULT FALSE,        -- ¿ya lo hemos pagado?
  payment_method      TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
  paid_at             TIMESTAMPTZ,
  related_expense_id  UUID REFERENCES expenses(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_budget_items_tournament ON tournament_budget_items(tournament_id);

-- ============================================================
-- ASISTENTES (qué jugadores van al torneo y cuánto paga cada familia)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_attendees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id           UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount_due          NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status      TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  payment_method      TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
  paid_at             TIMESTAMPTZ,
  notes               TEXT,
  added_by            UUID REFERENCES club_members(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_attendees_tournament ON tournament_attendees(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_attendees_player ON tournament_attendees(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_attendees_status ON tournament_attendees(payment_status);

-- ============================================================
-- LINKS CONTABILIDAD: cash_movements puede apuntar al torneo y al asistente
-- ============================================================
ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS related_tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL;

ALTER TABLE cash_movements
  ADD COLUMN IF NOT EXISTS related_tournament_attendee_id UUID REFERENCES tournament_attendees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_tournament ON cash_movements(related_tournament_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_tournament_attendee ON cash_movements(related_tournament_attendee_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE tournament_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_budget_read" ON tournament_budget
  FOR SELECT TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_budget_write" ON tournament_budget
  FOR ALL TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()))
  WITH CHECK (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_budget_items_read" ON tournament_budget_items
  FOR SELECT TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_budget_items_write" ON tournament_budget_items
  FOR ALL TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()))
  WITH CHECK (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_attendees_read" ON tournament_attendees
  FOR SELECT TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_attendees_write" ON tournament_attendees
  FOR ALL TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()))
  WITH CHECK (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));
