-- 046: Tracking de adquisición (UTM) + teléfono de contacto + emails de trial
-- Soporta la campaña de captación RFFM: atribución por club y ciclo de emails automáticos.

-- 1. Atribución de adquisición y teléfono en clubs
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS acquisition_source   TEXT,   -- utm_source  (ej: email)
  ADD COLUMN IF NOT EXISTS acquisition_campaign TEXT,   -- utm_campaign (ej: rffm-jun26)
  ADD COLUMN IF NOT EXISTS acquisition_content  TEXT,   -- utm_content (ej: nombre del club destinatario)
  ADD COLUMN IF NOT EXISTS contact_phone        TEXT;   -- teléfono del responsable (rescate de churn)

-- 2. Registro de emails del ciclo de trial (idempotencia: 1 email de cada tipo por club)
CREATE TABLE IF NOT EXISTS trial_emails (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL,            -- 'welcome' | 'import_help' | 'trial_ending'
  sent_to    TEXT NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, email_type)
);

CREATE INDEX IF NOT EXISTS idx_trial_emails_club ON trial_emails(club_id);

-- RLS: tabla interna del sistema (solo service role escribe/lee)
ALTER TABLE trial_emails ENABLE ROW LEVEL SECURITY;
