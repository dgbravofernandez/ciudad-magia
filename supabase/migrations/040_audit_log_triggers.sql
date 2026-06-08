-- ============================================================
-- 040_audit_log_triggers.sql
-- Activa auditoría automática sobre la tabla players:
--   - Cambios de equipo (team_id, next_team_id)
--   - Cambios de estado (status, wants_to_continue, made_reservation)
--   - Eliminaciones (baja definitiva)
-- Funciona para TODOS los clubs (multi-tenant por club_id del registro).
-- user_id se captura vía auth.uid() cuando hay sesión JWT;
-- será NULL con service-role (acciones de servidor/cron).
-- ============================================================

-- ── Función de auditoría de players ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_players_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id  UUID;
  v_record_id UUID;
  v_old      JSONB;
  v_new      JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_club_id   := NEW.club_id;
    v_record_id := NEW.id;
    v_old       := NULL;
    v_new       := to_jsonb(NEW);

  ELSIF TG_OP = 'UPDATE' THEN
    -- Solo auditar si cambió algún campo relevante
    IF  OLD.next_team_id         IS NOT DISTINCT FROM NEW.next_team_id
    AND OLD.team_id              IS NOT DISTINCT FROM NEW.team_id
    AND OLD.status               IS NOT DISTINCT FROM NEW.status
    AND OLD.wants_to_continue    IS NOT DISTINCT FROM NEW.wants_to_continue
    AND OLD.made_reservation     IS NOT DISTINCT FROM NEW.made_reservation
    AND OLD.email_team_assignment_sent IS NOT DISTINCT FROM NEW.email_team_assignment_sent
    THEN
      RETURN NEW;  -- nada relevante cambió, no guardar
    END IF;
    v_club_id   := NEW.club_id;
    v_record_id := NEW.id;
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);

  ELSIF TG_OP = 'DELETE' THEN
    v_club_id   := OLD.club_id;
    v_record_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
  END IF;

  INSERT INTO audit_log (
    club_id, user_id, action, table_name, record_id, old_data, new_data
  ) VALUES (
    v_club_id,
    auth.uid(),   -- NULL con service-role, UUID con sesión JWT activa
    TG_OP,        -- 'INSERT' | 'UPDATE' | 'DELETE'
    TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── Trigger en players ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_players ON players;

CREATE TRIGGER audit_players
  AFTER INSERT OR UPDATE OR DELETE
  ON players
  FOR EACH ROW
  EXECUTE FUNCTION audit_players_changes();

-- ── Índices para consultas rápidas ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_club_table
  ON audit_log (club_id, table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_record
  ON audit_log (record_id, created_at DESC);

-- ── Vista útil: cambios de equipo de jugadores ────────────────────────────────
CREATE OR REPLACE VIEW v_player_team_changes AS
SELECT
  al.created_at,
  al.club_id,
  al.record_id                          AS player_id,
  (al.old_data->>'first_name') || ' ' || (al.old_data->>'last_name') AS nombre,
  al.old_data->>'next_team_id'          AS equipo_anterior_id,
  al.new_data->>'next_team_id'          AS equipo_nuevo_id,
  al.old_data->>'status'                AS estado_anterior,
  al.new_data->>'status'                AS estado_nuevo,
  al.action,
  al.user_id
FROM audit_log al
WHERE al.table_name = 'players'
  AND al.action = 'UPDATE'
  AND (
    al.old_data->>'next_team_id' IS DISTINCT FROM al.new_data->>'next_team_id'
    OR al.old_data->>'status'    IS DISTINCT FROM al.new_data->>'status'
  )
ORDER BY al.created_at DESC;
