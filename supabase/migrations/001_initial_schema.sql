-- ============================================================
-- CIUDAD MAGIA CRM — Schema inicial
-- Multi-tenant: shared schema con club_id + RLS
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CLUBS (tenants)
-- ============================================================
CREATE TABLE clubs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#003087',
  secondary_color TEXT DEFAULT '#FFFFFF',
  city            TEXT,
  country         TEXT DEFAULT 'ES',
  plan            TEXT DEFAULT 'starter',
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLUB SETTINGS (1 fila por club)
-- ============================================================
CREATE TABLE club_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                   UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  quota_amounts             JSONB DEFAULT '{}',
  quota_deadline_day        INTEGER DEFAULT 5,
  special_quota_cases       JSONB DEFAULT '[]',
  google_sheets_id          TEXT,
  google_refresh_token      TEXT,
  google_service_email      TEXT,
  gmail_from_address        TEXT,
  inscription_open          BOOLEAN DEFAULT FALSE,
  sanction_yellow_threshold INTEGER DEFAULT 5,
  sanction_matches          INTEGER DEFAULT 1,
  UNIQUE (club_id)
);

-- ============================================================
-- CLUB MEMBERS (usuarios del club)
-- ============================================================
CREATE TABLE club_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  avatar_url  TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (club_id, user_id)
);
CREATE INDEX idx_club_members_club ON club_members(club_id);
CREATE INDEX idx_club_members_user ON club_members(user_id);

-- ============================================================
-- CLUB MEMBER ROLES (multi-rol por usuario)
-- ============================================================
CREATE TABLE club_member_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN (
    'admin', 'direccion', 'director_deportivo',
    'coordinador', 'entrenador', 'fisio', 'infancia', 'redes'
  )),
  team_id     UUID,  -- FK añadida abajo tras crear teams
  UNIQUE (member_id, role)
);
CREATE INDEX idx_member_roles_member ON club_member_roles(member_id);

-- ============================================================
-- EMAIL TEMPLATES
-- ============================================================
CREATE TABLE email_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_email_templates_club ON email_templates(club_id);

-- ============================================================
-- CATEGORIES (Benjamín, Alevín, Infantil...)
-- ============================================================
CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  birth_year_from INTEGER,
  birth_year_to   INTEGER,
  season          TEXT NOT NULL,
  active          BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0
);
CREATE INDEX idx_categories_club ON categories(club_id);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id),
  name            TEXT NOT NULL,
  coordinator_id  UUID REFERENCES club_members(id),
  season          TEXT NOT NULL,
  active          BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_teams_club ON teams(club_id);

-- Añadir FK en club_member_roles → teams
ALTER TABLE club_member_roles
  ADD CONSTRAINT fk_cmr_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

CREATE TABLE team_coaches (
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES club_members(id) ON DELETE CASCADE,
  role        TEXT DEFAULT 'entrenador',
  PRIMARY KEY (team_id, member_id)
);

