-- 037_cluberly_saas.sql
-- Add Cluberly SaaS billing fields + RFFM flag

-- ── Stripe billing on clubs ──────────────────────────────────────────────────
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at            TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');

-- ── RFFM flag: solo activar para EF Ciudad de Getafe ────────────────────────
ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS rffm_enabled BOOLEAN DEFAULT FALSE;

-- Activar RFFM para EF Ciudad de Getafe (se identifica por su slug)
UPDATE club_settings
SET rffm_enabled = TRUE
WHERE club_id = (SELECT id FROM clubs WHERE slug = 'ef-ciudad-de-getafe' LIMIT 1);

-- ── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clubs_stripe_customer ON clubs(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_clubs_subscription_status ON clubs(subscription_status);
