-- Add document URL fields and license type to players
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS license_type       TEXT,
  ADD COLUMN IF NOT EXISTS spanish_nationality BOOLEAN,
  ADD COLUMN IF NOT EXISTS dni_front_url       TEXT,
  ADD COLUMN IF NOT EXISTS dni_back_url        TEXT,
  ADD COLUMN IF NOT EXISTS birth_cert_url      TEXT,
  ADD COLUMN IF NOT EXISTS residency_cert_url  TEXT,
  ADD COLUMN IF NOT EXISTS passport_url        TEXT,
  ADD COLUMN IF NOT EXISTS nie_url             TEXT;