-- ============================================================
-- PLAYERS (Libro Maestro)
-- ============================================================
CREATE TABLE players (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  first_name                    TEXT NOT NULL,
  last_name                     TEXT NOT NULL,
  photo_url                     TEXT,
  birth_date                    DATE,
  dni                           TEXT,
  nationality                   TEXT DEFAULT 'ES',
  tutor_name                    TEXT,
  tutor_email                   TEXT,
  tutor_phone                   TEXT,
  tutor2_name                   TEXT,
  tutor2_email                  TEXT,
  position                      TEXT,
  dominant_foot                 TEXT,
  height_cm                     INTEGER,
  weight_kg                     DECIMAL(5,2),
  team_id                       UUID REFERENCES teams(id),
  dorsal_number                 INTEGER,
  status                        TEXT DEFAULT 'active',
  -- Inscripción / Google Sheets columns
  sheets_row_index              INTEGER,
  forms_link                    TEXT,
  wants_to_continue             BOOLEAN,
  meets_requirements            BOOLEAN,
  made_reservation              BOOLEAN,
  -- Email tracking flags
  email_team_assignment_sent    BOOLEAN DEFAULT FALSE,
  email_request_docs_sent       BOOLEAN DEFAULT FALSE,
  email_fill_form_sent          BOOLEAN DEFAULT FALSE,
  email_admitted_sent           BOOLEAN DEFAULT FALSE,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_players_club ON players(club_id);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_status ON players(status);

-- Stats por temporada
CREATE TABLE player_season_stats (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id         UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season            TEXT NOT NULL,
  team_id           UUID REFERENCES teams(id),
  goals             INTEGER DEFAULT 0,
  assists           INTEGER DEFAULT 0,
  yellow_cards      INTEGER DEFAULT 0,
  red_cards         INTEGER DEFAULT 0,
  matches_played    INTEGER DEFAULT 0,
  matches_available INTEGER DEFAULT 0,
  rating_avg        DECIMAL(3,1),
  UNIQUE (player_id, season)
);

-- ============================================================
-- INJURIES
-- ============================================================
CREATE TABLE injuries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reported_by     UUID REFERENCES club_members(id),
  injury_type     TEXT,
  body_part       TEXT,
  description     TEXT,
  injured_at      DATE NOT NULL,
  estimated_recovery DATE,
  recovered_at    DATE,
  status          TEXT DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_injuries_club ON injuries(club_id);
CREATE INDEX idx_injuries_player ON injuries(player_id);
CREATE INDEX idx_injuries_status ON injuries(status);

-- Citas de fisio
CREATE TABLE fisio_appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  injury_id       UUID REFERENCES injuries(id),
  player_id       UUID NOT NULL REFERENCES players(id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  coach_confirmed BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT 'pending',
  notes           TEXT,
  created_by      UUID REFERENCES club_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_fisio_appointments_club ON fisio_appointments(club_id);

-- ============================================================
-- SESSIONS (entrenamientos y partidos)
-- ============================================================
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES teams(id),
  session_type    TEXT NOT NULL CHECK (session_type IN ('training', 'match')),
  session_date    DATE NOT NULL,
  start_time      TIME,
  opponent        TEXT,
  score_home      INTEGER,
  score_away      INTEGER,
  is_home         BOOLEAN DEFAULT TRUE,
  notes           TEXT,
  logged_by       UUID REFERENCES club_members(id),
  is_live         BOOLEAN DEFAULT FALSE,
  completed       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_club ON sessions(club_id);
CREATE INDEX idx_sessions_team ON sessions(team_id);
CREATE INDEX idx_sessions_date ON sessions(session_date DESC);

-- Asistencia
CREATE TABLE session_attendance (
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'present',
  goals       INTEGER DEFAULT 0,
  assists     INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards   INTEGER DEFAULT 0,
  rating      DECIMAL(3,1),
  notes       TEXT,
  PRIMARY KEY (session_id, player_id)
);

-- Eventos de partido (para live tracking)
CREATE TABLE match_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES players(id),
  event_type  TEXT NOT NULL CHECK (event_type IN (
    'goal', 'assist', 'yellow_card', 'red_card', 'substitution_in',
    'substitution_out', 'injury', 'own_goal'
  )),
  minute      INTEGER,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_match_events_session ON match_events(session_id);

-- Incidencias reportadas en sesión
CREATE TABLE session_incidents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player_id   UUID REFERENCES players(id),
  type        TEXT NOT NULL CHECK (type IN ('behavioral', 'medical', 'disciplinary', 'other')),
  description TEXT NOT NULL,
  severity    TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  reported_by UUID REFERENCES club_members(id),
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_incidents_club ON session_incidents(club_id);

-- ============================================================
-- SANCIONES
-- ============================================================
CREATE TABLE sanction_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  competition TEXT DEFAULT 'liga',
  yellow_threshold INTEGER DEFAULT 5,
  sanction_matches INTEGER DEFAULT 1,
  UNIQUE (club_id, competition)
);

CREATE TABLE player_sanctions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season          TEXT NOT NULL,
  competition     TEXT DEFAULT 'liga',
  matches_banned  INTEGER DEFAULT 1,
  matches_served  INTEGER DEFAULT 0,
  start_date      DATE,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sanctions_player ON player_sanctions(player_id);

-- ============================================================
-- EXERCISE REPOSITORY (Pizarra Táctica)
-- ============================================================
CREATE TABLE exercise_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#6366f1',
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category_id     UUID REFERENCES exercise_categories(id),
  objective_tags  TEXT[] DEFAULT '{}',
  duration_min    INTEGER,
  canvas_data     JSONB,
  canvas_image_url TEXT,
  author_id       UUID REFERENCES club_members(id),
  is_public       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_exercises_club ON exercises(club_id);
CREATE INDEX idx_exercises_category ON exercises(category_id);

CREATE TABLE session_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id),
  position    INTEGER NOT NULL CHECK (position BETWEEN 1 AND 4),
  notes       TEXT,
  duration_min INTEGER,
  custom_canvas_data JSONB,
  UNIQUE (session_id, position)
);

