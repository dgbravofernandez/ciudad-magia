-- Índices para acelerar queries del dashboard RFFM.
-- Sin estos, la tabla rffm_scouting_signals con miles de filas
-- causa timeout 504 al renderizar /scouting/rffm.

CREATE INDEX IF NOT EXISTS idx_rffm_signals_dashboard
  ON rffm_scouting_signals (club_id, goles_por_partido DESC)
  WHERE estado <> 'descartado';

CREATE INDEX IF NOT EXISTS idx_rffm_signals_club_estado
  ON rffm_scouting_signals (club_id, estado);

CREATE INDEX IF NOT EXISTS idx_rffm_card_alerts_active
  ON rffm_card_alerts (club_id, alerta_activa)
  WHERE alerta_activa = true;

CREATE INDEX IF NOT EXISTS idx_rffm_sync_log_recent
  ON rffm_sync_log (club_id, started_at DESC);
