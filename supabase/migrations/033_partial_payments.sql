-- Migration 033: partial payments for torneos, ropa y actividades

-- ── tournament_attendees ─────────────────────────────────────────────
ALTER TABLE tournament_attendees
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Retroactively mark already-paid attendees as fully paid
UPDATE tournament_attendees
  SET amount_paid = amount_due
  WHERE payment_status = 'paid' AND amount_paid = 0;

-- Extend CHECK constraint to allow 'partial'
ALTER TABLE tournament_attendees
  DROP CONSTRAINT IF EXISTS tournament_attendees_payment_status_check;
ALTER TABLE tournament_attendees
  ADD CONSTRAINT tournament_attendees_payment_status_check
  CHECK (payment_status IN ('pending', 'partial', 'paid', 'cancelled'));

-- ── clothing_orders ──────────────────────────────────────────────────
ALTER TABLE clothing_orders
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Retroactively mark already-paid orders as fully paid
UPDATE clothing_orders
  SET amount_paid = total_amount
  WHERE payment_status = 'paid' AND amount_paid = 0;

-- Extend CHECK constraint to allow 'partial'
ALTER TABLE clothing_orders
  DROP CONSTRAINT IF EXISTS clothing_orders_payment_status_check;
ALTER TABLE clothing_orders
  ADD CONSTRAINT clothing_orders_payment_status_check
  CHECK (payment_status IN ('pending', 'partial', 'paid', 'cancelled'));

-- ── activity_charges ─────────────────────────────────────────────────
ALTER TABLE activity_charges
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Retroactively mark already-paid charges as fully paid
UPDATE activity_charges
  SET amount_paid = amount
  WHERE paid = true AND amount_paid = 0;