-- ============================================================
-- ACCOUNTING (Contabilidad)
-- ============================================================
CREATE TABLE quota_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  season          TEXT NOT NULL,
  month           INTEGER CHECK (month BETWEEN 1 AND 12),
  concept         TEXT,
  amount_due      DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid     DECIMAL(10,2) DEFAULT 0,
  payment_date    DATE,
  payment_method  TEXT CHECK (payment_method IN ('transfer', 'cash', 'card')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'exempt')),
  notes           TEXT,
  email_sent      BOOLEAN DEFAULT FALSE,
  registered_by   UUID REFERENCES club_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_quota_payments_club ON quota_payments(club_id);
CREATE INDEX idx_quota_payments_player ON quota_payments(player_id);
CREATE INDEX idx_quota_payments_status ON quota_payments(status);

CREATE TABLE expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  description     TEXT NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  expense_date    DATE NOT NULL,
  paid_by         UUID REFERENCES club_members(id),
  receipt_url     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_expenses_club ON expenses(club_id);

CREATE TABLE cash_movements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description         TEXT NOT NULL,
  amount              DECIMAL(10,2) NOT NULL,
  payment_method      TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')),
  movement_date       DATE NOT NULL,
  related_payment_id  UUID REFERENCES quota_payments(id),
  related_expense_id  UUID REFERENCES expenses(id),
  registered_by       UUID REFERENCES club_members(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cash_movements_club ON cash_movements(club_id);

CREATE TABLE cash_closes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  period_start        DATE NOT NULL,
  period_end          DATE NOT NULL,
  system_cash         DECIMAL(10,2) NOT NULL,
  real_cash           DECIMAL(10,2) NOT NULL,
  system_card         DECIMAL(10,2) NOT NULL,
  real_card           DECIMAL(10,2) NOT NULL,
  cash_difference     DECIMAL(10,2) GENERATED ALWAYS AS (real_cash - system_cash) STORED,
  card_difference     DECIMAL(10,2) GENERATED ALWAYS AS (real_card - system_card) STORED,
  notes               TEXT,
  closed_by           UUID REFERENCES club_members(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cash_closes_club ON cash_closes(club_id);

-- ============================================================
-- COMMUNICATIONS
-- ============================================================
CREATE TABLE communications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  sent_by         UUID REFERENCES club_members(id),
  template_id     UUID REFERENCES email_templates(id),
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  recipient_type  TEXT NOT NULL CHECK (recipient_type IN ('individual', 'team', 'category', 'all', 'filter')),
  recipient_ids   UUID[],
  recipient_filter JSONB,
  sent_at         TIMESTAMPTZ,
  gmail_thread_id TEXT,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_communications_club ON communications(club_id);

CREATE TABLE communication_recipients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id    UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  player_id           UUID REFERENCES players(id),
  email_address       TEXT NOT NULL,
  gmail_message_id    TEXT,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'bounced', 'failed')),
  sent_at             TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ
);
CREATE INDEX idx_comm_recipients_comm ON communication_recipients(communication_id);

-- ============================================================
-- PERSONAL DEL CLUB — Redes Sociales
-- ============================================================
CREATE TABLE media_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  team_id         UUID REFERENCES teams(id),
  uploader_id     UUID REFERENCES club_members(id),
  type            TEXT DEFAULT 'photo' CHECK (type IN ('photo', 'video', 'drive_folder')),
  url             TEXT NOT NULL,
  storage_path    TEXT,
  drive_url       TEXT,
  caption         TEXT,
  taken_at        DATE,
  taken_month     INTEGER,
  taken_year      INTEGER,
  approved        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_media_items_club ON media_items(club_id);
CREATE INDEX idx_media_items_team ON media_items(team_id);

