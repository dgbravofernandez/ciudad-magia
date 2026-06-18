-- BILLING-1: Idempotencia de webhooks Stripe
-- Stripe reintenta webhooks si nuestro endpoint no responde 2xx en <30s.
-- Sin esta tabla, un retry duplicaría updates (doble cobro, doble email, etc.)
-- Patrón: INSERT con PRIMARY KEY conflict = ya procesado.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id    TEXT        PRIMARY KEY,
  event_type  TEXT        NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Para limpieza periódica (Stripe solo reintenta hasta 72h; mantenemos 30 días por debug)
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON stripe_webhook_events(processed_at);

COMMENT ON TABLE stripe_webhook_events IS
  'Idempotency log for Stripe webhooks. INSERT con event.id como PK; conflict 23505 = evento ya procesado, devolver 200 sin reprocesar.';
