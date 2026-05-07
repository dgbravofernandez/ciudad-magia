-- Migración 029: Panel superadmin de plataforma
-- Tabla para administradores con acceso cross-club.
-- Estos usuarios pueden ver e impersonar cualquier club.
-- Aplicar manualmente en el SQL Editor de Supabase.

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar el primer superadmin (owner de la plataforma)
-- Busca el user_id por email y lo inserta si existe en auth.users
INSERT INTO platform_admins (user_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'dgbravofernandez@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

-- Añadir columna a clubs para guardar metadata útil para el superadmin
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS notes TEXT;          -- notas internas del superadmin sobre el club

-- Tabla para impersonaciones activas (sesiones de superadmin en un club)
-- TTL: 8 horas. El middleware las valida al leer el club_id.
CREATE TABLE IF NOT EXISTS superadmin_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '8 hours'),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Limpiar sesiones expiradas automáticamente (ejecutar periódicamente o en middleware)
CREATE OR REPLACE FUNCTION cleanup_expired_superadmin_sessions()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM superadmin_sessions WHERE expires_at < now();
$$;
