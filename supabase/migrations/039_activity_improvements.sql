-- 039: Mejoras a actividades
--
-- 1. Email de participante externo en activity_charges → enviar justificante por email
-- 2. Método de pago + estado pagado en activity_expenses → integración con caja

-- ── 1. Email participante externo ──────────────────────────────────────────────
ALTER TABLE activity_charges
  ADD COLUMN IF NOT EXISTS participant_email TEXT;

-- ── 2. Enriquecimiento de gastos de actividades ────────────────────────────────
ALTER TABLE activity_expenses
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash', 'card', 'transfer')),
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at DATE;
