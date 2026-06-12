-- Marketing outbound: clubes prospectos + tracking de envíos
-- Para campaña de captación Cluberly (628 clubes RFFM + otras federaciones)

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  location TEXT,
  federation TEXT,
  website TEXT,
  phone TEXT,
  -- Estado del lead
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'sent_1', 'sent_2', 'sent_3', 'replied', 'demo_booked', 'customer', 'unsubscribed', 'bounced', 'paused')),
  -- Tracking agregado (los detalles van en marketing_email_sends)
  last_sent_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  reply_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_clubs_status_idx ON public.marketing_clubs(status);
CREATE INDEX IF NOT EXISTS marketing_clubs_last_sent_idx ON public.marketing_clubs(last_sent_at);

-- Tracking individual de cada email enviado
CREATE TABLE IF NOT EXISTS public.marketing_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.marketing_clubs(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,    -- email_1, email_2, follow_up...
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced BOOLEAN DEFAULT false,
  error TEXT
);

CREATE INDEX IF NOT EXISTS marketing_email_sends_club_idx ON public.marketing_email_sends(club_id);
CREATE INDEX IF NOT EXISTS marketing_email_sends_sent_idx ON public.marketing_email_sends(sent_at DESC);

-- Plantillas editables desde el panel
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  key TEXT PRIMARY KEY,           -- email_1, email_2, follow_up_a, etc
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,        -- soporta {{club_name}}, {{location}}, {{federation}}, {{unsubscribe_url}}
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Settings de campaña (pause global, daily cap, etc)
CREATE TABLE IF NOT EXISTS public.marketing_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_send_cap INT NOT NULL DEFAULT 50,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  from_email TEXT NOT NULL DEFAULT 'dgbravofernandez@gmail.com',
  from_name TEXT NOT NULL DEFAULT 'Diego Bravo · Cluberly',
  reply_to TEXT,
  signature_html TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.marketing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
