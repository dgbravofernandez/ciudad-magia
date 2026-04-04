-- ============================================================
-- CIUDAD MAGIA CRM — Migración 002: Nuevos módulos
-- Torneos, Ropa, Carta de pruebas, Solicitudes alta/baja,
-- Servicios externos, Descuento hermanos, Módulos seleccionables
-- ============================================================

-- ============================================================
-- ACTUALIZAR CLUB_SETTINGS: nuevos campos
-- ============================================================
ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS sibling_discount_enabled  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sibling_discount_percent  INTEGER DEFAULT 40,
  ADD COLUMN IF NOT EXISTS enabled_modules           JSONB DEFAULT '{"jugadores":true,"contabilidad":true,"entrenadores":true,"personal":true,"comunicaciones":true,"torneos":true,"ropa":true}';

-- ============================================================
-- ACTUALIZAR SESSION_ATTENDANCE: añadir minutes_played
-- ============================================================
ALTER TABLE session_attendance
  ADD COLUMN IF NOT EXISTS minutes_played INTEGER DEFAULT 0;

-- ============================================================
-- CARTA DE PRUEBAS
-- ============================================================
CREATE TABLE IF NOT EXISTS trial_letters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  player_name     TEXT NOT NULL,
  player_dob      DATE,
  tutor_name      TEXT,
  tutor_email     TEXT,
  trial_date      DATE,
  location        TEXT,
  director_name   TEXT,
  pdf_url         TEXT,
  sent_at         TIMESTAMPTZ,
  created_by      UUID REFERENCES club_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trial_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trial_letters_read" ON trial_letters
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "trial_letters_write" ON trial_letters
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo') OR has_role('coordinador'))
  );

-- ============================================================
-- SOLICITUDES ALTA / BAJA (coordinadores → dirección)
-- ============================================================
CREATE TABLE IF NOT EXISTS registration_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('alta', 'baja')),
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  -- Para altas: datos del nuevo jugador
  player_data     JSONB DEFAULT '{}',
  team_id         UUID REFERENCES teams(id) ON DELETE SET NULL,
  requested_by    UUID REFERENCES club_members(id),
  reviewed_by     UUID REFERENCES club_members(id),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  notes           TEXT,
  rejection_reason TEXT,
  submitted_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reg_requests_read" ON registration_requests
  FOR SELECT TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR has_role('director_deportivo') OR
      requested_by = get_my_member_id()
    )
  );

CREATE POLICY "reg_requests_insert" ON registration_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('coordinador') OR has_role('director_deportivo'))
  );

CREATE POLICY "reg_requests_update" ON registration_requests
  FOR UPDATE TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      -- El que creó puede editar si está en draft
      (requested_by = get_my_member_id() AND status = 'draft') OR
      -- Dirección/admin puede aprobar/rechazar
      has_role('admin') OR has_role('direccion') OR has_role('director_deportivo')
    )
  );

-- ============================================================
-- TORNEOS
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT,
  format          TEXT DEFAULT 'league' CHECK (format IN ('league', 'cup', 'mixed')),
  start_date      DATE,
  end_date        DATE,
  location        TEXT,
  status          TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'finished')),
  notes           TEXT,
  created_by      UUID REFERENCES club_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  contact         TEXT,
  logo_url        TEXT,
  is_home_club    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,  -- 'A', 'B', 'C'...
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES tournament_groups(id) ON DELETE SET NULL,
  home_team_id    UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  away_team_id    UUID REFERENCES tournament_teams(id) ON DELETE SET NULL,
  home_score      INTEGER,
  away_score      INTEGER,
  match_date      TIMESTAMPTZ,
  location        TEXT,
  round           TEXT,  -- 'jornada_1', 'cuartos', 'semis', 'final'
  stage           TEXT DEFAULT 'group' CHECK (stage IN ('group', 'knockout')),
  status          TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'played', 'cancelled')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Torneos
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournaments_read" ON tournaments
  FOR SELECT TO authenticated USING (club_id = get_my_club_id());

CREATE POLICY "tournaments_write" ON tournaments
  FOR ALL TO authenticated
  USING (club_id = get_my_club_id())
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo') OR has_role('coordinador'))
  );

CREATE POLICY "tournament_teams_read" ON tournament_teams
  FOR SELECT TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_teams_write" ON tournament_teams
  FOR ALL TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()))
  WITH CHECK (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_groups_read" ON tournament_groups
  FOR SELECT TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_groups_write" ON tournament_groups
  FOR ALL TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()))
  WITH CHECK (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_matches_read" ON tournament_matches
  FOR SELECT TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

CREATE POLICY "tournament_matches_write" ON tournament_matches
  FOR ALL TO authenticated
  USING (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()))
  WITH CHECK (tournament_id IN (SELECT id FROM tournaments WHERE club_id = get_my_club_id()));

-- ============================================================
-- ROPA — Pedidos de equipación
-- ============================================================
CREATE TABLE IF NOT EXISTS clothing_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  description     TEXT,
  total_amount    NUMERIC(10,2) DEFAULT 0,
  payment_status  TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_by      UUID REFERENCES club_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clothing_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES clothing_orders(id) ON DELETE CASCADE,
  item_name       TEXT NOT NULL,
  size            TEXT,
  quantity        INTEGER DEFAULT 1,
  unit_price      NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clothing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothing_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clothing_orders_read" ON clothing_orders
  FOR SELECT TO authenticated USING (club_id = get_my_club_id());

