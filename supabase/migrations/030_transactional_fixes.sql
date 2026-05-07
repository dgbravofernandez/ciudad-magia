-- ──────────────────────────────────────────────────────────────────────
-- Migración 030: Fixes transaccionales críticos
--
-- 1. increment_session_score() — actualización atómica del marcador
--    Previene race condition cuando dos goles llegan simultáneamente
--    (doble tap en móvil, conexión lenta)
--
-- 2. activate_next_season() — activación de temporada en una transacción
--    Previene estado corrupto si el proceso falla a mitad
-- ──────────────────────────────────────────────────────────────────────

-- 1. Incremento atómico de marcador
CREATE OR REPLACE FUNCTION increment_session_score(
  p_session_id UUID,
  p_team     TEXT  -- 'home' | 'away'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_team = 'home' THEN
    UPDATE sessions
    SET score_home = COALESCE(score_home, 0) + 1
    WHERE id = p_session_id;
  ELSIF p_team = 'away' THEN
    UPDATE sessions
    SET score_away = COALESCE(score_away, 0) + 1
    WHERE id = p_session_id;
  ELSE
    RAISE EXCEPTION 'p_team debe ser ''home'' o ''away'', recibido: %', p_team;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_session_score(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_session_score(UUID, TEXT) TO service_role;


-- 2. Activación transaccional de temporada
CREATE OR REPLACE FUNCTION activate_next_season(
  p_club_id     UUID,
  p_next_season TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_count   INT;
  v_players_updated INT := 0;
  v_low_players  INT := 0;
  v_teams_activated INT := 0;
  v_current_season TEXT;
BEGIN
  -- 1. Obtener temporada actual
  SELECT current_season INTO v_current_season
  FROM club_settings
  WHERE club_id = p_club_id;

  -- 2. Validar que existen equipos borrador para la próxima temporada
  SELECT COUNT(*) INTO v_team_count
  FROM teams
  WHERE club_id = p_club_id
    AND season  = p_next_season
    AND active  = false;

  IF v_team_count = 0 THEN
    RAISE EXCEPTION 'No hay equipos planificados para la temporada %. Crea equipos primero.', p_next_season;
  END IF;

  -- 3. Jugadores con wants_to_continue=false → baja
  UPDATE players
  SET status       = 'low',
      team_id      = NULL,
      next_team_id = NULL
  WHERE club_id          = p_club_id
    AND status           = 'active'
    AND wants_to_continue = false;

  GET DIAGNOSTICS v_low_players = ROW_COUNT;

  -- 4. Migrar team_id ← next_team_id en jugadores activos
  UPDATE players
  SET team_id              = next_team_id,
      next_team_id         = NULL,
      wants_to_continue    = NULL,
      meets_requirements   = NULL,
      made_reservation     = NULL
  WHERE club_id      = p_club_id
    AND status       = 'active'
    AND next_team_id IS NOT NULL;

  GET DIAGNOSTICS v_players_updated = ROW_COUNT;

  -- 5. Activar equipos de la nueva temporada
  UPDATE teams
  SET active = true
  WHERE club_id = p_club_id
    AND season  = p_next_season;

  GET DIAGNOSTICS v_teams_activated = ROW_COUNT;

  -- 6. Desactivar equipos de la temporada anterior
  UPDATE teams
  SET active = false
  WHERE club_id = p_club_id
    AND season  = v_current_season;

  -- 7. Limpiar asignaciones de cuerpo técnico de la temporada anterior
  --    (las de la nueva temporada ya están creadas durante la planificación)
  DELETE FROM club_member_roles
  WHERE member_id IN (
    SELECT id FROM club_members WHERE club_id = p_club_id
  )
    AND team_id IN (
      SELECT id FROM teams
      WHERE club_id = p_club_id
        AND season  = v_current_season
    );

  -- 8. Actualizar current_season en club_settings
  UPDATE club_settings
  SET current_season = p_next_season
  WHERE club_id = p_club_id;

  -- Si llegamos aquí, todo fue bien — COMMIT implícito
  RETURN jsonb_build_object(
    'success', true,
    'nextSeason', p_next_season,
    'playersUpdated', v_players_updated,
    'lowPlayers', v_low_players,
    'teamsActivated', v_teams_activated
  );

EXCEPTION WHEN OTHERS THEN
  -- ROLLBACK automático — ninguna operación parcial queda guardada
  RAISE; -- propaga el error al cliente
END;
$$;

GRANT EXECUTE ON FUNCTION activate_next_season(UUID, TEXT) TO service_role;
-- Nota: NO se da acceso a authenticated — solo se llama desde server actions con service role
