-- =============================================================
-- 020_activities.sql
-- Actividades/servicios externos (campus, tecnificación, otros).
-- Cobros e ingresos separados de las cuotas regulares, pero
-- visibles en cierre de caja.
-- =============================================================

CREATE TABLE IF NOT EXISTS activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('campus', 'tecnificacion', 'otro')),
  description TEXT,
  season      TEXT,
  start_date  DATE,
  end_date    DATE,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_club ON activities(club_id);
CREATE INDEX IF NOT EXISTS idx_activities_season ON activities(season);

CREATE TABLE IF NOT EXISTS activity_charges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  activity_id       UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  player_id         UUID REFERENCES players(id) ON DELETE SET NULL,
  participant_name  TEXT,
  concept           TEXT,
  amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid              BOOLEAN DEFAULT FALSE,
  payment_method    TEXT CHECK (payment_method IN ('transfer', 'cash', 'card')),
  payment_date      DATE,
  notes             TEXT,
  registered_by     UUID REFERENCES club_members(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_charges_activity ON activity_charges(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_charges_club_date ON activity_charges(club_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_activity_charges_paid ON activity_charges(paid);

CREATE TABLE IF NOT EXISTS activity_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  activity_id  UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  concept      TEXT NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  category     TEXT,
  receipt_url  TEXT,
  expense_date DATE NOT NULL,
  notes        TEXT,
  registered_by UUID REFERENCES club_members(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_expenses_activity ON activity_expenses(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_expenses_club_date ON activity_expenses(club_id, expense_date);

-- RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS act_select ON activities;
CREATE POLICY act_select ON activities FOR SELECT
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS act_write ON activities;
CREATE POLICY act_write ON activities FOR ALL
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()))
  WITH CHECK (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ac_select ON activity_charges;
CREATE POLICY ac_select ON activity_charges FOR SELECT
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS ac_write ON activity_charges;
CREATE POLICY ac_write ON activity_charges FOR ALL
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()))
  WITH CHECK (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ae_select ON activity_expenses;
CREATE POLICY ae_select ON activity_expenses FOR SELECT
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS ae_write ON activity_expenses;
CREATE POLICY ae_write ON activity_expenses FOR ALL
  USING (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()))
  WITH CHECK (club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid()));