-- ============================================================
-- PERSONAL DEL CLUB — Infancia (Reuniones)
-- ============================================================
CREATE TABLE meeting_proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  proposed_by         UUID REFERENCES club_members(id),
  target_id           UUID REFERENCES club_members(id),
  subject             TEXT NOT NULL,
  description         TEXT,
  proposed_dates      TIMESTAMPTZ[],
  confirmed_date      TIMESTAMPTZ,
  status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  related_incident_id UUID REFERENCES session_incidents(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_meeting_proposals_club ON meeting_proposals(club_id);

-- ============================================================
-- PERSONAL DEL CLUB — Dirección (Calendario)
-- ============================================================
CREATE TABLE direction_calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES club_members(id),
  title       TEXT NOT NULL,
  description TEXT,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  location    TEXT,
  attendees   UUID[],
  google_event_id TEXT,
  type        TEXT DEFAULT 'meeting' CHECK (type IN ('meeting', 'trip', 'event', 'other')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dir_calendar_club ON direction_calendar_events(club_id);

-- ============================================================
-- COORDINATOR OBSERVATIONS
-- ============================================================
CREATE TABLE coordinator_observations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  observer_id     UUID NOT NULL REFERENCES club_members(id),
  session_id      UUID REFERENCES sessions(id),
  team_id         UUID REFERENCES teams(id),
  observation_date DATE NOT NULL,
  rating_level    INTEGER CHECK (rating_level BETWEEN 1 AND 5),
  rating_external INTEGER CHECK (rating_external BETWEEN 1 AND 5),
  comment         TEXT,
  coach_rating    INTEGER CHECK (coach_rating BETWEEN 1 AND 5),
  coach_comment   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_coord_obs_club ON coordinator_observations(club_id);

-- Valoraciones individuales de jugadores en observación
CREATE TABLE observation_player_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id  UUID NOT NULL REFERENCES coordinator_observations(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  UNIQUE (observation_id, player_id)
);

-- ============================================================
-- SCOUTING
-- ============================================================
CREATE TABLE scouting_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES sessions(id),
  reported_by UUID REFERENCES club_members(id),
  rival_team  TEXT NOT NULL,
  dorsal      TEXT,
  position    TEXT,
  approx_age  INTEGER,
  comment     TEXT,
  interest_level INTEGER DEFAULT 3 CHECK (interest_level BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_scouting_club ON scouting_reports(club_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID REFERENCES clubs(id),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_log_club ON audit_log(club_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_club_id()
RETURNS UUID AS $$
  SELECT club_id FROM club_members
  WHERE user_id = auth.uid() AND active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_member_id()
RETURNS UUID AS $$
  SELECT id FROM club_members
  WHERE user_id = auth.uid() AND active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_roles()
RETURNS TEXT[] AS $$
  SELECT ARRAY_AGG(cmr.role)
  FROM club_member_roles cmr
  JOIN club_members cm ON cm.id = cmr.member_id
  WHERE cm.user_id = auth.uid() AND cm.active = TRUE;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_role(check_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM club_member_roles cmr
    JOIN club_members cm ON cm.id = cmr.member_id
    WHERE cm.user_id = auth.uid()
      AND cm.active = TRUE
      AND cmr.role = check_role
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fisio_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE direction_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_player_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE scouting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ---- CLUBS ----
CREATE POLICY "members_read_own_club" ON clubs
  FOR SELECT TO authenticated
  USING (id = get_my_club_id());

-- ---- CLUB MEMBERS ----
CREATE POLICY "members_read_same_club" ON club_members
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "admin_manage_members" ON club_members
  FOR ALL TO authenticated
  USING (club_id = get_my_club_id() AND has_role('admin'))
  WITH CHECK (club_id = get_my_club_id() AND has_role('admin'));

-- ---- CLUB MEMBER ROLES ----
CREATE POLICY "members_read_roles" ON club_member_roles
  FOR SELECT TO authenticated
  USING (
    member_id IN (
      SELECT id FROM club_members WHERE club_id = get_my_club_id()
    )
  );

CREATE POLICY "admin_manage_roles" ON club_member_roles
  FOR ALL TO authenticated
  USING (has_role('admin'))
  WITH CHECK (has_role('admin'));

-- ---- PLAYERS ----
-- All authenticated club members can read players (row filtering done at app level for coaches)
CREATE POLICY "club_members_read_players" ON players
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "directors_write_players" ON players
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('coordinador') OR has_role('director_deportivo')
    )
  );

CREATE POLICY "directors_update_players" ON players
  FOR UPDATE TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('coordinador') OR has_role('director_deportivo')
    )
  );

-- ---- TEAMS ----
CREATE POLICY "club_members_read_teams" ON teams
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "admin_manage_teams" ON teams
  FOR ALL TO authenticated
  USING (club_id = get_my_club_id() AND (has_role('admin') OR has_role('direccion')))
  WITH CHECK (club_id = get_my_club_id() AND (has_role('admin') OR has_role('direccion')));

-- ---- SESSIONS ----
CREATE POLICY "club_members_read_sessions" ON sessions
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "coaches_write_sessions" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('coordinador') OR has_role('director_deportivo') OR
      has_role('entrenador')
    )
  );