CREATE POLICY "clothing_orders_write" ON clothing_orders
  FOR ALL TO authenticated
  USING (club_id = get_my_club_id())
  WITH CHECK (club_id = get_my_club_id());

CREATE POLICY "clothing_order_items_read" ON clothing_order_items
  FOR SELECT TO authenticated
  USING (order_id IN (SELECT id FROM clothing_orders WHERE club_id = get_my_club_id()));

CREATE POLICY "clothing_order_items_write" ON clothing_order_items
  FOR ALL TO authenticated
  USING (order_id IN (SELECT id FROM clothing_orders WHERE club_id = get_my_club_id()))
  WITH CHECK (order_id IN (SELECT id FROM clothing_orders WHERE club_id = get_my_club_id()));

-- ============================================================
-- SERVICIOS EXTERNOS (contabilidad separada por servicio)
-- ============================================================
CREATE TABLE IF NOT EXISTS external_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,  -- 'Torneo Copa Verano', 'Campus', 'Clínica técnica'
  type            TEXT DEFAULT 'other' CHECK (type IN ('tournament', 'campus', 'clinic', 'transport', 'other')),
  start_date      DATE,
  end_date        DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes           TEXT,
  created_by      UUID REFERENCES club_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_service_charges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES external_services(id) ON DELETE CASCADE,
  player_id       UUID REFERENCES players(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  payment_status  TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  paid_at         TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS external_service_expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id      UUID NOT NULL REFERENCES external_services(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  category        TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE external_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_service_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_service_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ext_services_read" ON external_services
  FOR SELECT TO authenticated USING (club_id = get_my_club_id());

CREATE POLICY "ext_services_write" ON external_services
  FOR ALL TO authenticated
  USING (club_id = get_my_club_id())
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion') OR has_role('director_deportivo'))
  );

CREATE POLICY "ext_charges_read" ON external_service_charges
  FOR SELECT TO authenticated
  USING (service_id IN (SELECT id FROM external_services WHERE club_id = get_my_club_id()));

CREATE POLICY "ext_charges_write" ON external_service_charges
  FOR ALL TO authenticated
  USING (service_id IN (SELECT id FROM external_services WHERE club_id = get_my_club_id()))
  WITH CHECK (service_id IN (SELECT id FROM external_services WHERE club_id = get_my_club_id()));

CREATE POLICY "ext_expenses_read" ON external_service_expenses
  FOR SELECT TO authenticated
  USING (service_id IN (SELECT id FROM external_services WHERE club_id = get_my_club_id()));

CREATE POLICY "ext_expenses_write" ON external_service_expenses
  FOR ALL TO authenticated
  USING (service_id IN (SELECT id FROM external_services WHERE club_id = get_my_club_id()))
  WITH CHECK (service_id IN (SELECT id FROM external_services WHERE club_id = get_my_club_id()));

-- ============================================================
-- FUNCIÓN HELPER: descuento hermanos
-- Detecta si un tutor_email/phone ya tiene otro jugador activo
-- en el mismo club y devuelve el % de descuento aplicable
-- ============================================================
CREATE OR REPLACE FUNCTION get_sibling_discount(p_player_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_club_id UUID;
  v_tutor_email TEXT;
  v_tutor_phone TEXT;
  v_sibling_count INTEGER;
  v_discount_enabled BOOLEAN;
  v_discount_percent INTEGER;
BEGIN
  -- Get player info
  SELECT club_id, tutor_email, tutor_phone
  INTO v_club_id, v_tutor_email, v_tutor_phone
  FROM players WHERE id = p_player_id;

  -- Get club settings
  SELECT sibling_discount_enabled, sibling_discount_percent
  INTO v_discount_enabled, v_discount_percent
  FROM club_settings WHERE club_id = v_club_id;

  IF NOT v_discount_enabled THEN
    RETURN 0;
  END IF;

  -- Count siblings (same tutor, different player, active)
  SELECT COUNT(*) INTO v_sibling_count
  FROM players
  WHERE club_id = v_club_id
    AND id != p_player_id
    AND status = 'active'
    AND (
      (v_tutor_email IS NOT NULL AND tutor_email = v_tutor_email) OR
      (v_tutor_phone IS NOT NULL AND tutor_phone = v_tutor_phone)
    );

  IF v_sibling_count > 0 THEN
    RETURN v_discount_percent;
  END IF;

  RETURN 0;
END;
$$;

-- ============================================================
-- ÍNDICES adicionales para rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tournaments_club ON tournaments(club_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_clothing_orders_club ON clothing_orders(club_id);
CREATE INDEX IF NOT EXISTS idx_clothing_orders_player ON clothing_orders(player_id);
CREATE INDEX IF NOT EXISTS idx_trial_letters_club ON trial_letters(club_id);
CREATE INDEX IF NOT EXISTS idx_reg_requests_club ON registration_requests(club_id);
CREATE INDEX IF NOT EXISTS idx_external_services_club ON external_services(club_id);
