-- 036: Forzar cambio de contraseña en el primer inicio de sesión
--
-- Cuando un admin crea una cuenta (o resetea la contraseña), se marca
-- must_change_password=true. El layout (app) redirige a /cambiar-password
-- hasta que el usuario establezca su propia contraseña.

ALTER TABLE club_members
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