CREATE POLICY "coaches_update_sessions" ON sessions
  FOR UPDATE TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('coordinador') OR has_role('director_deportivo') OR
      has_role('entrenador')
    )
  );

-- ---- INJURIES ----
CREATE POLICY "read_injuries" ON injuries
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "write_injuries" ON injuries
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('fisio') OR
      has_role('entrenador') OR has_role('coordinador')
    )
  );

-- ---- QUOTA PAYMENTS ----
CREATE POLICY "accounting_read" ON quota_payments
  FOR SELECT TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  );

CREATE POLICY "accounting_write" ON quota_payments
  FOR ALL TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  )
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  );

-- ---- EXERCISES ----
CREATE POLICY "coaches_read_exercises" ON exercises
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "coaches_write_exercises" ON exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('entrenador') OR
      has_role('coordinador') OR has_role('director_deportivo') OR
      has_role('direccion')
    )
  );

-- ---- MEDIA ITEMS ----
CREATE POLICY "club_members_read_media" ON media_items
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "coaches_upload_media" ON media_items
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('coordinador') OR has_role('entrenador') OR
      has_role('redes')
    )
  );

-- ---- SCOUTING ----
CREATE POLICY "scouting_read" ON scouting_reports
  FOR SELECT TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('director_deportivo')
    )
  );

CREATE POLICY "scouting_write" ON scouting_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('entrenador') OR
      has_role('coordinador') OR has_role('director_deportivo') OR
      has_role('direccion')
    )
  );

-- ---- COMMUNICATIONS ----
CREATE POLICY "comm_read" ON communications
  FOR SELECT TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('coordinador') OR has_role('director_deportivo')
    )
  );

CREATE POLICY "comm_write" ON communications
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('coordinador') OR has_role('director_deportivo')
    )
  );

-- ---- COORDINATOR OBSERVATIONS ----
CREATE POLICY "obs_read" ON coordinator_observations
  FOR SELECT TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('director_deportivo') OR
      observer_id = get_my_member_id()
    )
  );

CREATE POLICY "obs_write" ON coordinator_observations
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (
      has_role('coordinador') OR has_role('director_deportivo') OR
      has_role('admin') OR has_role('direccion')
    )
  );

-- ---- CLUB SETTINGS ----
CREATE POLICY "settings_read" ON club_settings
  FOR SELECT TO authenticated
  USING (club_id = get_my_club_id());

CREATE POLICY "settings_write" ON club_settings
  FOR ALL TO authenticated
  USING (club_id = get_my_club_id() AND (has_role('admin') OR has_role('direccion')))
  WITH CHECK (club_id = get_my_club_id() AND (has_role('admin') OR has_role('direccion')));

-- ---- DIRECTION CALENDAR ----
CREATE POLICY "direction_calendar_read" ON direction_calendar_events
  FOR SELECT TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      -- También ve el evento si es asistente
      get_my_member_id() = ANY(attendees)
    )
  );

CREATE POLICY "direction_calendar_write" ON direction_calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  );

-- ---- SESSION INCIDENTS (Infancia puede ver) ----
CREATE POLICY "incidents_read" ON session_incidents
  FOR SELECT TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (
      has_role('admin') OR has_role('direccion') OR
      has_role('director_deportivo') OR has_role('coordinador') OR
      has_role('infancia') OR
      reported_by = get_my_member_id()
    )
  );

-- ============================================================
-- UPDATED_AT trigger para players
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Storage buckets (ejecutar desde Supabase Dashboard o CLI)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('player-photos', 'player-photos', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('club-logos', 'club-logos', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('session-media', 'session-media', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('exercise-canvas', 'exercise-canvas', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);
