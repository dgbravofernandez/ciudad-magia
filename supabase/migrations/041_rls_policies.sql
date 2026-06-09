-- ─────────────────────────────────────────────────────────────────────────────
-- 041_rls_policies.sql
-- RLS policies de defensa en profundidad para las tablas críticas.
--
-- NOTAS DE ARQUITECTURA:
--   • El service_role bypasa RLS por diseño de Supabase — estas políticas
--     protegen contra acceso anónimo/autenticado sin service_role.
--   • Para aislamiento total en producción multi-tenant, combinar con
--     FORCE ROW LEVEL SECURITY (ver abajo, comentado — aplicar en fase pre-SaaS).
--   • La fuente de verdad del club_id en runtime son los headers del middleware
--     (x-club-id), leídos por getClubContext().
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilitar RLS en tablas clave (si no estaba habilitado)
ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members      ENABLE ROW LEVEL SECURITY;

-- ── players ──────────────────────────────────────────────────────────────────
-- Solo usuarios autenticados que pertenezcan al mismo club pueden leer jugadores.
DROP POLICY IF EXISTS "players_club_isolation" ON players;
CREATE POLICY "players_club_isolation" ON players
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR club_id IN (
      SELECT cm.club_id
      FROM club_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- ── quota_payments ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "quota_payments_club_isolation" ON quota_payments;
CREATE POLICY "quota_payments_club_isolation" ON quota_payments
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR club_id IN (
      SELECT cm.club_id
      FROM club_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- ── cash_movements ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cash_movements_club_isolation" ON cash_movements;
CREATE POLICY "cash_movements_club_isolation" ON cash_movements
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR club_id IN (
      SELECT cm.club_id
      FROM club_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- ── cash_closes ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "cash_closes_club_isolation" ON cash_closes;
CREATE POLICY "cash_closes_club_isolation" ON cash_closes
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR club_id IN (
      SELECT cm.club_id
      FROM club_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- ── club_members ──────────────────────────────────────────────────────────────
-- Un miembro solo puede ver su propio club o al service_role.
DROP POLICY IF EXISTS "club_members_self_isolation" ON club_members;
CREATE POLICY "club_members_self_isolation" ON club_members
  FOR ALL
  USING (
    auth.role() = 'service_role'
    OR user_id = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PRE-SAAS TODO: Para enforcement total (incluyendo service_role), ejecutar:
--
--   ALTER TABLE players        FORCE ROW LEVEL SECURITY;
--   ALTER TABLE quota_payments FORCE ROW LEVEL SECURITY;
--   ALTER TABLE cash_movements FORCE ROW LEVEL SECURITY;
--   ALTER TABLE cash_closes    FORCE ROW LEVEL SECURITY;
--
-- Esto requiere que el service_role también tenga una política válida o usar
-- un rol dedicado por tenant. No hacer hasta migrar la capa de datos a RLS nativo.
-- ─────────────────────────────────────────────────────────────────────────────
