-- 066: Stripe Connect Express — cobros de cuotas con application fee opt-in.
-- Aplicar a mano en el SQL Editor de Supabase. Idempotente.
--
-- Modelo: el club crea su propia cuenta Stripe Express (KYC + cuenta bancaria
-- gestionados por Stripe). La plataforma (Cluberly) inicia Checkout Sessions
-- contra esa cuenta usando `transfer_data.destination` + `application_fee_amount`
-- = 50 céntimos + 0,5 % del importe. El neto va al club; el fee a Cluberly.
--
-- Opcional por club: TODOS los clubes nacen con `stripe_cobros_enabled = false`.
-- El admin lo activa explícitamente en /configuracion/cobros (opt-in real, no
-- default-on). Getafe queda fuera salvo que tú lo actives manualmente.

-- ─── 1. Estado del Connected Account a nivel de CLUB ──────────────────────────
alter table club_settings add column if not exists stripe_account_id text;
alter table club_settings add column if not exists stripe_account_status text;
-- valores: NULL | 'pending' | 'active' | 'restricted' | 'rejected'
-- pending     = cuenta creada en Stripe pero onboarding sin terminar
-- active      = charges_enabled=true AND payouts_enabled=true
-- restricted  = Stripe pidió info adicional (KYC incompleto, doc pendiente, etc.)
-- rejected    = Stripe rechazó la cuenta (raro; KYC fallido grave)
alter table club_settings add column if not exists stripe_cobros_enabled boolean not null default false;
alter table club_settings add column if not exists stripe_onboarding_started_at timestamptz;
alter table club_settings add column if not exists stripe_onboarding_completed_at timestamptz;

-- Búsqueda rápida por account_id (al recibir webhooks account.updated)
create unique index if not exists club_settings_stripe_account_id_uniq
  on club_settings (stripe_account_id)
  where stripe_account_id is not null;

-- ─── 2. Cuotas con link de pago Stripe ────────────────────────────────────────
alter table quota_payments add column if not exists stripe_payment_intent_id text;
alter table quota_payments add column if not exists stripe_checkout_session_id text;
alter table quota_payments add column if not exists stripe_application_fee_amount integer;   -- céntimos cobrados por Cluberly
alter table quota_payments add column if not exists payment_link_url text;
alter table quota_payments add column if not exists payment_link_expires_at timestamptz;
alter table quota_payments add column if not exists payment_link_sent_at timestamptz;        -- cuándo se mandó email a la familia

-- Idempotencia de webhook: dos eventos checkout.session.completed con el mismo
-- payment_intent_id NO pueden duplicar el pago (cuota a "paid" dos veces).
create unique index if not exists quota_payments_stripe_payment_intent_id_uniq
  on quota_payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create unique index if not exists quota_payments_stripe_checkout_session_id_uniq
  on quota_payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- ─── 3. Tabla de application fees cobrados (para reporting Hacienda) ──────────
-- Cada cobro pagado registra una fila aquí con el fee neto que recibió Cluberly.
-- Es la fuente de verdad para facturar a clubes / declarar IVA / cuadrar caja.
create table if not exists stripe_application_fees (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  quota_payment_id uuid references quota_payments(id) on delete set null,
  stripe_account_id text not null,            -- account del club (redundante por trazabilidad)
  stripe_payment_intent_id text not null,
  amount_cents integer not null,              -- fee NETO recibido por Cluberly (céntimos)
  currency text not null default 'eur',
  gross_amount_cents integer not null,        -- importe total cobrado a la familia (para auditoría)
  refunded boolean not null default false,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists stripe_application_fees_club_id_idx on stripe_application_fees (club_id);
create index if not exists stripe_application_fees_created_at_idx on stripe_application_fees (created_at);
-- Idempotencia: un solo fee row por intent
create unique index if not exists stripe_application_fees_payment_intent_id_uniq
  on stripe_application_fees (stripe_payment_intent_id);

-- ─── 4. Eventos Stripe procesados (idempotencia at-least-once de Vercel) ─────
-- Vercel garantiza at-least-once en webhooks, no exactly-once. Guardamos cada
-- event.id procesado y lo ignoramos si ya estaba. Patrón idéntico al de Stripe
-- subscriptions (migración 050).
create table if not exists stripe_connect_webhook_events (
  id text primary key,                         -- evt_xxx (id de Stripe)
  type text not null,
  account_id text,                             -- a quién pertenece (puede ser null para platform events)
  received_at timestamptz not null default now()
);
create index if not exists stripe_connect_webhook_events_received_at_idx
  on stripe_connect_webhook_events (received_at);
